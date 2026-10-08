import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

FEEDBACK_FILE = Path(__file__).parent / "feedback_log.jsonl"


def record_feedback(
    value: str,
    question: str = "",
    reply: str = "",
    mode: str = "voice",
    user_comment: Optional[str] = None,
    trace_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> Dict[str, Any]:
    entry = {
        "id": f"fb_{int(datetime.now(timezone.utc).timestamp() * 1000)}",
        "at": datetime.now(timezone.utc).isoformat(),
        "value": value,
        "question": question,
        "reply": reply,
        "mode": mode,
        "user_comment": user_comment.strip() if user_comment else None,
        "trace_id": trace_id,
        "session_id": session_id,
    }

    try:
        with open(FEEDBACK_FILE, "a", encoding="utf-8") as f:
            f.write(json.dumps(entry, ensure_ascii=False) + "\n")
    except Exception:
        pass

    return entry


def read_feedback(limit: int = 50, filter_value: Optional[str] = None) -> List[Dict[str, Any]]:
    if not FEEDBACK_FILE.exists():
        return []

    entries = []
    try:
        with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    if filter_value and data.get("value") != filter_value:
                        continue
                    entries.append(data)
                except json.JSONDecodeError:
                    continue
    except Exception:
        return []

    entries.reverse()
    return entries[:limit]


def feedback_analytics() -> Dict[str, Any]:
    if not FEEDBACK_FILE.exists():
        return {
            "total": 0,
            "helpful": 0,
            "needs_improvement": 0,
            "satisfaction_rate": "0%",
        }

    total = 0
    helpful = 0
    needs_improvement = 0

    try:
        with open(FEEDBACK_FILE, "r", encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                try:
                    data = json.loads(line)
                    total += 1
                    if data.get("value") == "helpful":
                        helpful += 1
                    elif data.get("value") == "needs-improvement":
                        needs_improvement += 1
                except json.JSONDecodeError:
                    continue
    except Exception:
        pass

    rate = f"{int((helpful / total) * 100)}%" if total > 0 else "0%"

    return {
        "total": total,
        "helpful": helpful,
        "needs_improvement": needs_improvement,
        "satisfaction_rate": rate,
    }