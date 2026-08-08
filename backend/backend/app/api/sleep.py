from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.core.firestore_db import user_base, save_doc, get_doc, list_docs
from app.utils.time_utils import now_ts, today_str, validate_date
from app.models.schemas import SleepCreate

router = APIRouter()

QUALITY_LABELS = {1: "very_bad", 2: "bad", 3: "ok", 4: "good", 5: "great"}


def _base(uid: str):
    return user_base(uid, "sleep")


@router.post("/sleep")
def save_sleep(body: SleepCreate, user=Depends(get_current_user)):
    date = validate_date(body.date) if body.date else today_str()
    save_doc(_base(user["user_id"]) + [date], {
        "date": date,
        "hours": body.hours,
        "quality": body.quality,
        "quality_label": QUALITY_LABELS.get(body.quality, "ok"),
        "ts": now_ts(),
    })
    return {"date": date, "status": "success"}


@router.get("/sleep/today")
def sleep_today(user=Depends(get_current_user)):
    date = today_str()
    doc = get_doc(_base(user["user_id"]) + [date])
    if not doc:
        return {"date": date, "hours": None, "quality": None, "recorded": False}
    return {"date": date, "hours": doc.get("hours"), "quality": doc.get("quality"),
            "quality_label": doc.get("quality_label"), "recorded": True}


@router.get("/sleep")
def sleep_history(user=Depends(get_current_user)):
    entries = list_docs(_base(user["user_id"]))
    entries.sort(key=lambda e: e.get("date") or "", reverse=True)
    return {"entries": entries, "count": len(entries)}
