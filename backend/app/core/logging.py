"""Structured JSON logging with request-correlation IDs.

METRICS answer "what is happening" (aggregate, cheap, always-on).
LOGS answer "what happened" (this specific request, this specific error).
TRACES answer "where did the time go" (see app/observability/tracing.py).

This module wires the three together loosely: every log line emitted during
a request carries the same `request_id` that shows up in the response header
and in trace span attributes, so a slow/failed request can be followed across
all three signals.
"""
import logging
import sys

import structlog

REQUEST_ID_HEADER = "x-request-id"


def configure_logging(log_level: str = "INFO") -> None:
    logging.basicConfig(
        format="%(message)s",
        stream=sys.stdout,
        level=getattr(logging, log_level.upper(), logging.INFO),
    )

    structlog.configure(
        processors=[
            structlog.contextvars.merge_contextvars,
            structlog.processors.add_log_level,
            structlog.processors.TimeStamper(fmt="iso"),
            structlog.processors.StackInfoRenderer(),
            structlog.processors.format_exc_info,
            structlog.processors.JSONRenderer(),
        ],
        wrapper_class=structlog.make_filtering_bound_logger(
            getattr(logging, log_level.upper(), logging.INFO)
        ),
        context_class=dict,
        logger_factory=structlog.PrintLoggerFactory(),
        cache_logger_on_first_use=True,
    )


def get_logger(name: str):
    return structlog.get_logger(name)
