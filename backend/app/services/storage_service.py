"""Supabase Storage access — same 'documents' bucket the Next.js app used,
via the service-role key (server-side, bypasses RLS, matches lib/supabase/server.ts).
"""
from functools import lru_cache

from supabase import Client, create_client

from app.core.config import get_settings

BUCKET = "documents"


@lru_cache
def get_supabase_client() -> Client:
    settings = get_settings()
    return create_client(settings.supabase_url, settings.supabase_service_role_key)


def upload_file(storage_path: str, data: bytes, content_type: str) -> None:
    client = get_supabase_client()
    client.storage.from_(BUCKET).upload(
        storage_path, data, {"content-type": content_type or "application/octet-stream"}
    )


def get_public_url(storage_path: str) -> str:
    client = get_supabase_client()
    return client.storage.from_(BUCKET).get_public_url(storage_path)


def download_file(storage_path: str) -> bytes:
    client = get_supabase_client()
    return client.storage.from_(BUCKET).download(storage_path)


def delete_file(storage_path: str) -> None:
    client = get_supabase_client()
    client.storage.from_(BUCKET).remove([storage_path])


def storage_path_from_url(storage_url: str) -> str:
    """Recovers the bucket-relative path from a public URL, matching the
    `storageUrl.split('/documents/')[1]` pattern used throughout the
    original Next.js routes.
    """
    marker = "/documents/"
    if marker in storage_url:
        return storage_url.split(marker, 1)[1].split("?")[0]
    return ""
