"""Retrieval-augmented knowledge base for Chikki.

Sources:
  * Markdown/text files in backend/knowledge/ (verified project write-ups).
  * Optional KNOWLEDGE_URLS: comma-separated raw text/Markdown URLs, such as
    raw GitHub README links. Only list projects that are actually implemented.

The resume itself stays in the system prompt in full (it is the ground truth
and is small), so retrieval adds deeper context without risking the core facts.

Retrieval is hybrid:
  * BM25 keyword scoring always runs (no external dependencies).
  * When NVIDIA_API_KEY and NVIDIA_EMBED_MODEL are set, chunks and queries are
    embedded and the two rankings are merged with reciprocal rank fusion.
    Embedding failures fall back to BM25 automatically.
"""

from __future__ import annotations

import hashlib
import logging
import math
import os
import re
import threading
import time
from collections import Counter
from dataclasses import dataclass, field
from pathlib import Path

import requests

logger = logging.getLogger("chikki.knowledge")

KNOWLEDGE_DIR = Path(os.getenv("KNOWLEDGE_DIR") or Path(__file__).parent / "knowledge")
CHUNK_CHARS = 900
TOP_K = int(os.getenv("RAG_TOP_K", "3"))
EMBED_MIN_SCORE = float(os.getenv("RAG_EMBED_MIN_SCORE", "0.35"))
URL_CACHE_TTL_SECONDS = 3600
EMBED_DISABLE_SECONDS = 300
RRF_K = 60

STOP_WORDS = {
    "a", "about", "an", "and", "are", "as", "at", "be", "by", "can", "could", "did", "do",
    "does", "for", "from", "has", "have", "he", "his", "how", "i", "in", "is", "it", "its",
    "me", "my", "of", "on", "or", "please", "say", "should", "so", "tell", "that", "the",
    "their", "them", "there", "this", "to", "was", "we", "what", "when", "where", "which",
    "who", "why", "will", "with", "would", "you", "your", "akash", "akash's", "him",
}


@dataclass
class Chunk:
    source: str
    title: str
    heading: str
    text: str
    url: str = ""
    tokens: list[str] = field(default_factory=list)
    embedding: list[float] | None = None


def tokenize(text: str) -> list[str]:
    words = re.findall(r"[\w+#.-]+", text.lower())
    return [word.strip(".-") for word in words if word.strip(".-") and word.strip(".-") not in STOP_WORDS]


def chunk_markdown(text: str, source: str, title: str, url: str = "") -> list[Chunk]:
    """Split by Markdown headings, then pack paragraphs into ~CHUNK_CHARS chunks."""
    chunks: list[Chunk] = []
    sections = re.split(r"(?m)^(#{1,6}\s+.+)$", text)
    heading = title
    for part in sections:
        if not part.strip():
            continue
        if re.match(r"^#{1,6}\s+", part):
            heading = part.lstrip("#").strip()
            continue
        buffer = ""
        for paragraph in re.split(r"\n\s*\n", part.strip()):
            paragraph = paragraph.strip()
            if not paragraph:
                continue
            if buffer and len(buffer) + len(paragraph) > CHUNK_CHARS:
                chunks.append(Chunk(source, title, heading, buffer.strip(), url))
                buffer = ""
            buffer += paragraph + "\n\n"
        if buffer.strip():
            chunks.append(Chunk(source, title, heading, buffer.strip(), url))
    for chunk in chunks:
        chunk.tokens = tokenize(f"{chunk.heading} {chunk.text}")
    return chunks


class BM25:
    def __init__(self, documents: list[list[str]], k1: float = 1.5, b: float = 0.75):
        self.k1, self.b = k1, b
        self.docs = documents
        self.doc_freqs = [Counter(doc) for doc in documents]
        self.avgdl = sum(len(doc) for doc in documents) / max(1, len(documents))
        df: Counter = Counter()
        for doc in documents:
            df.update(set(doc))
        n = len(documents)
        self.idf = {term: math.log(1 + (n - freq + 0.5) / (freq + 0.5)) for term, freq in df.items()}

    def scores(self, query: list[str]) -> list[float]:
        results = []
        for doc, freqs in zip(self.docs, self.doc_freqs):
            score = 0.0
            for term in query:
                if term not in freqs:
                    continue
                tf = freqs[term]
                denom = tf + self.k1 * (1 - self.b + self.b * len(doc) / max(1e-9, self.avgdl))
                score += self.idf.get(term, 0.0) * tf * (self.k1 + 1) / denom
            results.append(score)
        return results


def _cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm = math.sqrt(sum(x * x for x in a)) * math.sqrt(sum(y * y for y in b))
    return dot / norm if norm else 0.0


class Embedder:
    """NVIDIA embeddings through the OpenAI-compatible endpoint. Optional."""

    def __init__(self):
        self.api_key = os.getenv("NVIDIA_API_KEY", "")
        self.model = os.getenv("NVIDIA_EMBED_MODEL", "")
        self._disabled_until = 0.0
        self._client = None

    @property
    def available(self) -> bool:
        return bool(self.api_key and self.model) and time.monotonic() >= self._disabled_until

    def embed(self, texts: list[str], input_type: str, timeout: float) -> list[list[float]] | None:
        if not self.available or not texts:
            return None
        try:
            if self._client is None:
                from openai import OpenAI

                self._client = OpenAI(api_key=self.api_key, base_url="https://integrate.api.nvidia.com/v1")
            response = self._client.embeddings.create(
                model=self.model,
                input=texts,
                encoding_format="float",
                extra_body={"input_type": input_type, "truncate": "END"},
                timeout=timeout,
            )
            return [item.embedding for item in response.data]
        except Exception as error:
            self._disabled_until = time.monotonic() + EMBED_DISABLE_SECONDS
            logger.warning("Embedding call failed (%s); using keyword retrieval for %ss", error, EMBED_DISABLE_SECONDS)
            return None


class KnowledgeBase:
    def __init__(self, knowledge_dir: Path = KNOWLEDGE_DIR, embedder: Embedder | None = None):
        self.knowledge_dir = knowledge_dir
        self.embedder = embedder if embedder is not None else Embedder()
        self._lock = threading.Lock()
        self._fingerprint = ""
        self._has_embeddings = False
        self._chunks: list[Chunk] = []
        self._bm25: BM25 | None = None
        self._url_cache: dict[str, tuple[float, str]] = {}

    # ---------------------------------------------------------------- sources
    def _load_documents(self) -> list[tuple[str, str, str, str]]:
        """Returns (source_id, title, text, url) tuples."""
        documents = []
        if self.knowledge_dir.exists():
            for path in sorted(self.knowledge_dir.glob("*")):
                if path.suffix.lower() not in {".md", ".txt"} or path.name.lower() == "readme.md":
                    continue
                try:
                    text = path.read_text(encoding="utf-8")
                except OSError as error:
                    logger.warning("Could not read %s: %s", path.name, error)
                    continue
                title_match = re.search(r"(?m)^#\s+(.+)$", text)
                title = title_match.group(1).strip() if title_match else path.stem.replace("-", " ").title()
                documents.append((path.name, title, text, ""))

        for url in [u.strip() for u in os.getenv("KNOWLEDGE_URLS", "").split(",") if u.strip()]:
            text = self._fetch_url(url)
            if text:
                title_match = re.search(r"(?m)^#\s+(.+)$", text)
                title = title_match.group(1).strip() if title_match else url.rstrip("/").split("/")[-1]
                documents.append((url, title, text, url))
        return documents

    def _fetch_url(self, url: str) -> str:
        cached = self._url_cache.get(url)
        if cached and time.monotonic() - cached[0] < URL_CACHE_TTL_SECONDS:
            return cached[1]
        try:
            response = requests.get(url, timeout=10)
            response.raise_for_status()
            text = response.text[:200_000]
        except requests.RequestException as error:
            logger.warning("Could not fetch knowledge URL %s: %s", url, error)
            text = cached[1] if cached else ""
        self._url_cache[url] = (time.monotonic(), text)
        return text

    # ------------------------------------------------------------------ index
    def refresh(self) -> None:
        documents = self._load_documents()
        fingerprint = hashlib.sha256(
            "\x00".join(f"{source}\x01{text}" for source, _, text, _ in documents).encode("utf-8")
        ).hexdigest()
        if fingerprint == self._fingerprint and (self._has_embeddings or not self.embedder.available):
            return

        chunks: list[Chunk] = []
        for source, title, text, url in documents:
            chunks.extend(chunk_markdown(text, source, title, url))

        embeddings = self.embedder.embed(
            [f"{chunk.title} - {chunk.heading}\n{chunk.text}" for chunk in chunks],
            input_type="passage",
            timeout=20.0,
        )
        if embeddings and len(embeddings) == len(chunks):
            for chunk, vector in zip(chunks, embeddings):
                chunk.embedding = vector

        with self._lock:
            self._chunks = chunks
            self._bm25 = BM25([chunk.tokens for chunk in chunks]) if chunks else None
            self._fingerprint = fingerprint
            self._has_embeddings = bool(embeddings)
        logger.info(
            "Knowledge index built: %d documents, %d chunks, embeddings=%s",
            len(documents), len(chunks), bool(embeddings),
        )

    def all_text(self) -> str:
        """Every indexed chunk, used as the allowed corpus for the grounding guard."""
        try:
            self.refresh()
        except Exception:
            logger.exception("Knowledge refresh failed; using the previous index")
        with self._lock:
            return "\n".join(f"{c.title} {c.heading} {c.text}" for c in self._chunks)

    @property
    def chunk_count(self) -> int:
        return len(self._chunks)

    # -------------------------------------------------------------- retrieval
    def retrieve(self, query: str, top_k: int = TOP_K) -> list[Chunk]:
        try:
            self.refresh()
        except Exception:
            logger.exception("Knowledge refresh failed; using the previous index")

        with self._lock:
            chunks, bm25 = self._chunks, self._bm25
        if not chunks or not query.strip():
            return []

        rankings: list[list[int]] = []

        query_tokens = tokenize(query)
        if bm25 and query_tokens:
            scores = bm25.scores(query_tokens)
            ranked = sorted((i for i, s in enumerate(scores) if s > 0), key=lambda i: scores[i], reverse=True)
            if ranked:
                rankings.append(ranked)

        if any(chunk.embedding for chunk in chunks):
            vectors = self.embedder.embed([query], input_type="query", timeout=3.0)
            if vectors:
                similarities = [
                    _cosine(vectors[0], chunk.embedding) if chunk.embedding else -1.0 for chunk in chunks
                ]
                ranked = sorted(
                    (i for i, s in enumerate(similarities) if s >= EMBED_MIN_SCORE),
                    key=lambda i: similarities[i],
                    reverse=True,
                )
                if ranked:
                    rankings.append(ranked)

        fused: dict[int, float] = {}
        for ranking in rankings:
            for rank, index in enumerate(ranking):
                fused[index] = fused.get(index, 0.0) + 1.0 / (RRF_K + rank + 1)
        best = sorted(fused, key=fused.get, reverse=True)[:top_k]
        return [chunks[i] for i in best]


def format_context(chunks: list[Chunk]) -> str:
    if not chunks:
        return ""
    blocks = [
        f"[{index}] Source: {chunk.title} - {chunk.heading}\n{chunk.text}"
        for index, chunk in enumerate(chunks, start=1)
    ]
    return (
        "\n\n==================================================\n"
        "RETRIEVED KNOWLEDGE (verified write-ups; use only when relevant)\n"
        "==================================================\n"
        "Use these excerpts to add specific, accurate detail. They are verified facts about "
        "implemented work. Never contradict the resume above, and do not mention source numbers aloud.\n\n"
        + "\n\n".join(blocks)
    )


def sources_for(chunks: list[Chunk]) -> list[dict]:
    seen = set()
    sources = []
    for chunk in chunks:
        key = (chunk.source, chunk.heading)
        if key in seen:
            continue
        seen.add(key)
        sources.append({"title": chunk.title, "section": chunk.heading, "url": chunk.url})
    return sources


knowledge_base = KnowledgeBase()
