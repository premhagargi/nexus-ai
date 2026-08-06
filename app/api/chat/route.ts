// @ts-nocheck
import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prisma';
import { getSession } from '@/lib/auth';
import { retrieveWorkspaceContext, buildSystemPrompt } from '@/lib/rag';

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
      description: 'Reads all uploaded documents and returns an AI-generated summary of the workspace content.',
      parameters: { type: 'object', properties: {} },
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
      return 'No documents found to summarize.'
    }

    // 2. Compute fair per-document chunk quota to prevent 1 large doc from monopolizing the limit
    const MAX_TOTAL_CHUNKS = 200
    const perDocQuota = Math.max(10, Math.floor(MAX_TOTAL_CHUNKS / documents.length))

    console.log(`[AI Tool] Found ${documents.length} document(s). Sampling up to ${perDocQuota} chunks per document.`)

    // 3. Fetch chunks for EACH document up to perDocQuota
    const docMap = new Map<string, { name: string; texts: string[] }>()
    let totalChunkCount = 0

    for (const doc of documents) {
      const docChunks = await prisma.documentChunk.findMany({
        where: { documentId: doc.id },
        select: { content: true },
        orderBy: { createdAt: 'asc' },
        take: perDocQuota,
      })

      if (docChunks.length > 0) {
        docMap.set(doc.id, {
          name: doc.filename,
          texts: docChunks.map((c) => c.content),
        })
        totalChunkCount += docChunks.length
      }
    }

    if (docMap.size === 0) {
      return 'No document text chunks found to summarize.'
    }

    const docsText = Array.from(docMap.values())
      .map(({ name, texts }) => `### Document: ${name}\n${texts.join('\n')}`)
      .join('\n\n---\n\n')

    console.log(`[AI Tool] Summarizing ${docMap.size} document(s) across ${totalChunkCount} total chunks with streaming...`)

    const summaryRespStream = await cerebras.chat.completions.create({
      messages: [{
        role: 'user',
        content: `You are summarizing a workspace knowledge base containing ${docMap.size} documents.

CRITICAL INSTRUCTION: You MUST write a distinct, clear summary section for EVERY single document listed below. Do NOT omit or skip any document.

Workspace Documents Content:
${docsText}

Output Format:
1. Executive Overview: A high-level summary synthesizing all documents.
2. Document-by-Document Breakdown: A dedicated section for EVERY document (titled with the exact document filename) covering its key topics and conclusions.
3. Key Takeaways & Action Items.`,
      }],
      model: CEREBRAS_MODEL,
      max_completion_tokens: 2048,
      temperature: 0.2,
      stream: true,
    })

    let summary = ''

    for await (const chunk of summaryRespStream) {
      const delta = (chunk.choices?.[0]?.delta as any)?.content || ''
      if (delta) {
        summary += delta
        if (onToken) {
          onToken(delta)
        }
        // Artificially slow down Cerebras to human-readable speeds (also prevents React freezing)
        await new Promise(r => setTimeout(r, 35))
      }
    }

    await prisma.toolExecution.create({
      data: {
        workspaceId,
        toolName: 'summarize_workspace',
        arguments: { documentCount: docMap.size, chunkCount: totalChunkCount },
        result: { status: 'success', summaryLength: summary.length, documentCount: docMap.size },
      },
    })
    console.log(`[AI Tool] 'summarize_workspace' streamed ${summary.length} chars summary for ${docMap.size} documents.`)
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

  // 1. Conversational greetings & meta questions
  if (/^(hi|hello|hey|greetings|good\s+(morning|afternoon|evening)|thanks|thank\s+you|who\s+are\s+you|what\s+can\s+you\s+do)[\s!.]*$/i.test(cleaned)) {
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

    if (queryText && (lastMessage?.role === 'user' || !lastMessage?.role)) {
      if (shouldSkipRetrieval(queryText)) {
        console.log(`[Chat API] Fast-path: query "${queryText}" matched tool/conversational pattern. Skipping RAG search.`)
      } else {
        const googleApiKey = process.env.GOOGLE_GENERATIVE_AI_API_KEY || process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || ''
        try {
          console.log(`[Chat API] Starting retrieval for workspace ${workspaceId}...`)
          const retrieval = await retrieveWorkspaceContext(workspaceId, queryText, googleApiKey)
          context = retrieval.context
          console.log(`[Chat API] Retrieval method=${retrieval.method} confidence=${retrieval.confidence.toFixed(2)} chunks=${retrieval.chunks.length}`)
        } catch (retrievalError: any) {
          console.error('[Chat API] Retrieval error:', retrievalError?.message || retrievalError)
        }
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

    /* ── Cerebras client ── */
    const cerebrasApiKey = process.env.CEREBRAS_API_KEY || ''
    console.log(`[Chat API] Cerebras API key present: ${!!cerebrasApiKey}`)

    const cerebras = new Cerebras({ apiKey: cerebrasApiKey })

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

            for await (const chunk of stream) {
              const choice = chunk.choices?.[0]
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
                // Artificially slow down Cerebras to human-readable speeds
                await new Promise(r => setTimeout(r, 35))
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
                for await (const chunk of followUpStream) {
                  const text = (chunk.choices?.[0]?.delta as any)?.content || ''
                  if (text) {
                    if (!followUpStarted) {
                      controller.enqueue(sseChunk({ type: 'text-start', id: followUpPartId }))
                      followUpStarted = true
                    }
                    followUpText += text
                    controller.enqueue(sseChunk({ type: 'text-delta', id: followUpPartId, delta: text }))
                    // Artificially slow down Cerebras to human-readable speeds
                    await new Promise(r => setTimeout(r, 35))
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
