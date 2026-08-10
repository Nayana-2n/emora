import os
import re
import json
import hashlib
from pathlib import Path
import requests
from dotenv import load_dotenv

# ... inside app/services/gemini_service.py ...

#load_dotenv(override=True)
#api_key = os.getenv("GEMINI_API_KEY")
# 1. Force reload — resolve .env from this file's location (backend/backend/.env)
#    so the key loads regardless of the process working directory.
load_dotenv(dotenv_path=Path(__file__).resolve().parents[2] / ".env", override=True)

# 2. Get Key and CLEAN it (remove hidden spaces)
raw_key = os.getenv("GEMINI_API_KEY")
if raw_key:
    api_key = raw_key.strip().replace('"', '').replace("'", "")
else:
    api_key = None

# 3. Debug Print (Hide the middle for security)
if api_key:
    masked_key = f"{api_key[:5]}...{api_key[-5:]}"
    print(f"DEBUG: Using API Key: [{masked_key}] (Length: {len(api_key)})")
else:
    print("DEBUG: No API Key found.")

# ... rest of your code ...


_GEMINI_URL = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent"


def _gemini_generate(model_name: str, prompt: str) -> str:
    """Call Gemini through plain REST (no SDK). Returns reply text or raises."""
    if not api_key:
        raise RuntimeError("No GEMINI_API_KEY configured.")
    resp = requests.post(
        _GEMINI_URL.format(model=model_name),
        params={"key": api_key},
        json={"contents": [{"parts": [{"text": prompt}]}]},
        timeout=60,
    )
    if resp.status_code != 200:
        try:
            msg = resp.json().get("error", {}).get("message", resp.text)
        except Exception:
            msg = resp.text
        raise RuntimeError(f"{model_name} -> HTTP {resp.status_code}: {msg}")
    try:
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError, TypeError) as e:
        raise RuntimeError(f"{model_name} -> malformed response: {resp.text[:300]}")


# ---------------------------------------------------------------------------
# FREE AI PROVIDER (OpenAI-compatible: OpenRouter / Cerebras / Groq / etc.)
# Used as the PRIMARY chat engine so the app never depends on a paid or
# quota-limited key. Configure via env vars:
#   FREE_AI_KEY        = your free provider API key (required to enable)
#   FREE_AI_BASE_URL   = default: https://openrouter.ai/api/v1
#   FREE_AI_MODEL      = default: meta-llama/llama-3.3-70b-instruct:free
#   FREE_AI_VISION_MODEL = default: meta-llama/llama-3.2-11b-vision-instruct:free
# ---------------------------------------------------------------------------
_FREE_BASE_URL = (os.getenv("FREE_AI_BASE_URL") or "https://openrouter.ai/api/v1").rstrip("/")
_FREE_KEY = (os.getenv("FREE_AI_KEY") or "").strip().replace('"', "").replace("'", "")
_FREE_MODEL = os.getenv("FREE_AI_MODEL") or "meta-llama/llama-3.3-70b-instruct:free"
_FREE_VISION_MODEL = os.getenv("FREE_AI_VISION_MODEL") or "meta-llama/llama-3.2-11b-vision-instruct:free"

if _FREE_KEY:
    print(f"DEBUG: Free AI provider enabled: {_FREE_BASE_URL} / {_FREE_MODEL}")
else:
    print("DEBUG: Free AI provider not configured (FREE_AI_KEY missing).")


def _free_ai_generate(prompt: str) -> str:
    """Call the free OpenAI-compatible provider. Returns reply text or raises."""
    if not _FREE_KEY:
        raise RuntimeError("FREE_AI_KEY not configured.")
    resp = requests.post(
        f"{_FREE_BASE_URL}/chat/completions",
        headers={"Authorization": f"Bearer {_FREE_KEY}", "Content-Type": "application/json"},
        json={
            "model": _FREE_MODEL,
            "messages": [{"role": "user", "content": prompt}],
            "max_tokens": 500,
        },
        timeout=60,
    )
    if resp.status_code != 200:
        try:
            msg = resp.json().get("error", {}).get("message", resp.text)
        except Exception:
            msg = resp.text
        raise RuntimeError(f"free-ai -> HTTP {resp.status_code}: {msg}")
    try:
        return resp.json()["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError) as e:
        raise RuntimeError(f"free-ai -> malformed response: {resp.text[:300]}")


def _free_ai_generate_vision(b64_jpeg: str, prompt: str) -> str:
    """Call the free provider's vision model on a JPEG frame. Returns text or raises."""
    if not _FREE_KEY:
        raise RuntimeError("FREE_AI_KEY not configured.")
    resp = requests.post(
        f"{_FREE_BASE_URL}/chat/completions",
        headers={"Authorization": f"Bearer {_FREE_KEY}", "Content-Type": "application/json"},
        json={
            "model": _FREE_VISION_MODEL,
            "messages": [
                {
                    "role": "user",
                    "content": [
                        {"type": "text", "text": prompt},
                        {"type": "image_url", "image_url": {"url": f"data:image/jpeg;base64,{b64_jpeg}"}},
                    ],
                }
            ],
            "max_tokens": 200,
        },
        timeout=60,
    )
    if resp.status_code != 200:
        try:
            msg = resp.json().get("error", {}).get("message", resp.text)
        except Exception:
            msg = resp.text
        raise RuntimeError(f"free-ai-vision -> HTTP {resp.status_code}: {msg}")
    try:
        return resp.json()["choices"][0]["message"]["content"].strip()
    except (KeyError, IndexError, TypeError) as e:
        raise RuntimeError(f"free-ai-vision -> malformed response: {resp.text[:300]}")


def _gemini_generate_vision(b64_jpeg: str, prompt: str) -> str:
    """Call Gemini with a JPEG frame (vision). Returns text or raises."""
    if not api_key:
        raise RuntimeError("No GEMINI_API_KEY configured.")
    resp = requests.post(
        _GEMINI_URL.format(model="gemini-2.5-flash"),
        params={"key": api_key},
        json={
            "contents": [
                {
                    "parts": [
                        {"text": prompt},
                        {"inline_data": {"mime_type": "image/jpeg", "data": b64_jpeg}},
                    ]
                }
            ]
        },
        timeout=60,
    )
    if resp.status_code != 200:
        try:
            msg = resp.json().get("error", {}).get("message", resp.text)
        except Exception:
            msg = resp.text
        raise RuntimeError(f"gemini-vision -> HTTP {resp.status_code}: {msg}")
    try:
        return resp.json()["candidates"][0]["content"]["parts"][0]["text"].strip()
    except (KeyError, IndexError, TypeError) as e:
        raise RuntimeError(f"gemini-vision -> malformed response: {resp.text[:300]}")


# ---------------------------------------------------------------------------
# SERVER-SIDE SPEECH-TO-TEXT (free Groq Whisper)
# Browser SpeechRecognition is unreliable on some phones, so the audio chunks
# we already upload are transcribed here. Configure:
#   GROQ_API_KEY = free key from https://console.groq.com/keys
#   GROQ_WHISPER_MODEL = default whisper-large-v3-turbo (both free)
# ---------------------------------------------------------------------------
_GROQ_KEY = (os.getenv("GROQ_API_KEY") or "").strip().replace('"', "").replace("'", "")
_GROQ_WHISPER_MODEL = os.getenv("GROQ_WHISPER_MODEL") or "whisper-large-v3-turbo"
_GROQ_STT_URL = "https://api.groq.com/openai/v1/audio/transcriptions"

if _GROQ_KEY:
    print("DEBUG: Groq Whisper STT enabled.")
else:
    print("DEBUG: Groq Whisper STT not configured (GROQ_API_KEY missing).")


def transcribe_audio(file_path: str) -> str:
    """Transcribe an audio/video file via Groq Whisper. Returns text or ''."""
    if not _GROQ_KEY:
        return ""
    try:
        with open(file_path, "rb") as f:
            resp = requests.post(
                _GROQ_STT_URL,
                headers={"Authorization": f"Bearer {_GROQ_KEY}"},
                files={"file": (os.path.basename(file_path), f)},
                data={"model": _GROQ_WHISPER_MODEL},
                timeout=30,
            )
        if resp.status_code == 200:
            try:
                return (resp.json().get("text") or "").strip()
            except Exception:
                return ""
        print(f"[transcribe_audio] HTTP {resp.status_code}: {resp.text[:200]}")
    except Exception as e:
        print(f"[transcribe_audio] {e}")
    return ""


_FACE_PROMPT = (
    "Look at the face in this image. Reply with ONLY a JSON object, no other text, in this exact format: "
    '{"emotion":"happy","confidence":85}. '
    'emotion must be exactly one of: happy, sad, angry, neutral, surprised, fearful. '
    "confidence is 0-100. If no clear face is visible, use neutral with a low confidence."
)


def classify_face_frame(b64_jpeg: str) -> dict:
    """Classify a webcam JPEG frame using a vision AI (free provider, then Gemini).

    Returns a distribution dict compatible with the local model output, e.g.
    {"emotion": "happy", "confidence": 85.0, "distribution": {"happy": 85.0, "neutral": 15.0}}.
    """
    text = None
    last_err = None
    for fn in (_free_ai_generate_vision, _gemini_generate_vision):
        try:
            text = fn(b64_jpeg, _FACE_PROMPT)
            if text:
                break
        except Exception as e:
            last_err = e
            continue
    if not text:
        print(f"[classify_face_frame] all vision providers failed: {last_err}")
        return {"emotion": "neutral", "confidence": 100.0, "distribution": {"neutral": 100.0}}

    match = re.search(r"\{.*\}", text, re.DOTALL)
    if not match:
        return {"emotion": "neutral", "confidence": 100.0, "distribution": {"neutral": 100.0}}
    try:
        data = json.loads(match.group(0))
    except Exception:
        return {"emotion": "neutral", "confidence": 100.0, "distribution": {"neutral": 100.0}}

    emotion = str(data.get("emotion") or "neutral").lower()
    aliases = {"surprised": "surprise", "fearful": "fear", "angry": "angry",
               "happy": "happy", "sad": "sad", "neutral": "neutral", "surprise": "surprise", "fear": "fear"}
    emotion = aliases.get(emotion, "neutral")
    try:
        conf = float(data.get("confidence") or 50.0)
    except Exception:
        conf = 50.0
    conf = max(0.0, min(100.0, conf))
    distribution = {"neutral": round(100.0 - conf, 2)}
    distribution[emotion] = round(conf, 2)
    return {"emotion": emotion, "confidence": round(conf, 2), "distribution": distribution}


CRISIS_PATTERNS = [
    re.compile(r"\bdie\b", re.IGNORECASE),
    re.compile(r"\bdying\b", re.IGNORECASE),
    re.compile(r"\bdied\b", re.IGNORECASE),
    re.compile(r"\bsuicid\w*\b", re.IGNORECASE),
    re.compile(r"\bk\s*m\s*s\b", re.IGNORECASE),
    re.compile(r"\b(kill|killing|end|ending)\s+(myself|my self)\b", re.IGNORECASE),
    re.compile(r"\b(end it all|end my life|end everything)\b", re.IGNORECASE),
    re.compile(r"\b(don't|do not|dont)\s+(want to live|wanna live)\b", re.IGNORECASE),
    re.compile(r"\bno (reason|point) to live\b", re.IGNORECASE),
    re.compile(r"\bnothing to live for\b", re.IGNORECASE),
    re.compile(r"\bbetter off dead\b", re.IGNORECASE),
    re.compile(r"\bwant(ing)? to die\b", re.IGNORECASE),
    re.compile(r"\bshould (just )?die\b", re.IGNORECASE),
    re.compile(r"\bwish(ing)? (i was|i'm|i am) dead\b", re.IGNORECASE),
    re.compile(r"\b(hurt|harm|cut) (myself|my self)\b", re.IGNORECASE),
    re.compile(r"\bself[ -]?harm\b", re.IGNORECASE),
    re.compile(r"\bhopeless\b", re.IGNORECASE),
    re.compile(r"\bcan'?t (go on|take it anymore|do this anymore)\b", re.IGNORECASE),
]


def _is_crisis(text: str) -> bool:
    return any(p.search(text) for p in CRISIS_PATTERNS)


# --- Local Cognitive Backup Engine (used when Gemini is unavailable/out-of-quota) ---
# Content-aware local NLG so the app stays conversational without the API:
# varies its phrasing, answers clarification questions, echoes the user, and never
# repeats the same canned template for unrelated messages.

_POSITIVE_WORDS = ["happy", "glad", "great", "good", "wonderful", "joy", "excited", "amazing", "awesome", "better", "loved"]
_SAD_WORDS = ["sad", "down", "unhappy", "cry", "crying", "hurting", "heartbroken", "miserable", "lonely", "depressed"]
_ANGRY_WORDS = ["angry", "mad", "frustrated", "annoyed", "pissed", "rage", "irritated", "hate"]
_ANXIOUS_WORDS = ["anxious", "worried", "nervous", "scared", "afraid", "stressed", "tense", "panic", "overwhelmed"]
_TIRED_WORDS = ["tired", "exhausted", "sleepy", "burned out", "burnout", "drained", "no energy", "worn out"]


def _pick(pool, seed_text):
    idx = int(hashlib.md5(seed_text.encode("utf-8")).hexdigest()[:4], 16)
    return pool[idx % len(pool)]


def _feeling_match(transcript):
    t = transcript.lower()
    for kind, words in [("positive", _POSITIVE_WORDS), ("sad", _SAD_WORDS), ("angry", _ANGRY_WORDS),
                        ("anxious", _ANXIOUS_WORDS), ("tired", _TIRED_WORDS)]:
        for w in words:
            if w in t:
                return kind
    return None


_NAME_STOP = {"fine", "good", "ok", "okay", "ready", "back", "here", "sure", "tired", "happy",
              "sad", "glad", "lost", "scared", "sorry", "confused", "interested", "home",
              "done", "busy", "nice", "great", "new", "away", "fine"}


def _extract_name(text):
    m = re.search(r"\b(?:my name is|name's|name is|call me|i'm|i am)\s+([A-Z][A-Za-z]{1,20})\b", text)
    if not m:
        return None
    name = m.group(1)
    if name.lower() in _NAME_STOP:
        return None
    return name


def _smart_fallback(transcript, user_state, chat_history=None):
    t = transcript.strip()
    tl = t.lower()
    text = t[:80]
    chat_history = chat_history or []

    def pick(pool):
        # Vary the pick over the conversation length so the same reply never
        # repeats across consecutive turns.
        return _pick(pool, tl + str(len(chat_history)))

    if user_state == "crisis":
        return pick([
            "I'm really glad you told me that. The most important thing right now is that you're safe. Are you safe at this very moment? You're not alone — please also reach out to someone you trust, or a crisis line like 988, where someone will listen 24/7.",
            "Thank you for trusting me with that — it takes real courage. Right now I just want to make sure you're safe. Are you safe at this moment? And could you reach out to someone you trust, or a helpline like 988, today?",
        ])

    if user_state == "enraged":
        return pick([
            f"I hear how intense that feels. I'm here with you. What's the heaviest part of '{text}' for you right now?",
            "I can feel the frustration behind that. Let's slow down together. What is at the root of this stress right now?",
        ])

    if user_state == "distressed":
        return pick([
            "I'm so sorry you're carrying this. Take a slow breath with me. I'm listening — you don't have to explain everything at once.",
            "That sounds really heavy, and I'm glad you told me. You don't have to face it alone. What feels like the hardest part right now?",
        ])

    if user_state == "numb":
        return pick([
            f"Thank you for staying with me. You said, '{text}' — what is that bringing up for you right now?",
            f"I'm here. You mentioned '{text}' — take your time, there's no rush. What's happening on the inside?",
        ])

    if user_state == "euphoric":
        return pick([
            f"That energy is wonderful! What made you feel this good when you said '{text}'?",
            "I love hearing that! What sparked that joy for you today?",
        ])

    # --- Content-aware handling ---

    # 1. Introducing a name (e.g. "My name is Naina", "I'm Naina", "Call me Naina")
    name = _extract_name(t)
    if name:
        return pick([
            f"Nice to meet you, {name}. I'm EMORA — I'm here to listen. How are you feeling today?",
            f"Hi {name}, thank you for telling me. I'll remember that. What's on your mind right now?",
        ])

    # 2. The user is correcting us or mildly annoyed — apologise, don't re-ask
    if re.search(r"\b(i'?ve|i have|already|just)\s+(told|said)\s+you\b|\b(as|like) i said\b|\b(you'?re|you are) not listening\b|\bthat'?s all\b", tl):
        return pick([
            "I hear you, and I'm sorry for the mix-up. You have my full attention — take your time.",
            "Sorry about that, you're right. I'm listening properly now. How are you feeling?",
            "Got it — thank you for being patient with me. I'm right here. What's going on inside?",
        ])

    # 3. Greetings
    if re.fullmatch(r"(hi|hiya|hello|hey|yo|hola|hi there|good (morning|afternoon|evening))[!. ,]*", tl):
        return pick([
            "Hi, it's good to see you. I'm EMORA — I'd love to hear how you're doing today.",
            "Hello! I'm glad you're here. How has today been treating you so far?",
        ])

    # 4. "How are you?" asked to us
    if re.search(r"\bhow (are|r)\s*(you|u)\b|\bhow'?s it going\b|\bhow'?s your day\b", tl):
        return pick([
            "I'm doing well, thank you for asking — but more importantly, how are you feeling today?",
            "I'm here and ready to listen. Tell me about you — how has your day been going?",
        ])

    # 5. Thanks
    if re.search(r"\b(thank you|thanks|thx|thank u)\b", tl):
        return "You're very welcome. I'm always here whenever you want to talk."

    # 6. Goodbyes
    if re.search(r"\b(goodbye|bye bye|see you|good night|talk later)\b", tl):
        return pick([
            "Take care of yourself. I'll be right here whenever you need me.",
            "Goodbye for now — be gentle with yourself today. I'm here anytime.",
        ])

    # 7. "what do you mean" / "explain" -> actually answer instead of re-asking
    if re.search(r"\bwhat do you mean\b|\bwhat does that mean\b|\bexplain\b|\bmeaning\b", tl):
        if "day to day" in tl or "day-to-day" in tl:
            return ("By 'day to day', I mean your everyday life — your routine, your work, the small moments, "
                    "and the people around you. So how has that been showing up in your regular days lately?")
        return pick([
            "Of course — let me be clearer. What part of that felt confusing? I'll make sure to explain properly this time.",
            "Sorry, let me rephrase that. I'm curious about how you're feeling inside right now. What has today felt like for you?",
        ])

    # 8. yes / no / short answers
    if re.fullmatch(r"(yes|yeah|yep|no|nope|maybe|i don't know|idk)[!. ]*", tl):
        return pick([
            "Thanks for letting me know. What has been on your mind about it lately?",
            "I appreciate the honesty. Would you like to tell me a bit more about that?",
        ])

    # 9. direct questions to us -> engage, don't dodge
    if tl.endswith("?") or re.match(r"^(what|why|how|when|who|where|which|do|does|did|are|is|can|could|should|would)\b", tl):
        return pick([
            "That's a thoughtful question. I don't have a single right answer for you — but what's behind it for you?",
            "Let me think about that with you. Tell me a bit more about why it's on your mind and we'll explore it together.",
        ])

    # 10. feeling words -> match the tone
    mood = _feeling_match(transcript)
    if mood == "positive":
        return pick([
            "That's really nice to hear! What helped you feel this way today?",
            "I'm glad you're feeling good. What's the best part of your day lately?",
        ])
    if mood == "sad":
        return pick([
            "I'm sorry things feel heavy. I'm here with you. Do you want to tell me what's been bringing that on?",
            "That sounds painful, and I'm listening. What's been the hardest thing about it lately?",
        ])
    if mood == "angry":
        return pick([
            "That sounds frustrating, and I'm here. What set that off today?",
            "I can hear the irritation in that. Tell me more about what happened.",
        ])
    if mood == "anxious":
        return pick([
            "That sounds stressful. Let's take one breath together. What's the biggest worry on your mind right now?",
            "Anxiety is hard to sit with — I'm glad you shared it. What's feeding it right now?",
        ])
    if mood == "tired":
        return pick([
            "That sounds draining. Are you getting any chance to rest at all?",
            "Being worn out is tough. What's been taking the most out of you lately?",
        ])

    # 11. default -> warm acknowledgment + open question, never a verbatim echo
    return pick([
        "I'm here with you. What's on your mind about that?",
        "Thank you for sharing that with me. How is it sitting with you right now?",
        "I'm listening. Tell me more — what's that like for you today?",
    ])


def generate_ai_response(transcript: str, video_emotions: dict, audio_emotions: dict, stress_score: float, chat_history: list = []) -> dict:
    
    # --- 1. MEMORY: Format Previous Context ---
    # We turn the list of previous chats into a string so Gemini remembers the conversation flow.
    # format: "User: ..., Assistant: ..."
    history_str = ""
    # We take the last 3 exchanges to keep the context fresh but not overload tokens
    for turn in chat_history[-3:]: 
        role = "User" if turn["role"] == "user" else "Assistant"
        history_str += f"{role}: {turn['content']}\n"

    # --- 2. COMPLEX STATE DETECTION (The "Cognition") ---
    
    # Get dominant raw emotions
    vid_mood = max(video_emotions, key=video_emotions.get) if video_emotions else "neutral"
    aud_mood = max(audio_emotions, key=audio_emotions.get) if audio_emotions else "neutral"
    
    vid_score = video_emotions.get(vid_mood, 0)
    aud_score = audio_emotions.get(aud_mood, 0)

    # default state
    user_state = "stable"
    instruction_override = ""

    # A.0 CRISIS / SAFETY (highest priority — text-based, overrides all biometric states)
    if _is_crisis(transcript):
        user_state = "crisis"
        instruction_override = """
        [SENSITIVITY: CRISIS/SAFETY — HIGHEST PRIORITY]
        The user has expressed thoughts of death, hopelessness, or self-harm.
        - Take this seriously. Respond with immediate warmth, care, and zero judgment.
        - First, check that they are safe right now: ask directly but gently.
        - Reassure them they are not alone and that sharing this was a brave step.
        - Gently suggest talking to someone they trust or a crisis line (e.g. 988 in the US/Canada, or their local helpline).
        - Do NOT lecture, minimize, or over-clinically list resources. Keep it short and human.
        - Acknowledge their exact words back to them before moving forward.
        """

    # A. DETECT LAUGHING / EUPHORIA
    elif vid_mood == "happy" and aud_mood == "happy" and (vid_score > 75 or aud_score > 75):
        user_state = "euphoric"
        instruction_override = """
        [SENSITIVITY: HIGH POSITIVITY]
        The user is laughing or extremely happy. 
        - Match their energy! Be enthusiastic.
        - Ask what specifically caused this joy (evaluate the positive trigger).
        - Do not be serious or clinical.
        """

    # B. DETECT SCREAMING / RAGE
    elif (aud_mood == "angry" or vid_mood == "angry") and stress_score > 80:
        user_state = "enraged"
        instruction_override = """
        [SENSITIVITY: AGGRESSION/SCREAMING]
        The user is shouting or expressing rage.
        - Do NOT argue.
        - Validate their feelings immediately ("I hear how angry you are").
        - Ask a grounding question to help them de-escalate.
        - Your goal is to find the root cause of this anger.
        """

    # C. DETECT CRYING / DISTRESS
    elif (aud_mood == "sad" or vid_mood == "sad") and stress_score > 60:
        user_state = "distressed"
        instruction_override = """
        [SENSITIVITY: CRYING/DISTRESS]
        The user appears to be crying or in deep pain.
        - Be extremely soft and gentle.
        - Use short, comforting phrases.
        - Do not ask them to 'explain' logically yet; just offer support.
        """
        
    # D. DETECT APATHY (Dangerous Neutrality)
    # Only treat as "numb" when real biometric data exists (camera/mic live).
    # Text-only messages send empty face/voice, so route them to normal "stable"
    # chat instead of mis-firing flat-affect on every single turn.
    elif (vid_mood == "neutral" and aud_mood == "neutral" and stress_score < 15
          and (video_emotions or audio_emotions)):
        user_state = "numb"
        instruction_override = """
        [SENSITIVITY: DISSOCIATION]
        The user is showing very little emotion (flat affect).
        - This can be a sign of shutting down.
        - Probe gently: "You seem very quiet/still right now, how are you feeling on the inside?"
        """

    # --- 3. CONSTRUCT THE PROMPT ---
    system_instruction = """
    You are EMORA, a warm and attentive wellness companion, not a clinical evaluator.
    Your goal is to make the person feel heard and to gently explore their feelings.
    Rules:
    1. Mirror their tone: warm and brief when they are light, soft and gentle when they are heavy.
    2. Acknowledge what they said in your own words first; do NOT quote their message back verbatim.
    3. Respond like a caring friend: natural, human, 1-2 sentences. Never interrogate or repeat a question.
    4. If they are correcting you or you misheard them, apologise briefly and move on naturally.
    5. Remember what they told you earlier (their name, what they mentioned) and use it.
    """

    full_prompt = f"""
    {system_instruction}

    [CURRENT BIOMETRICS]
    - Detected State: {user_state.upper()}
    - Visual: {vid_mood} ({vid_score}%)
    - Audio: {aud_mood} ({aud_score}%)
    - Stress Level: {stress_score}/100 (Volume/Jitter)

    [CONVERSATION HISTORY]
    {history_str}

    [CURRENT INPUT]
    User: "{transcript}"

    {instruction_override}

    Generate the next response:
    """

    # --- 4. CALL AI (free provider first, then Gemini, then local backup) ---
    try:
        response_text = None
        last_err = None

        # 4a. Free AI provider (primary)
        try:
            if _FREE_KEY:
                response_text = _free_ai_generate(full_prompt)
                if response_text:
                    print("[ai] reply from free provider")
        except Exception as ex:
            last_err = ex
            print(f"[ai] free provider failed: {ex}")

        # 4b. Gemini models (backup)
        if not response_text:
            model_names = ['gemini-flash-latest', 'gemini-2.5-flash', 'gemini-pro-latest', 'gemini-2.0-flash', 'gemini-pro']
            for m_name in model_names:
                try:
                    response_text = _gemini_generate(m_name, full_prompt)
                    if response_text:
                        print(f"[ai] reply from {m_name}")
                        break
                except Exception as ex:
                    last_err = ex
                    continue

        if not response_text:
            raise last_err or Exception("Failed to query AI providers.")

        reply = response_text.strip()

        return {
            "reply": reply,
            "status": "success",
            "meta": {
                "user_state": user_state,
                "history_used": len(chat_history)
            }
        }
    # ... inside generate_ai_response ...

    except Exception as e:
        print(f"\n[!] Gemini API Warning: {e}. Utilizing Cognitive Backup Engine.")
        
        smart_reply = _smart_fallback(transcript, user_state, chat_history)

        return {
            "reply": smart_reply,
            "status": "success",
            "meta": {
                "user_state": user_state,
                "history_used": len(chat_history),
                "fallback_mode": True
            }
        }
    
# ... (All your imports and functions should be above this) ...

# ==========================================
# TEST BLOCK: TEXT-ONLY VERIFICATION
# ==========================================
if __name__ == "__main__":
    print("\n--- Testing Gemini Service (Cognition Layer) ---")
    
    # Check if API Key is detected
    if not os.getenv("GEMINI_API_KEY"):
        print("ERROR: GEMINI_API_KEY is missing in .env file!")
        exit()
    else:
        print("API Key detected.")

    # --- Scenario 1: Normal Conversation ---
    print("\n[Scenario 1]: User is calm/neutral.")
    transcript_1 = "I am ready to start the interview."
    
    # We pass 'fake' neutral biometric data just to satisfy the function arguments
    response_1 = generate_ai_response(
        transcript=transcript_1,
        video_emotions={"neutral": 90.0, "happy": 10.0},
        audio_emotions={"neutral": 90.0},
        stress_score=10.0, # Low stress
        chat_history=[]
    )
    print(f"User said: '{transcript_1}'")
    print(f"AI Reply:  {response_1['reply']}")
    print(f"Detected State: {response_1['meta'].get('user_state')}")

    # --- Scenario 2: Testing the "Screaming/Rage" Logic ---
    print("\n[Scenario 2]: User is screaming (Simulating High Stress/Anger).")
    transcript_2 = "I told you I don't want to talk about that!!"
    
    # We pass 'fake' angry data to see if the AI detects the rage
    response_2 = generate_ai_response(
        transcript=transcript_2,
        video_emotions={"angry": 85.0, "neutral": 15.0},
        audio_emotions={"angry": 90.0},
        stress_score=88.0, # HIGH STRESS -> Should trigger 'enraged' logic
        chat_history=[{"role": "assistant", "content": "Can you tell me about your weakness?"}]
    )
    print(f"User said: '{transcript_2}'")
    print(f"AI Reply:  {response_2['reply']}")
    print(f"Detected State: {response_2['meta'].get('user_state')}")
    
    print("\n-------------------------------------------")
    if response_1['status'] == 'success':
        print("SUCCESS: Gemini is connected and responding!")
    else:
        print("FAILED: Check your API Key or Internet connection.")