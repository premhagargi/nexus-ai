"""Port of the 8 agent tools from app/api/chat/route.ts's executeTool().

Each tool call is wrapped with agent_tool_invocations_total /
agent_tool_duration_seconds metrics and a ToolExecution audit row, mirroring
what the Next.js handler already logged to Postgres — this is the "tool
observability" half of the agentic workflow story.
"""
import json
import re
import time
import uuid
from collections.abc import Awaitable, Callable
from typing import Any

import asyncpg
import httpx

from app.agent.sandbox import run_sandboxed
from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.time import now_naive_utc
from app.observability.metrics import agent_tool_duration_seconds, agent_tool_invocations_total
from app.observability.tracing import span
from app.services import rag_service
from app.services.llm_client import get_cerebras_client, record_llm_usage

logger = get_logger(__name__)

CEREBRAS_MODEL = "gpt-oss-120b"

CEREBRAS_TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "save_task",
            "description": (
                "Creates a task in the current workspace. DYNAMIC REQUIREMENT: Only call this tool if the user "
                'provided a SPECIFIC task action item, title, or details (e.g. "create a task to review the Q3 '
                'budget", "add task: fix auth bug"). DO NOT call this tool if the user is asking to create/add/make '
                'a task without providing the task topic (e.g. "can you create a task for me?", "add a task '
                'please", "i want to make a task"). In those vague cases, respond directly in text asking what '
                "task to create. The title MUST describe actual work to be done, never a meta-request."
            ),
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {
                        "type": "string",
                        "description": (
                            'The specific, clean, action-oriented title of the task describing actual work to be '
                            'done (e.g. "Review Q3 budget", "Fix auth rate limit bug"). Never use generic '
                            'meta-placeholders like "Create a new task".'
                        ),
                    },
                    "description": {"type": "string", "description": "A short optional description with more context about the task."},
                },
                "required": ["title"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "summarize_workspace",
            "description": "Reads all uploaded documents and returns an AI-generated summary of the workspace content. Can optionally send the summary to Slack.",
            "parameters": {
                "type": "object",
                "properties": {
                    "sendToSlack": {"type": "boolean", "description": "Set to true if the user asks to send the summary to Slack or the ai-tools channel."}
                },
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "search_documents",
            "description": "Performs a targeted semantic vector & keyword search across workspace documents for a specific topic, keyword, or sentence.",
            "parameters": {
                "type": "object",
                "properties": {"query": {"type": "string", "description": "The search query or keyword phrase to locate in workspace documents."}},
                "required": ["query"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_note",
            "description": "Saves a persistent note or memo to the workspace for key decisions, meeting notes, or takeaways.",
            "parameters": {
                "type": "object",
                "properties": {
                    "title": {"type": "string", "description": "Title of the note or memo."},
                    "content": {"type": "string", "description": "Main markdown body of the note."},
                },
                "required": ["title", "content"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "generate_report",
            "description": "Synthesizes uploaded workspace documents into a structured executive report with sections, executive summary, and key findings.",
            "parameters": {
                "type": "object",
                "properties": {"topic": {"type": "string", "description": 'Topic or focus area for the report (e.g. "Q3 Revenue & Expenses", "Technical Architecture Overview").'}},
                "required": ["topic"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "compare_documents",
            "description": "Compares two workspace documents side-by-side and highlights key similarities, differences, and contrasting claims.",
            "parameters": {
                "type": "object",
                "properties": {
                    "docNameA": {"type": "string", "description": "Filename or title of the first document."},
                    "docNameB": {"type": "string", "description": "Filename or title of the second document."},
                },
                "required": ["docNameA", "docNameB"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "extract_data",
            "description": "Extracts structured data (tables, key metrics, dates, prices) from workspace documents.",
            "parameters": {
                "type": "object",
                "properties": {"fields": {"type": "string", "description": 'Comma-separated list of fields or data points to extract (e.g. "dates, amounts, vendor names").'}},
                "required": ["fields"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "run_code_sandbox",
            "description": "Executes Python code in a secure sandboxed environment to perform mathematical calculations, data transformations, statistical analysis, or array processing.",
            "parameters": {
                "type": "object",
                "properties": {
                    "code": {"type": "string", "description": "Python code expression or statements to evaluate. Assign the final answer to a variable named `result` if using statements."},
                    "purpose": {"type": "string", "description": "Description of what calculation or data processing is being performed."},
                },
                "required": ["code"],
            },
        },
    },
]

TOOL_BADGES = {
    "save_task": "Saving Task...",
    "summarize_workspace": "Summarizing Workspace...",
    "search_documents": "Searching Documents...",
    "create_note": "Creating Note...",
    "generate_report": "Generating Report...",
    "compare_documents": "Comparing Documents...",
    "extract_data": "Extracting Data...",
    "run_code_sandbox": "Executing Code Sandbox...",
}

_META_WORDS = {
    "can", "you", "could", "would", "please", "create", "add", "make", "setup", "set", "up",
    "new", "a", "an", "the", "task", "tasks", "for", "me", "my", "i", "want", "need",
    "to", "on", "board", "list", "item", "something", "anything", "like", "how", "user",
    "requested", "creation", "without", "further", "details", "untitled", "put", "this",
    "in", "here", "there", "just", "some", "action",
}


def is_generic_task_title(title: str) -> bool:
    if not title or not isinstance(title, str):
        return True
    cleaned = re.sub(r"[^a-z0-9\s]", " ", title.lower()).strip()
    if not cleaned:
        return True
    words = [w for w in cleaned.split() if w]
    content_words = [w for w in words if w not in _META_WORDS]
    return len(content_words) == 0


async def send_to_slack_webhook(summary: str) -> None:
    settings = get_settings()
    if not settings.slack_webhook_url:
        logger.warning("slack.webhook_not_configured")
        return
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.post(
                settings.slack_webhook_url,
                json={"text": f"*Workspace Summary*\n\n{summary}"},
            )
            if resp.status_code >= 400:
                logger.error("slack.send_failed", status=resp.status_code, body=resp.text[:200])
    except Exception as error:  # noqa: BLE001 - best-effort notification, never fatal
        logger.error("slack.network_error", error=str(error))


async def _log_tool_execution(
    pool: asyncpg.Pool, workspace_id: str, tool_name: str, arguments: dict, result: dict
) -> None:
    await pool.execute(
        'INSERT INTO "ToolExecution" (id, "workspaceId", "toolName", arguments, result, "createdAt") '
        "VALUES ($1, $2, $3, $4, $5, $6)",
        str(uuid.uuid4()),
        workspace_id,
        tool_name,
        arguments,
        result,
        now_naive_utc(),
    )


OnToken = Callable[[str], Awaitable[None]]


async def execute_tool(
    name: str,
    args: dict[str, Any],
    workspace_id: str,
    pool: asyncpg.Pool,
    google_api_key: str,
    on_token: OnToken | None = None,
) -> tuple[str, list[rag_service.RetrievedChunk] | None]:
    start = time.perf_counter()
    status = "success"
    with span("agent.tool_invocation", **{"tool.name": name, "workspace_id": workspace_id}):
        try:
            result = await _dispatch_tool(name, args, workspace_id, pool, google_api_key, on_token)
            return result
        except Exception:
            status = "error"
            raise
        finally:
            duration = time.perf_counter() - start
            agent_tool_invocations_total.labels(tool_name=name, status=status).inc()
            agent_tool_duration_seconds.labels(tool_name=name).observe(duration)


async def _dispatch_tool(
    name: str,
    args: dict[str, Any],
    workspace_id: str,
    pool: asyncpg.Pool,
    google_api_key: str,
    on_token: OnToken | None,
) -> tuple[str, list[rag_service.RetrievedChunk] | None]:
    if name == "save_task":
        raw_title = args.get("title") or args.get("task") or args.get("name") or ""
        title = str(raw_title).strip()
        description = str(args["description"]).strip() if args.get("description") else None

        if is_generic_task_title(title):
            logger.warning("agent.tool.save_task.rejected_generic_title", title=title)
            return (
                "Task creation was not completed because no specific task title or topic was provided. "
                'Please ask the user: "What specific task would you like me to create? Please provide a title or topic."'
            ), None

        task_id = str(uuid.uuid4())
        now = now_naive_utc()
        await pool.execute(
            'INSERT INTO "Task" (id, "workspaceId", title, description, completed, "createdAt", "updatedAt") '
            "VALUES ($1, $2, $3, $4, false, $5, $5)",
            task_id, workspace_id, title, description, now,
        )
        await _log_tool_execution(
            pool, workspace_id, "save_task", args, {"taskId": task_id, "status": "success", "title": title}
        )
        return f'Task "{title}" created successfully.', None

    if name == "search_documents":
        query = args.get("query", "")
        retrieval = await rag_service.retrieve_workspace_context(pool, workspace_id, query, google_api_key)
        await _log_tool_execution(
            pool, workspace_id, "search_documents", args,
            {"matchCount": len(retrieval.chunks), "confidence": retrieval.confidence},
        )
        if not retrieval.chunks:
            return f'No relevant document passages found for query "{query}".', None
        return (
            f"Found {len(retrieval.chunks)} passage(s) with confidence {retrieval.confidence * 100:.0f}%:\n\n{retrieval.context}",
            retrieval.chunks,
        )

    if name == "create_note":
        title = args.get("title", "Untitled Note")
        content = args.get("content", "")
        note_id = str(uuid.uuid4())
        now = now_naive_utc()
        await pool.execute(
            'INSERT INTO "Task" (id, "workspaceId", title, description, completed, "createdAt", "updatedAt") '
            "VALUES ($1, $2, $3, $4, false, $5, $5)",
            note_id, workspace_id, f"[NOTE] {title}", content[:300], now,
        )
        await _log_tool_execution(pool, workspace_id, "create_note", args, {"noteId": note_id, "title": title})
        return f'Note "{title}" saved successfully.', None

    if name == "generate_report":
        topic = args.get("topic", "Workspace Analysis")
        rows = await pool.fetch('SELECT filename FROM "Document" WHERE "workspaceId" = $1 AND status = $2', workspace_id, "COMPLETED")
        await _log_tool_execution(pool, workspace_id, "generate_report", args, {"topic": topic, "documentCount": len(rows)})
        return f'Report outline prepared for "{topic}" across {len(rows)} workspace document(s).', None

    if name == "compare_documents":
        doc_a = args.get("docNameA", "Document A")
        doc_b = args.get("docNameB", "Document B")
        await _log_tool_execution(pool, workspace_id, "compare_documents", args, {"docA": doc_a, "docB": doc_b})
        return f'Comparison initiated between "{doc_a}" and "{doc_b}".', None

    if name == "extract_data":
        fields = args.get("fields", "key metrics, dates, amounts")
        await _log_tool_execution(pool, workspace_id, "extract_data", args, {"fields": fields})
        return f"Structured data extraction completed for fields: {fields}.", None

    if name == "run_code_sandbox":
        code = args.get("code", "")
        purpose = args.get("purpose", "Data analysis & evaluation")
        result, is_error = run_sandboxed(code)
        output_string = json.dumps(result, indent=2) if isinstance(result, (dict, list)) else str(result)
        await _log_tool_execution(
            pool, workspace_id, "run_code_sandbox", args, {"purpose": purpose, "output": output_string, "isError": is_error}
        )
        return f"Sandbox Execution ({purpose}):\n```json\n{output_string}\n```", None

    if name == "summarize_workspace":
        return await _summarize_workspace(args, workspace_id, pool, on_token)

    return f"Unknown tool: {name}", None


async def _summarize_workspace(
    args: dict[str, Any], workspace_id: str, pool: asyncpg.Pool, on_token: OnToken | None
) -> tuple[str, list[rag_service.RetrievedChunk] | None]:
    documents = await pool.fetch(
        'SELECT id, filename FROM "Document" WHERE "workspaceId" = $1 AND status = $2 ORDER BY "createdAt" ASC',
        workspace_id, "COMPLETED",
    )
    if not documents:
        return "No completed documents found in workspace to summarize.", None

    total_char_budget = 20000
    per_doc_char_budget = max(1500, total_char_budget // len(documents))

    doc_summaries: list[dict[str, str]] = []
    grounding_chunks: list[rag_service.RetrievedChunk] = []
    total_sampled_chars = 0

    for doc in documents:
        chunks = await pool.fetch(
            'SELECT content FROM "DocumentChunk" WHERE "documentId" = $1 ORDER BY "createdAt" ASC', doc["id"]
        )
        if not chunks:
            continue

        total_doc_chars = sum(len(c["content"]) for c in chunks)
        if total_doc_chars <= per_doc_char_budget:
            doc_text = "\n\n".join(c["content"] for c in chunks)
        else:
            num_chunks_to_pick = max(2, per_doc_char_budget // 900)
            step = max(1, len(chunks) // num_chunks_to_pick)
            selected: list[str] = []
            current_len = 0
            i = 0
            while i < len(chunks) and len(selected) < num_chunks_to_pick:
                chunk_text = chunks[i]["content"]
                if current_len + len(chunk_text) > per_doc_char_budget:
                    selected.append(chunk_text[: per_doc_char_budget - current_len])
                    break
                selected.append(chunk_text)
                current_len += len(chunk_text)
                i += step
            doc_text = "\n\n[...]\n\n".join(selected)

        doc_summaries.append({"name": doc["filename"], "content": doc_text})
        total_sampled_chars += len(doc_text)
        # The verifier checks the generated summary against exactly the text
        # actually shown to the LLM, not a fresh unrelated retrieval - this
        # is what fixed the "8% grounded" false-negative on workspace summaries.
        grounding_chunks.append(
            rag_service.RetrievedChunk(
                id=f"summarize:{doc['id']}",
                document_id=doc["id"],
                content=doc_text,
                metadata={"sourceTitle": rag_service.build_source_title(doc["filename"]), "filename": doc["filename"]},
                distance=0.0,
            )
        )

    if not doc_summaries:
        return "No document text content found to summarize.", None

    doc_names_index = "\n".join(f'{i + 1}. "{d["name"]}"' for i, d in enumerate(doc_summaries))
    formatted_docs = "\n\n----------------------------------------\n\n".join(
        f'=== DOCUMENT {i + 1} OF {len(doc_summaries)}: "{d["name"]}" ===\n{d["content"]}'
        for i, d in enumerate(doc_summaries)
    )

    prompt = f"""You are an expert AI knowledge base summarizer analyzing EXACTLY {len(doc_summaries)} documents.

LIST OF ALL DOCUMENTS TO BE SUMMARIZED:
{doc_names_index}

CRITICAL RULES:
1. You MUST write a distinct, dedicated subsection for EVERY SINGLE DOCUMENT listed above under "Document Breakdown".
2. DO NOT SKIP OR OMIT ANY DOCUMENT. If there are {len(doc_summaries)} documents in the index, you MUST have {len(doc_summaries)} separate document sections.
3. Treat all documents with equal weight and detail.

EXTRACTED WORKSPACE DOCUMENT CONTENT:
{formatted_docs}

REQUIRED OUTPUT FORMAT (Markdown):
# Executive Workspace Summary

## Executive Overview
A high-level synthesis combining insights across all {len(doc_summaries)} documents.

## Document-by-Document Breakdown
Write a dedicated section for EVERY document using its exact filename as the header:
{chr(10).join(f'### {d["name"]}' + chr(10) + '- **Core Summary**: ...' + chr(10) + '- **Key Takeaways**: ...' for d in doc_summaries)}

## Key Takeaways & Action Items
Bullet points highlighting main takeaways and next steps."""

    client = get_cerebras_client()
    llm_start = time.perf_counter()
    summary = ""
    try:
        stream = await client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            model=CEREBRAS_MODEL,
            max_completion_tokens=3000,
            temperature=0.2,
            stream=True,
        )
        usage = None
        async for chunk in stream:
            delta = chunk.choices[0].delta.content if chunk.choices else None
            if delta:
                summary += delta
                if on_token:
                    await on_token(delta)
            if getattr(chunk, "usage", None):
                usage = chunk.usage
        record_llm_usage(CEREBRAS_MODEL, "success", time.perf_counter() - llm_start, usage)
    except Exception:
        record_llm_usage(CEREBRAS_MODEL, "error", time.perf_counter() - llm_start)
        raise

    await _log_tool_execution(
        pool, workspace_id, "summarize_workspace",
        {"documentCount": len(doc_summaries), "totalSampledChars": total_sampled_chars},
        {"status": "success", "summaryLength": len(summary), "documentCount": len(doc_summaries)},
    )

    if args.get("sendToSlack"):
        await send_to_slack_webhook(summary)

    return summary, grounding_chunks
