"""asyncpg connection pool to the shared Supabase Postgres + pgvector database.

Same DATABASE_URL / schema the Next.js app's Prisma client used to talk to.
FastAPI is now the only process writing to it. No new database, no new
schema — table names below (User, Workspace, Membership, Document,
DocumentChunk, Conversation, Message, Task, ToolExecution) match
prisma/schema.prisma exactly, including Prisma's default double-quoted
CamelCase identifiers.
"""
import json
from urllib.parse import parse_qs, urlparse, urlunparse

import asyncpg

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger(__name__)

_pool: asyncpg.Pool | None = None


async def _init_connection(conn: asyncpg.Connection) -> None:
    """asyncpg returns json/jsonb columns as raw strings by default — Prisma's
    client auto-decoded them, and our service code (rag_service, chunking,
    etc.) assumes real dicts/lists. Register codecs so every connection in
    the pool decodes/encodes them transparently, matching Prisma's behavior.
    """
    await conn.set_type_codec(
        "jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog"
    )
    await conn.set_type_codec(
        "json", encoder=json.dumps, decoder=json.loads, schema="pg_catalog"
    )


def _strip_pgbouncer_param(dsn: str) -> str:
    """Supabase's pooled connection string (port 6543) includes
    `?pgbouncer=true`, a Prisma-specific hint that asyncpg doesn't
    understand as a libpq parameter. PgBouncer in transaction-pooling mode
    also can't serve server-side prepared statements, so we additionally
    disable asyncpg's statement cache when connecting through it.
    """
    parsed = urlparse(dsn)
    query = parse_qs(parsed.query)
    query.pop("pgbouncer", None)
    new_query = "&".join(f"{k}={v[0]}" for k, v in query.items())
    return urlunparse(parsed._replace(query=new_query))


async def init_pool() -> asyncpg.Pool:
    global _pool
    if _pool is not None:
        return _pool

    settings = get_settings()
    dsn = _strip_pgbouncer_param(settings.database_url)
    is_pooled = "pgbouncer=true" in settings.database_url or ":6543" in settings.database_url

    logger.info("db.pool.connecting", pooled=is_pooled)
    _pool = await asyncpg.create_pool(
        dsn,
        min_size=1,
        max_size=10,
        statement_cache_size=0 if is_pooled else 100,
        command_timeout=30,
        init=_init_connection,
    )
    logger.info("db.pool.connected")
    return _pool


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Database pool not initialized — call init_pool() during startup")
    return _pool
