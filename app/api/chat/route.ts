import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { retrieveWorkspaceContext, buildSystemPrompt } from '@/lib/rag';
import { routeQueryIntent } from '@/lib/router';

export const maxDuration = 60;

const CEREBRAS_MODEL = 'gpt-oss-120b';

/* ─── Extract text from any message format ─── */
function extractTextFromMessage(m: any): string {
  if (!m) return ''
  if (typeof m === 'string') return m
  if (typeof m.content === 'string') return m.content
  if (Array.isArray(m.content)) {
    const text = m.content
      .map((p: any) => {
        if (typeof p === 'string') return p
        if (p?.type === 'text' && typeof p.text === 'string') return p.text
        if (typeof p?.text === 'string') return p.text
        return ''
      })
      .join('')
    if (text) return text
  }
  if (Array.isArray(m.parts)) {
    const text = m.parts
      .map((p: any) => {
        if (typeof p === 'string') return p
        if (p?.type === 'text' && typeof p.text === 'string') return p.text
        if (typeof p?.text === 'string') return p.text
        return ''
      })
      .join('')
    if (text) return text
  }
  if (typeof m.text === 'string') return m.text
  return ''
}

/* ─── ai@7 UI message stream encoders (SSE JSON format) ─────────────────────
   Wire format:  data: {JSON}\n\n   (parsed by JsonToSseTransformStream in ai@7)
   Header:       x-vercel-ai-ui-message-stream: v1
   Types used:   text-start, text-delta, text-end  (see uiMessageChunkSchema)
   ─────────────────────────────────────────────────────────────────────────── */
const enc = new TextEncoder()
function sseChunk(obj: Record<string, unknown>): Uint8Array {
  return enc.encode(`data: ${JSON.stringify(obj)}\n\n`)
}
function sseDone(): Uint8Array {
  return enc.encode('data: [DONE]\n\n')
}

let _partIdCounter = 0
function newPartId() {
  return `part-${Date.now()}-${++_partIdCounter}`
}

const UI_STREAM_HEADERS = {
  'content-type': 'text/event-stream',
  'cache-control': 'no-cache',
  'connection': 'keep-alive',
  'x-vercel-ai-ui-message-stream': 'v1',
  'x-accel-buffering': 'no',
}

/* ─── Tool definitions (OpenAI function-calling format) ─── */
const CEREBRAS_TOOLS = [
  {
    type: 'function' as const,
    function: {
      name: 'save_task',
      description: 'Creates a task in the current workspace. DYNAMIC REQUIREMENT: Only call this tool if the user provided a SPECIFIC task action item, title, or details (e.g. "create a task to review the Q3 budget", "add task: fix auth bug"). DO NOT call this tool if the user is asking to create/add/make a task without providing the task topic (e.g. "can you create a task for me?", "add a task please", "i want to make a task"). In those vague cases, respond directly in text asking what task to create. The title MUST describe actual work to be done, never a meta-request.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'The specific, clean, action-oriented title of the task describing actual work to be done (e.g. "Review Q3 budget", "Fix auth rate limit bug"). Never use generic meta-placeholders like "Create a new task".' },
          description: { type: 'string', description: 'A short optional description with more context about the task.' },
        },
        required: ['title'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'summarize_workspace',
      description: 'Reads all uploaded documents and returns an AI-generated summary of the workspace content. Can optionally send the summary to Slack.',
      parameters: {
        type: 'object',
        properties: {
          sendToSlack: {
            type: 'boolean',
            description: 'Set to true if the user asks to send the summary to Slack or the ai-tools channel.'
          }
        }
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'search_documents',
      description: 'Performs a targeted semantic vector & keyword search across workspace documents for a specific topic, keyword, or sentence.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'The search query or keyword phrase to locate in workspace documents.' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'create_note',
      description: 'Saves a persistent note or memo to the workspace for key decisions, meeting notes, or takeaways.',
      parameters: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'Title of the note or memo.' },
          content: { type: 'string', description: 'Main markdown body of the note.' },
        },
        required: ['title', 'content'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'generate_report',
      description: 'Synthesizes uploaded workspace documents into a structured executive report with sections, executive summary, and key findings.',
      parameters: {
        type: 'object',
        properties: {
          topic: { type: 'string', description: 'Topic or focus area for the report (e.g. "Q3 Revenue & Expenses", "Technical Architecture Overview").' },
        },
        required: ['topic'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'compare_documents',
      description: 'Compares two workspace documents side-by-side and highlights key similarities, differences, and contrasting claims.',
      parameters: {
        type: 'object',
        properties: {
          docNameA: { type: 'string', description: 'Filename or title of the first document.' },
          docNameB: { type: 'string', description: 'Filename or title of the second document.' },
        },
        required: ['docNameA', 'docNameB'],
      },
    },
  },
  {
    type: 'function' as const,
    function: {
      name: 'extract_data',
      description: 'Extracts structured data (tables, key metrics, dates, prices) from workspace documents.',
      parameters: {
        type: 'object',
        properties: {
          fields: { type: 'string', description: 'Comma-separated list of fields or data points to extract (e.g. "dates, amounts, vendor names").' },
        },
        required: ['fields'],
      },
    },
  },
]

function isGenericTaskTitle(title: string): boolean {
  if (!title || typeof title !== 'string') return true
  const cleaned = title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').trim()
  if (!cleaned) return true

  // Set of meta/filler words commonly present in meta requests asking to create/add a task
  const META_WORDS = new Set([
    'can', 'you', 'could', 'would', 'please', 'create', 'add', 'make', 'setup', 'set', 'up',
    'new', 'a', 'an', 'the', 'task', 'tasks', 'for', 'me', 'my', 'i', 'want', 'need',
    'to', 'on', 'board', 'list', 'item', 'something', 'anything', 'like', 'how', 'user',
    'requested', 'creation', 'without', 'further', 'details', 'untitled', 'put', 'this',
    'in', 'here', 'there', 'just', 'some', 'action'
  ])

  const words = cleaned.split(/\s+/).filter(Boolean)
  const contentWords = words.filter((w) => !META_WORDS.has(w))

  // If there are no non-meta content words, it's a generic meta request with zero task details
  return contentWords.length === 0
}

async function sendToSlackWebhook(summary: string) {
  const WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL;
  
  if (!WEBHOOK_URL) {
    console.warn('[Slack] SLACK_WEBHOOK_URL is not set in environment variables. Notification skipped.');
    return;
  }

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: `*Workspace Summary*\n\n${summary}` }),
    });

    if (!response.ok) {
      console.error('[Slack] Failed to send message:', await response.text());
    } else {
      console.log(`[Slack] Successfully sent summary to channel.`);
    }
  } catch (error) {
    console.error('[Slack] Network error:', error);
  }
}

/* ─── Execute a tool call ─── */
async function executeTool(
  name: string,
  args: Record<string, any>,
  workspaceId: string,
  cerebras: InstanceType<typeof Cerebras>,
  onToken?: (text: string) => void
): Promise<string> {
  if (name === 'save_task') {
    const rawTitle = args?.title || args?.task || args?.name || ''
    const title = String(rawTitle).trim()
    const description = args?.description ? String(args.description).trim() : null

    if (isGenericTaskTitle(title)) {
      console.warn(`[AI Tool] Dynamically rejected generic/meta 'save_task' attempt with title: "${title}"`)
      return 'Task creation was not completed because no specific task title or topic was provided. Please ask the user: "What specific task would you like me to create? Please provide a title or topic."'
    }

    console.log(`[AI Tool] Executing 'save_task':`, { title, description })
    const task = await prisma.task.create({
      data: { workspaceId, title, description },
    })
    await prisma.toolExecution.create({
      data: {
        workspaceId,
        toolName: 'save_task',
        arguments: args || {},
        result: { taskId: task.id, status: 'success', title },
      },
    })
    console.log(`[AI Tool] 'save_task' created task id=${task.id}`)
    return `Task "${title}" created successfully.`
  }

  if (name === 'search_documents') {
    const query = args?.query || ''
    console.log(`[AI Tool] Executing 'search_documents' for query="${query}"`)
    const apiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
    const retrieval = await retrieveWorkspaceContext(workspaceId, query, apiKey)

    await prisma.toolExecution.create({
      data: {
        workspaceId,
        toolName: 'search_documents',
        arguments: args,
        result: { matchCount: retrieval.chunks.length, confidence: retrieval.confidence },
      },
    })

    if (!retrieval.chunks.length) {
      return `No relevant document passages found for query "${query}".`
    }

    return `Found ${retrieval.chunks.length} passage(s) with confidence ${(retrieval.confidence * 100).toFixed(0)}%:\n\n${retrieval.context}`
  }

  if (name === 'create_note') {
    const title = args?.title || 'Untitled Note'
    const content = args?.content || ''
    console.log(`[AI Tool] Executing 'create_note' titled "${title}"`)

    const noteTask = await prisma.task.create({
      data: {
        workspaceId,
        title: `[NOTE] ${title}`,
        description: content.slice(0, 300),
      },
    })

    await prisma.toolExecution.create({
      data: {
        workspaceId,
        toolName: 'create_note',
        arguments: args,
        result: { noteId: noteTask.id, title },
      },
    })

    return `Note "${title}" saved successfully.`
  }

  if (name === 'generate_report') {
    const topic = args?.topic || 'Workspace Analysis'
    console.log(`[AI Tool] Executing 'generate_report' on topic "${topic}"`)

    const documents = await prisma.document.findMany({
      where: { workspaceId, status: 'COMPLETED' },
      select: { filename: true },
    })

    await prisma.toolExecution.create({
      data: {
        workspaceId,
        toolName: 'generate_report',
        arguments: args,
        result: { topic, documentCount: documents.length },
      },
    })

    return `Report outline prepared for "${topic}" across ${documents.length} workspace document(s).`
  }

  if (name === 'compare_documents') {
    const docA = args?.docNameA || 'Document A'
    const docB = args?.docNameB || 'Document B'
    console.log(`[AI Tool] Executing 'compare_documents' between "${docA}" and "${docB}"`)

    await prisma.toolExecution.create({
      data: {
        workspaceId,
        toolName: 'compare_documents',
        arguments: args,
        result: { docA, docB },
      },
    })

    return `Comparison initiated between "${docA}" and "${docB}".`
  }

  if (name === 'extract_data') {
    const fields = args?.fields || 'key metrics, dates, amounts'
    console.log(`[AI Tool] Executing 'extract_data' for fields="${fields}"`)

    await prisma.toolExecution.create({
      data: {
        workspaceId,
        toolName: 'extract_data',
        arguments: args,
        result: { fields },
      },
    })

    return `Structured data extraction completed for fields: ${fields}.`
  }

  if (name === 'summarize_workspace') {
    console.log(`[AI Tool] Executing 'summarize_workspace' for workspaceId=${workspaceId}`)

    // 1. Fetch all completed documents in the workspace
    const documents = await prisma.document.findMany({
      where: { workspaceId, status: 'COMPLETED' },
      select: { id: true, filename: true },
      orderBy: { createdAt: 'asc' },
    })

    if (documents.length === 0) {
      console.log(`[AI Tool] No completed documents found in workspace ${workspaceId}`)
      return 'No completed documents found in workspace to summarize.'
    }

    // 2. Compute fair per-document character budget (20k total chars across all docs)
    const TOTAL_CHAR_BUDGET = 20000
    const perDocCharBudget = Math.max(1500, Math.floor(TOTAL_CHAR_BUDGET / documents.length))

    console.log(`[AI Tool] Found ${documents.length} document(s). Allocating up to ${perDocCharBudget} chars per document.`)

    // 3. Multi-position sampling per document (beginning, middle, end)
    const docSummaries: { name: string; content: string }[] = []
    let totalSampledChars = 0

    for (const doc of documents) {
      const chunks = await prisma.documentChunk.findMany({
        where: { documentId: doc.id },
        select: { content: true },
        orderBy: { createdAt: 'asc' },
      })

      if (chunks.length === 0) continue

      let docText = ''
      const totalDocChars = chunks.reduce((sum, c) => sum + c.content.length, 0)

      if (totalDocChars <= perDocCharBudget) {
        docText = chunks.map((c) => c.content).join('\n\n')
      } else {
        // Sample chunks evenly across the entire document duration (start, middle, end)
        const numChunksToPick = Math.max(2, Math.floor(perDocCharBudget / 900))
        const step = Math.max(1, Math.floor(chunks.length / numChunksToPick))
        const selectedChunks: string[] = []
        let currentLen = 0

        for (let i = 0; i < chunks.length && selectedChunks.length < numChunksToPick; i += step) {
          const chunkText = chunks[i].content
          if (currentLen + chunkText.length > perDocCharBudget) {
            selectedChunks.push(chunkText.slice(0, perDocCharBudget - currentLen))
            break
          }
          selectedChunks.push(chunkText)
          currentLen += chunkText.length
        }
        docText = selectedChunks.join('\n\n[...]\n\n')
      }

      docSummaries.push({ name: doc.filename, content: docText })
      totalSampledChars += docText.length
    }

    if (docSummaries.length === 0) {
      return 'No document text content found to summarize.'
    }

    const docNamesIndex = docSummaries.map((d, i) => `${i + 1}. "${d.name}"`).join('\n')
    const formattedDocsContent = docSummaries
      .map((d, i) => `=== DOCUMENT ${i + 1} OF ${docSummaries.length}: "${d.name}" ===\n${d.content}`)
      .join('\n\n----------------------------------------\n\n')

    console.log(`[AI Tool] Summarizing ${docSummaries.length} document(s) (${totalSampledChars} total chars sampled)...`)

    const promptContent = `You are an expert AI knowledge base summarizer analyzing EXACTLY ${docSummaries.length} documents.

LIST OF ALL DOCUMENTS TO BE SUMMARIZED:
${docNamesIndex}

CRITICAL RULES:
1. You MUST write a distinct, dedicated subsection for EVERY SINGLE DOCUMENT listed above under "Document Breakdown".
2. DO NOT SKIP OR OMIT ANY DOCUMENT. If there are ${docSummaries.length} documents in the index, you MUST have ${docSummaries.length} separate document sections.
3. Treat all documents with equal weight and detail.

EXTRACTED WORKSPACE DOCUMENT CONTENT:
${formattedDocsContent}

REQUIRED OUTPUT FORMAT (Markdown):
# Executive Workspace Summary

## Executive Overview
A high-level synthesis combining insights across all ${docSummaries.length} documents.

## Document-by-Document Breakdown
Write a dedicated section for EVERY document using its exact filename as the header:
${docSummaries.map((d) => `### ${d.name}\n- **Core Summary**: ...\n- **Key Takeaways**: ...`).join('\n\n')}

## Key Takeaways & Action Items
Bullet points highlighting main takeaways and next steps.`

    const summaryRespStream = await cerebras.chat.completions.create({
      messages: [{ role: 'user', content: promptContent }],
      model: CEREBRAS_MODEL,
      max_completion_tokens: 3000,
      temperature: 0.2,
      stream: true,
    })

    let summary = ''

    for await (const chunk of summaryRespStream as any) {
      const delta = ((chunk as any).choices?.[0]?.delta as any)?.content || ''
      if (delta) {
        summary += delta
        if (onToken) {
          onToken(delta)
        }
        await new Promise((r) => setTimeout(r, 25))
      }
    }

    await prisma.toolExecution.create({
      data: {
        workspaceId,
        toolName: 'summarize_workspace',
        arguments: { documentCount: docSummaries.length, totalSampledChars },
        result: { status: 'success', summaryLength: summary.length, documentCount: docSummaries.length },
      },
    })
    console.log(`[AI Tool] 'summarize_workspace' streamed ${summary.length} chars summary for ${docSummaries.length} documents.`)
    
    if (args?.sendToSlack) {
      sendToSlackWebhook(summary).catch((err) => console.error(err))
    }

    return summary
  }

  return `Unknown tool: ${name}`
}

/* ─── Persist user + assistant turn to DB ─── */
async function saveMessages(workspaceId: string, userText: string, assistantText: string) {
  try {
    let conversation = await prisma.conversation.findFirst({
      where: { workspaceId },
      orderBy: { updatedAt: 'desc' },
    })
    if (!conversation) {
      conversation = await prisma.conversation.create({ data: { workspaceId } })
    } else {
      await prisma.conversation.update({
        where: { id: conversation.id },
        data: { updatedAt: new Date() },
      })
    }
    await prisma.message.createMany({
      data: [
        { conversationId: conversation.id, role: 'user', content: userText },
        { conversationId: conversation.id, role: 'assistant', content: assistantText },
      ],
    })
    console.log(`[Chat API] Saved user+assistant messages to conversation ${conversation.id}`)
  } catch (e) {
    console.error('[Chat API] Failed to save messages:', e)
  }
}

function shouldSkipRetrieval(query: string): boolean {
  if (!query || typeof query !== 'string') return true
  const cleaned = query.toLowerCase().trim()
  if (!cleaned) return true

  // 1. Conversational greetings & meta acknowledgments
  if (/^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening)|thanks|thank\s+you|thx|cool|ok|okay|got\s+it|sounds\s+good|who\s+are\s+you|what\s+can\s+you\s+do)[\s!.]*$/i.test(cleaned)) {
    return true
  }

  // 2. Task creation requests & tool action triggers
  if (/(create|add|make|set\s*up|put|save)\s+(a\s+|an\s+|the\s+|new\s+)?(task|action\s+item|todo|reminder)/i.test(cleaned)) {
    return true
  }

  // 3. Workspace summarization requests (handled internally by summarize_workspace tool)
  if (/(summarize|summary|overview)\s+(the\s+|this\s+|all\s+)?(workspace|documents|files)/i.test(cleaned)) {
    return true
  }

  // 4. Pure math calculations (e.g. "what is 25 * 4", "calculate 150 / 3")
  if (/^(what\s+is\s+|calculate\s+|compute\s+)?\d+(\.\d+)?\s*[\+\-\*\/\^\%]\s*\d+(\.\d+)?$/i.test(cleaned)) {
    return true
  }

  return false
}

/* ════════════════════════════════════════════
   POST /api/chat
   ════════════════════════════════════════════ */
export async function POST(req: NextRequest) {
  const timestamp = new Date().toISOString()
  try {
    const body = await req.json().catch(() => ({}))
    const messages = body.messages || []
    const urlWorkspaceId = req.nextUrl.searchParams.get('workspaceId')
    const workspaceId = body.workspaceId || urlWorkspaceId

    console.log(`[Chat API] [${timestamp}] Incoming request - workspaceId: "${workspaceId}", messages: ${messages.length}`)

    if (!workspaceId) {
      console.warn(`[Chat API] Missing workspaceId`)
      return NextResponse.json({ error: 'workspaceId is required' }, { status: 400 })
    }

    const session = await getSession()
    if (!session?.userId) {
      console.warn(`[Chat API] Unauthorized — no session`)
      return new Response('Unauthorized', { status: 401 })
    }

    const membership = await prisma.membership.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: session.userId } },
    })
    if (!membership) {
      console.warn(`[Chat API] User ${session.userId} not in workspace ${workspaceId}`)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const lastMessage = messages[messages.length - 1]
    const queryText = extractTextFromMessage(lastMessage).trim()
    let context = ''

    console.log(`[Chat API] Query: "${queryText.substring(0, 100)}${queryText.length > 100 ? '...' : ''}"`)

    /* ── Cerebras client initialization ── */
    const cerebrasApiKey = process.env.CEREBRAS_API_KEY || ''
    const cerebras = new Cerebras({ apiKey: cerebrasApiKey })

    let searchTarget = queryText
    const isUserRole = lastMessage?.role === 'user' || !lastMessage?.role

    if (searchTarget && isUserRole) {
      const recentHistory = messages.slice(-5).map((m: any) => `${m.role}: ${extractTextFromMessage(m)}`).join('\n')
      const decision = await routeQueryIntent(searchTarget, recentHistory, cerebras)

      if (decision.route === 'RAG') {
        const ragSearchQuery = decision.searchQuery || searchTarget
        const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
        try {
          console.log(`[Chat API] Executing RAG retrieval for workspace ${workspaceId} with query "${ragSearchQuery}"...`)
          const retrieval = await retrieveWorkspaceContext(workspaceId, ragSearchQuery, googleApiKey)
          context = retrieval.context
          console.log(`[Chat API] Retrieval method=${retrieval.method} confidence=${retrieval.confidence.toFixed(2)} chunks=${retrieval.chunks.length}`)
        } catch (retrievalError: any) {
          console.error('[Chat API] Retrieval error:', retrievalError?.message || retrievalError)
        }
      } else {
        console.log(`[Chat API] Fast-path Intent Router bypassed RAG retrieval (route: ${decision.route}, reason: ${decision.reason})`)
      }
    }

    /* ── Build messages for Cerebras ── */
    const systemPrompt = buildSystemPrompt()

    // Keep history reasonably bounded (last 6 turns) to prevent context confusion in long sessions
    const recentMessages = (Array.isArray(messages) ? messages : []).slice(-6)

    const formattedMessages = recentMessages
      .map((m: any) => ({
        role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
        content: extractTextFromMessage(m),
      }))
      .filter((m: any) => typeof m.content === 'string' && m.content.trim().length > 0)

    // Detach RAG context from the global system prompt.
    // Instead, attach it directly to the *latest* user question so the LLM knows it's fresh data.
    if (formattedMessages.length > 0 && context) {
      const lastMsg = formattedMessages[formattedMessages.length - 1]
      if (lastMsg.role === 'user') {
        lastMsg.content = `[RETRIEVED WORKSPACE CONTEXT]\n${context}\n\n[USER QUESTION]\n${lastMsg.content}`
      }
    }

    const cerebrasMessages = [
      { role: 'system', content: systemPrompt },
      ...(formattedMessages.length > 0
        ? formattedMessages
        : [{ role: 'user', content: context ? `[RETRIEVED WORKSPACE CONTEXT]\n${context}\n\n[USER QUESTION]\n${queryText || 'hi'}` : (queryText || 'hi') }]),
    ]

    console.log(`[Chat API] Model: ${CEREBRAS_MODEL} | Messages: ${cerebrasMessages.length}`)

    /* ── Streaming response with tool support ── */
    const readable = new ReadableStream({
      async start(controller) {
        let attempts = 0
        const MAX_ATTEMPTS = 3

        // Each text part needs a stable ID across start/delta/end
        const textPartId = newPartId()

        while (attempts < MAX_ATTEMPTS) {
          attempts++
          try {
            console.log(`[Chat API] Cerebras stream attempt ${attempts}/${MAX_ATTEMPTS}...`)

            const stream = await cerebras.chat.completions.create({
              messages: cerebrasMessages as any,
              model: CEREBRAS_MODEL,
              tools: CEREBRAS_TOOLS as any,
              tool_choice: 'auto',
              max_completion_tokens: 2048,
              temperature: 0.2,
              top_p: 1,
              stream: true,
            })

            /* Accumulate streaming chunks */
            let finishReason = ''
            const accToolCalls: Record<number, { id: string; type: string; function: { name: string; arguments: string } }> = {}
            let assistantText = ''
            let textStarted = false

            for await (const chunk of stream as any) {
              const choice = (chunk as any).choices?.[0]
              if (!choice) continue
              if (choice.finish_reason) finishReason = choice.finish_reason

              const delta = choice.delta as any

              /* Stream text delta to client in ai@7 format */
              if (delta?.content) {
                if (!textStarted) {
                  // Signal start of a new text part
                  controller.enqueue(sseChunk({ type: 'text-start', id: textPartId }))
                  textStarted = true
                }
                assistantText += delta.content
                controller.enqueue(sseChunk({ type: 'text-delta', id: textPartId, delta: delta.content }))
              }

              /* Accumulate tool call deltas */
              if (delta?.tool_calls) {
                for (const tc of delta.tool_calls) {
                  const idx = tc.index ?? 0
                  if (!accToolCalls[idx]) {
                    accToolCalls[idx] = { id: '', type: 'function', function: { name: '', arguments: '' } }
                  }
                  if (tc.id) accToolCalls[idx].id = tc.id
                  if (tc.function?.name) accToolCalls[idx].function.name += tc.function.name
                  if (tc.function?.arguments) accToolCalls[idx].function.arguments += tc.function.arguments
                }
              }
            }

            // Close the text part
            if (textStarted) {
              controller.enqueue(sseChunk({ type: 'text-end', id: textPartId }))
            }

            console.log(`[Chat API] Stream done. finish_reason="${finishReason}"`)

            /* ── Handle tool calls ── */
            if (finishReason === 'tool_calls' && Object.keys(accToolCalls).length > 0) {
              const toolCallList = Object.values(accToolCalls)
              console.log(`[Chat API] Executing ${toolCallList.length} tool call(s)...`)

              let toolStreamedToUI = false

              const toolResults = await Promise.all(
                toolCallList.map(async (tc) => {
                  let args: Record<string, any> = {}
                  try { args = JSON.parse(tc.function.arguments || '{}') } catch {}
                  const result = await executeTool(tc.function.name, args, workspaceId, cerebras, (deltaToken) => {
                    toolStreamedToUI = true
                    if (!textStarted) {
                      controller.enqueue(sseChunk({ type: 'text-start', id: textPartId }))
                      textStarted = true
                    }
                    assistantText += deltaToken
                    controller.enqueue(sseChunk({ type: 'text-delta', id: textPartId, delta: deltaToken }))
                  })
                  return { tool_call_id: tc.id, role: 'tool' as const, content: result }
                })
              )

              if (!toolStreamedToUI) {
                /* Follow-up stream with tool results if tool didn't stream directly */
                const followUpMessages = [
                  ...cerebrasMessages,
                  { role: 'assistant', content: assistantText || null, tool_calls: toolCallList },
                  ...toolResults,
                ]

                console.log(`[Chat API] Follow-up stream after tool execution...`)
                const followUpStream = await cerebras.chat.completions.create({
                  messages: followUpMessages as any,
                  model: CEREBRAS_MODEL,
                  max_completion_tokens: 1024,
                  temperature: 0.2,
                  stream: true,
                })

                const followUpPartId = newPartId()
                let followUpStarted = false
                let followUpText = ''
                for await (const chunk of followUpStream as any) {
                  const text = ((chunk as any).choices?.[0]?.delta as any)?.content || ''
                  if (text) {
                    if (!followUpStarted) {
                      controller.enqueue(sseChunk({ type: 'text-start', id: followUpPartId }))
                      followUpStarted = true
                    }
                    followUpText += text
                    controller.enqueue(sseChunk({ type: 'text-delta', id: followUpPartId, delta: text }))
                  }
                }
                if (followUpStarted) {
                  controller.enqueue(sseChunk({ type: 'text-end', id: followUpPartId }))
                }
                assistantText = [assistantText, followUpText].filter(Boolean).join('\n')
              }
            }

            // Persist the conversation turn to DB
            await saveMessages(workspaceId, queryText, assistantText)

            controller.enqueue(sseDone())
            controller.close()
            return // success — exit retry loop

          } catch (err: any) {
            const msg = (err?.message || err?.toString() || '').toLowerCase()
            const isRetryable =
              msg.includes('overload') || msg.includes('503') || msg.includes('429') ||
              msg.includes('rate') || msg.includes('unavailable')

            console.warn(`[Chat API] Error on attempt ${attempts}: ${msg}`)

            if (!isRetryable || attempts >= MAX_ATTEMPTS) {
              const errText = isRetryable
                ? '⚠️ The Cerebras API is currently overloaded. Please try again in a moment.'
                : `⚠️ An error occurred: ${err?.message || 'Unknown error'}`
              console.error(`[Chat API] Final failure after ${attempts} attempt(s):`, err)
              const errPartId = newPartId()
              controller.enqueue(sseChunk({ type: 'text-start', id: errPartId }))
              controller.enqueue(sseChunk({ type: 'text-delta', id: errPartId, delta: errText }))
              controller.enqueue(sseChunk({ type: 'text-end', id: errPartId }))
              controller.enqueue(sseDone())
              controller.close()
              return
            }

            const delay = Math.pow(2, attempts - 1) * 1000
            console.warn(`[Chat API] Retrying in ${delay}ms...`)
            await new Promise(r => setTimeout(r, delay))
          }
        }
      },
    })

    return new Response(readable, { headers: UI_STREAM_HEADERS })

  } catch (e: any) {
    console.error('[Chat API] Fatal POST Handler Error:', e)
    return NextResponse.json({ error: e.message }, { status: 500 })
  }
}
