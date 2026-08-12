from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from opentelemetry.instrumentation.fastapi import FastAPIInstrumentor

from app.api.routes import auth, chat, chat_history, documents, health, logs, rag_eval, tasks, workspaces
from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
from app.db.pool import close_pool, init_pool
from app.observability.middleware import ObservabilityMiddleware
from app.observability.tracing import configure_tracing

settings = get_settings()
configure_logging(settings.log_level)
logger = get_logger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_tracing()
    await init_pool()
    logger.info("app.startup", environment=settings.environment)
    yield
    await close_pool()
    logger.info("app.shutdown")


app = FastAPI(title="Nexus AI Backend", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.add_middleware(ObservabilityMiddleware)

if settings.otel_enabled:
    # Auto-instruments incoming requests (the "where did the time go" root
    # span every RAG/LLM/tool span below attaches to as a child).
    FastAPIInstrumentor.instrument_app(app)

app.include_router(health.router, prefix="")
app.include_router(chat.router, prefix="")
app.include_router(documents.router)
app.include_router(auth.router)
app.include_router(tasks.router)
app.include_router(workspaces.router)
app.include_router(chat_history.router)
app.include_router(rag_eval.router)
app.include_router(logs.router)
