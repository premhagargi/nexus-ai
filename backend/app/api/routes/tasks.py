"""Port of app/api/tasks/route.ts and app/api/tasks/[taskId]/route.ts."""
import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field

from app.api.dependencies.auth import CurrentUser, get_current_user
from app.core.time import now_naive_utc
from app.db.pool import get_pool
from app.db.queries import get_membership

router = APIRouter(prefix="/api/tasks", tags=["tasks"])


class CreateTaskRequest(BaseModel):
    workspaceId: str
    title: str = Field(min_length=1)
    description: str | None = None


class UpdateTaskRequest(BaseModel):
    completed: bool | None = None
    title: str | None = None
    description: str | None = None


async def _require_membership(pool, workspace_id: str, user_id: str):
    membership = await get_membership(pool, workspace_id, user_id)
    if membership is None:
        raise HTTPException(status_code=403, detail="Unauthorized workspace access")
    return membership


@router.get("")
async def list_tasks(workspaceId: str, user: CurrentUser = Depends(get_current_user)):
    pool = get_pool()
    await _require_membership(pool, workspaceId, user.id)
    rows = await pool.fetch(
        'SELECT * FROM "Task" WHERE "workspaceId" = $1 ORDER BY "createdAt" DESC', workspaceId
    )
    return [dict(r) | {"createdAt": r["createdAt"].isoformat(), "updatedAt": r["updatedAt"].isoformat()} for r in rows]


@router.post("")
async def create_task(body: CreateTaskRequest, user: CurrentUser = Depends(get_current_user)):
    if not body.title.strip():
        raise HTTPException(status_code=400, detail="workspaceId and title are required")

    pool = get_pool()
    await _require_membership(pool, body.workspaceId, user.id)

    task_id = str(uuid.uuid4())
    now = now_naive_utc()
    description = body.description.strip() if body.description else None
    await pool.execute(
        'INSERT INTO "Task" (id, "workspaceId", title, description, completed, "createdAt", "updatedAt") '
        "VALUES ($1, $2, $3, $4, false, $5, $5)",
        task_id, body.workspaceId, body.title.strip(), description, now,
    )
    row = await pool.fetchrow('SELECT * FROM "Task" WHERE id = $1', task_id)
    return dict(row) | {"createdAt": row["createdAt"].isoformat(), "updatedAt": row["updatedAt"].isoformat()}


@router.patch("/{task_id}")
async def update_task(task_id: str, body: UpdateTaskRequest, user: CurrentUser = Depends(get_current_user)):
    pool = get_pool()
    task = await pool.fetchrow('SELECT * FROM "Task" WHERE id = $1', task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    await _require_membership(pool, task["workspaceId"], user.id)

    completed = body.completed if body.completed is not None else task["completed"]
    title = body.title.strip() if body.title is not None else task["title"]
    description = body.description.strip() if body.description is not None else task["description"]

    await pool.execute(
        'UPDATE "Task" SET completed = $2, title = $3, description = $4, "updatedAt" = $5 WHERE id = $1',
        task_id, completed, title, description, now_naive_utc(),
    )
    row = await pool.fetchrow('SELECT * FROM "Task" WHERE id = $1', task_id)
    return dict(row) | {"createdAt": row["createdAt"].isoformat(), "updatedAt": row["updatedAt"].isoformat()}


@router.delete("/{task_id}")
async def delete_task(task_id: str, user: CurrentUser = Depends(get_current_user)):
    pool = get_pool()
    task = await pool.fetchrow('SELECT "workspaceId" FROM "Task" WHERE id = $1', task_id)
    if task is None:
        raise HTTPException(status_code=404, detail="Task not found")

    await _require_membership(pool, task["workspaceId"], user.id)
    await pool.execute('DELETE FROM "Task" WHERE id = $1', task_id)
    return {"success": True, "deletedId": task_id}
