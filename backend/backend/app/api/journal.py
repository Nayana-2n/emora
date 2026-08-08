from fastapi import APIRouter, Depends, HTTPException

from app.core.security import get_current_user
from app.core.firestore_db import user_base, add_doc, get_doc, list_docs, delete_doc, save_doc
from app.utils.time_utils import now_ts, today_str, validate_date
from app.models.schemas import JournalCreate, JournalUpdate

router = APIRouter()


def _base(uid: str):
    return user_base(uid, "journals")


@router.post("/journal")
def create_journal(body: JournalCreate, user=Depends(get_current_user)):
    section = body.section or "today"
    if section not in ("today", "tomorrow_story"):
        raise HTTPException(status_code=400, detail="Section must be 'today' or 'tomorrow_story'")
    ts = now_ts()
    entry_id = add_doc(_base(user["user_id"]), {
        "title": body.title,
        "content": body.content,
        "mood_tag": body.mood_tag,
        "section": section,
        "date": validate_date(body.date) if body.date else today_str(),
        "created_at": ts,
        "updated_at": ts,
    })
    return {"id": entry_id, "status": "success"}


@router.get("/journal")
def list_journal(user=Depends(get_current_user)):
    entries = list_docs(_base(user["user_id"]))
    entries.sort(key=lambda e: e.get("created_at") or 0, reverse=True)
    return {"entries": entries, "count": len(entries)}


@router.get("/journal/{entry_id}")
def get_journal(entry_id: str, user=Depends(get_current_user)):
    doc = get_doc(_base(user["user_id"]) + [entry_id])
    if not doc:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    return doc


@router.put("/journal/{entry_id}")
def update_journal(entry_id: str, body: JournalUpdate, user=Depends(get_current_user)):
    base = _base(user["user_id"]) + [entry_id]
    existing = get_doc(base)
    if not existing:
        raise HTTPException(status_code=404, detail="Journal entry not found")
    updates = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "section" in updates and updates["section"] not in ("today", "tomorrow_story"):
        raise HTTPException(status_code=400, detail="Section must be 'today' or 'tomorrow_story'")
    updates["updated_at"] = now_ts()
    save_doc(base, updates)
    return {"id": entry_id, "status": "success"}


@router.delete("/journal/{entry_id}")
def delete_journal(entry_id: str, user=Depends(get_current_user)):
    base = _base(user["user_id"]) + [entry_id]
    if not get_doc(base):
        raise HTTPException(status_code=404, detail="Journal entry not found")
    delete_doc(base)
    return {"id": entry_id, "status": "deleted"}
