"""FastAPI dependencies that enforce authentication and per-endpoint permissions."""
from __future__ import annotations

from typing import Callable

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .service import PERMISSIONS, ROLES, AuthService, User

bearer = HTTPBearer(auto_error=False, description="Token from POST /api/auth/login")


def get_auth(request: Request) -> AuthService:
    return request.app.state.auth


def current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer),
    auth: AuthService = Depends(get_auth),
) -> User:
    if creds is None or not creds.credentials:
        raise HTTPException(status_code=401, detail="Not signed in.", headers={"WWW-Authenticate": "Bearer"})
    user = auth.user_for_token(creds.credentials)
    if user is None:
        raise HTTPException(status_code=401, detail="Session expired or invalid. Please sign in again.",
                            headers={"WWW-Authenticate": "Bearer"})
    return user


def require(permission: str) -> Callable[..., User]:
    """Dependency factory: the signed-in user must hold ``permission``."""
    if permission not in PERMISSIONS:
        raise ValueError(f"Unknown permission '{permission}'")
    allowed = sorted(PERMISSIONS[permission]["roles"])

    def checker(user: User = Depends(current_user)) -> User:
        if not user.can(permission):
            raise HTTPException(
                status_code=403,
                detail=f"Your role ({ROLES[user.role]}) cannot {PERMISSIONS[permission]['label'].lower()}. "
                       f"Allowed roles: {', '.join(ROLES[r] for r in allowed)}.",
            )
        return user

    return checker
