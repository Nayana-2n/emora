from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from typing import Optional, List, Dict

from app.core.security import get_current_user
from app.core.firestore_db import user_base, list_docs, get_doc
from app.services.conversation_service import process_turn, get_history, start_conversation

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    conversation_id: Optional[str] = None
    face: Optional[Dict[str, float]] = None
    voice: Optional[Dict[str, float]] = None
    stress: Optional[float] = None
    chat_history: Optional[List[dict]] = None
    session_id: Optional[str] = None
    turn_no: Optional[int] = None
    modalities: Optional[List[str]] = None
    confidence: Optional[float] = None


@router.post("/chat")
def chat(body: ChatRequest, user=Depends(get_current_user)):
    """One turn of the AI companion conversation.
    Browser STT sends `message` text; browser TTS speaks `reply` audio.
    Emotion context (face/voice/stress) is optional. When `session_id` is
    provided the turn is persisted against that live session.
    """
    if not body.message or not body.message.strip():
        raise HTTPException(status_code=400, detail="message cannot be empty")
    result = process_turn(
        uid=user["user_id"],
        message=body.message.strip(),
        cid=body.conversation_id,
        face=body.face,
        voice=body.voice,
        stress=body.stress,
        chat_history=body.chat_history,
        session_id=body.session_id,
        turn_no=body.turn_no,
        modalities=body.modalities,
        confidence=body.confidence,
    )
    return {"status": "success", **result}


@router.post("/conversation/start")
def conversation_start(user=Depends(get_current_user)):
    cid = start_conversation(user["user_id"])
    return {"conversation_id": cid}


@router.get("/conversations")
def list_conversations(user=Depends(get_current_user)):
    items = list_docs(user_base(user["user_id"], "conversations"))
    items.sort(key=lambda c: c.get("updated_at") or 0, reverse=True)
    return {"conversations": items, "count": len(items)}


@router.get("/conversations/{conversation_id}")
def conversation_detail(conversation_id: str, user=Depends(get_current_user)):
    doc = get_doc(user_base(user["user_id"], "conversations") + [conversation_id])
    if not doc:
        raise HTTPException(status_code=404, detail="Conversation not found")
    return {"conversation": doc, "turns": get_history(user["user_id"], conversation_id)}
