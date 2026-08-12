"""Port of workspace logic previously spread across app/actions.ts (Server
Actions), app/dashboard/page.tsx, app/dashboard/[workspaceId]/layout.tsx,
app/dashboard/[workspaceId]/settings/page.tsx, and
app/api/workspace/invite/route.ts.

Server Actions only exist inside a Next.js server runtime, so with the
backend moved out to FastAPI they become plain REST endpoints that the
frontend calls with fetch() instead of an RPC-style import.
"""
import re
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, EmailStr, Field

from app.api.dependencies.auth import CurrentUser, get_current_user, require_role
from app.core.config import get_settings
from app.core.time import now_naive_utc
from app.db.pool import get_pool
from app.db.queries import get_membership
from app.services.resend_client import send_workspace_invite

router = APIRouter(prefix="/api/workspaces", tags=["workspaces"])


class CreateWorkspaceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class UpdateWorkspaceRequest(BaseModel):
    name: str = Field(min_length=1, max_length=200)


class InviteRequest(BaseModel):
    email: EmailStr
    role: str = "MEMBER"


def _slugify(name: str, suffix: str) -> str:
    slug_base = re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", name.lower()))
    return f"{slug_base}-{suffix}"


@router.get("")
async def list_workspaces(user: CurrentUser = Depends(get_current_user)):
    pool = get_pool()
    rows = await pool.fetch(
        """
        SELECT w.id, w.name, w.slug, w."ownerId", w."createdAt", m.role
        FROM "Membership" m
        JOIN "Workspace" w ON w.id = m."workspaceId"
        WHERE m."userId" = $1
        ORDER BY w."createdAt" ASC
        """,
        user.id,
    )

    if rows:
        return [dict(r) | {"createdAt": r["createdAt"].isoformat()} for r in rows]

    # No workspace yet — mirrors dashboard/page.tsx's auto-provision-on-first-login behavior.
    workspace_id = str(uuid.uuid4())
    membership_id = str(uuid.uuid4())
    now = now_naive_utc()
    slug = _slugify("Personal Workspace", user.id[:8])

    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                'INSERT INTO "Workspace" (id, name, slug, "ownerId", "createdAt") VALUES ($1, $2, $3, $4, $5)',
                workspace_id, "Personal Workspace", slug, user.id, now,
            )
            await conn.execute(
                'INSERT INTO "Membership" (id, "workspaceId", "userId", role, "createdAt") VALUES ($1, $2, $3, $4, $5)',
                membership_id, workspace_id, user.id, "OWNER", now,
            )

    return [{
        "id": workspace_id, "name": "Personal Workspace", "slug": slug,
        "ownerId": user.id, "createdAt": now.isoformat(), "role": "OWNER",
    }]


@router.post("")
async def create_workspace(body: CreateWorkspaceRequest, user: CurrentUser = Depends(get_current_user)):
    pool = get_pool()
    workspace_id = str(uuid.uuid4())
    membership_id = str(uuid.uuid4())
    now = now_naive_utc()
    slug = _slugify(body.name, uuid.uuid4().hex[:5])

    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                'INSERT INTO "Workspace" (id, name, slug, "ownerId", "createdAt") VALUES ($1, $2, $3, $4, $5)',
                workspace_id, body.name, slug, user.id, now,
            )
            await conn.execute(
                'INSERT INTO "Membership" (id, "workspaceId", "userId", role, "createdAt") VALUES ($1, $2, $3, $4, $5)',
                membership_id, workspace_id, user.id, "OWNER", now,
            )

    return {"id": workspace_id, "name": body.name, "slug": slug}


@router.get("/{workspace_id}")
async def get_workspace(workspace_id: str, user: CurrentUser = Depends(get_current_user)):
    pool = get_pool()
    membership = await get_membership(pool, workspace_id, user.id)
    if membership is None:
        raise HTTPException(status_code=404, detail="Workspace not found")

    row = await pool.fetchrow(
        """
        SELECT w.id, w.name, w.slug, u.email AS "ownerEmail"
        FROM "Workspace" w JOIN "User" u ON u.id = w."ownerId"
        WHERE w.id = $1
        """,
        workspace_id,
    )
    if row is None:
        raise HTTPException(status_code=404, detail="Workspace not found")

    return dict(row) | {"role": membership["role"]}


@router.get("/{workspace_id}/stats")
async def get_workspace_stats(workspace_id: str, user: CurrentUser = Depends(get_current_user)):
    """Port of the Promise.all() Prisma .count() batch previously embedded in
    app/dashboard/[workspaceId]/page.tsx (WorkspaceOverview)."""
    pool = get_pool()
    membership = await get_membership(pool, workspace_id, user.id)
    if membership is None:
        raise HTTPException(status_code=404, detail="Workspace not found")

    doc_count = await pool.fetchval('SELECT count(*) FROM "Document" WHERE "workspaceId" = $1', workspace_id)
    chunk_count = await pool.fetchval('SELECT count(*) FROM "DocumentChunk" WHERE "workspaceId" = $1', workspace_id)
    task_count = await pool.fetchval('SELECT count(*) FROM "Task" WHERE "workspaceId" = $1', workspace_id)
    completed_task_count = await pool.fetchval(
        'SELECT count(*) FROM "Task" WHERE "workspaceId" = $1 AND completed = true', workspace_id
    )
    conv_count = await pool.fetchval('SELECT count(*) FROM "Conversation" WHERE "workspaceId" = $1', workspace_id)
    tool_execution_count = await pool.fetchval(
        'SELECT count(*) FROM "ToolExecution" WHERE "workspaceId" = $1', workspace_id
    )
    recent_rows = await pool.fetch(
        'SELECT id, "toolName", "createdAt", result FROM "ToolExecution" '
        'WHERE "workspaceId" = $1 ORDER BY "createdAt" DESC LIMIT 5',
        workspace_id,
    )

    return {
        "docCount": doc_count,
        "chunkCount": chunk_count,
        "taskCount": task_count,
        "completedTaskCount": completed_task_count,
        "convCount": conv_count,
        "toolExecutionCount": tool_execution_count,
        "recentLogs": [
            {
                "id": r["id"],
                "toolName": r["toolName"],
                "createdAt": r["createdAt"].isoformat(),
                "status": (r["result"] or {}).get("status", "success"),
            }
            for r in recent_rows
        ],
    }


@router.patch("/{workspace_id}")
async def update_workspace(
    workspace_id: str, body: UpdateWorkspaceRequest, access=Depends(require_role("OWNER"))
):
    pool = get_pool()
    await pool.execute('UPDATE "Workspace" SET name = $2 WHERE id = $1', workspace_id, body.name)
    return {"success": True}


@router.delete("/{workspace_id}")
async def delete_workspace(workspace_id: str, access=Depends(require_role("OWNER"))):
    pool = get_pool()
    await pool.execute('DELETE FROM "Workspace" WHERE id = $1', workspace_id)
    return {"success": True}


@router.post("/{workspace_id}/invite")
async def invite_member(workspace_id: str, body: InviteRequest, access=Depends(require_role("OWNER"))):
    settings = get_settings()
    invite_url = f"{settings.cors_origins[0]}/login?invitedWorkspace={workspace_id}"

    try:
        result = send_workspace_invite(
            body.email, access.workspace_name, access.user.email, body.role, invite_url
        )
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))

    return {"success": True, "emailId": result.get("id") if isinstance(result, dict) else None, "invitedEmail": body.email}
