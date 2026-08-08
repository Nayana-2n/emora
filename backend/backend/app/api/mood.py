from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.core.firestore_db import user_base, save_doc, get_doc, list_docs
from app.utils.time_utils import now_ts, today_str, validate_date
from app.models.schemas import MoodCreate

router = APIRouter()

MOOD_LABELS = {1: "very_low", 2: "low", 3: "neutral", 4: "good", 5: "great"}


def _base(uid: str):
    return user_base(uid, "moods")


@router.post("/mood")
def save_mood(body: MoodCreate, user=Depends(get_current_user)):
    date = validate_date(body.date) if body.date else today_str()
    save_doc(_base(user["user_id"]) + [date], {
        "date": date,
        "mood": body.mood,
        "mood_label": MOOD_LABELS.get(body.mood, "neutral"),
        "note": body.note,
        "emotion": body.emotion,
        "stress": body.stress,
        "ts": now_ts(),
    })
    return {"date": date, "status": "success"}


@router.get("/mood/today")
def mood_today(user=Depends(get_current_user)):
    date = today_str()
    doc = get_doc(_base(user["user_id"]) + [date])
    if not doc:
        return {"date": date, "mood": None, "recorded": False}
    return {"date": date, "mood": doc.get("mood"), "mood_label": doc.get("mood_label"),
            "note": doc.get("note"), "emotion": doc.get("emotion"), "stress": doc.get("stress"),
            "recorded": True}


@router.get("/mood")
def mood_history(user=Depends(get_current_user)):
    entries = list_docs(_base(user["user_id"]))
    entries.sort(key=lambda e: e.get("date") or "", reverse=True)
    return {"entries": entries, "count": len(entries)}
