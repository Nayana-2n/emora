from collections import defaultdict
from datetime import datetime, timedelta
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response

from app.core.security import get_current_user
from app.services import data_service
from app.services.wellness_engine import wellness_score
from app.services.burnout_engine import burnout_report
from app.services.report_service import (
    compute_report_metrics, fallback_recommendation, gemini_narrative,
)
from app.utils.pdf_utils import build_pdf

router = APIRouter()

BUCKET_DAYS = {"day": 1, "week": 7, "month": 30, "year": 365}


def _load(uid: str):
    return (
        data_service.get_user_interactions(uid),
        data_service.get_moods(uid),
        data_service.get_habits(uid),
        data_service.get_water(uid),
        data_service.get_sleep(uid),
        data_service.get_journals(uid),
    )


def _buckets(period: str) -> tuple[str, list[str]]:
    """Returns bucket label format and the list of bucket keys covering the period."""
    days = BUCKET_DAYS.get(period, 7)
    now = datetime.now().astimezone()
    labels = []
    fmt = "%Y-%m-%d" if days <= 7 else "%Y-%m-%d"
    if period == "month":
        labels = []
        for w in range(4):
            start = now - timedelta(weeks=w + 1)
            labels.append(start.strftime("%Y-W%W"))
        labels.reverse()
        return "week", labels
    if period == "year":
        labels = [f"{now.month - i:02d}" for i in range(11, -1, -1)]
        labels = [f"{now.year}-{m}" for m in labels]
        return "month", labels
    labels = [(now - timedelta(days=i)).strftime(fmt) for i in range(days - 1, -1, -1)]
    return "day", labels


def _bucket_key(fmt: str, ts: int) -> str:
    dt = datetime.fromtimestamp(ts).astimezone()
    if fmt == "week":
        return dt.strftime("%Y-W%W")
    if fmt == "month":
        return dt.strftime("%Y-%m")
    return dt.strftime("%Y-%m-%d")


def _dominant(fused: dict) -> Optional[str]:
    return max(fused, key=fused.get) if fused else None


@router.get("/analytics/overview")
def overview(user=Depends(get_current_user)):
    uid = user["user_id"]
    interactions, moods, habits, water, sleep, journals = _load(uid)
    return {
        "wellness": wellness_score(interactions, moods, habits, water, sleep,
                                   data_service.get_water_goal(uid)),
        "burnout": burnout_report(interactions, sleep, moods, journals),
        "counts": {
            "interactions": len(interactions),
            "journals": len(journals),
            "moods": len(moods),
            "active_days": len({d.get("date") for d in water if d.get("date")}),
        },
    }


@router.get("/analytics/trends")
def trends(period: str = "week", user=Depends(get_current_user)):
    period = period if period in BUCKET_DAYS else "week"
    interactions, moods, habits, water, sleep, _ = _load(user["user_id"])
    bucket_fmt, buckets = _buckets(period)

    stress: dict[str, list[float]] = {b: [] for b in buckets}
    emotions: dict[str, dict] = {b: {} for b in buckets}
    mood_series: dict[str, list[float]] = {b: [] for b in buckets}
    habits_series: dict[str, dict] = {b: {"completed": 0, "total": 0} for b in buckets}

    for it in interactions:
        k = _bucket_key(bucket_fmt, it.get("ts") or 0)
        if k not in stress:
            continue
        s = it.get("stress")
        if isinstance(s, (int, float)):
            stress[k].append(float(s))
        dom = _dominant(it.get("fusion") or {})
        if dom:
            emotions[k][dom] = emotions[k].get(dom, 0) + 1

    for m in moods:
        if m.get("date") in mood_series and isinstance(m.get("mood"), (int, float)):
            mood_series[m["date"]].append(float(m["mood"]))

    for h in habits:
        if h.get("date") in habits_series:
            habits_series[h["date"]]["completed"] += h.get("completed", 0)
            habits_series[h["date"]]["total"] += h.get("total", 0)

    stress_series = []
    emotion_series = []
    mood_out = []
    habit_out = []
    for b in buckets:
        vals = stress[b]
        stress_series.append(round(sum(vals) / len(vals), 1) if vals else None)
        emo = emotions[b]
        emotion_series.append({"bucket": b, **emo})
        mv = mood_series[b]
        mood_out.append(round(sum(mv) / len(mv), 2) if mv else None)
        hh = habits_series[b]
        habit_out.append(round(hh["completed"] / hh["total"] * 100, 1) if hh["total"] else None)

    return {
        "period": period,
        "buckets": buckets,
        "stress": stress_series,
        "emotions": emotion_series,
        "mood": mood_out,
        "habits": habit_out,
    }


@router.get("/analytics/calendar")
def calendar(month: Optional[str] = None, user=Depends(get_current_user)):
    uid = user["user_id"]
    interactions, moods, habits, water, sleep, journals = _load(uid)

    # Resolve the requested month (defaults to current).
    try:
        ref = datetime.strptime(month, "%Y-%m") if month else datetime.now().astimezone()
    except Exception:
        ref = datetime.now().astimezone()
    ref = ref.replace(day=1)
    next_month = (ref + timedelta(days=32)).replace(day=1)
    days = {}
    cursor = ref
    while cursor < next_month:
        days[cursor.strftime("%Y-%m-%d")] = {"date": cursor.strftime("%Y-%m-%d"), "emotion": None,
                                             "stress": None, "mood": None, "journal": None}
        cursor += timedelta(days=1)

    mood_map = {m.get("date"): m for m in moods}
    journal_map = {}
    for j in journals:
        d = (j.get("date") or "")
        if d in days and journal_map.get(d) is None:
            journal_map[d] = j

    for it in interactions:
        d = datetime.fromtimestamp(it.get("ts") or 0).astimezone().strftime("%Y-%m-%d")
        if d in days:
            dom = _dominant(it.get("fusion") or {})
            stress = it.get("stress")
            if days[d]["emotion"] is None and dom:
                days[d]["emotion"] = dom
            if days[d]["stress"] is None and isinstance(stress, (int, float)):
                days[d]["stress"] = round(float(stress), 1)

    for d, rec in days.items():
        m = mood_map.get(d)
        if m:
            rec["mood"] = m.get("mood")
        j = journal_map.get(d)
        if j:
            rec["journal"] = {"id": j.get("id"), "title": j.get("title"), "mood_tag": j.get("mood_tag")}

    return {"month": ref.strftime("%Y-%m"), "days": [days[d] for d in sorted(days.keys())]}


@router.get("/analytics/day")
def day_detail(date: Optional[str] = None, user=Depends(get_current_user)):
    """Full record for one calendar day (defaults to today)."""
    uid = user["user_id"]
    if not date:
        date = datetime.now().astimezone().strftime("%Y-%m-%d")
    try:
        ref = datetime.strptime(date, "%Y-%m-%d")
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid date. Use YYYY-MM-DD.")
    day_str = ref.strftime("%Y-%m-%d")

    interactions, moods, habits, water, sleep, journals = _load(uid)
    day_sessions = []
    emotion_counts: dict[str, int] = {}
    stress_series = []
    for it in interactions:
        d = datetime.fromtimestamp(it.get("ts") or 0).astimezone().strftime("%Y-%m-%d")
        if d != day_str:
            continue
        dom = _dominant(it.get("fusion") or {}) or it.get("emotion")
        if dom:
            emotion_counts[dom] = emotion_counts.get(dom, 0) + 1
        s = it.get("stress")
        if isinstance(s, (int, float)):
            stress_series.append({"ts": it.get("ts"), "stress": round(float(s), 1)})
        day_sessions.append({
            "ts": it.get("ts"),
            "stress": s if isinstance(s, (int, float)) else None,
            "emotion": dom,
            "confidence": it.get("confidence"),
            "modalities": it.get("modalities"),
            "transcript": it.get("transcript"),
            "ai_reply": it.get("ai_reply"),
        })
    stress_series.sort(key=lambda x: x["ts"] or 0)

    mood = next((m for m in moods if m.get("date") == day_str), None)
    habit = next((h for h in habits if h.get("date") == day_str), None)
    water_goal = data_service.get_water_goal(uid)
    water_total = sum(e.get("amount_ml") or 0 for e in water if e.get("date") == day_str)
    sleep_doc = next((s for s in sleep if s.get("date") == day_str), None)
    journals_day = [j for j in journals if (j.get("date") or "") == day_str]

    total_emo = sum(emotion_counts.values())
    return {
        "date": day_str,
        "stress_series": stress_series,
        "emotion_counts": emotion_counts,
        "emotion_percent": {k: round(v / total_emo * 100, 1) for k, v in emotion_counts.items()} if total_emo else {},
        "sessions": day_sessions,
        "mood": (mood or {}).get("mood"),
        "mood_note": (mood or {}).get("note"),
        "journals": [{"id": j.get("id"), "title": j.get("title"), "mood_tag": j.get("mood_tag"),
                      "section": j.get("section", "today")} for j in journals_day],
        "habits": {"completed": (habit or {}).get("completed", 0), "total": (habit or {}).get("total", 0),
                   "percent": (habit or {}).get("percent", 0.0)} if habit else None,
        "water": {"total_ml": water_total, "goal_ml": water_goal,
                  "percent": round(water_total / water_goal * 100, 1) if water_goal else 0.0},
        "sleep": {"hours": sleep_doc.get("hours"), "quality": sleep_doc.get("quality")} if sleep_doc else None,
    }


@router.get("/analytics/emotions")
def emotions(period: str = "week", user=Depends(get_current_user)):
    """Emotion distribution (counts + %) for day/week/month/year windows."""
    period = period if period in BUCKET_DAYS else "week"
    interactions, *_ = _load(user["user_id"])
    bucket_fmt, buckets = _buckets(period)
    counts: dict[str, dict] = {b: {} for b in buckets}
    for it in interactions:
        k = _bucket_key(bucket_fmt, it.get("ts") or 0)
        if k not in counts:
            continue
        dom = _dominant(it.get("fusion") or {}) or it.get("emotion")
        if dom:
            counts[k][dom] = counts[k].get(dom, 0) + 1
    overall: dict[str, int] = {}
    for b in buckets:
        for emo, n in counts[b].items():
            overall[emo] = overall.get(emo, 0) + n
    total = sum(overall.values())
    return {
        "period": period,
        "buckets": [{ "bucket": b, "counts": counts[b],
                      "distribution": {k: round(v / sum(counts[b].values()) * 100, 1)
                                       for k, v in counts[b].items()} if counts[b] else {} } for b in buckets],
        "total_counts": overall,
        "distribution": {k: round(v / total * 100, 1) for k, v in overall.items()} if total else {},
    }


def _insight_pair(label: str, statement: str, level: str, samples: int) -> dict:
    return {"title": label, "statement": statement, "level": level, "samples": samples}


@router.get("/analytics/insights")
def insights(user=Depends(get_current_user)):
    """Plain-language wellness correlations. Never claims causation."""
    uid = user["user_id"]
    interactions, moods, habits, water, sleep, journals = _load(uid)
    goal_ml = data_service.get_water_goal(uid)
    out = []

    # Water vs stress: compare avg stress on goal-reached vs missed days.
    water_by_day: dict[str, int] = {}
    for e in water:
        d = e.get("date") or ""
        water_by_day[d] = water_by_day.get(d, 0) + (e.get("amount_ml") or 0)
    stress_by_day: dict[str, list[float]] = {}
    for it in interactions:
        d = datetime.fromtimestamp(it.get("ts") or 0).astimezone().strftime("%Y-%m-%d")
        s = it.get("stress")
        if isinstance(s, (int, float)):
            stress_by_day.setdefault(d, []).append(float(s))
    reached = [sum(v) / len(v) for d, v in stress_by_day.items()
               if d in water_by_day and water_by_day[d] >= goal_ml]
    missed = [sum(v) / len(v) for d, v in stress_by_day.items()
              if d in water_by_day and 0 < water_by_day[d] < goal_ml]
    if len(reached) + len(missed) >= 5 and reached and missed:
        diff = sum(reached) / len(reached) - sum(missed) / len(missed)
        strength = "strong" if abs(diff) >= 10 else ("moderate" if abs(diff) >= 5 else "weak")
        if diff < 0:
            stmt = ("On days you reached your water goal, your average recorded stress was lower "
                    f"({round(sum(reached) / len(reached), 1)} vs {round(sum(missed) / len(missed), 1)}). "
                    "This is a pattern observed in your own data, not a guaranteed effect.")
        else:
            stmt = (f"Your average recorded stress was similar on goal and non-goal days "
                    f"({round(sum(reached) / len(reached), 1)} vs {round(sum(missed) / len(missed), 1)}). "
                    "No clear pattern yet.")
        out.append(_insight_pair("Hydration & stress", stmt, strength, len(reached) + len(missed)))
    else:
        out.append(_insight_pair("Hydration & stress",
                                 "Not enough data yet. Log water and a few mood sessions to unlock this insight.",
                                 "none", len(reached) + len(missed)))

    # Habits vs mood: avg mood on high vs low habit days.
    habit_by_day = {h["date"]: h for h in habits if h.get("total")}
    mood_by_day: dict[str, float] = {}
    for m in moods:
        if isinstance(m.get("mood"), (int, float)):
            mood_by_day[m["date"]] = float(m["mood"])
    high = [v for d, v in mood_by_day.items()
            if d in habit_by_day and (habit_by_day[d]["completed"] / habit_by_day[d]["total"]) >= 0.5]
    low = [v for d, v in mood_by_day.items()
           if d in habit_by_day and (habit_by_day[d]["completed"] / habit_by_day[d]["total"]) < 0.5]
    if len(high) + len(low) >= 5 and high and low:
        diff = sum(high) / len(high) - sum(low) / len(low)
        strength = "strong" if diff >= 0.8 else ("moderate" if diff >= 0.4 else "weak")
        stmt = (f"On days you completed at least half your habits, your recorded mood averaged "
                f"{round(sum(high) / len(high), 2)}/5 vs {round(sum(low) / len(low), 2)}/5 on lighter days. "
                "A possible connection, not a rule.")
        out.append(_insight_pair("Habits & mood", stmt, strength, len(high) + len(low)))
    else:
        out.append(_insight_pair("Habits & mood",
                                 "Not enough data yet. Track habits and moods for a few days to unlock this insight.",
                                 "none", len(high) + len(low)))

    # Journal activity vs stress.
    journal_days = {j.get("date") for j in journals if j.get("date")}
    j_stress = [sum(v) / len(v) for d, v in stress_by_day.items() if d in journal_days]
    nj_stress = [sum(v) / len(v) for d, v in stress_by_day.items() if d not in journal_days and stress_by_day.get(d)]
    if len(j_stress) >= 5 and len(nj_stress) >= 5:
        diff = sum(j_stress) / len(j_stress) - sum(nj_stress) / len(nj_stress)
        strength = "strong" if abs(diff) >= 10 else ("moderate" if abs(diff) >= 5 else "weak")
        stmt = (f"On days you wrote in your journal, your average recorded stress was "
                f"{round(sum(j_stress) / len(j_stress), 1)} vs {round(sum(nj_stress) / len(nj_stress), 1)} "
                "on days you didn't. A possible connection worth watching.")
        out.append(_insight_pair("Journaling & stress", stmt, strength, len(j_stress) + len(nj_stress)))
    else:
        out.append(_insight_pair("Journaling & stress",
                                 "Write journal entries on several days to unlock this insight.",
                                 "none", len(j_stress) + len(nj_stress)))

    return {"insights": out, "count": len(out)}


REPORT_MOOD_LABELS = {1: "very_low", 2: "low", 3: "neutral", 4: "good", 5: "great"}


def _parse_date(s):
    try:
        return datetime.strptime(str(s), "%Y-%m-%d").date()
    except Exception:
        return None


def _in_range(d, ws, we) -> bool:
    dd = _parse_date(d)
    return dd is not None and ws <= dd <= we


def _week_start(dt: datetime):
    return (dt - timedelta(days=dt.weekday())).date()


def _weekly_trend_rows(interactions, moods, habits, water) -> list[str]:
    """Human-readable rows for the last 4 ISO weeks (oldest first)."""
    now = datetime.now().astimezone()
    weeks = []
    for w in range(3, -1, -1):
        ws = _week_start(now) - timedelta(weeks=w)
        weeks.append((ws, ws + timedelta(days=6)))
    rows = []
    for ws, we in weeks:
        it_stress = [
            float(i["stress"]) for i in interactions
            if isinstance(i.get("stress"), (int, float))
            and ws <= datetime.fromtimestamp(i.get("ts") or 0).astimezone().date() <= we
        ]
        mood_vals = [float(m["mood"]) for m in moods
                     if isinstance(m.get("mood"), (int, float)) and _in_range(m.get("date"), ws, we)]
        hab = [h for h in habits if _in_range(h.get("date"), ws, we)]
        wat = [w for w in water if _in_range(w.get("date"), ws, we)]
        if not (it_stress or mood_vals or hab or wat):
            continue
        stress = round(sum(it_stress) / len(it_stress), 1) if it_stress else "-"
        mood = round(sum(mood_vals) / len(mood_vals), 1) if mood_vals else "-"
        h_comp = sum(h.get("completed", 0) for h in hab)
        h_tot = sum(h.get("total", 0) for h in hab)
        hpct = round(h_comp / h_tot * 100, 1) if h_tot else "-"
        w_avg = round(sum(w.get("amount_ml") or 0 for w in wat) / max(1, len(wat)) / 1000, 2) if wat else "-"
        rows.append(
            f"  {ws.strftime('%b %d')} - {we.strftime('%b %d')}: "
            f"stress {stress} | mood {mood}/5 | habits {hpct}% | water {w_avg}L"
        )
    return rows


def _report_mood_label(avg: float) -> str:
    if avg >= 4.5:
        return "great"
    if avg >= 3.5:
        return "good"
    if avg >= 2.5:
        return "neutral"
    if avg >= 1.5:
        return "low"
    return "very_low"


def _report_lines(interactions, moods, habits, water, sleep, journals, goal_ml,
                  metrics, narrative, display_name, generated_at, uid) -> list:
    lines = []

    if display_name:
        lines.append(("T", f"For {display_name}"))

    ts_list = [it.get("ts") or 0 for it in interactions]
    if ts_list:
        start = datetime.fromtimestamp(min(ts_list)).astimezone().strftime("%b %d, %Y")
        end = datetime.fromtimestamp(max(ts_list)).astimezone().strftime("%b %d, %Y")
        lines.append(("T", f"Report period: {start} - {end}"))
    else:
        lines.append(("T", "Report period: no session data yet"))
    lines.append(("T", f"Generated: {datetime.fromtimestamp(generated_at).astimezone().strftime('%b %d, %Y %H:%M')}"))
    lines.append(("E", ""))

    has_any = bool(interactions or moods or habits or water or sleep or journals)

    if not has_any:
        lines.append(("H", "No wellness records available for this period"))
        lines.append(("T", "Start by logging your mood, tracking water or habits, or running a"))
        lines.append(("T", "live session. As soon as you have data, this report will summarize"))
        lines.append(("T", "your trends and recommend small, kind next steps."))
        return lines

    lines.append(("H", "1. Overview"))
    lines.append(f"Happiness ............ {metrics['happy_percent']}%")
    lines.append(f"Sadness .............. {metrics['sad_percent']}%")
    lines.append(f"Stress ............... {metrics['stress_percent']}%")
    lines.append(f"Fatigue .............. {metrics['fatigue_percent']}%")
    lines.append(f"Burnout Risk ......... {metrics['burnout'].upper()} ({metrics['burnout_score']}/100)")
    lines.append(f"Wellness Score ....... {metrics['wellness']}/100 ({metrics['wellness_level']})")

    lines.append(("H", "2. Emotion distribution"))
    if interactions and metrics["emotion_breakdown"]:
        for k, v in metrics["emotion_breakdown"].items():
            lines.append(f"  - {k}: {v}%")
    else:
        lines.append("  No emotion signals recorded in this period.")

    lines.append(("H", "3. Weekly trends (last 4 weeks)"))
    rows = _weekly_trend_rows(interactions, moods, habits, water)
    if rows:
        lines.extend(rows)
    else:
        lines.append("  Not enough data to show weekly trends yet.")

    lines.append(("H", "4. Mood summary"))
    mood_vals = [float(m["mood"]) for m in moods if isinstance(m.get("mood"), (int, float))]
    if mood_vals:
        avg = sum(mood_vals) / len(mood_vals)
        lines.append(f"  Average mood: {round(avg, 1)}/5 ({_report_mood_label(avg)})")
        lines.append(f"  Days recorded: {len(moods)}")
        dist: dict[str, int] = defaultdict(int)
        for m in moods:
            v = m.get("mood")
            if isinstance(v, (int, float)):
                dist[REPORT_MOOD_LABELS.get(int(v), "neutral")] += 1
        if dist:
            lines.append("  Distribution: " + ", ".join(f"{n}x {k}" for k, n in sorted(dist.items())))
    else:
        lines.append("  No moods recorded in this period.")

    lines.append(("H", "5. Habits"))
    definitions = data_service.get_habit_definitions(uid)
    if definitions:
        total_comp = sum(h.get("completed", 0) for h in habits)
        total_days = sum(h.get("total", 0) for h in habits)
        overall = round(total_comp / total_days * 100, 1) if total_days else 0.0
        best_streak = max((d.get("longest_streak") or 0 for d in definitions), default=0)
        cur_streaks = sum(1 for d in definitions if d.get("streak"))
        lines.append(f"  Active habits: {len(definitions)}")
        lines.append(f"  Overall completion: {overall}% over {len(habits)} tracked days")
        lines.append(f"  Habits with a current streak: {cur_streaks}")
        lines.append(f"  Longest streak: {best_streak} days")
    else:
        lines.append("  No habits created in this period.")

    lines.append(("H", "6. Hydration"))
    if water:
        by_day: dict[str, int] = defaultdict(int)
        for w in water:
            by_day[w.get("date") or ""] += w.get("amount_ml") or 0
        avg_day = round(sum(by_day.values()) / len(by_day))
        days_met = sum(1 for v in by_day.values() if v >= goal_ml)
        lines.append(f"  Goal: {goal_ml} ml / day")
        lines.append(f"  Days logged: {len(by_day)}")
        lines.append(f"  Average intake: {avg_day} ml / day")
        lines.append(f"  Days at or above goal: {days_met}")
    else:
        lines.append("  No water intake recorded in this period.")

    lines.append(("H", "7. Journal activity"))
    if journals:
        days_written = len({j.get("date") for j in journals if j.get("date")})
        today_n = sum(1 for j in journals if j.get("section") == "today")
        story_n = sum(1 for j in journals if j.get("section") == "tomorrow_story")
        lines.append(f"  Entries: {len(journals)} across {days_written} days")
        lines.append(f"  Today entries: {today_n} | Tomorrow story: {story_n}")
    else:
        lines.append("  No journal entries in this period.")

    lines.append(("H", "8. Sleep"))
    if sleep:
        hours = [float(s["hours"]) for s in sleep if isinstance(s.get("hours"), (int, float))]
        if hours:
            lines.append(f"  Average sleep: {round(sum(hours) / len(hours), 1)}h ({len(sleep)} nights)")
        quality = [int(s["quality"]) for s in sleep if isinstance(s.get("quality"), (int, float))]
        if quality:
            lines.append(f"  Average quality: {round(sum(quality) / len(quality), 1)}/5")
    else:
        lines.append("  No sleep records in this period.")

    lines.append(("H", "9. Recommendation"))
    lines.append(("T", narrative))

    lines.append(("E", ""))
    lines.append(("T", "This report is generated from your face, voice, journal, mood,"))
    lines.append(("T", "habits, water and sleep data. It is not a medical diagnosis."))
    return lines


@router.get("/analytics/report")
def report(user=Depends(get_current_user)):
    uid = user["user_id"]
    interactions, moods, habits, water, sleep, journals = _load(uid)
    metrics = compute_report_metrics(interactions, sleep, moods, journals, habits, water,
                                     data_service.get_water_goal(uid))
    narrative = gemini_narrative(metrics) or fallback_recommendation(metrics)
    return {"metrics": metrics, "recommendation": narrative, "generated_at": int(__import__("time").time())}


@router.get("/analytics/report.pdf")
def report_pdf(user=Depends(get_current_user)):
    uid = user["user_id"]
    interactions, moods, habits, water, sleep, journals = _load(uid)
    metrics = compute_report_metrics(interactions, sleep, moods, journals, habits, water,
                                     data_service.get_water_goal(uid))
    narrative = gemini_narrative(metrics) or fallback_recommendation(metrics)

    user_doc = None
    try:
        from app.core.firestore_db import get_doc
        from app.core.config import APP_ID
        user_doc = get_doc(["artifacts", APP_ID, "users", uid])
    except Exception:
        pass
    display_name = (user_doc or {}).get("display_name") or ""
    goal_ml = data_service.get_water_goal(uid)
    generated_at = int(__import__("time").time())

    lines = _report_lines(interactions, moods, habits, water, sleep, journals,
                          goal_ml, metrics, narrative, display_name, generated_at, uid)

    pdf_bytes = build_pdf("EMORA - AI Mental Health Report", lines, subtitle="Your wellbeing, summarized")
    return Response(content=pdf_bytes, media_type="application/pdf",
                    headers={"Content-Disposition": 'attachment; filename="emora-report.pdf"'})
