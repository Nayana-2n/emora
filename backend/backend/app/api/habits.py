from datetime import date, timedelta

from fastapi import APIRouter, Depends, HTTPException

from app.core.security import get_current_user
from app.core.firestore_db import user_base, add_doc, get_doc, delete_doc, save_doc
from app.utils.time_utils import now_ts, today_str, validate_date
from app.models.schemas import HabitCreate, HabitToggle
from app.services.data_service import get_habit_definitions, get_habit_daily

router = APIRouter()

PRIORITY_LABELS = {1: "high", 2: "medium", 3: "low"}
CATEGORIES = ["health", "education", "fitness", "productivity", "personal", "social", "other"]


def _base(uid: str):
    return user_base(uid, "habits")


def _streaks(completions: dict) -> tuple[int, int]:
    """(current_streak, longest_streak) from a {date: true} completions map."""
    done = {d for d, v in (completions or {}).items() if v}
    if not done:
        return 0, 0
    ordered = sorted(done)
    longest = 0
    run = 0
    prev = None
    for d in ordered:
        try:
            dd = date.fromisoformat(d)
        except Exception:
            continue
        if prev is None or (dd - prev).days == 1:
            run += 1
        else:
            run = 1
        longest = max(longest, run)
        prev = dd

    today = date.today()
    cur = today if today.isoformat() in done else today - timedelta(days=1)
    streak = 0
    while cur.isoformat() in done:
        streak += 1
        cur -= timedelta(days=1)
    return streak, longest


def _enrich(uid: str, habit: dict) -> dict:
    completions = habit.get("completions") or {}
    streak, longest = _streaks(completions)
    created = habit.get("created_at")
    elapsed = 1
    try:
        if isinstance(created, (int, float)):
            start = date.fromtimestamp(int(created))
        else:
            start = date.fromisoformat(str(created).split(" ")[0])
        elapsed = max(1, (date.today() - start).days + 1)
    except Exception:
        pass
    done_days = len({d for d, v in completions.items() if v})
    habit["streak"] = streak
    habit["longest_streak"] = longest
    habit["completed_days"] = done_days
    habit["completion_percent"] = round(done_days / elapsed * 100, 1)
    habit["completed_today"] = bool(completions.get(today_str()))
    habit["priority_label"] = PRIORITY_LABELS.get(habit.get("priority"), "medium")
    return habit


@router.post("/habits")
def create_habit(body: HabitCreate, user=Depends(get_current_user)):
    name = (body.name or "").strip()
    if not name:
        raise HTTPException(status_code=400, detail="Habit name cannot be empty")
    if body.category and body.category not in CATEGORIES:
        raise HTTPException(status_code=400, detail=f"Category must be one of: {', '.join(CATEGORIES)}")
    habit_id = add_doc(_base(user["user_id"]), {
        "name": name[:100],
        "category": (body.category or "other")[:50],
        "priority": body.priority,
        "description": (body.description or "").strip()[:300],
        "frequency": (body.frequency or "").strip()[:50],
        "created_at": now_ts(),
        "completions": {},
    })
    habit = get_doc(_base(user["user_id"]) + [habit_id]) or {}
    habit["id"] = habit_id
    return {"id": habit_id, "status": "success", "habit": _enrich(user["user_id"], habit)}


@router.get("/habits/today")
def habits_today(user=Depends(get_current_user)):
    date = today_str()
    definitions = get_habit_definitions(user["user_id"])
    habits = []
    for h in definitions:
        habits.append({
            "id": h.get("id"),
            "name": h.get("name"),
            "category": h.get("category"),
            "priority": h.get("priority"),
            "description": h.get("description"),
            "frequency": h.get("frequency"),
            "completed": bool((h.get("completions") or {}).get(date)),
        })
    completed = sum(1 for h in habits if h["completed"])
    total = len(habits)
    return {
        "date": date,
        "habits": habits,
        "completed": completed,
        "total": total,
        "percent": round(completed / total * 100, 1) if total else 0.0,
        "recorded": total > 0,
    }


@router.get("/habits")
def habits_history(user=Depends(get_current_user)):
    definitions = [_enrich(user["user_id"], h) for h in get_habit_definitions(user["user_id"])]
    definitions.sort(key=lambda h: h.get("created_at") or 0, reverse=True)
    return {"habits": definitions, "count": len(definitions), "days": get_habit_daily(user["user_id"])}


@router.delete("/habits/{habit_id}")
def delete_habit(habit_id: str, user=Depends(get_current_user)):
    base = _base(user["user_id"]) + [habit_id]
    if not get_doc(base):
        raise HTTPException(status_code=404, detail="Habit not found")
    delete_doc(base)
    return {"id": habit_id, "status": "deleted"}


@router.post("/habits/{habit_id}/toggle")
def toggle_habit(habit_id: str, body: HabitToggle, user=Depends(get_current_user)):
    base = _base(user["user_id"]) + [habit_id]
    habit = get_doc(base)
    if not habit:
        raise HTTPException(status_code=404, detail="Habit not found")
    date = validate_date(body.date) if body.date else today_str()
    completions = dict(habit.get("completions") or {})
    if body.completed is None:
        completions[date] = not completions.get(date, False)
    else:
        completions[date] = bool(body.completed)
    if not completions.get(date):
        completions.pop(date, None)
    save_doc(base, {"completions": completions})
    updated = get_doc(base) or {}
    updated["id"] = habit_id
    return {"id": habit_id, "status": "success", "habit": _enrich(user["user_id"], updated)}
