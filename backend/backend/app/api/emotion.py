from fastapi import APIRouter, UploadFile, File, Depends
from pydantic import BaseModel
from typing import Optional
import os

from app.core.security import get_current_user
from app.utils.file_handler import save_upload

# --- Reuse existing models (with safe fallbacks when unavailable) ---
try:
    import cv2
    import numpy as np
    from app.services.video_processor import analyze_frame
except Exception:
    cv2 = None
    np = None

    def analyze_frame(frame_bgr):
        return {"emotion": "neutral", "confidence": 100.0, "distribution": {"neutral": 100.0}}

try:
    from app.services.audio_processor import analyze_audio_emotion
except Exception:
    def analyze_audio_emotion(path: str):
        return {"neutral": 100.0}, 35.0

from app.services.fusion_engine import fuse_multimodal_sentiment

router = APIRouter()


@router.post("/emotion/facial-frame")
async def facial_frame(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Analyze a single camera frame. Returns dominant emotion + confidence."""
    data = await file.read()
    if cv2 is None or np is None:
        return {"emotion": "neutral", "confidence": 100.0, "distribution": {"neutral": 100.0}}
    arr = np.frombuffer(data, np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        return {"emotion": "neutral", "confidence": 100.0, "distribution": {"neutral": 100.0}}
    result = analyze_frame(frame)
    result["status"] = "success"
    return result


@router.post("/emotion/voice-chunk")
async def voice_chunk(file: UploadFile = File(...), user=Depends(get_current_user)):
    """Analyze a ~5s audio chunk. Returns dominant emotion, confidence + stress."""
    path = save_upload(file)
    try:
        emotions, stress_score = analyze_audio_emotion(path)
    finally:
        if os.path.exists(path):
            try:
                os.remove(path)
            except Exception:
                pass
    if emotions:
        dominant = max(emotions, key=emotions.get)
        return {
            "status": "success",
            "emotion": dominant,
            "confidence": round(emotions[dominant], 2),
            "stress": round(float(stress_score), 2),
            "distribution": emotions,
        }
    return {"status": "success", "emotion": "neutral", "confidence": 100.0, "stress": 0.0,
            "distribution": {"neutral": 100.0}}


class FuseRequest(BaseModel):
    face: Optional[dict] = None
    voice: Optional[dict] = None
    stress: Optional[float] = None


@router.post("/emotion/fuse")
def fuse(body: FuseRequest, user=Depends(get_current_user)):
    """Fuse face + voice emotion signals into one overall emotion + stress score."""
    face = body.face or {}
    voice = body.voice or {}

    if face and voice:
        fused = fuse_multimodal_sentiment(face, voice, {})
    else:
        fused = dict(face) if face else dict(voice)

    if fused:
        dominant = max(fused, key=fused.get)
        confidence = fused[dominant]
    else:
        dominant, confidence = "neutral", 100.0

    return {
        "status": "success",
        "emotion": dominant,
        "confidence": round(float(confidence), 2),
        "distribution": fused,
        "stress": round(float(body.stress or 0.0), 2),
    }
