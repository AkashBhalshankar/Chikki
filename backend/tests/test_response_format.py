import pytest

from response_format import classify, layout_hint


@pytest.mark.parametrize(
    "question,shape",
    [
        ("What are his main skills?", "list"),
        ("Which technologies does he use?", "list"),
        ("Which companies has he worked at?", "experience"),
        ("What projects has he built?", "experience"),
        ("Does Akash have Kubernetes experience?", "verdict"),
        ("Did he work at Google?", "verdict"),
        ("Why should we hire him?", "pitch"),
        ("How does Chikki work?", "explain"),
        ("Explain the architecture", "explain"),
        ("How can I contact Akash?", "contact"),
        ("Can I get his resume?", "contact"),
        ("Tell me about yourself", "default"),
    ],
)
def test_question_shapes(question, shape):
    assert classify(question) == shape


def test_layout_hint_matches_shape():
    assert "bullets" in layout_hint("What are his skills?")
    assert "verdict" in layout_hint("Does he know Rust?")
