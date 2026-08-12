"""Port of app/api/auth/{login,signup}/route.ts.

Cross-origin note: the original set an httpOnly session cookie via
setSession(). The frontend now lives on a different origin (Vercel) than
this API, so httpOnly cross-site cookies would need SameSite=None + Secure
and still be fragile across browsers/deployments — instead the token is
returned in the JSON body and the frontend attaches it as
`Authorization: Bearer <token>` (see app/api/dependencies/auth.py). Same
JWT secret/algorithm/payload shape either way, so this is a transport
change, not a security-model change.
"""
import re
import uuid

from fastapi import APIRouter, HTTPException

from app.core.security import create_session_token, hash_password, verify_password
from app.core.time import now_naive_utc
from app.db.pool import get_pool
from app.db.queries import get_user_by_email
from app.schemas.auth import AuthResponse, LoginRequest, SignupRequest, UserOut

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login", response_model=AuthResponse)
async def login(body: LoginRequest):
    pool = get_pool()
    email = body.email.strip().lower()

    row = await pool.fetchrow('SELECT id, email, password FROM "User" WHERE email = $1', email)
    if row is None:
        raise HTTPException(status_code=400, detail="No account found with this email. Please sign up.")

    if not verify_password(body.password, row["password"]):
        raise HTTPException(status_code=400, detail="Incorrect password. Please try again.")

    token = create_session_token(row["id"])
    return AuthResponse(token=token, user=UserOut(id=row["id"], name=row["email"].split("@")[0], email=row["email"]))


@router.post("/signup", response_model=AuthResponse)
async def signup(body: SignupRequest):
    pool = get_pool()
    email = body.email.strip().lower()
    workspace_name = body.workspace_name.strip() or "My Workspace"

    existing = await get_user_by_email(pool, email)
    if existing is not None:
        raise HTTPException(status_code=400, detail="An account with this email already exists. Please log in instead.")

    hashed = hash_password(body.password)
    user_id = str(uuid.uuid4())
    workspace_id = str(uuid.uuid4())
    membership_id = str(uuid.uuid4())
    now = now_naive_utc()

    slug_base = re.sub(r"(^-|-$)", "", re.sub(r"[^a-z0-9]+", "-", workspace_name.lower()))
    slug = f"{slug_base}-{uuid.uuid4().hex[:8]}"

    async with pool.acquire() as conn:
        async with conn.transaction():
            await conn.execute(
                'INSERT INTO "User" (id, email, password, "createdAt", "updatedAt") VALUES ($1, $2, $3, $4, $4)',
                user_id, email, hashed, now,
            )
            await conn.execute(
                'INSERT INTO "Workspace" (id, name, slug, "ownerId", "createdAt") VALUES ($1, $2, $3, $4, $5)',
                workspace_id, workspace_name, slug, user_id, now,
            )
            await conn.execute(
                'INSERT INTO "Membership" (id, "workspaceId", "userId", role, "createdAt") VALUES ($1, $2, $3, $4, $5)',
                membership_id, workspace_id, user_id, "OWNER", now,
            )

    token = create_session_token(user_id)
    return AuthResponse(token=token, user=UserOut(id=user_id, name=email.split("@")[0], email=email))
