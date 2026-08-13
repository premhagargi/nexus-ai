from functools import lru_cache
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    # Database (same Supabase Postgres + pgvector instance used by the Next.js app)
    database_url: str
    direct_url: str | None = None

    # Auth — must match the Next.js lib/auth.ts JWT secret so sessions issued by
    # either side (during migration) verify identically.
    jwt_secret: str = "nexus-ai-dev-jwt-secret-key-change-in-prod-32bytes"
    jwt_algorithm: str = "HS256"
    jwt_expires_seconds: int = 60 * 60 * 24  # 1 day, matches setSession() in lib/auth.ts

    # Supabase storage
    supabase_url: str = ""
    supabase_service_role_key: str = ""

    # LLM / embeddings — same providers as the existing app
    cerebras_api_key: str = ""
    cerebras_model: str = "gpt-oss-120b"
    google_generative_ai_api_key: str = ""

    # Integrations
    slack_webhook_url: str = ""
    resend_api_key: str = ""
    resend_domain: str = "adchariot.in"

    # CORS
    frontend_origins: str = "http://localhost:3000"

    # Observability
    otel_enabled: bool = False
    otel_exporter_otlp_endpoint: str = ""
    log_level: str = "INFO"
    environment: str = "development"
    # /metrics is public by default (empty = no auth, matches prior behavior).
    # Set this to require a Bearer token — needed for Grafana Cloud's agentless
    # "Metrics Endpoint" scrape job, which refuses to scrape an unauthenticated
    # public URL.
    metrics_bearer_token: str = ""

    @property
    def cors_origins(self) -> list[str]:
        return [o.strip() for o in self.frontend_origins.split(",") if o.strip()]


@lru_cache
def get_settings() -> Settings:
    return Settings()
