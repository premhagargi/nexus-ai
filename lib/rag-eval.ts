import { retrieveWorkspaceContext, RetrievedChunk } from './rag'

export interface RAGEvalMetric {
  query: string
  retrievedCount: number
  topDistance: number
  meanDistance: number
  precisionAtK: number
  reciprocalRank: number
  confidenceScore: number
  latencyMs: number
  pass: boolean
}

export interface RAGEvalReport {
  timestamp: string
  workspaceId: string
  totalQueriesEvaluated: number
  overallPrecision: number
  meanReciprocalRank: number
  averageConfidence: number
  averageLatencyMs: number
  metrics: RAGEvalMetric[]
}

/**
 * Calculates Precision@K based on exact query token overlap across top-K chunks.
 */
function calculatePrecisionAtK(chunks: RetrievedChunk[], queryTokens: string[]): number {
  if (chunks.length === 0 || queryTokens.length === 0) return 0

  let relevantChunkCount = 0
  for (const chunk of chunks) {
    const chunkLower = chunk.content.toLowerCase()
    const matchesToken = queryTokens.some((token) => chunkLower.includes(token))
    if (matchesToken) {
      relevantChunkCount++
    }
  }

  return Number((relevantChunkCount / chunks.length).toFixed(2))
}

/**
 * Calculates Reciprocal Rank (1 / rank of first relevant chunk).
 */
function calculateReciprocalRank(chunks: RetrievedChunk[], queryTokens: string[]): number {
  if (chunks.length === 0 || queryTokens.length === 0) return 0

  for (let i = 0; i < chunks.length; i++) {
    const chunkLower = chunks[i].content.toLowerCase()
    if (queryTokens.some((token) => chunkLower.includes(token))) {
      return Number((1 / (i + 1)).toFixed(2))
    }
  }

  return 0
}

/**
 * Runs automated RAG evaluation benchmarks on a set of test queries for a given workspace.
 */
export async function evaluateWorkspaceRAG(
  workspaceId: string,
  testQueries: string[],
  googleApiKey: string
): Promise<RAGEvalReport> {
  const metrics: RAGEvalMetric[] = []

  for (const query of testQueries) {
    const startTime = Date.now()
    const result = await retrieveWorkspaceContext(workspaceId, query, googleApiKey)
    const latencyMs = Date.now() - startTime

    const queryTokens = query
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, '')
      .split(/\s+/)
      .filter((t) => t.length > 3)

    const precisionAtK = calculatePrecisionAtK(result.chunks, queryTokens)
    const reciprocalRank = calculateReciprocalRank(result.chunks, queryTokens)
    const distances = result.chunks.map((c) => c.distance)
    const topDistance = distances.length > 0 ? Math.min(...distances) : 1
    const meanDistance = distances.length > 0 ? distances.reduce((a, b) => a + b, 0) / distances.length : 1

    metrics.push({
      query,
      retrievedCount: result.chunks.length,
      topDistance: Number(topDistance.toFixed(3)),
      meanDistance: Number(meanDistance.toFixed(3)),
      precisionAtK,
      reciprocalRank,
      confidenceScore: Number(result.confidence.toFixed(2)),
      latencyMs,
      pass: result.chunks.length > 0 && result.confidence >= 0.35,
    })
  }

  const totalQueries = metrics.length || 1
  const overallPrecision = Number(
    (metrics.reduce((acc, m) => acc + m.precisionAtK, 0) / totalQueries).toFixed(2)
  )
  const meanReciprocalRank = Number(
    (metrics.reduce((acc, m) => acc + m.reciprocalRank, 0) / totalQueries).toFixed(2)
  )
  const averageConfidence = Number(
    (metrics.reduce((acc, m) => acc + m.confidenceScore, 0) / totalQueries).toFixed(2)
  )
  const averageLatencyMs = Math.round(
    metrics.reduce((acc, m) => acc + m.latencyMs, 0) / totalQueries
  )

  return {
    timestamp: new Date().toISOString(),
    workspaceId,
    totalQueriesEvaluated: metrics.length,
    overallPrecision,
    meanReciprocalRank,
    averageConfidence,
    averageLatencyMs,
    metrics,
  }
}
