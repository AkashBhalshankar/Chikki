import json


def test_record_and_read_feedback(feedback_db):
    feedback_db.record_feedback("helpful", question="q1", reply="r1", user_comment="  great  ")
    feedback_db.record_feedback("needs-improvement", question="q2", reply="r2")

    entries = feedback_db.read_feedback(limit=10)
    assert [entry["question"] for entry in entries] == ["q2", "q1"]
    assert entries[1]["user_comment"] == "great"
    assert entries[0]["user_comment"] is None

    only_helpful = feedback_db.read_feedback(filter_value="helpful")
    assert [entry["question"] for entry in only_helpful] == ["q1"]


def test_feedback_analytics(feedback_db):
    assert feedback_db.feedback_analytics()["total"] == 0
    for value in ("helpful", "helpful", "helpful", "needs-improvement"):
        feedback_db.record_feedback(value)
    stats = feedback_db.feedback_analytics()
    assert stats == {"total": 4, "helpful": 3, "needs_improvement": 1, "satisfaction_rate": "75%"}


def test_legacy_jsonl_imported_once(tmp_path, monkeypatch):
    import feedback_store

    legacy = tmp_path / "feedback_log.jsonl"
    legacy.write_text(
        "\n".join([
            json.dumps({"id": "fb_1", "at": "2026-01-01T00:00:00+00:00", "value": "helpful", "question": "old"}),
            "not json",
            json.dumps({"id": "fb_2", "at": "2026-01-02T00:00:00+00:00", "value": "bogus"}),
        ]),
        encoding="utf-8",
    )
    monkeypatch.setattr(feedback_store, "LEGACY_JSONL", legacy)
    monkeypatch.setenv("FEEDBACK_DB_PATH", str(tmp_path / "fb.db"))

    entries = feedback_store.read_feedback()
    assert [entry["id"] for entry in entries] == ["fb_1"]
