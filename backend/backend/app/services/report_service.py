"""AI Mental Health Report: computes percentages + narrative recommendation."""

from app.services.burnout_engine import burnout_report
from app.services.wellness_engine import wellness_score

# Happiness / sadness mapping for fusion emotion keys.
POSITIVE = {"happy", "surprise"}
NEGATIVE = {"sad", "angry", "fear", "disgust"}


def _emotion_breakdown(interactions: list[dict]) -> dict:
    totals: dict[str, float] = {}
    for it in interactions:
        fused = it.get("fusion") or {}
        for k, v in fused.items():
            totals[k] = totals.get(k, 0) + float(v or 0)
    total = sum(totals.values())
    if total <= 0:
        return {"happy": 0.0, "sad": 0.0, "neutral": 100.0, "angry": 0.0, "fear": 0.0}
    return {k: round(v / total * 100, 1) for k, v in sorted(totals.items(), key=lambda x: -x[1])}


def compute_report_metrics(interactions: list[dict], sleep_docs: list[dict],
                           mood_docs: list[dict], journals: list[dict],
                           habit_docs: list[dict], water_docs: list[dict],
                           water_goal_ml: float = 2000.0) -> dict:
    breakdown = _emotion_breakdown(interactions)
    burn = burnout_report(interactions, sleep_docs, mood_docs, journals)
    wellness = wellness_score(interactions, mood_docs, habit_docs, water_docs, sleep_docs, water_goal_ml)

    fatigue = burn["fatigue"]["score"] or 0.0
    stress = burn["stress"]["score"] or 0.0
    happy = round(breakdown.get("happy", 0) + breakdown.get("surprise", 0), 1)
    sad = round(breakdown.get("sad", 0) + breakdown.get("fear", 0) + breakdown.get("disgust", 0), 1)

    return {
        "happy_percent": happy,
        "sad_percent": sad,
        "stress_percent": round(stress, 1),
        "fatigue_percent": round(fatigue, 1),
        "burnout": burn["burnout"]["level"] if burn["burnout"]["score"] is not None else "no_data",
        "burnout_score": burn["burnout"]["score"],
        "wellness": wellness["overall"],
        "wellness_level": wellness["level"],
        "emotion_breakdown": breakdown,
        "stress_level": burn["stress"]["level"],
        "fatigue_level": burn["fatigue"]["level"],
        "isolation_level": burn["isolation"]["level"] if burn["isolation"]["score"] is not None else "no_data",
    }


def gemini_narrative(metrics: dict) -> str:
    """Ask Gemini for a compassionate narrative + recommendation. Returns None on any failure."""
    try:
        import google.generativeai as genai
        from dotenv import load_dotenv
        import os
        load_dotenv(override=True)
        key = os.getenv("GEMINI_API_KEY")
        if not key:
            return None
        genai.configure(api_key=key.strip().replace('"', "").replace("'", ""))
        prompt = f"""
You are EMORA, an empathetic AI mental health companion writing a short report for a user.

User analytics (0-100 scale):
- Happiness: {metrics['happy_percent']}%
- Sadness: {metrics['sad_percent']}%
- Stress: {metrics['stress_percent']}%
- Fatigue: {metrics['fatigue_percent']}%
- Burnout level: {metrics['burnout']}
- Wellness score: {metrics['wellness']}

Write 4-6 sentences: acknowledge how they are feeling, then give 3 practical, kind recommendations.
Keep it warm, not clinical. Do not use bullet lists.
"""
        model = genai.GenerativeModel("gemini-flash-latest")
        resp = model.generate_content(prompt)
        return resp.text.strip() if resp and resp.text else None
    except Exception:
        return None


def fallback_recommendation(metrics: dict) -> str:
    tips = []
    if metrics["stress_percent"] >= 60:
        tips.append("Your stress levels have been consistently high. Try 5-minute box breathing breaks between tasks.")
    elif metrics["stress_percent"] >= 40:
        tips.append("You are experiencing moderate stress. Short walks and scheduled pauses can help reset your nervous system.")
    if metrics["fatigue_percent"] >= 60:
        tips.append("Fatigue looks significant. Protect a 7-8 hour sleep window and avoid screens 30 minutes before bed.")
    if metrics["burnout"] == "high":
        tips.append("Your burnout risk is high. Consider reducing load, delegating tasks, and planning a true rest day.")
    if metrics["wellness"] is not None and metrics["wellness"] < 40:
        tips.append("Your overall wellness is low. Small consistent habits matter more than intensity right now - pick one habit to rebuild.")
    if metrics["isolation_level"] == "high":
        tips.append("Signs of isolation are present. Schedule one real social connection this week, even a short call.")
    if metrics["sad_percent"] >= 40:
        tips.append("Sustained sadness was detected. Speaking with someone you trust or a professional can make a real difference.")
    if not tips:
        tips.append("You are on a healthy trajectory. Keep your current routines and protect your sleep and hydration.")
    return " ".join(tips)
