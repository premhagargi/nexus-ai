from fastapi import APIRouter, Body, Depends, HTTPException
from fastapi.responses import StreamingResponse

from app.agent.sse import UI_STREAM_HEADERS
from app.api.dependencies.auth import CurrentUser, get_current_user
from app.db.pool import get_pool
from app.db.queries import get_membership
from app.services.chat_service import stream_chat_response

router = APIRouter(tags=["chat"])


@router.post("/api/chat")
async def chat(
    body: dict = Body(...),
    user: CurrentUser = Depends(get_current_user),
):
    # workspaceId travels in the body (or ?workspaceId= query param), not the
    # path — mirrors the original Next.js route, which read `body.workspaceId
    # || req.nextUrl.searchParams.get('workspaceId')`. useChat() POSTs the
    # workspace id alongside `messages`, so there's no {workspaceId} path segment here.
    workspace_id = body.get("workspaceId")
    if not workspace_id:
        raise HTTPException(status_code=400, detail="workspaceId is required")

    pool = get_pool()
    membership = await get_membership(pool, workspace_id, user.id)
    if membership is None:
        raise HTTPException(status_code=401, detail="Unauthorized")

    messages = body.get("messages") or []
    return StreamingResponse(
        stream_chat_response(pool, workspace_id, messages),
        headers=UI_STREAM_HEADERS,
    )
