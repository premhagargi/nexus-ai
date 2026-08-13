"""Port of app/api/chat/route.ts's POST handler — the agentic chat pipeline.

Flow: extract query -> hybrid intent router -> conditional RAG retrieval ->
streaming Cerebras completion with tool-calling -> (if tools were called)
execute tools + follow-up synthesis stream -> hallucination/citation
verification -> RAG metadata annotation -> persist conversation turn.

The tool-calling "agent loop" here is intentionally bounded to a single
round: the model gets one chance to call tools, the tools execute once,
and one follow-up stream synthesizes the results. There's no recursive
re-invocation, so infinite tool-call loops are prevented by construction
rather than by a step counter — worth being explicit about in an
interview, since it's a real design choice, not an oversight.
"""
import asyncio
import time
import uuid
from collections.abc import AsyncGenerator
from typing import Any

import asyncpg

from app.agent.sse import UI_STREAM_HEADERS, new_part_id, sse_chunk, sse_done
from app.agent.tools import CEREBRAS_TOOLS, TOOL_BADGES, execute_tool
from app.core.config import get_settings
from app.core.logging import get_logger
from app.core.time import now_naive_utc
from app.observability.metrics import agent_run_duration_seconds, agent_runs_total
from app.observability.tracing import span
from app.services import rag_service
from app.services.llm_client import get_cerebras_client, record_llm_usage
from app.services.router_service import route_query_intent

logger = get_logger(__name__)

CEREBRAS_MODEL = "gpt-oss-120b"
MAX_STREAM_ATTEMPTS = 3


def extract_text_from_message(message: dict[str, Any] | None) -> str:
    if not message:
        return ""
    if isinstance(message, str):
        return message

    content = message.get("content")
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        text = "".join(_extract_part_text(p) for p in content)
        if text:
            return text

    parts = message.get("parts")
    if isinstance(parts, list):
        text = "".join(_extract_part_text(p) for p in parts)
        if text:
            return text

    text = message.get("text")
    return text if isinstance(text, str) else ""


def _extract_part_text(part: Any) -> str:
    if isinstance(part, str):
        return part
    if isinstance(part, dict):
        if part.get("type") == "text" and isinstance(part.get("text"), str):
            return part["text"]
        if isinstance(part.get("text"), str):
            return part["text"]
    return ""


async def _get_or_create_conversation(pool: asyncpg.Pool, workspace_id: str) -> str:
    row = await pool.fetchrow(
        'SELECT id FROM "Conversation" WHERE "workspaceId" = $1 ORDER BY "updatedAt" DESC LIMIT 1',
        workspace_id,
    )
    now = now_naive_utc()
    if row:
        await pool.execute('UPDATE "Conversation" SET "updatedAt" = $2 WHERE id = $1', row["id"], now)
        return row["id"]

    conversation_id = str(uuid.uuid4())
    await pool.execute(
        'INSERT INTO "Conversation" (id, "workspaceId", "createdAt", "updatedAt") VALUES ($1, $2, $3, $3)',
        conversation_id, workspace_id, now,
    )
    return conversation_id


async def _save_messages(
    pool: asyncpg.Pool, workspace_id: str, user_text: str, assistant_text: str, citations: dict | None
) -> None:
    try:
        conversation_id = await _get_or_create_conversation(pool, workspace_id)
        now = now_naive_utc()
        await pool.execute(
            'INSERT INTO "Message" (id, "conversationId", role, content, citations, "createdAt") VALUES ($1, $2, $3, $4, $5, $6)',
            str(uuid.uuid4()), conversation_id, "user", user_text, None, now,
        )
        await pool.execute(
            'INSERT INTO "Message" (id, "conversationId", role, content, citations, "createdAt") VALUES ($1, $2, $3, $4, $5, $6)',
            str(uuid.uuid4()), conversation_id, "assistant", assistant_text, citations, now,
        )
    except Exception as error:  # noqa: BLE001 - persistence failure shouldn't break the response the user already saw
        logger.error("chat.save_messages.failed", error=str(error))


def _is_retryable_error(error: Exception) -> bool:
    msg = str(error).lower()
    return any(term in msg for term in ("overload", "503", "429", "rate", "unavailable"))


def _field(obj: Any, name: str, default: Any = None) -> Any:
    """Reads an attribute from a Cerebras SDK streaming object OR a plain
    dict. The SDK's pydantic models don't always coerce every chunk — an
    empty terminal delta (e.g. `{}` on the finish_reason chunk) has been
    observed coming through as a raw dict instead of
    ChatChunkResponseChoiceDelta, so every stream-field read needs to
    tolerate both shapes.
    """
    if obj is None:
        return default
    if isinstance(obj, dict):
        return obj.get(name, default)
    return getattr(obj, name, default)


async def stream_chat_response(
    pool: asyncpg.Pool, workspace_id: str, messages: list[dict[str, Any]]
) -> AsyncGenerator[bytes, None]:
    settings = get_settings()
    google_api_key = settings.google_generative_ai_api_key

    last_message = messages[-1] if messages else None
    query_text = extract_text_from_message(last_message).strip()

    retrieval_details: rag_service.RetrievalResult | None = None
    is_user_role = not last_message or last_message.get("role", "user") == "user"

    if query_text and is_user_role:
        recent_history = "\n".join(
            f"{m.get('role', 'user')}: {extract_text_from_message(m)}" for m in messages[-5:]
        )
        decision = await route_query_intent(query_text, recent_history)

        if decision.route == "RAG":
            rag_query = decision.search_query or query_text
            try:
                retrieval_details = await rag_service.retrieve_workspace_context(
                    pool, workspace_id, rag_query, google_api_key
                )
            except Exception as error:
                logger.error("chat.retrieval_error", error=str(error))
        else:
            logger.info("chat.rag_bypassed", route=decision.route, reason=decision.reason)

    context = retrieval_details.context if retrieval_details else ""

    system_prompt = rag_service.build_system_prompt()
    recent_messages = messages[-6:]
    formatted_messages = []
    for m in recent_messages:
        role = m.get("role")
        role = "assistant" if role == "assistant" else "system" if role == "system" else "user"
        text = extract_text_from_message(m)
        if text and text.strip():
            formatted_messages.append({"role": role, "content": text})

    if formatted_messages and context and formatted_messages[-1]["role"] == "user":
        formatted_messages[-1]["content"] = (
            f"[RETRIEVED WORKSPACE CONTEXT]\n{context}\n\n[USER QUESTION]\n{formatted_messages[-1]['content']}"
        )

    if formatted_messages:
        cerebras_messages = [{"role": "system", "content": system_prompt}, *formatted_messages]
    else:
        fallback_content = (
            f"[RETRIEVED WORKSPACE CONTEXT]\n{context}\n\n[USER QUESTION]\n{query_text or 'hi'}"
            if context
            else (query_text or "hi")
        )
        cerebras_messages = [{"role": "system", "content": system_prompt}, {"role": "user", "content": fallback_content}]

    client = get_cerebras_client()
    text_part_id = new_part_id()
    attempts = 0

    while attempts < MAX_STREAM_ATTEMPTS:
        attempts += 1
        llm_start = time.perf_counter()
        try:
          with span("llm.chat_completion_stream", **{"llm.model": CEREBRAS_MODEL, "llm.provider": "cerebras"}):
            stream = await client.chat.completions.create(
                messages=cerebras_messages,
                model=CEREBRAS_MODEL,
                tools=CEREBRAS_TOOLS,
                tool_choice="auto",
                max_completion_tokens=2048,
                temperature=0.2,
                top_p=1,
                stream=True,
            )

            finish_reason = ""
            acc_tool_calls: dict[int, dict[str, Any]] = {}
            assistant_text = ""
            text_started = False
            usage = None

            async for chunk in stream:
                choices = _field(chunk, "choices")
                if not choices:
                    continue
                choice = choices[0]
                finish = _field(choice, "finish_reason")
                if finish:
                    finish_reason = finish
                delta = _field(choice, "delta")

                delta_content = _field(delta, "content")
                if delta_content:
                    if not text_started:
                        yield sse_chunk({"type": "text-start", "id": text_part_id})
                        text_started = True
                    assistant_text += delta_content
                    yield sse_chunk({"type": "text-delta", "id": text_part_id, "delta": delta_content})

                delta_tool_calls = _field(delta, "tool_calls")
                if delta_tool_calls:
                    for tc in delta_tool_calls:
                        idx = _field(tc, "index") or 0
                        if idx not in acc_tool_calls:
                            acc_tool_calls[idx] = {"id": "", "type": "function", "function": {"name": "", "arguments": ""}}
                        tc_id = _field(tc, "id")
                        if tc_id:
                            acc_tool_calls[idx]["id"] = tc_id
                        tc_function = _field(tc, "function")
                        fn_name = _field(tc_function, "name")
                        if fn_name:
                            acc_tool_calls[idx]["function"]["name"] += fn_name
                        fn_args = _field(tc_function, "arguments")
                        if fn_args:
                            acc_tool_calls[idx]["function"]["arguments"] += fn_args

                chunk_usage = _field(chunk, "usage")
                if chunk_usage:
                    usage = chunk_usage

            record_llm_usage(CEREBRAS_MODEL, "success", time.perf_counter() - llm_start, usage)

            if text_started:
                yield sse_chunk({"type": "text-end", "id": text_part_id})

            if finish_reason == "tool_calls" and acc_tool_calls:
                text_holder = _TextHolder(assistant_text)
                with span(
                    "agent.run", **{"workspace_id": workspace_id, "agent.tool_count": len(acc_tool_calls)}
                ):
                    async for piece in _run_agent_tool_round(
                        text_holder, acc_tool_calls, cerebras_messages, workspace_id, pool, google_api_key,
                        text_part_id, text_started,
                    ):
                        yield piece
                assistant_text = text_holder.text

                if text_holder.grounding_chunks:
                    # A tool (e.g. summarize_workspace) supplied the real source
                    # material it used - verify against that, not the stale
                    # pre-routing RAG retrieval, which may be unrelated.
                    retrieval_details = rag_service.RetrievalResult(
                        context="",
                        chunks=text_holder.grounding_chunks,
                        confidence=1.0,
                        method="tool_context",
                    )

            verification = None
            if retrieval_details and retrieval_details.chunks:
                verification = rag_service.verify_citations(assistant_text, retrieval_details.chunks)

            rag_metadata = _build_rag_metadata(retrieval_details, verification)
            if rag_metadata["retrieval"] or rag_metadata["verification"]:
                annotation_id = new_part_id()
                annotation_tag = f"\n\n<!-- RAG_METADATA:{_json_compact(rag_metadata)} -->"
                yield sse_chunk({"type": "text-start", "id": annotation_id})
                yield sse_chunk({"type": "text-delta", "id": annotation_id, "delta": annotation_tag})
                yield sse_chunk({"type": "text-end", "id": annotation_id})

            await _save_messages(pool, workspace_id, query_text, assistant_text, rag_metadata)

            yield sse_done()
            return

        except Exception as error:
            record_llm_usage(CEREBRAS_MODEL, "error", time.perf_counter() - llm_start)
            retryable = _is_retryable_error(error)
            logger.warning("chat.stream_attempt_failed", attempt=attempts, error=str(error), retryable=retryable)

            if not retryable or attempts >= MAX_STREAM_ATTEMPTS:
                err_text = (
                    "⚠️ The Cerebras API is currently overloaded. Please try again in a moment."
                    if retryable
                    else f"⚠️ An error occurred: {error}"
                )
                err_id = new_part_id()
                yield sse_chunk({"type": "text-start", "id": err_id})
                yield sse_chunk({"type": "text-delta", "id": err_id, "delta": err_text})
                yield sse_chunk({"type": "text-end", "id": err_id})
                yield sse_done()
                return

            await asyncio.sleep((2 ** (attempts - 1)))


class _TextHolder:
    """Mutable out-param for the accumulated assistant text: the tool round
    below is an async generator that must yield SSE bytes as it streams, so
    it can't also `return` its final text — the caller reads `.text` after
    the generator is exhausted instead.

    `grounding_chunks` piggybacks on the same pattern: when a tool call
    (e.g. summarize_workspace) supplies the real source material it used,
    the caller substitutes it for the pre-routing RAG retrieval before
    running citation verification, instead of checking the tool's answer
    against whatever unrelated chunks the original query happened to match.
    """

    __slots__ = ("text", "grounding_chunks")

    def __init__(self, initial: str = "") -> None:
        self.text = initial
        self.grounding_chunks: list[rag_service.RetrievedChunk] | None = None


async def _run_agent_tool_round(
    holder: _TextHolder,
    acc_tool_calls: dict[int, dict[str, Any]],
    cerebras_messages: list[dict[str, Any]],
    workspace_id: str,
    pool: asyncpg.Pool,
    google_api_key: str,
    text_part_id: str,
    text_started: bool,
) -> AsyncGenerator[bytes, None]:
    """Executes one bounded round of tool calls + a follow-up synthesis stream."""
    agent_start = time.perf_counter()

    tool_call_list = list(acc_tool_calls.values())

    if not text_started:
        yield sse_chunk({"type": "text-start", "id": text_part_id})

    for tc in tool_call_list:
        badge_text = TOOL_BADGES.get(tc["function"]["name"], f"Executing {tc['function']['name']}...")
        badge_markdown = f"\n\n[{badge_text}](tool://{tc['function']['name']})\n\n"
        holder.text += badge_markdown
        yield sse_chunk({"type": "text-delta", "id": text_part_id, "delta": badge_markdown})

    async def _run_one(tc: dict[str, Any]) -> dict[str, Any]:
        import json as _json

        try:
            args = _json.loads(tc["function"]["arguments"] or "{}")
        except Exception:
            args = {}

        streamed_tokens: list[str] = []

        async def on_token(delta: str) -> None:
            streamed_tokens.append(delta)

        content, grounding_chunks = await execute_tool(
            tc["function"]["name"], args, workspace_id, pool, google_api_key, on_token
        )
        return {
            "tool_call_id": tc["id"],
            "role": "tool",
            "content": content,
            "streamed": streamed_tokens,
            "grounding_chunks": grounding_chunks,
        }

    agent_status = "success"
    try:
        tool_results = await asyncio.gather(*[_run_one(tc) for tc in tool_call_list])
    except Exception:
        agent_status = "error"
        agent_runs_total.labels(status=agent_status).inc()
        agent_run_duration_seconds.observe(time.perf_counter() - agent_start)
        raise

    for tr in tool_results:
        for token in tr["streamed"]:
            holder.text += token
            yield sse_chunk({"type": "text-delta", "id": text_part_id, "delta": token})
        if tr["grounding_chunks"]:
            holder.grounding_chunks = tr["grounding_chunks"]

    yield sse_chunk({"type": "text-end", "id": text_part_id})

    follow_up_tool_results = [
        {
            "tool_call_id": tr["tool_call_id"],
            "role": "tool",
            "content": (
                "(Summary streamed directly to user. Proceed with answering other queries if any.)"
                if next((tc for tc in tool_call_list if tc["id"] == tr["tool_call_id"]), {}).get("function", {}).get("name")
                == "summarize_workspace"
                else tr["content"]
            ),
        }
        for tr in tool_results
    ]

    follow_up_messages = [
        *cerebras_messages,
        {"role": "assistant", "content": holder.text or None, "tool_calls": tool_call_list},
        *follow_up_tool_results,
    ]

    client = get_cerebras_client()
    follow_up_start = time.perf_counter()
    follow_up_part_id = new_part_id()
    follow_up_started = False
    follow_up_text = ""
    try:
        follow_up_stream = await client.chat.completions.create(
            messages=follow_up_messages,
            model=CEREBRAS_MODEL,
            max_completion_tokens=1024,
            temperature=0.2,
            stream=True,
        )
        usage = None
        async for chunk in follow_up_stream:
            choices = _field(chunk, "choices")
            if not choices:
                continue
            text = _field(_field(choices[0], "delta"), "content") or ""
            if text:
                if not follow_up_started:
                    yield sse_chunk({"type": "text-start", "id": follow_up_part_id})
                    follow_up_started = True
                follow_up_text += text
                yield sse_chunk({"type": "text-delta", "id": follow_up_part_id, "delta": text})
            chunk_usage = _field(chunk, "usage")
            if chunk_usage:
                usage = chunk_usage
        record_llm_usage(CEREBRAS_MODEL, "success", time.perf_counter() - follow_up_start, usage)
    except Exception:
        record_llm_usage(CEREBRAS_MODEL, "error", time.perf_counter() - follow_up_start)
        agent_status = "error"
        raise
    finally:
        agent_runs_total.labels(status=agent_status).inc()
        agent_run_duration_seconds.observe(time.perf_counter() - agent_start)

    if follow_up_started:
        yield sse_chunk({"type": "text-end", "id": follow_up_part_id})

    holder.text = "\n".join(t for t in [holder.text, follow_up_text] if t)


def _build_rag_metadata(
    retrieval: rag_service.RetrievalResult | None, verification: rag_service.VerificationResult | None
) -> dict[str, Any]:
    retrieval_payload = None
    if retrieval:
        retrieval_payload = {
            "method": retrieval.method,
            "confidence": retrieval.confidence,
            "chunkCount": len(retrieval.chunks),
            "chunks": [
                {
                    "id": c.id,
                    "distance": c.distance,
                    "sourceTitle": c.metadata.get("sourceTitle") or c.metadata.get("filename") or "Document",
                    "snippet": c.content[:150],
                }
                for c in retrieval.chunks
            ],
        }

    verification_payload = None
    if verification:
        verification_payload = {
            "groundedScore": verification.grounded_score,
            "status": verification.status,
            "claims": [
                {
                    "statement": c.statement,
                    "verified": c.verified,
                    "confidence": c.confidence,
                    "matchedChunkId": c.matched_chunk_id,
                    "sourceTitle": c.source_title,
                }
                for c in verification.claims
            ],
        }

    return {"retrieval": retrieval_payload, "verification": verification_payload}


def _json_compact(obj: Any) -> str:
    import json

    return json.dumps(obj, separators=(",", ":"))
