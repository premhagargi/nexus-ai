"""Port of the ToolExecution query embedded in
app/dashboard/[workspaceId]/logs/page.tsx (previously direct Prisma access)."""
from fastapi import APIRouter, Depends, HTTPException

from app.api.dependencies.auth import CurrentUser, get_current_user
from app.db.pool import get_pool
from app.db.queries import get_membership

router = APIRouter(prefix="/api/logs", tags=["logs"])


@router.get("")
async def list_tool_executions(workspaceId: str, user: CurrentUser = Depends(get_current_user)):
    pool = get_pool()
    membership = await get_membership(pool, workspaceId, user.id)
    if membership is None:
        raise HTTPException(status_code=403, detail="Forbidden")

    rows = await pool.fetch(
        'SELECT id, "workspaceId", "toolName", arguments, result, "createdAt" '
        'FROM "ToolExecution" WHERE "workspaceId" = $1 ORDER BY "createdAt" DESC',
        workspaceId,
    )
    return [dict(r) | {"createdAt": r["createdAt"].isoformat()} for r in rows]
