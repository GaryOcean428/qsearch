from __future__ import annotations

import os
from typing import Any

import httpx
from mcp.server.fastmcp import FastMCP

mcp = FastMCP("qsearch")


def _api_base() -> str:
    return (os.environ.get("QSEARCH_API_BASE") or "http://127.0.0.1:8000").rstrip("/")


@mcp.tool()
def qsearch_health() -> dict[str, Any]:
    """Return health from the qsearch HTTP API."""
    url = f"{_api_base()}/health"
    with httpx.Client(timeout=20.0) as client:
        r = client.get(url)
        r.raise_for_status()
        return r.json()


@mcp.tool()
def qsearch_search(query: str, limit: int = 10) -> dict[str, Any]:
    """Search qsearch and return ranked results."""
    url = f"{_api_base()}/search"
    with httpx.Client(timeout=60.0) as client:
        r = client.post(url, json={"query": query, "limit": limit})
        r.raise_for_status()
        return r.json()


def main() -> None:
    mcp.run()


if __name__ == "__main__":
    main()
