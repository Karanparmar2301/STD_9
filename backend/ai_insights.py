"""
AI Performance Insights Engine
================================
Rule-based (no external ML library required) analysis of student performance.

`generate_insights(student_data)` returns a structured JSON-serialisable dict
that the frontend AI Insight Card renders directly.

Rules Applied
-------------
Math / Science accuracy:
  ≥ 80 % → "Great improvement" message
  60–79 % → "Doing well, keep practising"
  < 60 %  → "Needs attention" + specific recommendation

English accuracy:
  < 70 %  → Spelling / reading practice recommendation

Streak:
  0       → Encourage first login
  1–2     → Encourage consistency
  broken  → Gentle re-engagement
  ≥ 7     → Celebrate milestone

XP (reward_points):
  0–49    xp_stagnant → suggest games
  100–299 progressing → badge hint
  ≥ 300   thriving    → Gold badge hint

Homework completion rate:
  ≥ 90 %  → Praise
  70–89 % → Light nudge
  < 70 %  → Stronger push

Game performance:
  accuracy ≥ 80 % → positive reinforcement
  < 60 %          → recommend more practice

The function never fails — if data is missing it uses safe defaults.
"""

from __future__ import annotations

from typing import Any

# ─── Helpers ──────────────────────────────────────────────────────────────────

def _pct(part: int | float, total: int | float) -> float:
    """Return percentage, safe against divide-by-zero."""
    return round((part / total) * 100, 1) if total else 0.0


def _safe_int(value: Any, default: int = 0) -> int:
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _safe_float(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


# ─── Sub-analysers ────────────────────────────────────────────────────────────

def _analyse_streak(streak: int) -> tuple[str, str]:
    """Return (observation, motivation) based on current streak."""
    if streak == 0:
        return (
            "No active streak yet.",
            "Log in and complete an activity today to start your streak! 🔥",
        )
    if streak == 1:
        return (
            "You started a streak — great first step!",
            "Come back tomorrow to keep the fire going! 🔥",
        )
    if streak < 7:
        return (
            f"You're on a {streak}-day streak!",
            f"Just {7 - streak} more days to hit your first streak milestone. Keep going! 💪",
        )
    if streak % 7 == 0:
        return (
            f"🏅 Incredible! You hit a {streak}-day streak milestone!",
            "You're unstoppable. A streak bonus will be awarded — keep it up! 🚀",
        )
    return (
        f"Amazing {streak}-day streak active!",
        "You're building a fantastic habit. Don't break the chain! 🔥",
    )


def _analyse_xp(total_xp: int, streak: int) -> tuple[str, str]:
    """Return (xp_summary, next_step_hint)."""
    if total_xp == 0:
        return (
            "You haven't earned any XP yet.",
            "Play a game or submit homework to earn your first XP! 🎮",
        )
    if total_xp < 50:
        return (
            f"You've earned {total_xp} XP — a solid start!",
            "Try a few more games to speed up your XP gain. 🎯",
        )
    if total_xp < 100:
        return (
            f"You're at {total_xp} XP — so close to Bronze Badge!",
            "Just {xp_left} more XP to unlock Bronze! 🥉".format(xp_left=100 - total_xp),
        )
    if total_xp < 300:
        return (
            f"Bronze Badge unlocked with {total_xp} XP. Nice work!",
            f"Earn {300 - total_xp} more XP to unlock Silver Badge! 🥈",
        )
    if total_xp < 500:
        return (
            f"Silver Badge achieved! {total_xp} XP and counting.",
            f"Gold Badge is {500 - total_xp} XP away — you've got this! 🥇",
        )
    if total_xp < 1000:
        return (
            f"Gold Badge holder with {total_xp} XP — outstanding!",
            f"Diamond Badge awaits at 1000 XP — only {1000 - total_xp} to go! 💎",
        )
    return (
        f"💎 Diamond Badge achieved! {total_xp} XP total — legendary performance!",
        "You've mastered the platform! Challenge yourself with harder game levels. 🏆",
    )


def _analyse_homework(completed: int, total: int) -> tuple[str, str | None]:
    """Return (homework_summary, recommendation_or_None)."""
    rate = _pct(completed, total)
    if total == 0:
        return ("No homework assigned yet.", None)
    if rate >= 90:
        return (
            f"Excellent! {completed}/{total} homework tasks done ({rate}%).",
            None,
        )
    if rate >= 70:
        return (
            f"Good progress: {completed}/{total} homework done ({rate}%).",
            "Try to complete the remaining homework before the deadline.",
        )
    return (
        f"Homework completion at {rate}% — needs attention.",
        f"You have {total - completed} homework tasks pending. Complete them to earn XP! 📚",
    )


def _analyse_game_accuracy(accuracy: float) -> tuple[str, str | None]:
    """Return (game_summary, recommendation_or_None). accuracy is 0–100."""
    if accuracy <= 0:
        return ("No game activity yet.", "Play a game to start earning XP! 🎮")
    if accuracy >= 80:
        return (
            f"Game accuracy: {accuracy:.0f}% — excellent performance!",
            None,
        )
    if accuracy >= 60:
        return (
            f"Game accuracy: {accuracy:.0f}% — getting better!",
            "Focus on accuracy over speed to improve your score.",
        )
    return (
        f"Game accuracy: {accuracy:.0f}% — lots of room to grow.",
        "Practise the same game a few more times to improve your accuracy. 🎯",
    )


def _analyse_subject(subject_scores: dict[str, float]) -> tuple[str | None, str | None, str | None]:
    """
    Detect weak subjects.
    Returns (weak_subject_name_or_None, weak_area_message, recommendation).
    subject_scores: { "Math": 85.0, "English": 62.0, ... }
    """
    if not subject_scores:
        return None, None, None

    thresholds = {
        "English": 70,
        "Math": 80,
        "Science": 75,
    }

    weakest_subject = None
    lowest_score = 100.0

    for subject, score in subject_scores.items():
        thresh = thresholds.get(subject, 70)
        if score < thresh and score < lowest_score:
            lowest_score = score
            weakest_subject = subject

    if weakest_subject is None:
        return None, None, None

    subject_recs = {
        "English": "Practice 5 spelling exercises and read one passage daily. 📖",
        "Math": "Revise today's math topic and attempt 10 practice problems. ➕",
        "Science": "Review the chapter summary and try the concept quiz. 🔬",
    }

    weak_msg = (
        f"{weakest_subject} accuracy is low ({lowest_score:.0f}%) — "
        f"below the target of {thresholds.get(weakest_subject, 70)}%."
    )
    rec = subject_recs.get(weakest_subject, f"Practise more {weakest_subject} exercises.")

    return weakest_subject, weak_msg, rec


# ─── Public API ───────────────────────────────────────────────────────────────

def generate_insights(student_data: dict[str, Any]) -> dict[str, Any]:
    """
    Analyse student performance data and return a structured insights dict.

    Parameters
    ----------
    student_data:
        Merged record containing:
            reward_points, streak, homework_completed, homework_total,
            game_accuracy (0-100), subject_scores (dict),
            games_played, high_score, current_level

    Returns
    -------
    {
        "summary":          str,
        "weak_area":        str | null,
        "recommendation":   str,
        "motivation":       str,
        "subject_scores":   dict,
        "xp_summary":       str,
        "homework_status":  str,
        "game_feedback":    str,
        "streak_status":    str,
        "score":            float,   # overall performance 0–100
        "trend":            "up" | "stable" | "down",
        "badge_hint":       str | null,
        "generated_at":     str (ISO),
    }
    """
    from datetime import datetime

    total_xp = _safe_int(student_data.get("reward_points", 0))
    streak = _safe_int(student_data.get("streak", 0))
    hw_done = _safe_int(student_data.get("homework_completed", 0))
    hw_total = _safe_int(student_data.get("homework_total", 0))
    game_accuracy = _safe_float(student_data.get("game_accuracy", 0))
    subject_scores: dict[str, float] = student_data.get("subject_scores") or {}
    games_played = _safe_int(student_data.get("games_played", 0))
    level = _safe_int(student_data.get("current_level", 1))

    # ── Sub-analyses ─────────────────────────────────────────────────────────
    streak_obs, streak_motivation = _analyse_streak(streak)
    xp_obs, xp_next = _analyse_xp(total_xp, streak)
    hw_obs, hw_rec = _analyse_homework(hw_done, hw_total)
    game_obs, game_rec = _analyse_game_accuracy(game_accuracy)
    weak_subject, weak_msg, subject_rec = _analyse_subject(subject_scores)

    # ── Determine primary recommendation ─────────────────────────────────────
    recommendation = (
        subject_rec
        or hw_rec
        or game_rec
        or xp_next
        or streak_motivation
        or "Keep up the fantastic work! 🌟"
    )

    # ── Overall performance score (weighted) ─────────────────────────────────
    hw_rate = _pct(hw_done, hw_total) if hw_total else 50.0
    score = round(
        hw_rate * 0.35
        + min(game_accuracy, 100) * 0.30
        + min(streak * 5, 100) * 0.20
        + min((total_xp / 10), 100) * 0.15,
        1,
    )

    # ── Trend heuristic ──────────────────────────────────────────────────────
    if score >= 70 and streak >= 3:
        trend = "up"
    elif score < 40 or streak == 0:
        trend = "down"
    else:
        trend = "stable"

    # ── Badge hint ───────────────────────────────────────────────────────────
    badge_hint = None
    badge_thresholds = [
        (100,  "Bronze",  "🥉"),
        (300,  "Silver",  "🥈"),
        (500,  "Gold",    "🥇"),
        (1000, "Diamond", "💎"),
    ]
    for thresh, name, icon in badge_thresholds:
        if total_xp < thresh:
            badge_hint = f"Earn {thresh - total_xp} more XP to unlock {name} Badge {icon}!"
            break

    # ── Primary summary ──────────────────────────────────────────────────────
    if trend == "up":
        summary = f"Great work this week! You're at Level {level} with {total_xp} XP. {streak_obs}"
    elif trend == "down":
        summary = "You've been a bit quiet lately — let's get back on track! 💪"
    else:
        summary = f"Steady progress! Level {level}, {total_xp} XP earned so far. {streak_obs}"

    return {
        "summary": summary,
        "weak_area": weak_msg,
        "recommendation": recommendation,
        "motivation": streak_motivation if streak > 0 else badge_hint or "Start your journey today! 🚀",
        "subject_scores": subject_scores,
        "xp_summary": xp_obs,
        "homework_status": hw_obs,
        "game_feedback": game_obs,
        "streak_status": streak_obs,
        "score": score,
        "trend": trend,
        "badge_hint": badge_hint,
        "generated_at": datetime.utcnow().isoformat() + "Z",
    }
