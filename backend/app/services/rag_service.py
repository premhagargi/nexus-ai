"""Port of lib/rag.ts — hybrid RAG retrieval pipeline.

Vector search (pgvector cosine distance) + Postgres full-text keyword
search + ILIKE/Levenshtein fuzzy fallback, merged, lexically reranked,
diversified (MMR-like overlap penalty), expanded with neighbor chunks, and
scored for confidence. Table/column names match prisma/schema.prisma
exactly. See app/services/embeddings.py for the embedding-dimension bug
fix applied during this port.
"""
import re
import time
from dataclasses import dataclass, field
from typing import Any

import asyncpg

from app.core.logging import get_logger
from app.observability.metrics import rag_retrieval_duration_seconds, rag_retrieval_total, rag_retrieved_chunks
from app.observability.tracing import span
from app.services.embeddings import embed_query, normalize_text

logger = get_logger(__name__)

CHUNK_SIZE = 1100
CHUNK_OVERLAP = 220
VECTOR_TOP_K = 8
KEYWORD_TOP_K = 8
CONTEXT_CHUNK_LIMIT = 6
MIN_CONFIDENCE_SCORE = 0.35
VECTOR_DISTANCE_THRESHOLD = 0.45

_STOPWORDS = {
    "the", "is", "are", "a", "an", "of", "for", "to", "and", "or", "in", "on",
    "with", "by", "from", "that", "this", "it", "as",
}


@dataclass
class RetrievedChunk:
    id: str
    document_id: str
    content: str
    metadata: dict[str, Any]
    distance: float
    rank: float | None = None


@dataclass
class RetrievalResult:
    context: str
    chunks: list[RetrievedChunk] = field(default_factory=list)
    confidence: float = 0.0
    method: str = "empty_query"


def build_source_title(filename: str) -> str:
    title = re.sub(r"\.[^.]+$", "", filename)
    title = re.sub(r"[_-]+", " ", title)
    title = re.sub(r"\s+", " ", title)
    return title.strip()


def _tokenize(text: str) -> list[str]:
    return [t for t in re.split(r"[^a-z0-9]+", text.lower()) if t]


def levenshtein_distance(a: str, b: str) -> int:
    a_len, b_len = len(a), len(b)
    matrix = [[0] * (b_len + 1) for _ in range(a_len + 1)]
    for i in range(a_len + 1):
        matrix[i][0] = i
    for j in range(b_len + 1):
        matrix[0][j] = j
    for i in range(1, a_len + 1):
        for j in range(1, b_len + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            matrix[i][j] = min(
                matrix[i - 1][j] + 1,
                matrix[i][j - 1] + 1,
                matrix[i - 1][j - 1] + cost,
            )
    return matrix[a_len][b_len]


def fuzzy_match_token(token: str, text: str, max_distance: int = 2) -> bool:
    for word in _tokenize(text):
        if levenshtein_distance(token, word) <= max_distance:
            return True
    return False


def generate_query_variants(query: str) -> list[str]:
    normalized = normalize_text(query)
    if not normalized:
        return []

    tokens = _tokenize(normalized)
    keywords = [t for t in tokens if t not in _STOPWORDS][:12]
    keyword_query = " ".join(keywords)
    statement_query = re.sub(r"[?]+$", "", normalized)

    variants = [normalized]
    if keyword_query and keyword_query != normalized:
        variants.append(keyword_query)
    if len(tokens) > 7 and statement_query and statement_query != normalized:
        variants.append(statement_query)

    seen: list[str] = []
    for v in variants:
        if v not in seen:
            seen.append(v)
    return seen[:3]


async def vector_search_candidates(
    pool: asyncpg.Pool, workspace_id: str, query_vectors: list[list[float]], top_k: int = VECTOR_TOP_K
) -> list[RetrievedChunk]:
    merged: dict[str, RetrievedChunk] = {}
    for query_vector in query_vectors:
        vector_literal = "[" + ",".join(str(v) for v in query_vector) + "]"
        try:
            rows = await pool.fetch(
                """
                SELECT id, "documentId", content, metadata, embedding <-> $2::vector AS distance
                FROM "DocumentChunk"
                WHERE "workspaceId" = $1
                ORDER BY embedding <-> $2::vector
                LIMIT $3
                """,
                workspace_id,
                vector_literal,
                top_k,
            )
        except Exception:
            logger.warning("rag.vector_search.failed", workspace_id=workspace_id)
            continue

        for row in rows:
            distance = float(row["distance"]) if row["distance"] is not None else 9999.0
            existing = merged.get(row["id"])
            if existing is None or distance < existing.distance:
                merged[row["id"]] = RetrievedChunk(
                    id=row["id"],
                    document_id=row["documentId"],
                    content=normalize_text(row["content"] or ""),
                    metadata=dict(row["metadata"] or {}),
                    distance=distance,
                )

    return sorted(merged.values(), key=lambda c: c.distance)


async def keyword_search_candidates(
    pool: asyncpg.Pool, workspace_id: str, query: str, top_k: int = KEYWORD_TOP_K
) -> list[RetrievedChunk]:
    sanitized = normalize_text(query)
    if not sanitized:
        return []

    try:
        rows = await pool.fetch(
            """
            SELECT id, "documentId", content, metadata,
                   ts_rank_cd(to_tsvector('english', content || ' ' || coalesce(metadata->>'sourceTitle','')), plainto_tsquery('english', $2)) AS rank
            FROM "DocumentChunk"
            WHERE "workspaceId" = $1
              AND to_tsvector('english', content || ' ' || coalesce(metadata->>'sourceTitle','')) @@ plainto_tsquery('english', $2)
            ORDER BY rank DESC
            LIMIT $3
            """,
            workspace_id,
            sanitized,
            top_k,
        )
        return [
            RetrievedChunk(
                id=row["id"],
                document_id=row["documentId"],
                content=normalize_text(row["content"] or ""),
                metadata=dict(row["metadata"] or {}),
                distance=1 - min(1.0, float(row["rank"] or 0) / 10),
                rank=float(row["rank"] or 0),
            )
            for row in rows
        ]
    except Exception:
        logger.warning("rag.keyword_search.fts_failed_falling_back_to_ilike", workspace_id=workspace_id)
        rows = await pool.fetch(
            """
            SELECT id, "documentId", content, metadata
            FROM "DocumentChunk"
            WHERE "workspaceId" = $1
              AND (content ILIKE '%' || $2 || '%' OR coalesce(metadata->>'sourceTitle','') ILIKE '%' || $2 || '%')
            LIMIT $3
            """,
            workspace_id,
            sanitized,
            top_k,
        )
        return [
            RetrievedChunk(
                id=row["id"],
                document_id=row["documentId"],
                content=normalize_text(row["content"] or ""),
                metadata=dict(row["metadata"] or {}),
                distance=1.0,
            )
            for row in rows
        ]


async def fuzzy_search_candidates(
    pool: asyncpg.Pool, workspace_id: str, query: str, top_k: int = KEYWORD_TOP_K
) -> list[RetrievedChunk]:
    query_tokens = _tokenize(normalize_text(query))
    if not query_tokens:
        return []

    try:
        rows = await pool.fetch(
            'SELECT id, "documentId", content, metadata FROM "DocumentChunk" WHERE "workspaceId" = $1 LIMIT 50',
            workspace_id,
        )
    except Exception:
        logger.warning("rag.fuzzy_search.failed", workspace_id=workspace_id)
        return []

    scored: list[tuple[asyncpg.Record, int]] = []
    for row in rows:
        metadata = dict(row["metadata"] or {})
        chunk_text = normalize_text(f"{row['content']} {metadata.get('sourceTitle', '')}").lower()
        match_count = sum(1 for token in query_tokens if fuzzy_match_token(token, chunk_text, 2))
        if match_count > 0:
            scored.append((row, match_count))

    scored.sort(key=lambda item: item[1], reverse=True)
    results = []
    for row, match_count in scored[:top_k]:
        metadata = dict(row["metadata"] or {})
        results.append(
            RetrievedChunk(
                id=row["id"],
                document_id=row["documentId"],
                content=normalize_text(row["content"] or ""),
                metadata=metadata,
                distance=1 - min(1.0, match_count / len(query_tokens)),
                rank=float(match_count),
            )
        )
    return results


def score_chunk(candidate: RetrievedChunk, query: str) -> float:
    query_terms = _tokenize(normalize_text(query))
    text = normalize_text(f"{candidate.content} {candidate.metadata.get('sourceTitle', '')}").lower()
    match_count = sum(1 for term in query_terms if term in text)
    lexical_boost = min(match_count, 6) * 0.04
    return candidate.distance - lexical_boost


def rerank_candidates(candidates: list[RetrievedChunk], query: str) -> list[RetrievedChunk]:
    rescored = [
        RetrievedChunk(c.id, c.document_id, c.content, c.metadata, score_chunk(c, query), c.rank)
        for c in candidates
    ]
    return sorted(rescored, key=lambda c: c.distance)


def select_diverse_chunks(candidates: list[RetrievedChunk], top_k: int = CONTEXT_CHUNK_LIMIT) -> list[RetrievedChunk]:
    selected: list[RetrievedChunk] = []
    remaining = list(candidates)
    while len(selected) < top_k and remaining:
        next_chunk = remaining.pop(0)
        overlap_penalty = 0.0
        next_terms = set(_tokenize(normalize_text(next_chunk.content)))
        for candidate in selected:
            shared = set(_tokenize(normalize_text(candidate.content)))
            intersection = len(shared & next_terms)
            overlap_penalty += min(0.1, intersection / 25)
        next_chunk.distance += overlap_penalty
        selected.append(next_chunk)
        remaining.sort(key=lambda c: c.distance)
    return selected[:top_k]


async def fetch_neighbor_chunks(
    pool: asyncpg.Pool, workspace_id: str, top_chunks: list[RetrievedChunk], radius: int = 1
) -> list[RetrievedChunk]:
    document_groups: dict[str, list[int]] = {}
    for chunk in top_chunks:
        index = chunk.metadata.get("chunkIndex", -1)
        try:
            index = int(index)
        except (TypeError, ValueError):
            index = -1
        if not chunk.document_id or index < 0:
            continue
        document_groups.setdefault(chunk.document_id, []).append(index)

    if not document_groups:
        return top_chunks

    conditions = []
    params: list[Any] = [workspace_id]
    param_index = 2
    for document_id, indices in document_groups.items():
        range_values = [v for index in indices for v in (max(index - radius, 0), index + radius)]
        min_index, max_index = min(range_values), max(range_values)
        conditions.append(
            f'("documentId" = ${param_index} AND (metadata->>\'chunkIndex\')::int BETWEEN ${param_index + 1} AND ${param_index + 2})'
        )
        params.extend([document_id, min_index, max_index])
        param_index += 3

    query = f"""
        SELECT id, "documentId", content, metadata
        FROM "DocumentChunk"
        WHERE "workspaceId" = $1 AND ({' OR '.join(conditions)})
        ORDER BY "documentId", (metadata->>'chunkIndex')::int ASC
        LIMIT 30
    """

    neighbors: dict[str, RetrievedChunk] = {}
    try:
        rows = await pool.fetch(query, *params)
        for row in rows:
            metadata = dict(row["metadata"] or {})
            neighbors[row["id"]] = RetrievedChunk(
                id=row["id"],
                document_id=row["documentId"],
                content=normalize_text(row["content"] or ""),
                metadata=metadata,
                distance=float(metadata.get("chunkIndex", 9999)),
            )
    except Exception:
        logger.warning("rag.neighbor_fetch.failed", workspace_id=workspace_id)

    return list(neighbors.values())


def build_context(chunks: list[RetrievedChunk], query: str) -> str:
    selected = select_diverse_chunks(chunks, CONTEXT_CHUNK_LIMIT)
    lines = []
    for chunk in selected:
        filename = chunk.metadata.get("sourceTitle") or chunk.metadata.get("filename") or "document"
        chunk_index = chunk.metadata.get("chunkIndex", "0")
        source_type = chunk.metadata.get("sourceType", "text")
        lines.append(
            f'  <document id="{chunk.id}" filename="{filename}" chunk_index="{chunk_index}" source_type="{source_type}">\n'
            f"    {chunk.content}\n  </document>"
        )
    return "<retrieved_context>\n" + "\n\n".join(lines) + "\n</retrieved_context>"


def build_system_prompt() -> str:
    return """You are a workspace AI assistant. Use only the provided user query and the retrieved workspace context.
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

If the context provided in the user's message is empty or insufficient, say you do not know instead of inventing details."""


def calculate_confidence(chunks: list[RetrievedChunk]) -> float:
    if not chunks:
        return 0.0
    top_distance = chunks[0].distance
    base = max(0.0, 1 - top_distance)
    diversity_boost = min(0.3, len(chunks) * 0.05)
    confidence = max(0.0, min(1.0, base + diversity_boost))
    logger.debug(
        "rag.confidence",
        top_distance=round(top_distance, 3),
        base=round(base, 3),
        boost=round(diversity_boost, 3),
        confidence=round(confidence, 3),
    )
    return confidence


async def retrieve_workspace_context(
    pool: asyncpg.Pool, workspace_id: str, query: str, api_key: str
) -> RetrievalResult:
    with span("rag.retrieve_workspace_context", workspace_id=workspace_id) as current_span:
        result = await _retrieve_workspace_context_impl(pool, workspace_id, query, api_key)
        current_span.set_attribute("rag.method", result.method)
        current_span.set_attribute("rag.confidence", result.confidence)
        current_span.set_attribute("rag.chunk_count", len(result.chunks))
        return result


async def _retrieve_workspace_context_impl(
    pool: asyncpg.Pool, workspace_id: str, query: str, api_key: str
) -> RetrievalResult:
    start = time.perf_counter()
    logger.info("rag.retrieval.start", workspace_id=workspace_id, query_preview=query[:80])

    query_variants = generate_query_variants(query)
    if not query_variants:
        rag_retrieval_total.labels(status="no_results").inc()
        return RetrievalResult(context="", chunks=[], confidence=0.0, method="empty_query")

    query_embeddings = [await embed_query(v, api_key) for v in query_variants]

    vector_candidates = await vector_search_candidates(pool, workspace_id, query_embeddings, VECTOR_TOP_K)
    keyword_candidates = await keyword_search_candidates(pool, workspace_id, query, KEYWORD_TOP_K)

    unique: dict[str, RetrievedChunk] = {}
    for candidate in [*vector_candidates, *keyword_candidates]:
        existing = unique.get(candidate.id)
        if existing is None or candidate.distance < existing.distance:
            unique[candidate.id] = candidate

    merged = rerank_candidates(list(unique.values()), query)

    if not merged:
        fuzzy_candidates = await fuzzy_search_candidates(pool, workspace_id, query, KEYWORD_TOP_K)
        if fuzzy_candidates:
            merged = fuzzy_candidates
        else:
            duration = time.perf_counter() - start
            rag_retrieval_duration_seconds.observe(duration)
            rag_retrieval_total.labels(status="no_results").inc()
            rag_retrieved_chunks.observe(0)
            return RetrievalResult(context="", chunks=[], confidence=0.0, method="no_results")

    expanded = await fetch_neighbor_chunks(pool, workspace_id, merged[:CONTEXT_CHUNK_LIMIT], 1)
    final_candidates = rerank_candidates([*merged, *expanded], query)[:CONTEXT_CHUNK_LIMIT]

    context = build_context(final_candidates, query)
    confidence = calculate_confidence(final_candidates)

    method = "hybrid_vector_keyword" if vector_candidates else "keyword_fallback"
    if merged and not vector_candidates and not keyword_candidates:
        method = "fuzzy_fallback"

    duration = time.perf_counter() - start
    rag_retrieval_duration_seconds.observe(duration)
    rag_retrieval_total.labels(status="success").inc()
    rag_retrieved_chunks.observe(len(final_candidates))

    logger.info(
        "rag.retrieval.complete",
        workspace_id=workspace_id,
        method=method,
        confidence=round(confidence, 3),
        chunk_count=len(final_candidates),
        duration_ms=round(duration * 1000, 1),
    )

    return RetrievalResult(context=context, chunks=final_candidates, confidence=confidence, method=method)


@dataclass
class GroundingClaim:
    statement: str
    verified: bool
    confidence: float
    matched_chunk_id: str | None = None
    source_title: str | None = None


@dataclass
class VerificationResult:
    grounded_score: int
    status: str  # FULLY_GROUNDED | PARTIALLY_GROUNDED | LOW_GROUNDING | NO_CONTEXT
    claims: list[GroundingClaim] = field(default_factory=list)


def verify_citations(response_content: str, retrieved_chunks: list[RetrievedChunk]) -> VerificationResult:
    if not response_content or not retrieved_chunks:
        return VerificationResult(grounded_score=0, status="NO_CONTEXT", claims=[])

    raw_sentences = re.split(r"(?<=[.!?])\s+", response_content)
    sentences = [
        s.strip()
        for s in raw_sentences
        if len(s.strip()) > 15 and not s.strip().startswith(("#", "-", "*"))
    ]

    if not sentences:
        return VerificationResult(grounded_score=100, status="FULLY_GROUNDED", claims=[])

    claims: list[GroundingClaim] = []
    verified_count = 0

    for sentence in sentences:
        claim_tokens = [t for t in re.sub(r"[^a-z0-9\s]", "", sentence.lower()).split() if len(t) > 3]

        if not claim_tokens:
            claims.append(GroundingClaim(statement=sentence, verified=True, confidence=1.0))
            verified_count += 1
            continue

        max_match_ratio = 0.0
        best_chunk: RetrievedChunk | None = None

        for chunk in retrieved_chunks:
            chunk_lower = chunk.content.lower()
            matches = sum(1 for token in claim_tokens if token in chunk_lower)
            match_ratio = matches / len(claim_tokens)
            if match_ratio > max_match_ratio:
                max_match_ratio = match_ratio
                best_chunk = chunk

        is_verified = max_match_ratio >= 0.45 or (
            best_chunk is not None and sentence.lower()[:30] in best_chunk.content.lower()
        )
        if is_verified:
            verified_count += 1

        claims.append(
            GroundingClaim(
                statement=sentence,
                verified=is_verified,
                confidence=round(max_match_ratio, 2),
                matched_chunk_id=best_chunk.id if best_chunk else None,
                source_title=(best_chunk.metadata.get("sourceTitle") or best_chunk.metadata.get("filename"))
                if best_chunk
                else None,
            )
        )

    grounded_score = round((verified_count / len(sentences)) * 100)
    if grounded_score < 40:
        status = "LOW_GROUNDING"
    elif grounded_score < 85:
        status = "PARTIALLY_GROUNDED"
    else:
        status = "FULLY_GROUNDED"

    return VerificationResult(grounded_score=grounded_score, status=status, claims=claims)
