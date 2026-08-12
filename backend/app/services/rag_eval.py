"""Port of lib/rag-eval.ts — Precision@K / Reciprocal Rank RAG benchmark harness."""
import re
import time
from datetime import datetime, timezone

import asyncpg

from app.services import rag_service

MIN_CONFIDENCE_SCORE = 0.35


def _tokenize_query(query: str) -> list[str]:
    cleaned = re.sub(r"[^a-z0-9\s]", "", query.lower())
    return [t for t in cleaned.split() if len(t) > 3]


def _precision_at_k(chunks: list[rag_service.RetrievedChunk], query_tokens: list[str]) -> float:
    if not chunks or not query_tokens:
        return 0.0
    relevant = sum(
        1 for c in chunks if any(token in c.content.lower() for token in query_tokens)
    )
    return round(relevant / len(chunks), 2)


def _reciprocal_rank(chunks: list[rag_service.RetrievedChunk], query_tokens: list[str]) -> float:
    if not chunks or not query_tokens:
        return 0.0
    for i, chunk in enumerate(chunks):
        if any(token in chunk.content.lower() for token in query_tokens):
            return round(1 / (i + 1), 2)
    return 0.0


async def evaluate_workspace_rag(
    pool: asyncpg.Pool, workspace_id: str, test_queries: list[str], google_api_key: str
) -> dict:
    metrics = []

    for query in test_queries:
        start = time.perf_counter()
        result = await rag_service.retrieve_workspace_context(pool, workspace_id, query, google_api_key)
        latency_ms = round((time.perf_counter() - start) * 1000)

        query_tokens = _tokenize_query(query)
        precision_at_k = _precision_at_k(result.chunks, query_tokens)
        reciprocal_rank = _reciprocal_rank(result.chunks, query_tokens)
        distances = [c.distance for c in result.chunks]
        top_distance = min(distances) if distances else 1.0
        mean_distance = sum(distances) / len(distances) if distances else 1.0

        metrics.append({
            "query": query,
            "retrievedCount": len(result.chunks),
            "topDistance": round(top_distance, 3),
            "meanDistance": round(mean_distance, 3),
            "precisionAtK": precision_at_k,
            "reciprocalRank": reciprocal_rank,
            "confidenceScore": round(result.confidence, 2),
            "latencyMs": latency_ms,
            "pass": len(result.chunks) > 0 and result.confidence >= MIN_CONFIDENCE_SCORE,
        })

    total = len(metrics) or 1
    overall_precision = round(sum(m["precisionAtK"] for m in metrics) / total, 2)
    mean_reciprocal_rank = round(sum(m["reciprocalRank"] for m in metrics) / total, 2)
    average_confidence = round(sum(m["confidenceScore"] for m in metrics) / total, 2)
    average_latency_ms = round(sum(m["latencyMs"] for m in metrics) / total)

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "workspaceId": workspace_id,
        "totalQueriesEvaluated": len(metrics),
        "overallPrecision": overall_precision,
        "meanReciprocalRank": mean_reciprocal_rank,
        "averageConfidence": average_confidence,
        "averageLatencyMs": average_latency_ms,
        "metrics": metrics,
    }
