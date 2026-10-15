"""Authentication and user/role management endpoints."""
from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials

from app.auth.deps import bearer, current_user, get_auth, require
from app.auth.service import PERMISSIONS, ROLES, AuthService, User
from app.schemas.api import LoginRequest, RoleUpdateRequest

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(body: LoginRequest, auth: AuthService = Depends(get_auth)) -> dict[str, Any]:
    result = auth.login(body.username, body.password)
    if result is None:
        raise HTTPException(status_code=401, detail="Incorrect username or password.")
    token, user = result
    return {"access_token": token, "token_type": "bearer", "user": user.to_dict()}


@router.post("/logout")
def logout(
    creds: HTTPAuthorizationCredentials | None = Depends(bearer), auth: AuthService = Depends(get_auth)
) -> dict[str, Any]:
    if creds:
        auth.logout(creds.credentials)
    return {"ok": True, "message": "Signed out."}


@router.get("/me")
def me(user: User = Depends(current_user)) -> dict[str, Any]:
    return user.to_dict()


@router.get("/roles")
def roles(_: User = Depends(current_user)) -> dict[str, Any]:
    """Role → permission matrix (shown in the UI so access rules are transparent)."""
    return {
        "roles": [{"id": r, "label": label} for r, label in ROLES.items()],
        "permissions": [{"id": p, "label": spec["label"], "roles": sorted(spec["roles"])} for p, spec in PERMISSIONS.items()],
    }


@router.get("/users")
def list_users(_: User = Depends(require("manage_users")), auth: AuthService = Depends(get_auth)) -> list[dict[str, Any]]:
    return [u.to_dict() for u in auth.list_users()]


@router.patch("/users/{username}")
def update_role(
    username: str,
    body: RoleUpdateRequest,
    admin: User = Depends(require("manage_users")),
    auth: AuthService = Depends(get_auth),
) -> dict[str, Any]:
    if username == admin.username and body.role != "admin":
        raise HTTPException(status_code=409, detail="You cannot remove your own administrator role.")
    user = auth.set_role(username, body.role)
    if user is None:
        raise HTTPException(status_code=404, detail=f"User '{username}' not found")
    return user.to_dict()
