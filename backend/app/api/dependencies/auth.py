"""FastAPI dependencies equivalent to lib/auth.ts's getSession/requireWorkspaceAccess.

Token transport: the Next.js frontend proxies /api/* to this backend via a
same-origin rewrite (see next.config.ts), so the browser's httpOnly
`session` cookie rides along automatically — Next.js never reads the JWT
itself, it just sets/clears the cookie via a thin session route with no
business logic. Direct/non-browser clients (curl, tests, a future mobile
client) can instead send `Authorization: Bearer <token>` — both are
accepted, cookie takes the header as a fallback. Same secret/algorithm/
payload shape as the original jose-based implementation either way.
"""
from dataclasses import dataclass

from fastapi import Cookie, Header, HTTPException, Path

from app.core.security import decode_session_token
from app.db.pool import get_pool
from app.db.queries import get_membership, get_user_by_id


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str


async def get_current_user(
    authorization: str | None = Header(default=None),
    session: str | None = Cookie(default=None),
) -> CurrentUser:
    token = None
    if authorization and authorization.lower().startswith("bearer "):
        token = authorization.split(" ", 1)[1].strip()
    elif session:
        token = session

    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")

    payload = decode_session_token(token)
    if not payload or "userId" not in payload:
        raise HTTPException(status_code=401, detail="Invalid or expired session")

    pool = get_pool()
    user = await get_user_by_id(pool, payload["userId"])
    if user is None:
        raise HTTPException(status_code=401, detail="User no longer exists")

    return CurrentUser(id=user["id"], email=user["email"])


@dataclass(frozen=True)
class WorkspaceAccess:
    workspace_id: str
    workspace_name: str
    slug: str
    user: CurrentUser
    role: str


def require_workspace_access_dep():
    """Returns a dependency bound to the `workspaceId` path parameter, mirroring
    requireWorkspaceAccess(workspaceId) from lib/auth.ts (404 if no such workspace/
    membership, so we don't leak whether a workspace ID exists to non-members).
    """
    from fastapi import Depends

    async def _dep(
        workspaceId: str = Path(...),
        user: CurrentUser = Depends(get_current_user),
    ) -> WorkspaceAccess:
        pool = get_pool()
        membership = await get_membership(pool, workspaceId, user.id)
        if membership is None:
            raise HTTPException(status_code=404, detail="Workspace not found")
        return WorkspaceAccess(
            workspace_id=membership["workspaceId"],
            workspace_name=membership["workspaceName"],
            slug=membership["slug"],
            user=user,
            role=membership["role"],
        )

    return _dep


def require_role(*allowed_roles: str):
    """Extra guard for OWNER-only actions (invite, delete workspace) — mirrors the
    manual `if (membership.role !== 'OWNER')` checks in the Next.js route handlers.
    """
    from fastapi import Depends

    async def _dep(
        access: WorkspaceAccess = Depends(require_workspace_access_dep()),
    ) -> WorkspaceAccess:
        if access.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return access

    return _dep
