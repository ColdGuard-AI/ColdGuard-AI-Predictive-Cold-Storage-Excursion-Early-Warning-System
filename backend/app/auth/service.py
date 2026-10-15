"""Role-based access control for the prototype.

* Users live in the SQLite ``users`` table with PBKDF2-hashed passwords (stdlib only).
* Logging in returns a random bearer token; sessions are kept in memory and expire.
* Each API endpoint declares the *permission* it needs; roles map to permissions below.

This is demo-grade authentication (no HTTPS enforcement, no password reset, in-memory
sessions). It shows how access is separated by role; it is not production security.
"""
from __future__ import annotations

import hashlib
import hmac
import secrets
import sqlite3
import threading
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

ROLES: dict[str, str] = {
    "admin": "Administrator",
    "manager": "Storage Manager",
    "operator": "Operator",
}

PERMISSIONS: dict[str, dict[str, Any]] = {
    "view": {"label": "View live monitoring, history and alerts", "roles": {"admin", "manager", "operator"}},
    "acknowledge": {"label": "Acknowledge alerts", "roles": {"admin", "manager", "operator"}},
    "manager_overview": {"label": "Storage manager dashboard", "roles": {"admin", "manager"}},
    "what_if": {"label": "Run What-If simulations", "roles": {"admin", "manager"}},
    "model": {"label": "View model performance & method", "roles": {"admin", "manager"}},
    "simulate": {"label": "Control the sensor simulator (scenarios, reset, speed)", "roles": {"admin"}},
    "manage_users": {"label": "Manage users and roles", "roles": {"admin"}},
}

# Demo accounts created on first start. Documented in the README and on the login page.
DEMO_USERS = [
    ("admin", "Asha Admin", "admin", "admin123"),
    ("manager", "Ravi Manager", "manager", "manager123"),
    ("operator", "Omar Operator", "operator", "operator123"),
]

SESSION_HOURS = 12
_ITERATIONS = 120_000


def hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _ITERATIONS)
    return f"{salt.hex()}${digest.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, digest_hex = stored.split("$", 1)
    except ValueError:
        return False
    candidate = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), _ITERATIONS)
    return hmac.compare_digest(candidate.hex(), digest_hex)


def permissions_for(role: str) -> list[str]:
    return [p for p, spec in PERMISSIONS.items() if role in spec["roles"]]


@dataclass
class User:
    username: str
    full_name: str
    role: str

    @property
    def permissions(self) -> list[str]:
        return permissions_for(self.role)

    def can(self, permission: str) -> bool:
        return self.role in PERMISSIONS[permission]["roles"]

    def to_dict(self) -> dict[str, Any]:
        return {"username": self.username, "full_name": self.full_name, "role": self.role,
                "role_label": ROLES[self.role], "permissions": self.permissions}


class AuthService:
    def __init__(self, conn: sqlite3.Connection, lock: threading.RLock) -> None:
        self._conn = conn
        self._lock = lock
        self._sessions: dict[str, tuple[str, datetime]] = {}
        with self._lock:
            self._conn.execute(
                """CREATE TABLE IF NOT EXISTS users (
                       username TEXT PRIMARY KEY,
                       full_name TEXT NOT NULL,
                       role TEXT NOT NULL,
                       password_hash TEXT NOT NULL
                   )"""
            )
            for username, full_name, role, password in DEMO_USERS:
                exists = self._conn.execute("SELECT 1 FROM users WHERE username = ?", (username,)).fetchone()
                if not exists:
                    self._conn.execute("INSERT INTO users VALUES (?,?,?,?)",
                                       (username, full_name, role, hash_password(password)))
            self._conn.commit()

    # ------------------------------------------------------------------ users
    def get_user(self, username: str) -> User | None:
        with self._lock:
            row = self._conn.execute("SELECT username, full_name, role FROM users WHERE username = ?", (username,)).fetchone()
        return User(row[0], row[1], row[2]) if row else None

    def list_users(self) -> list[User]:
        with self._lock:
            rows = self._conn.execute("SELECT username, full_name, role FROM users ORDER BY username").fetchall()
        return [User(r[0], r[1], r[2]) for r in rows]

    def set_role(self, username: str, role: str) -> User | None:
        if role not in ROLES:
            raise ValueError(f"Unknown role '{role}'")
        with self._lock:
            cur = self._conn.execute("UPDATE users SET role = ? WHERE username = ?", (role, username))
            self._conn.commit()
        return self.get_user(username) if cur.rowcount else None

    # ------------------------------------------------------------------ sessions
    def login(self, username: str, password: str) -> tuple[str, User] | None:
        with self._lock:
            row = self._conn.execute("SELECT password_hash FROM users WHERE username = ?", (username.strip().lower(),)).fetchone()
        if not row or not verify_password(password, row[0]):
            return None
        user = self.get_user(username.strip().lower())
        token = secrets.token_urlsafe(32)
        self._sessions[token] = (user.username, datetime.now(timezone.utc) + timedelta(hours=SESSION_HOURS))
        return token, user

    def user_for_token(self, token: str) -> User | None:
        session = self._sessions.get(token)
        if not session:
            return None
        username, expires = session
        if datetime.now(timezone.utc) > expires:
            self._sessions.pop(token, None)
            return None
        # Re-read the user so role changes apply immediately.
        return self.get_user(username)

    def logout(self, token: str) -> None:
        self._sessions.pop(token, None)
