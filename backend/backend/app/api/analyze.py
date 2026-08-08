from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Depends
import shutil
import os
import uuid
import json

# --- IMPORT YOUR SERVICES (with safe fallbacks) ---
try:
    from app.services.video_processor import analyze_video_emotion
except Exception:
    def analyze_video_emotion(path: str) -> dict:
        return {"neutral": 100.0}
try:
    from app.services.audio_processor import analyze_audio_emotion
except Exception:
    def analyze_audio_emotion(path: str):
        return {"neutral": 100.0}, 35.0
try:
    from app.services.text_processor import analyze_text_sentiment
except Exception:
    def analyze_text_sentiment(text: str) -> dict:
        return {"neutral": 100.0}
try:
    from app.services.gemini_service import generate_ai_response
except Exception:
    def generate_ai_response(**kwargs):
        return {"reply": "Thank you. What felt most significant in that answer?", "status": "stub"}
from app.services.fusion_engine import fuse_multimodal_sentiment
from app.core.security import get_current_user
from app.core.firestore_db import user_base, add_doc, list_docs
from app.utils.file_handler import save_upload, split_video_audio
from app.utils.math_tools import normalize_score

router = APIRouter()

# Define where to save temp video files
UPLOAD_DIR = "static/uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)

@router.post("/interaction")
async def analyze_interaction(
    file: UploadFile = File(...),
    transcript: str = Form(...),
    session_id: str = Form(...),
    chat_history: str = Form("[]"),
    user = Depends(get_current_user)
):
    """
    1. Receives Video + Transcript.
    2. Runs AI Models (Video, Audio, Text).
    3. Fuses data for charts.
    4. Generates Gemini Response.
    """
    
    temp_path = save_upload(file)
    
    try:
        print(f"\n--- [API] Processing Request: {session_id} ---")

        # 2. Run AI Analysis (Sequential for safety)
        
        # A. Video Analysis
        print("1. Running Video Processor...")
        v_path, a_path = split_video_audio(temp_path)
        video_emotions = analyze_video_emotion(v_path)
        
        # B. Audio Analysis
        print("2. Running Audio Processor...")
        audio_emotions, stress_score = analyze_audio_emotion(a_path)
        
        # C. Text Analysis
        print("3. Running Text Processor...")
        text_emotions = analyze_text_sentiment(transcript)
        
        # D. Fusion
        print("4. Fusing Multimodal Data...")
        final_sentiment = fuse_multimodal_sentiment(video_emotions, audio_emotions, text_emotions)

        # 3. Parse Chat History
        try:
            history_list = json.loads(chat_history)
        except json.JSONDecodeError:
            print("[API] Warning: Invalid JSON in chat_history. Resetting to empty.")
            history_list = []

        # 4. Cognitive Processing (Gemini)
        print("5. Consulting Gemini (Cognition)...")
        ai_result = generate_ai_response(
            transcript=transcript,
            video_emotions=video_emotions,
            audio_emotions=audio_emotions,
            stress_score=stress_score,
            chat_history=history_list
        )

        print("--- [API] Analysis Complete ---")

        ts = int(__import__("time").time())
        add_doc(user_base(user["user_id"], "sessions") + [session_id, "interactions"], {
            "ts": ts,
            "transcript": transcript,
            "video": video_emotions,
            "audio": audio_emotions,
            "stress": stress_score,
            "text": text_emotions,
            "fusion": final_sentiment,
            "ai_reply": ai_result.get("reply")
        })
        return {
            "status": "success",
            "ai_response": ai_result, 
            "analysis": {
                "stress_score": stress_score,
                "sentiment_pie_chart": final_sentiment,
                "raw_data": {
                    "video": video_emotions,
                    "audio": audio_emotions,
                    "text": text_emotions
                }
            }
        }

    except Exception as e:
        print(f"[API CRITICAL ERROR] {e}")
        return {
            "status": "error",
            "message": str(e),
            "ai_response": {"reply": "I encountered a system error, but I am still online."},
            "analysis": {"stress_score": 0, "sentiment_pie_chart": {}}
        }
        
    finally:
        if os.path.exists(temp_path):
            try:
                os.remove(temp_path)
            except Exception:
                pass

@router.get("/session/{session_id}")
def get_session_summary(session_id: str, user = Depends(get_current_user)):
    stress_trend = []
    sentiments: dict[str, float] = {}

    interactions = list_docs(user_base(user["user_id"], "sessions") + [session_id, "interactions"])
    for i, d in enumerate(interactions):
        stress = d.get("stress") or 0
        stress_trend.append({"index": i, "score": normalize_score(stress/100 if isinstance(stress, (int,float)) else 0)})
        fused = d.get("fusion") or fuse_multimodal_sentiment(d.get("video") or {}, d.get("audio") or {}, d.get("text") or {})
        for k, vsc in fused.items():
            sentiments[k] = sentiments.get(k, 0) + vsc

    total = sum(sentiments.values()) or 1
    pie = {k: round((v/total)*100, 2) for k, v in sentiments.items()}
    return {"session_id": session_id, "stress_trend": stress_trend, "sentiment_pie_chart": pie}
