"""
Simple DB-based authentication (no OAuth).
Users register with email/password, login to get a session.
"""

from __future__ import annotations

import hashlib
import uuid
import logging
from typing import Any

from fastapi import APIRouter, HTTPException, Request
from pydantic import BaseModel, EmailStr
from sqlalchemy import text

from qsearch.api.deps import get_config
from qsearch.index.storage import DocumentStore

router = APIRouter(prefix="/api/v1/auth")
_log = logging.getLogger("qsearch.auth")


# === Database Setup ===

USERS_TABLE_SQL = """
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL UNIQUE,
    email VARCHAR(256) NOT NULL UNIQUE,
    password_hash VARCHAR(128) NOT NULL,
    name VARCHAR(128),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS saved_searches (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(64) NOT NULL REFERENCES users(user_id),
    query TEXT NOT NULL,
    results_count INTEGER,
    search_mode VARCHAR(32),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_saved_searches_user ON saved_searches(user_id);
"""


def ensure_users_table(session):
    try:
        session.execute(text(USERS_TABLE_SQL))
        session.commit()
    except Exception as e:
        _log.warning("Could not create users table: %s", e)
        session.rollback()


def hash_password(password: str, salt: str = "") -> str:
    """Simple password hashing with SHA-256."""
    return hashlib.sha256((password + salt).encode()).hexdigest()


# === Models ===


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str
    name: str | None = None


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class SaveSearchRequest(BaseModel):
    query: str
    results_count: int = 0
    search_mode: str = "hybrid"


# === Routes ===


@router.get("/providers")
def providers() -> dict[str, Any]:
    """Return available auth providers (just local DB auth)."""
    return {
        "enabled": True,
        "providers": {
            "local": True,
            "google": False,
            "microsoft": False,
        },
    }


@router.post("/register")
def register(req: RegisterRequest, request: Request):
    """Register a new user with email/password."""
    if len(req.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    cfg = get_config()
    store = DocumentStore(cfg.db_url)
    with store.session() as session:
        ensure_users_table(session)

        # Check if email exists
        result = session.execute(
            text("SELECT id FROM users WHERE email = :email"), {"email": req.email}
        )
        if result.fetchone():
            raise HTTPException(400, "Email already registered")

        user_id = str(uuid.uuid4())
        password_hash = hash_password(req.password, user_id)

        session.execute(
            text(
                """
            INSERT INTO users (user_id, email, password_hash, name, created_at)
            VALUES (:user_id, :email, :password_hash, :name, NOW())
        """
            ),
            {
                "user_id": user_id,
                "email": req.email,
                "password_hash": password_hash,
                "name": req.name or req.email.split("@")[0],
            },
        )
        session.commit()

        # Set session
        request.session["user_id"] = user_id

        return {
            "ok": True,
            "message": "Registration successful",
            "user": {
                "user_id": user_id,
                "email": req.email,
                "name": req.name or req.email.split("@")[0],
            },
        }


@router.post("/login")
def login(req: LoginRequest, request: Request):
    """Login with email/password."""
    cfg = get_config()
    store = DocumentStore(cfg.db_url)
    with store.session() as session:
        ensure_users_table(session)

        result = session.execute(
            text(
                "SELECT user_id, email, password_hash, name FROM users WHERE email = :email"
            ),
            {"email": req.email},
        )
        row = result.mappings().fetchone()

        if not row:
            raise HTTPException(401, "Invalid email or password")

        expected_hash = hash_password(req.password, row["user_id"])
        if row["password_hash"] != expected_hash:
            raise HTTPException(401, "Invalid email or password")

        # Update last login
        session.execute(
            text("UPDATE users SET last_login_at = NOW() WHERE user_id = :user_id"),
            {"user_id": row["user_id"]},
        )

        # Set session
        request.session["user_id"] = row["user_id"]

        return {
            "ok": True,
            "message": "Login successful",
            "user": {
                "user_id": row["user_id"],
                "email": row["email"],
                "name": row["name"],
            },
        }


@router.post("/logout")
def logout(request: Request):
    """Clear session."""
    request.session.clear()
    return {"ok": True}


@router.get("/me")
def me(request: Request):
    """Get current authenticated user."""
    user_id = request.session.get("user_id")
    if not user_id:
        return {"authenticated": False}

    cfg = get_config()
    store = DocumentStore(cfg.db_url)
    with store.session() as session:
        ensure_users_table(session)

        result = session.execute(
            text(
                "SELECT user_id, email, name, created_at FROM users WHERE user_id = :user_id"
            ),
            {"user_id": user_id},
        )
        row = result.mappings().fetchone()

        if not row:
            request.session.clear()
            return {"authenticated": False}

        return {
            "authenticated": True,
            "user": {
                "user_id": row["user_id"],
                "email": row["email"],
                "name": row["name"],
                "created_at": (
                    row["created_at"].isoformat() if row["created_at"] else None
                ),
            },
        }


# === Saved Searches ===


@router.post("/searches/save")
def save_search(req: SaveSearchRequest, request: Request):
    """Save a search for the authenticated user."""
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(401, "Not authenticated")

    cfg = get_config()
    store = DocumentStore(cfg.db_url)
    with store.session() as session:
        ensure_users_table(session)

        session.execute(
            text(
                """
            INSERT INTO saved_searches (user_id, query, results_count, search_mode, created_at)
            VALUES (:user_id, :query, :results_count, :search_mode, NOW())
        """
            ),
            {
                "user_id": user_id,
                "query": req.query,
                "results_count": req.results_count,
                "search_mode": req.search_mode,
            },
        )

        return {"ok": True, "message": "Search saved"}


@router.get("/searches")
def list_searches(request: Request):
    """List saved searches for the authenticated user."""
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(401, "Not authenticated")

    cfg = get_config()
    store = DocumentStore(cfg.db_url)
    with store.session() as session:
        ensure_users_table(session)

        result = session.execute(
            text(
                """
            SELECT id, query, results_count, search_mode, created_at
            FROM saved_searches
            WHERE user_id = :user_id
            ORDER BY created_at DESC
            LIMIT 50
        """
            ),
            {"user_id": user_id},
        )

        searches = [
            {
                "id": row["id"],
                "query": row["query"],
                "results_count": row["results_count"],
                "search_mode": row["search_mode"],
                "created_at": (
                    row["created_at"].isoformat() if row["created_at"] else None
                ),
            }
            for row in result.mappings()
        ]

        return {"searches": searches}


@router.delete("/searches/{search_id}")
def delete_search(search_id: int, request: Request):
    """Delete a saved search."""
    user_id = request.session.get("user_id")
    if not user_id:
        raise HTTPException(401, "Not authenticated")

    cfg = get_config()
    store = DocumentStore(cfg.db_url)
    with store.session() as session:
        session.execute(
            text(
                """
            DELETE FROM saved_searches WHERE id = :search_id AND user_id = :user_id
        """
            ),
            {"search_id": search_id, "user_id": user_id},
        )

        return {"ok": True}
