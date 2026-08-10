import uuid

from app.core.firestore_db import user_base, add_doc, list_docs, get_doc, save_doc
from app.utils.time_utils import now_ts
from app.services.text_processor import analyze_text_sentiment

try:
    from app.services.gemini_service import generate_ai_response
except Exception as _imp_err:
    print(f"[!] gemini_service import failed: {_imp_err!r}")

    def generate_ai_response(transcript, video_emotions, audio_emotions, stress_score, chat_history=None, **kwargs):
        return {"reply": "I am here with you. Tell me more about that.", "status": "fallback"}


def start_conversation(uid: str) -> str:
    """Create a new conversation thread. Returns the conversation id."""
    cid = uuid.uuid4().hex
    ts = now_ts()
    # Store the conversation doc under the conversation id itself so the doc
    # key, the conversation_id field and the turns sub-collection all line up.
    save_doc(user_base(uid, "conversations") + [cid], {
        "conversation_id": cid,
        "created_at": ts,
        "updated_at": ts,
    })
    return cid


def get_conversation(uid: str, cid: str):
    return get_doc(user_base(uid, "conversations") + [cid])


def get_history(uid: str, cid: str) -> list[dict]:
    turns = list_docs(user_base(uid, "conversations") + [cid, "turns"])
    turns.sort(key=lambda t: t.get("ts") or 0)
    return turns


def get_turns_for_session(uid: str, session_id: str) -> list[dict]:
    """Aggregate every conversation turn that belongs to a live session."""
    out: list[dict] = []
    for conv in list_docs(user_base(uid, "conversations")):
        cid = conv.get("conversation_id") or conv.get("id")
        if not cid:
            continue
        for turn in get_history(uid, cid):
            if turn.get("session_id") == session_id:
                out.append(turn)
    out.sort(key=lambda t: t.get("ts") or 0)
    return out


def process_turn(uid: str, message: str, cid: str = None, face=None, voice=None,
                 stress=None, chat_history=None, session_id: str = None,
                 turn_no: int = None, modalities: list = None, confidence: float = None) -> dict:
    """Run one chat turn: Gemini reply, then persist question/answer + emotion context.

    When `session_id` is provided the turn is linked to a live session and a
    session interaction record is written so analytics can use the data.
    """
    cid = cid or start_conversation(uid)
    face = face or {}
    voice = voice or {}
    stress = stress if isinstance(stress, (int, float)) else 0.0
    chat_history = chat_history or []
    modalities = modalities or ([m for m, d in (("face", face), ("voice", voice)) if d] or None)

    ai_result = generate_ai_response(
        transcript=message,
        video_emotions=face,
        audio_emotions=voice,
        stress_score=stress,
        chat_history=chat_history,
    )

    fused = {}
    for k in set(face) | set(voice):
        fused[k] = (face.get(k, 0) * 0.5) + (voice.get(k, 0) * 0.3)
    text_emo = None
    if not fused:
        # Text-only turn: detect emotion from what the user wrote, and derive a
        # stress estimate from the amount of negative emotion detected.
        text_emo = analyze_text_sentiment(message)
        fused = dict(text_emo)
    dominant = max(fused, key=fused.get) if fused else "neutral"
    if text_emo is not None and dominant != "neutral":
        if not isinstance(stress, (int, float)) or stress <= 0:
            stress = round(text_emo.get("sad", 0) + text_emo.get("angry", 0), 2)
    if confidence is None:
        confidence = round(float(fused.get(dominant, 0)), 2) if fused else None

    ts = now_ts()
    turn_id = add_doc(user_base(uid, "conversations") + [cid, "turns"], {
        "question": message,
        "answer": ai_result.get("reply", ""),
        "emotion": dominant,
        "stress": round(float(stress), 2),
        "face": face,
        "voice": voice,
        "fusion": fused,
        "confidence": confidence,
        "modalities": modalities,
        "session_id": session_id,
        "turn_no": turn_no,
        "ts": ts,
    })
    save_doc(user_base(uid, "conversations") + [cid], {"updated_at": ts})

    # Persist a session interaction record (feeds analytics) when this turn
    # carries real emotion/stress data. Text-only turns still have their turn
    # record above; we never fabricate emotion values.
    if session_id:
        has_data = bool(face or voice) or bool(stress)
        if has_data:
            add_doc(user_base(uid, "sessions") + [session_id, "interactions"], {
                "ts": ts,
                "transcript": message,
                "video": face,
                "audio": voice,
                "stress": round(float(stress), 2),
                "fusion": fused,
                "ai_reply": ai_result.get("reply", ""),
                "emotion": dominant,
                "confidence": confidence,
                "modalities": modalities,
            })
        session_doc = get_doc(user_base(uid, "sessions") + [session_id])
        if session_doc is not None:
            save_doc(user_base(uid, "sessions") + [session_id], {
                "turns": int(session_doc.get("turns") or 0) + 1,
                "last_ts": ts,
            })

    return {
        "conversation_id": cid,
        "turn_id": turn_id,
        "reply": ai_result.get("reply", ""),
        "meta": ai_result.get("meta", {}),
        "emotion": dominant,
        "stress": round(float(stress), 2),
        "session_id": session_id,
        "turn_no": turn_no,
        "modalities": modalities,
        "confidence": confidence,
    }
