"""ASGI middleware that records real request metrics + a correlation ID.

Route label uses the matched Starlette route *template* (e.g.
"/api/documents/{document_id}"), never the raw path, so per-request IDs in
URLs never become a Prometheus label value (unbounded cardinality).
"""
import time
import uuid

import structlog
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from app.core.logging import REQUEST_ID_HEADER
from app.observability.metrics import http_request_duration_seconds, http_requests_total


def _route_template(request: Request) -> str:
    route = request.scope.get("route")
    if route is not None and getattr(route, "path", None):
        return route.path
    return request.url.path


class ObservabilityMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        request_id = request.headers.get(REQUEST_ID_HEADER) or uuid.uuid4().hex
        structlog.contextvars.bind_contextvars(request_id=request_id)

        start = time.perf_counter()
        try:
            response = await call_next(request)
        except Exception:
            duration = time.perf_counter() - start
            route = _route_template(request)
            http_requests_total.labels(method=request.method, route=route, status_code="500").inc()
            http_request_duration_seconds.labels(method=request.method, route=route).observe(duration)
            raise
        finally:
            structlog.contextvars.unbind_contextvars("request_id")

        duration = time.perf_counter() - start
        route = _route_template(request)
        http_requests_total.labels(
            method=request.method, route=route, status_code=str(response.status_code)
        ).inc()
        http_request_duration_seconds.labels(method=request.method, route=route).observe(duration)
        response.headers[REQUEST_ID_HEADER] = request_id
        return response
