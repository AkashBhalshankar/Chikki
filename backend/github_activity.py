"""Live public GitHub activity, offered to the model when visitors ask about it."""

import logging
import os
import re
import time

import requests

logger = logging.getLogger("chikki.github")

CACHE_TTL_SECONDS = 3600
GITHUB_QUESTION = re.compile(r"\b(github|repos?|repositor(?:y|ies)|open[- ]source|recent(?:ly)? (?:work|project|commit)s?|latest (?:work|project|commit)s?|currently building)\b", re.IGNORECASE)

_cache: dict[str, tuple[float, list[dict]]] = {}


def is_github_question(message: str) -> bool:
    return bool(GITHUB_QUESTION.search(message))


def recent_repos(username: str, limit: int = 5) -> list[dict]:
    """Most recently pushed public, non-fork, non-archived repos. Cached for an hour."""
    cached = _cache.get(username)
    if cached and time.monotonic() - cached[0] < CACHE_TTL_SECONDS:
        return cached[1]
    try:
        response = requests.get(
            f"https://api.github.com/users/{username}/repos",
            params={"sort": "pushed", "per_page": 30},
            headers={"Accept": "application/vnd.github+json"},
            timeout=8,
        )
        response.raise_for_status()
        repos = [
            {
                "name": repo["name"],
                "description": (repo.get("description") or "")[:160],
                "language": repo.get("language") or "",
                "pushed_at": (repo.get("pushed_at") or "")[:10],
                "url": repo["html_url"],
            }
            for repo in response.json()
            if not repo.get("fork") and not repo.get("archived")
        ][:limit]
    except (requests.RequestException, ValueError, KeyError) as error:
        logger.warning("GitHub fetch failed: %s", type(error).__name__)
        return cached[1] if cached else []
    _cache[username] = (time.monotonic(), repos)
    return repos


def github_context(message: str) -> str:
    """Prompt block with live repos, or "" when not relevant or not configured."""
    username = os.getenv("GITHUB_USERNAME", "").strip()
    if not username or not is_github_question(message):
        return ""
    repos = recent_repos(username)
    if not repos:
        return ""
    lines = [
        f"- {r['name']}" + (f" ({r['language']})" if r["language"] else "")
        + (f": {r['description']}" if r["description"] else "")
        + f" - last pushed {r['pushed_at']}"
        for r in repos
    ]
    return (
        "\n\n==================================================\n"
        "LIVE GITHUB ACTIVITY (public repositories, fetched just now)\n"
        "==================================================\n"
        "Mention only what is listed here. Do not claim these are production systems or invent details beyond "
        "the names, languages and descriptions.\n" + "\n".join(lines)
    )
