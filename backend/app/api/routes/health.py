from fastapi import APIRouter
from fastapi.responses import Response

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
async def metrics():
    body, content_type = render_metrics()
    return Response(content=body, media_type=content_type)
