from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

# Import the API routers
from app.api import analyze
from app.api import auth
from app.api import session as session_api
from app.api import journal
from app.api import mood
from app.api import habits
from app.api import water
from app.api import sleep
from app.api import emotion
from app.api import chat
from app.api import analytics
from app.api import quotes
from app.api import professionals

# Initialize App
app = FastAPI(
    title="EMORA - Multimodal Sentiment Analysis Backend",
    description="Hackathon API for Video/Audio/Text Emotion Detection, AI Companion, Wellness & Analytics",
    version="2.0.0"
)

# 1. Enable CORS (Cross-Origin Resource Sharing)
# Critical for Hackathons: Allows the Frontend (e.g. http://localhost:6000)
# to talk to this Backend (running on port 9000) without browser security blocking it.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allows ALL origins. (Change this to specific domain in production)
    allow_credentials=True,
    allow_methods=["*"],  # Allows GET, POST, PUT, DELETE, etc.
    allow_headers=["*"],
)

# 2. Mount Static Folder
# This allows you to access uploaded files via URL if needed (e.g., http://localhost:9000/static/...)
app.mount("/static", StaticFiles(directory="static"), name="static")

# 3. Register Routes
# All endpoints in analyze.py will be prefixed with /api
# Example: http://localhost:9000/api/interaction
app.include_router(auth.router, prefix="/api", tags=["Auth"])
app.include_router(session_api.router, prefix="/api", tags=["Session"])
app.include_router(analyze.router, prefix="/api", tags=["Analysis"])
app.include_router(journal.router, prefix="/api", tags=["Journal"])
app.include_router(mood.router, prefix="/api", tags=["Mood"])
app.include_router(habits.router, prefix="/api", tags=["Habits"])
app.include_router(water.router, prefix="/api", tags=["Water"])
app.include_router(sleep.router, prefix="/api", tags=["Sleep"])
app.include_router(emotion.router, prefix="/api", tags=["Emotion"])
app.include_router(chat.router, prefix="/api", tags=["Conversation"])
app.include_router(analytics.router, prefix="/api", tags=["Analytics"])
app.include_router(quotes.router, prefix="/api", tags=["Quotes"])
app.include_router(professionals.router, prefix="/api", tags=["Professionals"])

# 4. Root Endpoint (Health Check)
@app.get("/")
def root():
    return {
        "message": "System Online",
        "services": {
            "video": "active",
            "audio": "active",
            "gemini": "active"
        }
    }

# 5. Run Server (If file is run directly)
if __name__ == "__main__":
    import uvicorn
    print("Starting Server on Port 9000...")
    uvicorn.run(app, host="0.0.0.0", port=9000)
