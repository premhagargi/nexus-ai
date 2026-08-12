"""Prometheus metrics for the Nexus AI backend.

Exposed at GET /metrics in Prometheus text format. Every metric here is
updated from real request/LLM/RAG/agent execution — nothing is synthetic.
Labels are kept low-cardinality on purpose (route *templates*, not raw
paths with IDs; bounded enums for status/tool/model) so this is safe to
scrape in production without blowing up Prometheus's series cardinality.
"""
from prometheus_client import CONTENT_TYPE_LATEST, Counter, Histogram, generate_latest

LATENCY_BUCKETS = (0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10, 20, 30, 60)

# ── API ──────────────────────────────────────────────────────────────────
http_requests_total = Counter(
    "nexus_http_requests_total",
    "Total HTTP requests handled by the FastAPI backend",
    ["method", "route", "status_code"],
)
http_request_duration_seconds = Histogram(
    "nexus_http_request_duration_seconds",
    "HTTP request duration in seconds (used to derive P50/P95/P99 via histogram_quantile)",
    ["method", "route"],
    buckets=LATENCY_BUCKETS,
)

# ── LLM ──────────────────────────────────────────────────────────────────
llm_requests_total = Counter(
    "nexus_llm_requests_total",
    "Total LLM inference calls",
    ["provider", "model", "status"],
)
llm_request_duration_seconds = Histogram(
    "nexus_llm_request_duration_seconds",
    "LLM inference call duration in seconds",
    ["provider", "model"],
    buckets=LATENCY_BUCKETS,
)
llm_tokens_total = Counter(
    "nexus_llm_tokens_total",
    "Total tokens reported by the LLM provider (only recorded when the provider returns real usage figures)",
    ["provider", "model", "token_type"],  # token_type: prompt | completion | total
)

# ── RAG ──────────────────────────────────────────────────────────────────
rag_retrieval_total = Counter(
    "nexus_rag_retrieval_total",
    "Total RAG retrieval operations",
    ["status"],  # success | no_results | error
)
rag_retrieval_duration_seconds = Histogram(
    "nexus_rag_retrieval_duration_seconds",
    "RAG retrieval duration in seconds (embedding + vector search + keyword search + rerank)",
    buckets=LATENCY_BUCKETS,
)
rag_retrieved_chunks = Histogram(
    "nexus_rag_retrieved_chunks",
    "Number of chunks returned per RAG retrieval",
    buckets=(0, 1, 2, 3, 4, 5, 6, 8, 10, 15, 20),
)

# ── Agent ────────────────────────────────────────────────────────────────
agent_runs_total = Counter(
    "nexus_agent_runs_total",
    "Total agent orchestration runs",
    ["status"],  # success | error
)
agent_run_duration_seconds = Histogram(
    "nexus_agent_run_duration_seconds",
    "Total agent run duration in seconds, including all tool calls",
    buckets=LATENCY_BUCKETS,
)
agent_tool_invocations_total = Counter(
    "nexus_agent_tool_invocations_total",
    "Total tool invocations made by the agent",
    ["tool_name", "status"],
)
agent_tool_duration_seconds = Histogram(
    "nexus_agent_tool_duration_seconds",
    "Tool execution duration in seconds",
    ["tool_name"],
    buckets=LATENCY_BUCKETS,
)

# ── Document ingestion ──────────────────────────────────────────────────
document_ingestion_total = Counter(
    "nexus_document_ingestion_total",
    "Total document ingestion attempts",
    ["status"],  # success | error
)
document_ingestion_duration_seconds = Histogram(
    "nexus_document_ingestion_duration_seconds",
    "Document ingestion duration in seconds (extract + chunk + embed + store)",
    buckets=(0.5, 1, 2.5, 5, 10, 20, 30, 60, 120, 300),
)


def render_metrics() -> tuple[bytes, str]:
    return generate_latest(), CONTENT_TYPE_LATEST
