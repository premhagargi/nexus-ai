"""Embedding generation via Google's gemini-embedding-001.

Bug-fix note (found while porting lib/rag.ts, confirmed against the live
Supabase DB): the original Next.js pipeline called the Google embedding API
without an explicit output dimensionality. gemini-embedding-001 defaults to
3072 dimensions, but the code only accepted a result if it was exactly 768
— so every real API call silently failed that check and fell back to
`generate_fallback_embedding` (a deterministic character-hash vector).
Every embedding already stored in "DocumentChunk" is that fallback, not a
real semantic embedding (verified: cosine similarity of 0.9999999989
between a stored embedding and the recomputed fallback for its content).

This port fixes it by passing output_dimensionality=768 explicitly, which
the Google API honors (Matryoshka Representation Learning truncation), and
re-normalizes since truncated output isn't unit-length. Existing chunks are
re-embedded by scripts/reembed_chunks.py so retrieval stays consistent.
"""
import asyncio
import math
import re

import google.generativeai as genai

EMBEDDING_MODEL = "models/gemini-embedding-001"
EMBEDDING_DIMENSIONS = 768
_EMBED_BATCH_SIZE = 20
_MAX_ATTEMPTS = 3


def normalize_text(text: str) -> str:
    text = re.sub(r"[​-‍﻿]", "", text or "")
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def normalize_embedding(vector: list[float]) -> list[float]:
    magnitude = math.sqrt(sum(v * v for v in vector)) or 1.0
    return [v / magnitude for v in vector]


def generate_fallback_embedding(text: str, dimensions: int = EMBEDDING_DIMENSIONS) -> list[float]:
    """Deterministic character-hash embedding used only when the real API is
    unavailable/misconfigured — kept as a genuine last-resort fallback, not
    the primary path (see module docstring for why this used to be the
    primary path by accident).
    """
    vector = [0.0] * dimensions
    normalized = normalize_text(text)
    for i, ch in enumerate(normalized):
        idx = i % dimensions
        vector[idx] = (vector[idx] + ord(ch) / 255.0) % 2.0 - 1.0
    return normalize_embedding(vector)


async def _embed_content(text: str, api_key: str, task_type: str) -> list[float] | None:
    def _call():
        genai.configure(api_key=api_key)
        result = genai.embed_content(
            model=EMBEDDING_MODEL,
            content=text,
            task_type=task_type,
            output_dimensionality=EMBEDDING_DIMENSIONS,
        )
        return result["embedding"]

    return await asyncio.to_thread(_call)


async def embed_texts(texts: list[str], api_key: str) -> list[list[float]]:
    if not api_key or not texts:
        return [generate_fallback_embedding(t) for t in texts]

    results: list[list[float]] = [None] * len(texts)  # type: ignore[list-item]

    for start in range(0, len(texts), _EMBED_BATCH_SIZE):
        batch = texts[start : start + _EMBED_BATCH_SIZE]
        success = False
        attempts = 0
        while not success and attempts < _MAX_ATTEMPTS:
            attempts += 1
            try:
                embeddings = await asyncio.gather(
                    *[_embed_content(t, api_key, "retrieval_document") for t in batch]
                )
                for offset, embedding in enumerate(embeddings):
                    if isinstance(embedding, list) and len(embedding) == EMBEDDING_DIMENSIONS:
                        results[start + offset] = normalize_embedding(embedding)
                    else:
                        results[start + offset] = generate_fallback_embedding(batch[offset])
                success = True
            except Exception as error:  # noqa: BLE001 - deliberately broad, mirrors JS try/catch fallback
                message = str(error)
                if "429" in message or "rate" in message.lower():
                    await asyncio.sleep(attempts * 2)
                else:
                    for offset, chunk in enumerate(batch):
                        results[start + offset] = generate_fallback_embedding(chunk)
                    success = True

        if not success:
            for offset, chunk in enumerate(batch):
                results[start + offset] = generate_fallback_embedding(chunk)

    return results  # type: ignore[return-value]


async def embed_query(query: str, api_key: str) -> list[float]:
    normalized_query = normalize_text(query)
    if not api_key or not normalized_query:
        return generate_fallback_embedding(normalized_query)

    try:
        embedding = await _embed_content(normalized_query, api_key, "retrieval_query")
        if isinstance(embedding, list) and len(embedding) == EMBEDDING_DIMENSIONS:
            return normalize_embedding(embedding)
    except Exception:  # noqa: BLE001 - mirrors JS try/catch fallback
        pass

    return generate_fallback_embedding(normalized_query)
