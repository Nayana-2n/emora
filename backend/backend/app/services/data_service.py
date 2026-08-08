from datetime import date, timedelta

from app.core.firestore_db import list_docs, get_doc, user_base

LEGACY_HABIT_KEYS = ["exercise", "meditation", "reading", "walking"]


def get_user_interactions(uid: str) -> list[dict]:
    """All interaction records across every session, newest first.
    Each record gains a 'session_id' field. Backend-agnostic (Firestore/SQLite).
    """
    out: list[dict] = []
    sessions = list_docs(user_base(uid, "sessions"))
    for s in sessions:
        sid = s.get("session_id") or s.get("id")
        if not sid:
            continue
        for i in list_docs(user_base(uid, "sessions") + [sid, "interactions"]):
            i["session_id"] = sid
            out.append(i)
    out.sort(key=lambda d: d.get("ts") or 0, reverse=True)
    return out


def get_feature_docs(uid: str, feature: str) -> list[dict]:
    return list_docs(user_base(uid, feature))


def get_journals(uid: str) -> list[dict]:
    docs = get_feature_docs(uid, "journals")
    docs.sort(key=lambda d: d.get("created_at") or 0, reverse=True)
    return docs


def get_moods(uid: str) -> list[dict]:
    docs = get_feature_docs(uid, "moods")
    docs.sort(key=lambda d: d.get("date") or "", reverse=True)
    return docs


def get_habit_definitions(uid: str) -> list[dict]:
    """User-created habit definitions (name/category/priority/etc)."""
    return [d for d in get_feature_docs(uid, "habits") if "name" in d]


def get_habit_daily(uid: str) -> list[dict]:
    """Daily habit completion summaries [{date, completed, total}].

    Handles both the new per-habit completion model and any legacy day docs
    (fixed 4-key boolean checklists) that may still exist in storage.
    """
    docs = get_feature_docs(uid, "habits")
    definitions = [d for d in docs if "name" in d]
    legacy = [d for d in docs if not ("name" in d)]

    daily: dict[str, dict] = {}

    # Legacy day docs: {exercise, meditation, reading, walking, date}
    for d in legacy:
        day = d.get("date") or ""
        if not day:
            continue
        rec = daily.setdefault(day, {"date": day, "completed": 0, "total": 0})
        rec["completed"] += sum(1 for k in LEGACY_HABIT_KEYS if d.get(k))
        rec["total"] += len(LEGACY_HABIT_KEYS)

    # New model: completions dict per habit definition. A habit counts toward
    # a day's total from its creation date onwards (even when not completed).
    for d in definitions:
        completions = d.get("completions") or {}
        created = d.get("created_at")
        try:
            if isinstance(created, (int, float)):
                start_d = date.fromtimestamp(int(created))
            else:
                start_d = date.fromisoformat(str(created).split(" ")[0])
        except Exception:
            continue
        cur = start_d
        today = date.today()
        while cur <= today:
            day = cur.isoformat()
            rec = daily.setdefault(day, {"date": day, "completed": 0, "total": 0})
            rec["total"] += 1
            if completions.get(day):
                rec["completed"] += 1
            cur += timedelta(days=1)

    out = sorted(daily.values(), key=lambda r: r["date"], reverse=True)
    for r in out:
        r["percent"] = round(r["completed"] / r["total"] * 100, 1) if r["total"] else 0.0
    return out


def get_habits(uid: str) -> list[dict]:
    """Daily habit completion summaries (used by analytics/wellness)."""
    return get_habit_daily(uid)


def get_water(uid: str) -> list[dict]:
    return get_feature_docs(uid, "water")


def get_water_goal(uid: str) -> int:
    doc = get_doc(user_base(uid, "preferences") + ["water_goal"])
    goal = (doc or {}).get("goal_ml")
    return int(goal) if isinstance(goal, (int, float)) else 2000


def get_sleep(uid: str) -> list[dict]:
    docs = get_feature_docs(uid, "sleep")
    docs.sort(key=lambda d: d.get("date") or "", reverse=True)
    return docs
