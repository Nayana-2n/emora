from datetime import date, timedelta

from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.core.firestore_db import user_base, add_doc, list_docs, get_doc, save_doc
from app.utils.time_utils import now_ts, today_str, validate_date
from app.models.schemas import WaterCreate, WaterGoalUpdate
from app.services.data_service import get_water_goal

router = APIRouter()


def _base(uid: str):
    return user_base(uid, "water")


def _goal_path(uid: str):
    return user_base(uid, "preferences") + ["water_goal"]


def _daily(uid: str) -> dict[str, int]:
    by_day: dict[str, int] = {}
    for e in list_docs(_base(uid)):
        d = e.get("date") or ""
        by_day[d] = by_day.get(d, 0) + (e.get("amount_ml") or 0)
    return by_day


def _streak(uid: str, goal_ml: int) -> int:
    by_day = _daily(uid)
    if not by_day:
        return 0
    today = date.today()
    cur = today if today.isoformat() in by_day and by_day[today.isoformat()] >= goal_ml else today - timedelta(days=1)
    streak = 0
    while cur.isoformat() in by_day and by_day[cur.isoformat()] >= goal_ml:
        streak += 1
        cur -= timedelta(days=1)
    return streak


@router.post("/water")
def add_water(body: WaterCreate, user=Depends(get_current_user)):
    date = validate_date(body.date) if body.date else today_str()
    entry_id = add_doc(_base(user["user_id"]), {
        "amount_ml": body.amount_ml,
        "date": date,
        "ts": now_ts(),
    })
    return {"id": entry_id, "amount_ml": body.amount_ml, "date": date, "status": "success"}


@router.get("/water/today")
def water_today(user=Depends(get_current_user)):
    uid = user["user_id"]
    date = today_str()
    entries = sorted([e for e in list_docs(_base(uid)) if e.get("date") == date],
                     key=lambda e: e.get("ts") or 0)
    total = sum(e.get("amount_ml") or 0 for e in entries)
    goal_ml = get_water_goal(uid)
    percent = round(total / goal_ml * 100, 1) if goal_ml else 0.0
    return {
        "date": date,
        "total_ml": total,
        "goal_ml": goal_ml,
        "percent": percent,
        "remaining_ml": max(0, goal_ml - total),
        "glasses": len(entries),
        "entries": entries,
        "streak": _streak(uid, goal_ml),
    }


@router.get("/water")
def water_history(user=Depends(get_current_user)):
    uid = user["user_id"]
    entries = list_docs(_base(uid))
    by_day: dict[str, dict] = {}
    for e in entries:
        d = e.get("date") or ""
        rec = by_day.setdefault(d, {"date": d, "total_ml": 0, "glasses": 0, "entries": []})
        rec["total_ml"] += e.get("amount_ml") or 0
        rec["glasses"] += 1
        rec["entries"].append(e)
    for rec in by_day.values():
        rec["entries"].sort(key=lambda x: x.get("ts") or 0)
    history = sorted(by_day.values(), key=lambda x: x["date"], reverse=True)
    goal_ml = get_water_goal(uid)
    for rec in history:
        rec["percent"] = round(rec["total_ml"] / goal_ml * 100, 1) if goal_ml else 0.0
        rec["goal_ml"] = goal_ml
    return {"history": history, "count": len(history), "goal_ml": goal_ml, "streak": _streak(uid, goal_ml)}


@router.post("/water/goal")
def set_water_goal(body: WaterGoalUpdate, user=Depends(get_current_user)):
    save_doc(_goal_path(user["user_id"]), {"goal_ml": body.goal_ml})
    return {"goal_ml": body.goal_ml, "status": "success"}


@router.get("/water/goal")
def get_goal(user=Depends(get_current_user)):
    return {"goal_ml": get_water_goal(user["user_id"])}
