"""
Federation Routes

Dashboard-friendly endpoints for managing API keys, connected instances,
and basin sync status. These are internal admin routes that wrap the 
external API functionality for the UI.
"""

from __future__ import annotations

import secrets
import logging
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel, Field
from sqlalchemy import text
from sqlalchemy.orm import Session

from qsearch.api.deps import get_config
from qsearch.store.document_store import get_session

router = APIRouter(prefix="/federation", tags=["federation"])
_log = logging.getLogger("qsearch.federation")


# === Models ===

class CreateKeyRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=128)
    instance_type: str = Field(default="external")
    scopes: list[str] = Field(default=["read", "write", "search", "hybrid", "sync", "crawl"])
    rate_limit: int = Field(default=120, ge=1, le=1000)


class ApiKeyResponse(BaseModel):
    id: int
    name: str
    instance_type: str
    scopes: list[str]
    created_at: datetime
    last_used_at: Optional[datetime]
    rate_limit: int
    is_active: bool


class FederatedInstanceResponse(BaseModel):
    id: int
    name: str
    endpoint: str
    status: str
    capabilities: list[str]
    sync_direction: str
    last_sync_at: Optional[datetime]
    created_at: datetime


class SyncStatusResponse(BaseModel):
    is_connected: bool
    peer_count: int
    last_sync_time: Optional[str]
    pending_packets: int
    sync_mode: str


class HealthResponse(BaseModel):
    status: str
    version: str
    timestamp: str
    capabilities: list[str]


# === Database Setup ===

SETUP_SQL = """
CREATE TABLE IF NOT EXISTS external_api_keys (
    id SERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    api_key VARCHAR(128) NOT NULL UNIQUE,
    instance_type VARCHAR(64) NOT NULL DEFAULT 'external',
    scopes JSONB NOT NULL DEFAULT '[]'::jsonb,
    rate_limit INTEGER NOT NULL DEFAULT 120,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_used_at TIMESTAMP
);

CREATE TABLE IF NOT EXISTS federated_instances (
    id SERIAL PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    endpoint VARCHAR(512) NOT NULL,
    api_key_hash VARCHAR(128),
    status VARCHAR(32) NOT NULL DEFAULT 'pending',
    capabilities JSONB NOT NULL DEFAULT '[]'::jsonb,
    sync_direction VARCHAR(32) NOT NULL DEFAULT 'bidirectional',
    last_sync_at TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_key ON external_api_keys(api_key);
CREATE INDEX IF NOT EXISTS idx_federated_instances_status ON federated_instances(status);
"""


def ensure_tables(session: Session):
    """Ensure federation tables exist."""
    try:
        session.execute(text(SETUP_SQL))
        session.commit()
    except Exception as e:
        _log.warning("Could not create federation tables: %s", e)
        session.rollback()


# === Routes ===

@router.get("/health", response_model=HealthResponse)
def federation_health():
    """Public health endpoint for connectivity checks."""
    return HealthResponse(
        status="healthy",
        version="0.2.0",
        timestamp=datetime.utcnow().isoformat(),
        capabilities=["search", "hybrid", "crawl", "sync", "basin_geometry"],
    )


@router.get("/keys")
def list_api_keys():
    """List all API keys for the dashboard."""
    cfg = get_config()
    with get_session(cfg.db_url) as session:
        ensure_tables(session)
        result = session.execute(text("""
            SELECT id, name, instance_type, scopes, created_at, last_used_at, rate_limit, is_active
            FROM external_api_keys
            ORDER BY created_at DESC
        """))
        
        keys = []
        for row in result.mappings():
            scopes = row["scopes"]
            if isinstance(scopes, str):
                import json
                scopes = json.loads(scopes)
            keys.append(ApiKeyResponse(
                id=row["id"],
                name=row["name"],
                instance_type=row["instance_type"],
                scopes=scopes if isinstance(scopes, list) else [],
                created_at=row["created_at"],
                last_used_at=row["last_used_at"],
                rate_limit=row["rate_limit"] or 120,
                is_active=row["is_active"] if row["is_active"] is not None else True,
            ))
        
        return {"keys": keys}


@router.post("/keys")
def create_api_key(req: CreateKeyRequest):
    """Create a new unified API key (all scopes)."""
    valid_types = ["external", "headless", "federation", "research", "development"]
    if req.instance_type not in valid_types:
        raise HTTPException(400, f"Invalid instance_type. Valid: {valid_types}")
    
    valid_scopes = ["read", "write", "admin", "search", "hybrid", "sync", "crawl", "basin"]
    for scope in req.scopes:
        if scope not in valid_scopes:
            raise HTTPException(400, f"Invalid scope '{scope}'. Valid: {valid_scopes}")
    
    raw_key = f"qig_{secrets.token_hex(32)}"
    
    cfg = get_config()
    with get_session(cfg.db_url) as session:
        ensure_tables(session)
        import json
        scopes_json = json.dumps(req.scopes)
        
        result = session.execute(text("""
            INSERT INTO external_api_keys (name, api_key, instance_type, scopes, rate_limit, is_active, created_at)
            VALUES (:name, :api_key, :instance_type, :scopes::jsonb, :rate_limit, true, NOW())
            RETURNING id
        """), {
            "name": req.name,
            "api_key": raw_key,
            "instance_type": req.instance_type,
            "scopes": scopes_json,
            "rate_limit": req.rate_limit,
        })
        session.commit()
        
        row = result.fetchone()
        inserted_id = row[0] if row else None
    
    return {
        "message": "API key created",
        "id": inserted_id,
        "key": raw_key,
        "warning": "Save this key securely - it will not be shown again",
    }


@router.delete("/keys/{key_id}")
def revoke_api_key(key_id: int):
    """Revoke an API key."""
    cfg = get_config()
    with get_session(cfg.db_url) as session:
        ensure_tables(session)
        session.execute(text("""
            UPDATE external_api_keys SET is_active = false WHERE id = :key_id
        """), {"key_id": key_id})
        session.commit()
    
    return {"message": "API key revoked", "key_id": key_id}


@router.get("/instances")
def list_instances():
    """List all connected federated instances."""
    cfg = get_config()
    with get_session(cfg.db_url) as session:
        ensure_tables(session)
        result = session.execute(text("""
            SELECT id, name, endpoint, status, capabilities, sync_direction, last_sync_at, created_at
            FROM federated_instances
            ORDER BY last_sync_at DESC NULLS LAST
        """))
        
        instances = []
        for row in result.mappings():
            caps = row["capabilities"]
            if isinstance(caps, str):
                import json
                caps = json.loads(caps)
            instances.append(FederatedInstanceResponse(
                id=row["id"],
                name=row["name"],
                endpoint=row["endpoint"],
                status=row["status"] or "pending",
                capabilities=caps if isinstance(caps, list) else [],
                sync_direction=row["sync_direction"] or "bidirectional",
                last_sync_at=row["last_sync_at"],
                created_at=row["created_at"],
            ))
        
        return {"instances": instances}


@router.post("/instances/register")
def register_instance(name: str, endpoint: str, api_key: str, capabilities: list[str] = None):
    """Register a new federated instance."""
    import hashlib
    key_hash = hashlib.sha256(api_key.encode()).hexdigest()
    
    cfg = get_config()
    with get_session(cfg.db_url) as session:
        ensure_tables(session)
        import json
        caps_json = json.dumps(capabilities or [])
        
        result = session.execute(text("""
            INSERT INTO federated_instances (name, endpoint, api_key_hash, capabilities, status, created_at)
            VALUES (:name, :endpoint, :key_hash, :capabilities::jsonb, 'pending', NOW())
            RETURNING id
        """), {
            "name": name,
            "endpoint": endpoint,
            "key_hash": key_hash,
            "capabilities": caps_json,
        })
        session.commit()
        
        row = result.fetchone()
        instance_id = row[0] if row else None
    
    return {"message": "Instance registered", "id": instance_id}


@router.get("/sync/status", response_model=SyncStatusResponse)
def get_sync_status():
    """Get current basin sync status."""
    cfg = get_config()
    with get_session(cfg.db_url) as session:
        ensure_tables(session)
        result = session.execute(text("""
            SELECT COUNT(*) as count, MAX(last_sync_at) as latest_sync
            FROM federated_instances
            WHERE status = 'active'
        """))
        
        row = result.mappings().fetchone()
        peer_count = int(row["count"] or 0) if row else 0
        latest_sync = row["latest_sync"] if row else None
    
    return SyncStatusResponse(
        is_connected=peer_count > 0,
        peer_count=peer_count,
        last_sync_time=latest_sync.isoformat() if latest_sync else None,
        pending_packets=0,
        sync_mode="bidirectional" if peer_count > 0 else "standalone",
    )


# === External API Routes (for other QIG systems) ===

external_router = APIRouter(prefix="/api/v1/external", tags=["external"])


@external_router.get("/health")
def external_health():
    """Public health endpoint for external connectivity checks."""
    return {
        "status": "healthy",
        "version": "0.2.0",
        "timestamp": datetime.utcnow().isoformat(),
        "capabilities": ["search", "hybrid", "crawl", "sync", "basin_geometry"],
    }


@external_router.get("/sync/status")
def external_sync_status():
    """Get sync status for external systems."""
    return get_sync_status()


@external_router.post("/basin/query")
def external_basin_query(query: str, limit: int = 10):
    """Query basins from external systems."""
    from qsearch.api.deps import get_orchestrator
    orchestrator = get_orchestrator()
    results = orchestrator.search(query, limit=limit)
    return {
        "query": query,
        "count": len(results),
        "results": [
            {
                "doc_id": r.doc_id,
                "url": r.url,
                "title": r.title,
                "basin_distance": r.distance,
            }
            for r in results
        ],
    }
