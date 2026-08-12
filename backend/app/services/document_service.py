"""Port of processDocument()/reprocessDocument() from the upload and
reprocess Next.js routes — extract -> chunk -> embed -> batch insert.

Note on Inngest: the original app published a `document/process` event to
an Inngest queue AND ran the same pipeline synchronously via Next.js's
`after()` — the Inngest send was effectively redundant, since `after()`
already guaranteed the work ran. This port keeps a single path (a FastAPI
BackgroundTask) instead of carrying over the duplicate queue.
"""
import time
import uuid

import asyncpg

from app.core.logging import get_logger
from app.observability.metrics import document_ingestion_duration_seconds, document_ingestion_total
from app.services import storage_service
from app.services.chunking import create_document_chunks
from app.services.embeddings import embed_texts, generate_fallback_embedding
from app.services.text_extraction import extract_text

logger = get_logger(__name__)

BATCH_SIZE = 20


async def process_document(
    pool: asyncpg.Pool, document_id: str, storage_path: str, workspace_id: str, filename: str, google_api_key: str
) -> None:
    start = time.perf_counter()
    try:
        await pool.execute('DELETE FROM "DocumentChunk" WHERE "documentId" = $1', document_id)

        data = storage_service.download_file(storage_path)
        ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
        text = extract_text(data, ext)

        logger.info("document.extracted", document_id=document_id, chars=len(text))

        chunks = create_document_chunks(text, filename, document_id, ext)
        logger.info("document.chunked", document_id=document_id, chunk_count=len(chunks))

        texts = [c["content"] for c in chunks]
        vectors = await embed_texts(texts, google_api_key)

        for i in range(0, len(chunks), BATCH_SIZE):
            batch_chunks = chunks[i : i + BATCH_SIZE]
            batch_vectors = vectors[i : i + BATCH_SIZE]

            async with pool.acquire() as conn:
                async with conn.transaction():
                    for chunk, vector in zip(batch_chunks, batch_vectors):
                        if not vector or len(vector) != 768:
                            vector = generate_fallback_embedding(chunk["content"])
                        vector_literal = "[" + ",".join(str(v) for v in vector) + "]"
                        await conn.execute(
                            'INSERT INTO "DocumentChunk" (id, "workspaceId", "documentId", content, embedding, metadata, "createdAt") '
                            "VALUES (gen_random_uuid(), $1, $2, $3, $4::vector, $5, NOW())",
                            workspace_id, document_id, chunk["content"], vector_literal, chunk["metadata"],
                        )
            logger.info(
                "document.batch_inserted", document_id=document_id,
                batch=i // BATCH_SIZE + 1, total_batches=-(-len(chunks) // BATCH_SIZE),
            )

        await pool.execute(
            'UPDATE "Document" SET status = $2, "chunkCount" = $3, "errorMessage" = NULL WHERE id = $1',
            document_id, "COMPLETED", len(chunks),
        )

        document_ingestion_total.labels(status="success").inc()
        document_ingestion_duration_seconds.observe(time.perf_counter() - start)
        logger.info("document.ingestion.complete", document_id=document_id, chunk_count=len(chunks))

    except Exception as error:
        logger.error("document.ingestion.failed", document_id=document_id, error=str(error))
        await pool.execute('DELETE FROM "DocumentChunk" WHERE "documentId" = $1', document_id)
        await pool.execute(
            'UPDATE "Document" SET status = $2, "errorMessage" = $3 WHERE id = $1',
            document_id, "FAILED", str(error),
        )
        document_ingestion_total.labels(status="error").inc()
        document_ingestion_duration_seconds.observe(time.perf_counter() - start)


def build_storage_path(workspace_id: str, filename: str) -> str:
    ext = filename.rsplit(".", 1)[-1].lower() if "." in filename else ""
    return f"{workspace_id}/{int(time.time() * 1000)}-{uuid.uuid4().hex[:6]}.{ext}"
