"""Burnout Engine: predicts stress, burnout, fatigue and isolation risk (0-100)."""

ISOLATION_WORDS = [
    "alone", "lonely", "isolated", "isolate", "by myself", "nobody", "no one",
    "disconnected", "left out", "ignored", "abandoned", "hollow", "empty",
]


def _avg(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _clip(v: float) -> float:
    return round(max(0.0, min(100.0, v)), 1)


def _level(score: float) -> str:
    if score >= 70:
        return "high"
    if score >= 40:
        return "medium"
    return "low"


def stress_level(interactions: list[dict]) -> dict:
    stresses = []
    for it in interactions:
        s = it.get("stress")
        if isinstance(s, (int, float)):
            stresses.append(float(s))
    if not stresses:
        return {"score": None, "level": "no_data", "samples": 0}
    score = _clip(_avg(stresses))
    return {"score": score, "level": _level(score), "samples": len(stresses)}


def fatigue_score(interactions: list[dict], sleep_docs: list[dict], mood_docs: list[dict]) -> dict:
    """Fatigue rises with sustained stress, poor sleep and low mood."""
    stress = stress_level(interactions)
    s = stress["score"] if stress["score"] is not None else 50.0

    recent_sleep = sleep_docs[:7]
    sleep_penalty = 0.0
    if recent_sleep:
        hours = [float(d["hours"]) for d in recent_sleep if isinstance(d.get("hours"), (int, float))]
        if hours:
            avg_hours = _avg(hours)
            sleep_penalty = 0.0 if avg_hours >= 7 else min(100.0, (7 - avg_hours) * 20)

    mood_penalty = 0.0
    recent_moods = [float(d["mood"]) for d in mood_docs[:7] if isinstance(d.get("mood"), (int, float))]
    if recent_moods:
        mood_penalty = max(0.0, (3.5 - _avg(recent_moods)) / 2.5 * 100)

    score = _clip(0.45 * s + 0.30 * sleep_penalty + 0.25 * mood_penalty)
    return {"score": score, "level": _level(score), "stress_contribution": round(0.45 * s, 1),
            "sleep_contribution": round(0.30 * sleep_penalty, 1), "mood_contribution": round(0.25 * mood_penalty, 1)}


def burnout_risk(interactions: list[dict], sleep_docs: list[dict], mood_docs: list[dict]) -> dict:
    """Burnout = fatigue plus how *sustained* high stress has been over time."""
    fat = fatigue_score(interactions, sleep_docs, mood_docs)
    # Persistence: share of recent interactions with stress above 60.
    stresses = [float(it["stress"]) for it in interactions if isinstance(it.get("stress"), (int, float))]
    persistence = 0.0
    if stresses:
        persistence = sum(1 for x in stresses if x > 60) / len(stresses) * 100
    score = _clip(0.7 * fat["score"] + 0.3 * persistence)
    return {"score": score, "level": _level(score), "fatigue": fat["score"], "persistence": round(persistence, 1)}


def isolation_score(mood_docs: list[dict], interactions: list[dict], journals: list[dict]) -> dict:
    """Isolation risk from low engagement, low mood and isolation language in journals."""
    factors = []
    weights = []

    moods = [float(d["mood"]) for d in mood_docs[:14] if isinstance(d.get("mood"), (int, float))]
    if moods:
        factors.append(max(0.0, (3.5 - _avg(moods)) / 2.5 * 100))
        weights.append(0.35)

    engagement = min(100.0, (1 - len(interactions) / 20.0) * 100)
    factors.append(engagement)
    weights.append(0.35)

    if journals:
        text = " ".join((j.get("content") or "").lower() for j in journals[:10])
        hits = sum(1 for w in ISOLATION_WORDS if w in text)
        text_score = min(100.0, hits * 25)
        factors.append(text_score)
        weights.append(0.30)

    if not factors:
        return {"score": None, "level": "no_data"}
    score = _clip(sum(f * w for f, w in zip(factors, weights)) / sum(weights))
    return {"score": score, "level": _level(score), "factors": {
        "low_mood": round(factors[0] if moods else 0, 1) if weights else 0,
        "low_engagement": round(engagement, 1),
        "isolation_language": round(factors[-1], 1) if journals else 0,
    }}


def burnout_report(interactions: list[dict], sleep_docs: list[dict], mood_docs: list[dict], journals: list[dict]) -> dict:
    return {
        "stress": stress_level(interactions),
        "fatigue": fatigue_score(interactions, sleep_docs, mood_docs),
        "burnout": burnout_risk(interactions, sleep_docs, mood_docs),
        "isolation": isolation_score(mood_docs, interactions, journals),
    }
