"""OpenTelemetry tracing — optional, off by default (OTEL_ENABLED=false).

Spans are added only where they earn their keep for the "why was this
request slow" debugging story: the request itself, RAG retrieval, the LLM
call, and each agent tool invocation. When OTEL_ENABLED is false this
module is a no-op (get_tracer returns a tracer whose spans are never
exported), so there's zero cost/behavior change in environments that don't
set an OTLP endpoint (e.g. local dev).
"""
from contextlib import contextmanager

from opentelemetry import trace
from opentelemetry.sdk.resources import SERVICE_NAME, Resource
from opentelemetry.sdk.trace import TracerProvider
from opentelemetry.sdk.trace.export import BatchSpanProcessor, ConsoleSpanExporter

from app.core.config import get_settings

_configured = False


def configure_tracing() -> None:
    global _configured
    if _configured:
        return
    settings = get_settings()

    resource = Resource.create({SERVICE_NAME: "nexus-ai-backend"})
    provider = TracerProvider(resource=resource)

    if settings.otel_enabled and settings.otel_exporter_otlp_endpoint:
        from opentelemetry.exporter.otlp.proto.http.trace_exporter import OTLPSpanExporter

        provider.add_span_processor(
            BatchSpanProcessor(OTLPSpanExporter(endpoint=settings.otel_exporter_otlp_endpoint))
        )
    elif settings.otel_enabled:
        provider.add_span_processor(BatchSpanProcessor(ConsoleSpanExporter()))

    trace.set_tracer_provider(provider)
    _configured = True


def get_tracer():
    return trace.get_tracer("nexus.backend")


@contextmanager
def span(name: str, **attributes):
    tracer = get_tracer()
    with tracer.start_as_current_span(name) as current_span:
        for key, value in attributes.items():
            if value is not None:
                current_span.set_attribute(key, value)
        yield current_span
