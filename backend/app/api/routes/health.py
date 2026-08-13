import secrets

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import Response

from app.core.config import get_settings
from app.db.pool import get_pool
from app.observability.metrics import render_metrics

router = APIRouter(tags=["health"])


@router.get("/health")
async def health():
    return {"status": "ok"}


@router.get("/health/db")
async def health_db():
    pool = get_pool()
    value = await pool.fetchval("SELECT 1")
    return {"status": "ok", "db": value == 1}


@router.get("/metrics")
async def metrics(request: Request):
    token = get_settings().metrics_bearer_token
    if token:
        auth_header = request.headers.get("authorization", "")
        provided = auth_header[7:] if auth_header.lower().startswith("bearer ") else ""
        if not secrets.compare_digest(provided, token):
            raise HTTPException(status_code=401, detail="Unauthorized")

    body, content_type = render_metrics()
    return Response(content=body, media_type=content_type)
