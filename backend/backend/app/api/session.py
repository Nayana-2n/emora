import uuid

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional

from app.core.security import get_current_user
from app.core.firestore_db import user_base, save_doc, get_doc, list_docs
from app.utils.time_utils import now_ts
from app.services.conversation_service import get_turns_for_session

router = APIRouter()


def _session_doc_path(uid: str, session_id: str) -> list[str]:
    return user_base(uid, "sessions") + [session_id]


def _interactions(uid: str, session_id: str) -> list[dict]:
    return list_docs(user_base(uid, "sessions") + [session_id, "interactions"])


def _dominant(xs):
    return max(xs, key=xs.get) if xs else None


def _summary(uid: str, doc: dict) -> dict:
    """Compute a human-readable summary for a session from its interactions."""
    session_id = doc.get("session_id") or doc.get("id")
    interactions = _interactions(uid, session_id) if session_id else []
    stress_values = [float(i["stress"]) for i in interactions if isinstance(i.get("stress"), (int, float))]
    emotion_counts: dict[str, int] = {}
    for i in interactions:
        dom = _dominant(i.get("fusion") or {}) or i.get("emotion")
        if dom:
            emotion_counts[dom] = emotion_counts.get(dom, 0) + 1
    dominant = max(emotion_counts, key=emotion_counts.get) if emotion_counts else None
    return {
        "session_id": session_id,
        "created_at": doc.get("created_at"),
        "ended_at": doc.get("ended_at"),
        "status": doc.get("status") or "active",
        "turns": int(doc.get("turns") or 0),
        "interactions": len(interactions),
        "dominant_emotion": dominant,
        "avg_stress": round(sum(stress_values) / len(stress_values), 1) if stress_values else None,
        "emotion_distribution": emotion_counts,
        "final_emotion": doc.get("final_emotion"),
    }


class EndSessionRequest(BaseModel):
    final_emotion: Optional[str] = None
    avg_stress: Optional[float] = None
    stress_samples: Optional[int] = None
    total_turns: Optional[int] = None
    summary: Optional[str] = None


@router.post("/session/start")
def start_session(user=Depends(get_current_user)):
    session_id = uuid.uuid4().hex
    ts = now_ts()
    save_doc(_session_doc_path(user["user_id"], session_id), {
        "session_id": session_id,
        "created_at": ts,
        "last_ts": ts,
        "status": "active",
        "turns": 0,
    })
    return {"session_id": session_id, "status": "active", "created_at": ts}


@router.post("/session/{session_id}/end")
def end_session(session_id: str, body: EndSessionRequest, user=Depends(get_current_user)):
    doc = get_doc(_session_doc_path(user["user_id"], session_id))
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")
    interactions = _interactions(user["user_id"], session_id)
    stress_values = [float(i["stress"]) for i in interactions if isinstance(i.get("stress"), (int, float))]
    save_doc(_session_doc_path(user["user_id"], session_id), {
        "ended_at": now_ts(),
        "status": "ended",
        "final_emotion": body.final_emotion or _summary(user["user_id"], doc).get("dominant_emotion"),
        "avg_stress": body.avg_stress if body.avg_stress is not None else (round(sum(stress_values) / len(stress_values), 1) if stress_values else None),
        "total_turns": body.total_turns if body.total_turns is not None else int(doc.get("turns") or 0),
        "session_summary": body.summary,
    })
    updated = get_doc(_session_doc_path(user["user_id"], session_id))
    return {"status": "ended", "session": _summary(user["user_id"], updated)}


@router.get("/session/history")
def session_history(user=Depends(get_current_user)):
    sessions = list_docs(user_base(user["user_id"], "sessions"))
    sessions.sort(key=lambda x: x.get("created_at") or x.get("last_ts") or 0, reverse=True)
    items = [_summary(user["user_id"], s) for s in sessions]
    return {"sessions": items, "count": len(items)}


@router.get("/session/{session_id}")
def session_detail(session_id: str, user=Depends(get_current_user)):
    doc = get_doc(_session_doc_path(user["user_id"], session_id))
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"session": _summary(user["user_id"], doc), "turns": get_turns_for_session(user["user_id"], session_id)}


@router.get("/session/{session_id}/turns")
def session_turns(session_id: str, user=Depends(get_current_user)):
    doc = get_doc(_session_doc_path(user["user_id"], session_id))
    if not doc:
        raise HTTPException(status_code=404, detail="Session not found")
    return {"session_id": session_id, "turns": get_turns_for_session(user["user_id"], session_id)}
