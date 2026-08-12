"""Port of app/api/rag/eval/route.ts."""
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel

from app.api.dependencies.auth import CurrentUser, get_current_user
from app.core.config import get_settings
from app.db.pool import get_pool
from app.db.queries import get_membership
from app.services.rag_eval import evaluate_workspace_rag

router = APIRouter(prefix="/api/rag", tags=["rag"])

_DEFAULT_QUERIES = [
    "What are the key themes in these documents?",
    "Summary of main topics and conclusions",
    "Action items and responsibilities",
    "Important metrics, dates, and amounts",
]


class EvalRequest(BaseModel):
    workspaceId: str
    customQueries: list[str] | None = None


@router.post("/eval")
async def run_eval(body: EvalRequest, user: CurrentUser = Depends(get_current_user)):
    pool = get_pool()
    membership = await get_membership(pool, body.workspaceId, user.id)
    if membership is None:
        raise HTTPException(status_code=403, detail="Forbidden")

    queries = body.customQueries[:10] if body.customQueries else _DEFAULT_QUERIES
    settings = get_settings()

    report = await evaluate_workspace_rag(pool, body.workspaceId, queries, settings.google_generative_ai_api_key)
    return {"success": True, "report": report}
