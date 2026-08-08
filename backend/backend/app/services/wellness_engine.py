"""Wellness Engine: converts raw multimodal + lifestyle signals into a 0-100 score."""

EMOTION_HEALTH = {
    "happy": 100.0, "surprise": 65.0, "neutral": 72.0,
    "sad": 40.0, "angry": 30.0, "fear": 35.0, "disgust": 30.0,
}


def _avg(values: list[float]) -> float:
    return sum(values) / len(values) if values else 0.0


def _weighted(pairs: list[tuple[float, float]]) -> float:
    """Weighted average of (score, weight) pairs."""
    total_w = sum(w for _, w in pairs)
    if total_w <= 0:
        return 0.0
    return sum(s * w for s, w in pairs) / total_w


def emotion_health(interactions: list[dict]) -> float:
    """Average emotional wellbeing from the most recent interactions."""
    scores = []
    for it in interactions[:10]:
        fused = it.get("fusion") or {}
        if not fused:
            continue
        dominant = max(fused, key=fused.get)
        scores.append(EMOTION_HEALTH.get(dominant, 50.0))
    return round(_avg(scores), 1)


def stress_health(interactions: list[dict]) -> float:
    """100 minus recent average stress."""
    stresses = []
    for it in interactions[:10]:
        s = it.get("stress")
        if isinstance(s, (int, float)):
            stresses.append(float(s))
    if not stresses:
        return 0.0
    return round(max(0.0, min(100.0, 100 - _avg(stresses))), 1)


def sleep_health(sleep_docs: list[dict]) -> float:
    if not sleep_docs:
        return 0.0
    recent = sleep_docs[:7]
    hours_scores, quality_scores = [], []
    for d in recent:
        h = d.get("hours")
        if isinstance(h, (int, float)):
            hours_scores.append(100 - abs(float(h) - 7.5) * 20)
        q = d.get("quality")
        if isinstance(q, (int, float)):
            quality_scores.append(float(q) / 5 * 100)
    h_avg = _avg([max(0.0, s) for s in hours_scores]) if hours_scores else 0.0
    q_avg = _avg(quality_scores) if quality_scores else 0.0
    if not hours_scores and not quality_scores:
        return 0.0
    return round(_weighted([(h_avg, 0.5), (q_avg, 0.5)]), 1)


def hydration_health(water_docs: list[dict], goal_ml: float = 2000.0, days: int = 7) -> float:
    """Average daily intake vs the daily goal, over the last N days."""
    by_day: dict[str, int] = {}
    for d in water_docs:
        day = d.get("date") or ""
        by_day[day] = by_day.get(day, 0) + (d.get("amount_ml") or 0)
    if not by_day:
        return 0.0
    recent = sorted(by_day.values(), reverse=True)[:days]
    goal = goal_ml or 2000.0
    return round(min(100.0, (_avg(recent) / goal) * 100.0), 1)


def habits_health(habit_docs: list[dict], days: int = 7) -> float:
    """Average daily % of habits completed over the last N days.

    habit_docs are daily completion summaries [{date, completed, total}].
    """
    if not habit_docs:
        return 0.0
    recent = habit_docs[:days]
    scores = [d["completed"] / d["total"] * 100 for d in recent if d.get("total")]
    return round(_avg(scores), 1)


def mood_health(mood_docs: list[dict], days: int = 7) -> float:
    """Average mood (1-5 -> 0-100) over the last N days."""
    if not mood_docs:
        return 0.0
    recent = [d for d in mood_docs if isinstance(d.get("mood"), (int, float))]
    recent = recent[:days]
    if not recent:
        return 0.0
    return round(_avg([float(d["mood"]) / 5 * 100 for d in recent]), 1)


def wellness_score(interactions: list[dict], mood_docs: list[dict], habit_docs: list[dict],
                   water_docs: list[dict], sleep_docs: list[dict],
                   water_goal_ml: float = 2000.0) -> dict:
    """Blends all signals into an overall wellness score with sub-scores."""
    subs = {
        "emotion": emotion_health(interactions),
        "stress_relief": stress_health(interactions),
        "sleep": sleep_health(sleep_docs),
        "hydration": hydration_health(water_docs, water_goal_ml),
        "habits": habits_health(habit_docs),
        "mood": mood_health(mood_docs),
    }
    weights = {
        "emotion": 0.25, "stress_relief": 0.25, "mood": 0.15,
        "sleep": 0.15, "hydration": 0.10, "habits": 0.10,
    }
    present = [(subs[k], weights[k]) for k in subs if subs[k] > 0]
    if not present:
        overall = None
        level = "no_data"
    else:
        overall = round(_weighted(present), 1)
        if overall >= 75:
            level = "thriving"
        elif overall >= 55:
            level = "balanced"
        elif overall >= 35:
            level = "struggling"
        else:
            level = "at_risk"
    return {"overall": overall, "level": level, "subscores": subs}
