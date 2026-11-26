from pathlib import Path

from knowledge import BM25, KnowledgeBase, chunk_markdown, format_context, sources_for, tokenize


class NoEmbedder:
    available = False

    def embed(self, texts, input_type, timeout):
        return None


class FakeEmbedder:
    """Maps text to a 2-d vector: [mentions voice, mentions resume]."""

    available = True

    def __init__(self):
        self.calls = []

    def embed(self, texts, input_type, timeout):
        if not self.available:
            return None
        self.calls.append(input_type)
        return [[float("voice" in t.lower() or "speech" in t.lower()), float("resume" in t.lower())] for t in texts]


def write_docs(folder: Path):
    (folder / "chikki.md").write_text(
        "# Chikki Project\n\n## Voice\n\nEdge-TTS speech synthesis streams sentence audio.\n\n"
        "## Resume\n\nATS resume PDF generated from Google Drive.\n",
        encoding="utf-8",
    )
    (folder / "other.md").write_text("# Other\n\n## Testing\n\nPytest suite and GitHub Actions CI.\n", encoding="utf-8")
    (folder / "README.md").write_text("# Instructions, not knowledge\n\nVoice voice voice.\n", encoding="utf-8")


def test_tokenize_drops_stop_words_and_keeps_tech_terms():
    assert tokenize("What does Akash know about FastAPI and C#?") == ["know", "fastapi", "c#"]


def test_chunk_markdown_splits_by_heading():
    chunks = chunk_markdown("# T\n\n## A\n\nalpha text\n\n## B\n\nbeta text", "t.md", "T")
    assert [(c.heading, c.text) for c in chunks] == [("A", "alpha text"), ("B", "beta text")]


def test_chunk_markdown_packs_long_sections():
    paragraphs = "\n\n".join(f"paragraph {i} " + "x" * 300 for i in range(6))
    chunks = chunk_markdown(f"## Long\n\n{paragraphs}", "l.md", "L")
    assert len(chunks) > 1
    assert all(len(c.text) <= 1300 for c in chunks)


def test_bm25_prefers_matching_document():
    bm25 = BM25([["voice", "speech"], ["resume", "pdf"]])
    scores = bm25.scores(["resume"])
    assert scores[1] > scores[0] == 0


def test_keyword_retrieval_ignores_readme_and_returns_sources(tmp_path):
    write_docs(tmp_path)
    kb = KnowledgeBase(tmp_path, embedder=NoEmbedder())
    results = kb.retrieve("How does the speech synthesis work?")
    assert results and results[0].heading == "Voice"
    assert all(chunk.source != "README.md" for chunk in kb._chunks)
    assert sources_for(results)[0] == {"title": "Chikki Project", "section": "Voice", "url": ""}
    assert "Edge-TTS" in format_context(results)


def test_irrelevant_query_returns_nothing(tmp_path):
    write_docs(tmp_path)
    kb = KnowledgeBase(tmp_path, embedder=NoEmbedder())
    assert kb.retrieve("favourite pizza topping") == []
    assert format_context([]) == ""


def test_hybrid_retrieval_uses_embeddings(tmp_path):
    write_docs(tmp_path)
    embedder = FakeEmbedder()
    kb = KnowledgeBase(tmp_path, embedder=embedder)
    # No keyword overlap with "Voice" chunk except via the embedding.
    results = kb.retrieve("tell me about the voice")
    assert results[0].heading == "Voice"
    assert "passage" in embedder.calls and "query" in embedder.calls


def test_index_rebuilds_when_files_change(tmp_path):
    write_docs(tmp_path)
    kb = KnowledgeBase(tmp_path, embedder=NoEmbedder())
    assert kb.retrieve("kubernetes") == []
    (tmp_path / "k8s.md").write_text("# Infra\n\n## Kubernetes\n\nDeployed with Kubernetes.\n", encoding="utf-8")
    assert kb.retrieve("kubernetes")[0].heading == "Kubernetes"


def test_embeddings_are_retried_after_an_outage(tmp_path):
    write_docs(tmp_path)
    embedder = FakeEmbedder()
    embedder.available = False
    kb = KnowledgeBase(tmp_path, embedder=embedder)
    kb.retrieve("voice")
    assert not any(chunk.embedding for chunk in kb._chunks)
    embedder.available = True
    kb.retrieve("voice")
    assert all(chunk.embedding for chunk in kb._chunks)
