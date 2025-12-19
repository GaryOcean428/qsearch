from __future__ import annotations

import uuid
from typing import Any
from typing import Annotated

from authlib.integrations.starlette_client import OAuth
from fastapi import APIRouter, Depends, HTTPException, Request
from starlette.responses import RedirectResponse

from qsearch.api.deps import get_config, get_orchestrator
from qsearch.config import QSearchConfig
from qsearch.index.models import User

router = APIRouter(prefix="/api/v1/auth")


def _oauth(cfg: QSearchConfig) -> OAuth:
    oauth = OAuth()

    if cfg.google_client_id and cfg.google_client_secret:
        oauth.register(
            name="google",
            client_id=cfg.google_client_id,
            client_secret=cfg.google_client_secret,
            server_metadata_url="https://accounts.google.com/.well-known/openid-configuration",
            client_kwargs={"scope": "openid email profile"},
        )

    if cfg.microsoft_client_id and cfg.microsoft_client_secret:
        oauth.register(
            name="microsoft",
            client_id=cfg.microsoft_client_id,
            client_secret=cfg.microsoft_client_secret,
            server_metadata_url="https://login.microsoftonline.com/common/v2.0/.well-known/openid-configuration",
            client_kwargs={"scope": "openid email profile"},
        )

    return oauth


@router.get("/providers")
def providers(cfg: Annotated[QSearchConfig, Depends(get_config)]) -> dict[str, Any]:
    return {
        "enabled": cfg.auth_enabled,
        "providers": {
            "google": bool(cfg.google_client_id and cfg.google_client_secret),
            "microsoft": bool(cfg.microsoft_client_id and cfg.microsoft_client_secret),
        },
    }


@router.get("/{provider}/login")
async def login(
    provider: str,
    request: Request,
    cfg: Annotated[QSearchConfig, Depends(get_config)],
):
    if not cfg.auth_enabled:
        raise HTTPException(status_code=503, detail="auth_disabled")
    if not cfg.public_base_url:
        raise HTTPException(status_code=500, detail="missing_public_base_url")

    oauth = _oauth(cfg)
    if provider not in oauth._registry:
        raise HTTPException(status_code=404, detail="unknown_provider")

    redirect_uri = f"{cfg.public_base_url}/api/v1/auth/{provider}/callback"
    return await oauth.create_client(provider).authorize_redirect(request, redirect_uri)


@router.get("/{provider}/callback")
async def callback(
    provider: str,
    request: Request,
    cfg: Annotated[QSearchConfig, Depends(get_config)],
):
    if not cfg.auth_enabled:
        raise HTTPException(status_code=503, detail="auth_disabled")

    oauth = _oauth(cfg)
    if provider not in oauth._registry:
        raise HTTPException(status_code=404, detail="unknown_provider")

    client = oauth.create_client(provider)
    token = await client.authorize_access_token(request)
    userinfo = await client.userinfo(token=token)

    provider_user_id = str(userinfo.get("sub") or "")
    email = str(userinfo.get("email") or "")
    name = str(userinfo.get("name") or "")
    avatar_url = str(userinfo.get("picture") or "")

    if not provider_user_id:
        raise HTTPException(status_code=400, detail="missing_provider_user_id")

    # Persist user
    orch = get_orchestrator()
    with orch.store.session() as s:
        existing = (
            s.query(User)
            .filter(User.provider == provider)
            .filter(User.provider_user_id == provider_user_id)
            .one_or_none()
        )

        if existing is None:
            u = User(
                user_id=str(uuid.uuid4()),
                provider=provider,
                provider_user_id=provider_user_id,
                email=email,
                name=name,
                avatar_url=avatar_url,
            )
            s.add(u)
            user_id = u.user_id
        else:
            existing.email = email
            existing.name = name
            existing.avatar_url = avatar_url
            user_id = existing.user_id

    # Session
    request.session["user_id"] = user_id
    request.session["provider"] = provider

    # Redirect back to webapp (or API base if you want to keep it simple)
    return RedirectResponse(url=cfg.public_base_url)


@router.post("/logout")
def logout(request: Request):
    request.session.clear()
    return {"ok": True}


@router.get("/me")
def me(request: Request, cfg: Annotated[QSearchConfig, Depends(get_config)]):
    if not cfg.auth_enabled:
        raise HTTPException(status_code=503, detail="auth_disabled")

    user_id = request.session.get("user_id")
    if not user_id:
        return {"authenticated": False}

    orch = get_orchestrator()
    with orch.store.session() as s:
        u = s.get(User, user_id)
        if u is None:
            request.session.clear()
            return {"authenticated": False}

        return {
            "authenticated": True,
            "user": {
                "user_id": u.user_id,
                "provider": u.provider,
                "email": u.email,
                "name": u.name,
                "avatar_url": u.avatar_url,
            },
        }
