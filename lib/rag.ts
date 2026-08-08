import { GoogleGenerativeAIEmbeddings } from '@langchain/google-genai'
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters'
import { TaskType } from '@google/generative-ai'
import prisma from './prisma'

export const EMBEDDING_DIMENSIONS = 768
export const CHUNK_SIZE = 1100
export const CHUNK_OVERLAP = 220
export const VECTOR_TOP_K = 8
export const KEYWORD_TOP_K = 8
export const CONTEXT_CHUNK_LIMIT = 6
export const MIN_CONFIDENCE_SCORE = 0.35
export const VECTOR_DISTANCE_THRESHOLD = 0.45

export interface DocumentChunkPayload {
  content: string
  metadata: Record<string, unknown>
}

export interface RetrievedChunk {
  id: string
  documentId: string
  content: string
  metadata: Record<string, any>
  distance: number
  rank?: number
}

export interface RetrievalResult {
  context: string
  chunks: RetrievedChunk[]
  confidence: number
  method: string
}

export function normalizeText(text: string): string {
  return text
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

export function buildSourceTitle(filename: string): string {
  return filename
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function getEmbeddingClient(apiKey: string) {
  return new GoogleGenerativeAIEmbeddings({
    model: 'gemini-embedding-001',
    taskType: TaskType.RETRIEVAL_DOCUMENT,
    apiKey,
  })
}

export function normalizeEmbedding(vector: number[]) {
  const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0)) || 1
  return vector.map((value) => value / magnitude)
}

export function generateFallbackEmbedding(text: string, dimensions = EMBEDDING_DIMENSIONS): number[] {
  const vector = new Array(dimensions).fill(0)
  const normalizedText = normalizeText(text)
  for (let i = 0; i < normalizedText.length; i++) {
    const charCode = normalizedText.charCodeAt(i)
    vector[i % dimensions] = (vector[i % dimensions] + charCode / 255.0) % 2.0 - 1.0
  }
  return normalizeEmbedding(vector)
}

export function levenshteinDistance(a: string, b: string): number {
  const aLen = a.length
  const bLen = b.length
  const matrix: number[][] = Array(aLen + 1)
    .fill(null)
    .map(() => Array(bLen + 1).fill(0))

  for (let i = 0; i <= aLen; i++) matrix[i][0] = i
  for (let j = 0; j <= bLen; j++) matrix[0][j] = j

  for (let i = 1; i <= aLen; i++) {
    for (let j = 1; j <= bLen; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost,
      )
    }
  }
  return matrix[aLen][bLen]
}

export function fuzzyMatchToken(token: string, text: string, maxDistance = 2): boolean {
  const words = text.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)
  for (const word of words) {
    if (levenshteinDistance(token, word) <= maxDistance) {
      return true
    }
  }
  return false
}

export async function createDocumentChunks(
  text: string,
  filename: string,
  documentId: string,
  sourceType: string,
): Promise<DocumentChunkPayload[]> {
  const sanitized = normalizeText(text)
  const splitter = new RecursiveCharacterTextSplitter({
    chunkSize: CHUNK_SIZE,
    chunkOverlap: CHUNK_OVERLAP,
    separators: ['\n\n', '\n', '.', '!', '?', ';', ',', ' ', ''],
  })

  const docs = await splitter.createDocuments([sanitized], [{ source: filename }])
  return docs.map((doc, index) => ({
    content: normalizeText(doc.pageContent),
    metadata: {
      source: filename,
      sourceTitle: buildSourceTitle(filename),
      sourceType,
      documentId,
      chunkIndex: index,
      chunkCount: docs.length,
      chunkLength: doc.pageContent.length,
      chunkTokensEstimate: Math.max(1, Math.ceil(doc.pageContent.length / 4)),
      createdAt: new Date().toISOString(),
    },
  }))
}

export async function embedTexts(texts: string[], apiKey: string) {
  if (!apiKey || texts.length === 0) {
    return texts.map((text) => generateFallbackEmbedding(text))
  }

  const client = getEmbeddingClient(apiKey)
  const batches: number[][] = []
  const BATCH_SIZE = 20
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE)
    try {
      const embeddings = await client.embedDocuments(batch)
      embeddings.forEach((embedding) => {
        if (Array.isArray(embedding) && embedding.length === EMBEDDING_DIMENSIONS) {
          batches.push(normalizeEmbedding(embedding))
        } else {
          batches.push(generateFallbackEmbedding(batch[batches.length]))
        }
      })
    } catch (error) {
      console.warn('[RAG] Embedding batch failed, falling back to deterministic embeddings:', error)
      batch.forEach((chunk) => batches.push(generateFallbackEmbedding(chunk)))
    }
  }
  return batches
}

export async function embedQuery(query: string, apiKey: string) {
  const normalizedQuery = normalizeText(query)
  if (!apiKey || !normalizedQuery) {
    return generateFallbackEmbedding(normalizedQuery)
  }

  try {
    const client = new GoogleGenerativeAIEmbeddings({
      model: 'gemini-embedding-001',
      taskType: TaskType.RETRIEVAL_QUERY,
      apiKey,
    })
    const embedding = await client.embedQuery(normalizedQuery)
    if (Array.isArray(embedding) && embedding.length === EMBEDDING_DIMENSIONS) {
      return normalizeEmbedding(embedding)
    }
  } catch (error) {
    console.warn('[RAG] Query embedding failed, using fallback embedding:', error)
  }

  return generateFallbackEmbedding(normalizedQuery)
}

export function generateQueryVariants(query: string): string[] {
  const normalized = normalizeText(query)
  if (!normalized) {
    return []
  }

  const tokens = normalized
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

  const stopwords = new Set(['the', 'is', 'are', 'a', 'an', 'of', 'for', 'to', 'and', 'or', 'in', 'on', 'with', 'by', 'from', 'that', 'this', 'it', 'as'])
  const keywords = tokens.filter((token) => !stopwords.has(token)).slice(0, 12)
  const keywordQuery = keywords.join(' ')
  const statementQuery = normalized.replace(/[?]+$/, '')

  const variants = [normalized]
  if (keywordQuery && keywordQuery !== normalized) {
    variants.push(keywordQuery)
  }
  // Only add extra statement variants for longer, complex queries (>7 tokens)
  if (tokens.length > 7) {
    if (statementQuery && statementQuery !== normalized) {
      variants.push(statementQuery)
    }
  }
  return Array.from(new Set(variants)).slice(0, 3)
}

export async function vectorSearchCandidates(
  workspaceId: string,
  queryVectors: number[][],
  topK = VECTOR_TOP_K,
): Promise<RetrievedChunk[]> {
  const merged = new Map<string, RetrievedChunk>()
  for (const queryVector of queryVectors) {
    const queryVectorStr = `[${queryVector.join(',')}]`
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, "documentId", content, metadata, embedding <-> $2::vector AS distance
       FROM "DocumentChunk"
       WHERE "workspaceId" = $1
       ORDER BY embedding <-> $2::vector
       LIMIT $3`,
      workspaceId,
      queryVectorStr,
      topK,
    )

    for (const row of rows) {
      const existing = merged.get(row.id)
      const distance = Number(row.distance ?? 9999)
      if (!existing || distance < existing.distance) {
        merged.set(row.id, {
          id: row.id,
          documentId: row.documentId,
          content: normalizeText(row.content || ''),
          metadata: row.metadata || {},
          distance,
        })
      }
    }
  }
  return Array.from(merged.values()).sort((a, b) => a.distance - b.distance)
}

export async function keywordSearchCandidates(
  workspaceId: string,
  query: string,
  topK = KEYWORD_TOP_K,
): Promise<RetrievedChunk[]> {
  const sanitized = normalizeText(query)
  if (!sanitized) {
    return []
  }

  try {
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, "documentId", content, metadata,
              ts_rank_cd(to_tsvector('english', content || ' ' || coalesce(metadata->>'sourceTitle','')), plainto_tsquery('english', $2)) AS rank
       FROM "DocumentChunk"
       WHERE "workspaceId" = $1
         AND to_tsvector('english', content || ' ' || coalesce(metadata->>'sourceTitle','')) @@ plainto_tsquery('english', $2)
       ORDER BY rank DESC
       LIMIT $3`,
      workspaceId,
      sanitized,
      topK,
    )

    return rows.map((row) => ({
      id: row.id,
      documentId: row.documentId,
      content: normalizeText(row.content || ''),
      metadata: row.metadata || {},
      distance: 1 - Math.min(1, Number(row.rank ?? 0) / 10),
      rank: Number(row.rank ?? 0),
    }))
  } catch (error) {
    console.warn('[RAG] Keyword search FTS failed, falling back to ILIKE search:', error)
    const rows: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, "documentId", content, metadata
       FROM "DocumentChunk"
       WHERE "workspaceId" = $1
         AND (content ILIKE '%' || $2 || '%' OR coalesce(metadata->>'sourceTitle','') ILIKE '%' || $2 || '%')
       LIMIT $3`,
      workspaceId,
      sanitized,
      topK,
    )
    return rows.map((row) => ({
      id: row.id,
      documentId: row.documentId,
      content: normalizeText(row.content || ''),
      metadata: row.metadata || {},
      distance: 1.0,
    }))
  }
}

export async function fuzzySearchCandidates(
  workspaceId: string,
  query: string,
  topK = KEYWORD_TOP_K,
): Promise<RetrievedChunk[]> {
  const normalizedQuery = normalizeText(query).toLowerCase()
  const queryTokens = normalizedQuery.split(/[^a-z0-9]+/).filter(Boolean)

  if (queryTokens.length === 0) {
    return []
  }

  try {
    const allChunks: any[] = await prisma.$queryRawUnsafe(
      `SELECT id, "documentId", content, metadata FROM "DocumentChunk" WHERE "workspaceId" = $1 LIMIT 50`,
      workspaceId,
    )

    const scored: Array<{
      chunk: any
      matchCount: number
    }> = []

    for (const chunk of allChunks) {
      const chunkText = normalizeText(`${chunk.content} ${chunk.metadata?.sourceTitle ?? ''}`).toLowerCase()
      let matchCount = 0
      for (const token of queryTokens) {
        if (fuzzyMatchToken(token, chunkText, 2)) {
          matchCount++
        }
      }
      if (matchCount > 0) {
        scored.push({ chunk, matchCount })
      }
    }

    return scored
      .sort((a, b) => b.matchCount - a.matchCount)
      .slice(0, topK)
      .map((item) => ({
        id: item.chunk.id,
        documentId: item.chunk.documentId,
        content: normalizeText(item.chunk.content || ''),
        metadata: item.chunk.metadata || {},
        distance: 1 - Math.min(1, item.matchCount / queryTokens.length),
        rank: item.matchCount,
      }))
  } catch (error) {
    console.warn('[RAG] Fuzzy search failed:', error)
    return []
  }
}

export function scoreChunk(candidate: RetrievedChunk, query: string): number {
  const queryTerms = normalizeText(query)
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean)

  const text = normalizeText(`${candidate.content} ${candidate.metadata.sourceTitle ?? ''}`).toLowerCase()
  const matchCount = queryTerms.reduce((count, term) => (text.includes(term) ? count + 1 : count), 0)
  const lexicalBoost = Math.min(matchCount, 6) * 0.04
  const sourceBoost = candidate.metadata.sourceType === 'pdf' ? 0.0 : 0.0
  return candidate.distance - lexicalBoost - sourceBoost
}

export function rerankCandidates(candidates: RetrievedChunk[], query: string): RetrievedChunk[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      distance: scoreChunk(candidate, query),
    }))
    .sort((a, b) => a.distance - b.distance)
}

export function selectDiverseChunks(candidates: RetrievedChunk[], topK = CONTEXT_CHUNK_LIMIT): RetrievedChunk[] {
  const selected: RetrievedChunk[] = []
  const remaining = [...candidates]
  while (selected.length < topK && remaining.length > 0) {
    const next = remaining.shift()
    if (!next) break
    const overlapPenalty = selected.reduce((penalty, candidate) => {
      const shared = new Set(
        normalizeText(candidate.content)
          .toLowerCase()
          .split(/[^a-z0-9]+/)
          .filter(Boolean),
      )
      const currentTerms = new Set(
        normalizeText(next.content).toLowerCase().split(/[^a-z0-9]+/).filter(Boolean),
      )
      const intersection = [...shared].filter((token) => currentTerms.has(token)).length
      return penalty + Math.min(0.1, intersection / 25)
    }, 0)
    next.distance += overlapPenalty
    selected.push(next)
    remaining.sort((a, b) => a.distance - b.distance)
  }
  return selected.slice(0, topK)
}

export async function fetchNeighborChunks(
  workspaceId: string,
  topChunks: RetrievedChunk[],
  radius = 1,
): Promise<RetrievedChunk[]> {
  const neighbors: Map<string, RetrievedChunk> = new Map()
  const documentGroups: Record<string, number[]> = {}

  for (const chunk of topChunks) {
    const index = Number(chunk.metadata.chunkIndex ?? -1)
    if (!chunk.documentId || index < 0) continue
    documentGroups[chunk.documentId] = documentGroups[chunk.documentId] || []
    documentGroups[chunk.documentId].push(index)
  }

  const conditions = []
  const params: any[] = [workspaceId]
  let paramIndex = 2
  for (const [documentId, indices] of Object.entries(documentGroups)) {
    const rangeValues = indices.flatMap((index) => [Math.max(index - radius, 0), index + radius])
    const minIndex = Math.min(...rangeValues)
    const maxIndex = Math.max(...rangeValues)
    conditions.push(`("documentId" = $${paramIndex} AND (metadata->>'chunkIndex')::int BETWEEN $${paramIndex + 1} AND $${paramIndex + 2})`)
    params.push(documentId, minIndex, maxIndex)
    paramIndex += 3
  }

  if (conditions.length === 0) {
    return topChunks
  }

  const query = `SELECT id, "documentId", content, metadata
    FROM "DocumentChunk"
    WHERE "workspaceId" = $1 AND (${conditions.join(' OR ')})
    ORDER BY "documentId", (metadata->>'chunkIndex')::int ASC
    LIMIT 30`

  try {
    const rows: any[] = await prisma.$queryRawUnsafe(query, ...params)
    for (const row of rows) {
      neighbors.set(row.id, {
        id: row.id,
        documentId: row.documentId,
        content: normalizeText(row.content || ''),
        metadata: row.metadata || {},
        distance: Number(row.metadata?.chunkIndex ?? 9999),
      })
    }
  } catch (error) {
    console.warn('[RAG] Neighbor fetch failed:', error)
  }

  return Array.from(neighbors.values())
}

export function buildContext(chunks: RetrievedChunk[], query: string) {
  const selected = selectDiverseChunks(chunks, CONTEXT_CHUNK_LIMIT)
  const contextLines: string[] = []

  for (const chunk of selected) {
    const filename = chunk.metadata?.sourceTitle || chunk.metadata?.filename || 'document'
    const chunkIndex = chunk.metadata?.chunkIndex ?? '0'
    const sourceType = chunk.metadata?.sourceType || 'text'

    contextLines.push(
      `  <document id="${chunk.id}" filename="${filename}" chunk_index="${chunkIndex}" source_type="${sourceType}">\n    ${chunk.content}\n  </document>`
    )
  }

  return `<retrieved_context>\n${contextLines.join('\n\n')}\n</retrieved_context>`
}

export function buildSystemPrompt() {
  return `You are a workspace AI assistant. Use only the provided user query and the retrieved workspace context.
- Do not reveal filenames, storage URLs, document paths, or internal system details.
- Do not quote the documents verbatim; instead, synthesize the answer naturally.
- If the answer cannot be found in the workspace documents, say: "I don't know based on the workspace documents."
- Answer conversationally and be concise unless the user asks for more detail.
- If the user repeats a question, answer it again normally. Do NOT assume it is a trick.

Tool Usage & Task Creation Rules:
- ONLY call the save_task tool when the user provides specific task details, a topic, or an action item to save (e.g., "create a task to review the Q3 budget", "add task: fix auth bug").
- DO NOT call save_task if the user is asking to create/add/make a task WITHOUT specifying the task content or topic (e.g., "can you create a task for me?", "add a task please", "i want to make a task", "put a task on my board").
- In all vague cases, respond directly in natural language asking the user: "What specific task would you like me to create? Please provide a title or topic."
- NEVER call save_task with generic placeholder titles such as "Create a new task", "New Task", "Task", "User requested a task creation", or any phrase that merely restates the request to create a task.

If the context provided in the user's message is empty or insufficient, say you do not know instead of inventing details.`
}

export function calculateConfidence(chunks: RetrievedChunk[]) {
  if (!chunks.length) return 0
  const topChunkDistance = chunks[0].distance
  const base = Math.max(0, 1 - topChunkDistance)
  const diversityBoost = Math.min(0.3, chunks.length * 0.05)
  const confidence = Math.max(0, Math.min(1, base + diversityBoost))
  console.log(`[RAG] Confidence: topDistance=${topChunkDistance.toFixed(3)} base=${base.toFixed(3)} boost=${diversityBoost.toFixed(3)} final=${confidence.toFixed(3)}`)
  return confidence
}

export async function retrieveWorkspaceContext(workspaceId: string, query: string, apiKey: string): Promise<RetrievalResult> {
  console.log(`[RAG] Starting retrieval for query: "${query.substring(0, 80)}${query.length > 80 ? '...' : ''}"`)
  
  const queryVariants = generateQueryVariants(query)
  console.log(`[RAG] Generated ${queryVariants.length} query variant(s)`)
  
  if (queryVariants.length === 0) {
    return { context: '', chunks: [], confidence: 0, method: 'empty_query' }
  }

  const queryEmbeddings = await Promise.all(queryVariants.map((variant) => embedQuery(variant, apiKey)))
  console.log(`[RAG] Embedded ${queryEmbeddings.length} query variant(s)`)

  const vectorCandidates = await vectorSearchCandidates(workspaceId, queryEmbeddings, VECTOR_TOP_K)
  console.log(`[RAG] Vector search returned ${vectorCandidates.length} candidate(s)`)
  
  const keywordCandidates = await keywordSearchCandidates(workspaceId, query, KEYWORD_TOP_K)
  console.log(`[RAG] Keyword search returned ${keywordCandidates.length} candidate(s)`)

  const allCandidates = [...vectorCandidates, ...keywordCandidates]
  const uniqueMap = new Map<string, RetrievedChunk>()
  for (const candidate of allCandidates) {
    const existing = uniqueMap.get(candidate.id)
    if (!existing || candidate.distance < existing.distance) {
      uniqueMap.set(candidate.id, candidate)
    }
  }
  console.log(`[RAG] Merged to ${uniqueMap.size} unique candidate(s)`)

  let merged = Array.from(uniqueMap.values())
  merged = rerankCandidates(merged, query)
  console.log(`[RAG] After reranking: ${merged.length} candidate(s)`)
  
  if (merged.length === 0) {
    console.log('[RAG] No results from vector+keyword search, attempting fuzzy search...')
    const fuzzyCandidates = await fuzzySearchCandidates(workspaceId, query, KEYWORD_TOP_K)
    if (fuzzyCandidates.length > 0) {
      console.log(`[RAG] Fuzzy search found ${fuzzyCandidates.length} candidate(s)`)
      merged = fuzzyCandidates
    } else {
      return { context: '', chunks: [], confidence: 0, method: 'no_results' }
    }
  }

  const expanded = await fetchNeighborChunks(workspaceId, merged.slice(0, CONTEXT_CHUNK_LIMIT), 1)
  console.log(`[RAG] Neighbor expansion added ${Math.max(0, expanded.length - merged.length)}  chunk(s)`)
  
  const finalCandidates = rerankCandidates([...merged, ...expanded], query).slice(0, CONTEXT_CHUNK_LIMIT)
  console.log(`[RAG] Final selection: ${finalCandidates.length} chunk(s)`)
  
  const context = buildContext(finalCandidates, query)
  const confidence = calculateConfidence(finalCandidates)
  let method = vectorCandidates.length ? 'hybrid_vector_keyword' : 'keyword_fallback'
  if (merged.length > 0 && vectorCandidates.length === 0 && keywordCandidates.length === 0) {
    method = 'fuzzy_fallback'
  }

  console.log(`[RAG] Retrieval complete: method=${method} confidence=${confidence.toFixed(3)}`)
  return {
    context,
    chunks: finalCandidates,
    confidence,
    method,
  }
}
