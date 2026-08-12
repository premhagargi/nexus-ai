"""Shared Cerebras client + instrumented call helpers.

Every LLM call in the app funnels through here so `nexus_llm_*` metrics are
recorded consistently, with no fabricated numbers: duration is wall-clock
around the actual SDK call, and token counts are only recorded when the
Cerebras response actually includes a `usage` object.
"""
import time

from cerebras.cloud.sdk import AsyncCerebras

from app.core.config import get_settings
from app.core.logging import get_logger
from app.observability.metrics import llm_request_duration_seconds, llm_requests_total, llm_tokens_total
from app.observability.tracing import span

logger = get_logger(__name__)

PROVIDER = "cerebras"
_client: AsyncCerebras | None = None


def get_cerebras_client() -> AsyncCerebras:
    global _client
    if _client is None:
        settings = get_settings()
        _client = AsyncCerebras(api_key=settings.cerebras_api_key)
    return _client


def _read(obj: object, name: str):
    """The Cerebras SDK doesn't always coerce streaming payloads into their
    pydantic models (an empty/edge-case chunk can arrive as a raw dict), so
    every field read here tolerates both shapes.
    """
    if obj is None:
        return None
    if isinstance(obj, dict):
        return obj.get(name)
    return getattr(obj, name, None)


def record_llm_usage(model: str, status: str, duration: float, usage: object | None = None) -> None:
    llm_requests_total.labels(provider=PROVIDER, model=model, status=status).inc()
    llm_request_duration_seconds.labels(provider=PROVIDER, model=model).observe(duration)

    if usage is not None:
        prompt_tokens = _read(usage, "prompt_tokens")
        completion_tokens = _read(usage, "completion_tokens")
        total_tokens = _read(usage, "total_tokens")
        if prompt_tokens is not None:
            llm_tokens_total.labels(provider=PROVIDER, model=model, token_type="prompt").inc(prompt_tokens)
        if completion_tokens is not None:
            llm_tokens_total.labels(provider=PROVIDER, model=model, token_type="completion").inc(completion_tokens)
        if total_tokens is not None:
            llm_tokens_total.labels(provider=PROVIDER, model=model, token_type="total").inc(total_tokens)


async def instrumented_completion(model: str, **kwargs):
    """Wraps a non-streaming Cerebras chat completion with metrics + logging."""
    client = get_cerebras_client()
    start = time.perf_counter()
    with span("llm.chat_completion", **{"llm.model": model, "llm.provider": PROVIDER}):
        try:
            response = await client.chat.completions.create(model=model, **kwargs)
            duration = time.perf_counter() - start
            record_llm_usage(model, "success", duration, getattr(response, "usage", None))
            return response
        except Exception:
            duration = time.perf_counter() - start
            record_llm_usage(model, "error", duration)
            logger.error("llm.call.failed", model=model, duration_ms=round(duration * 1000, 1))
            raise
