"""All timestamp columns in the shared schema are `timestamp without time
zone` (Prisma's `DateTime` maps to that by default, no tz). asyncpg refuses
to write timezone-aware datetimes into those columns, so every insert/update
must use a naive UTC datetime — this is that one, so it's not reimplemented
slightly differently in five different files.
"""
from datetime import datetime, timezone


def now_naive_utc() -> datetime:
    return datetime.now(timezone.utc).replace(tzinfo=None)
