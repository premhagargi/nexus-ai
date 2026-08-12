"""Shared raw-SQL lookups used by dependencies across multiple routers.

Table/column names match prisma/schema.prisma exactly, including Prisma's
double-quoted CamelCase identifiers (e.g. "workspaceId"). Route- and
feature-specific queries live next to the service that owns them; this
module only holds the handful of lookups needed by shared dependencies
(current-user resolution, workspace membership checks).
"""
import asyncpg


async def get_user_by_id(pool: asyncpg.Pool, user_id: str) -> asyncpg.Record | None:
    return await pool.fetchrow(
        'SELECT id, email, "createdAt" FROM "User" WHERE id = $1',
        user_id,
    )


async def get_user_by_email(pool: asyncpg.Pool, email: str) -> asyncpg.Record | None:
    return await pool.fetchrow(
        'SELECT id, email, password FROM "User" WHERE email = $1',
        email,
    )


async def get_membership(
    pool: asyncpg.Pool, workspace_id: str, user_id: str
) -> asyncpg.Record | None:
    return await pool.fetchrow(
        """
        SELECT m.id, m.role, m."workspaceId", m."userId", w.name AS "workspaceName", w.slug
        FROM "Membership" m
        JOIN "Workspace" w ON w.id = m."workspaceId"
        WHERE m."workspaceId" = $1 AND m."userId" = $2
        """,
        workspace_id,
        user_id,
    )
