"""Port of app/api/chat/history/route.ts."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.dependencies.auth import CurrentUser, get_current_user
from app.core.time import now_naive_utc
from app.db.pool import get_pool
from app.db.queries import get_membership

router = APIRouter(prefix="/api/chat/history", tags=["chat"])


class SaveMessageRequest(BaseModel):
    workspaceId: str
    role: str
    content: str


async def _require_membership(pool, workspace_id: str, user_id: str):
    membership = await get_membership(pool, workspace_id, user_id)
    if membership is None:
        raise HTTPException(status_code=401, detail="Unauthorized")


@router.get("")
async def get_history(workspaceId: str, user: CurrentUser = Depends(get_current_user)):
    pool = get_pool()
    await _require_membership(pool, workspaceId, user.id)

    conversation = await pool.fetchrow(
        'SELECT id FROM "Conversation" WHERE "workspaceId" = $1 ORDER BY "updatedAt" DESC LIMIT 1', workspaceId
    )
    if conversation is None:
        return {"messages": []}

    rows = await pool.fetch(
        'SELECT id, role, content, citations FROM "Message" WHERE "conversationId" = $1 '
        'AND role IN (\'user\',\'assistant\') ORDER BY "createdAt" ASC LIMIT 100',
        conversation["id"],
    )

    messages = [
        {
            "id": r["id"],
            "role": r["role"],
            "parts": [{"type": "text", "text": r["content"]}],
            "content": r["content"],
            "citations": r["citations"],
        }
        for r in rows
    ]
    return {"messages": messages, "conversationId": conversation["id"]}


@router.post("")
async def save_message(body: SaveMessageRequest, user: CurrentUser = Depends(get_current_user)):
    pool = get_pool()
    await _require_membership(pool, body.workspaceId, user.id)

    conversation = await pool.fetchrow(
        'SELECT id FROM "Conversation" WHERE "workspaceId" = $1 ORDER BY "updatedAt" DESC LIMIT 1', body.workspaceId
    )
    now = now_naive_utc()
    if conversation is None:
        conversation_id = str(uuid.uuid4())
        await pool.execute(
            'INSERT INTO "Conversation" (id, "workspaceId", "createdAt", "updatedAt") VALUES ($1, $2, $3, $3)',
            conversation_id, body.workspaceId, now,
        )
    else:
        conversation_id = conversation["id"]
        await pool.execute('UPDATE "Conversation" SET "updatedAt" = $2 WHERE id = $1', conversation_id, now)

    message_id = str(uuid.uuid4())
    await pool.execute(
        'INSERT INTO "Message" (id, "conversationId", role, content, "createdAt") VALUES ($1, $2, $3, $4, $5)',
        message_id, conversation_id, body.role, body.content, now,
    )
    return {"message": {"id": message_id, "conversationId": conversation_id, "role": body.role, "content": body.content}}


@router.delete("")
async def clear_history(workspaceId: str, user: CurrentUser = Depends(get_current_user)):
    pool = get_pool()
    await _require_membership(pool, workspaceId, user.id)
    await pool.execute(
        'DELETE FROM "Message" WHERE "conversationId" IN (SELECT id FROM "Conversation" WHERE "workspaceId" = $1)',
        workspaceId,
    )
    return {"success": True}
