"""One-off migration: re-embed existing DocumentChunk rows with real
Google gemini-embedding-001 vectors (768-dim, via output_dimensionality),
replacing the deterministic hash fallback vectors that were silently
stored by the original Next.js pipeline (see app/services/embeddings.py
docstring for the full story). Run once against the live Supabase DB.

Usage: python scripts/reembed_chunks.py
"""
import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from app.core.config import get_settings
from app.db.pool import close_pool, get_pool, init_pool
from app.services.embeddings import embed_texts

BATCH_SIZE = 20


async def main() -> None:
    settings = get_settings()
    await init_pool()
    pool = get_pool()

    rows = await pool.fetch('SELECT id, content FROM "DocumentChunk" ORDER BY "createdAt" ASC')
    print(f"Found {len(rows)} chunks to re-embed")

    updated = 0
    for start in range(0, len(rows), BATCH_SIZE):
        batch = rows[start : start + BATCH_SIZE]
        texts = [row["content"] for row in batch]
        embeddings = await embed_texts(texts, settings.google_generative_ai_api_key)

        async with pool.acquire() as conn:
            async with conn.transaction():
                for row, embedding in zip(batch, embeddings):
                    vector_literal = "[" + ",".join(str(v) for v in embedding) + "]"
                    await conn.execute(
                        'UPDATE "DocumentChunk" SET embedding = $2::vector WHERE id = $1',
                        row["id"],
                        vector_literal,
                    )
        updated += len(batch)
        print(f"  re-embedded {updated}/{len(rows)}")

    print("Done.")
    await close_pool()


if __name__ == "__main__":
    asyncio.run(main())
