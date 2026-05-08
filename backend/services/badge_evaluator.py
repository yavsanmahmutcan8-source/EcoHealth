"""
Smart Badge Achievement Engine.

Evaluates all badge conditions against a user's completion history
and returns any newly earned badges.
"""
from typing import List, Dict, Any
from datetime import datetime, timedelta
from collections import defaultdict


def evaluate_badges(
    user_xp: int,
    user_level: int,
    owned_badge_ids: List[str],
    completions: List[Any],
    review_count: int,
    badge_definitions: List[Any],
    activities_created_count: int = 0,
    creator_completions_count: int = 0,
) -> List[Dict]:
    """
    Stateless badge evaluation function.

    Args:
        user_xp: Current user XP
        user_level: Current user level
        owned_badge_ids: List of badge IDs the user already has
        completions: List of CompletionLog objects (with .category, .completed_at)
        review_count: Number of reviews the user has written
        badge_definitions: List of BadgeDefinition objects
        activities_created_count: Number of activities this user has authored
        creator_completions_count: Number of times other users completed this user's activities

    Returns:
        List of newly earned badge dicts (id, name, description, emoji, color)
    """
    newly_earned = []

    for badge in badge_definitions:
        if badge.id in owned_badge_ids:
            continue

        ct = badge.condition_type
        cfg = badge.condition_config or {}
        earned = False

        if ct == "ACTIVITY_COUNT":
            earned = len(completions) >= cfg.get("count", 1)

        elif ct == "TOTAL_XP":
            earned = user_xp >= cfg.get("xp", 0)

        elif ct == "LEVEL_REACHED":
            earned = user_level >= cfg.get("level", 1)

        elif ct == "CATEGORY_COUNT":
            target_cat = cfg.get("category", "")
            count_needed = cfg.get("count", 1)
            cat_count = sum(1 for c in completions if c.category == target_cat)
            earned = cat_count >= count_needed

        elif ct == "WEEKEND_COUNT":
            count_needed = cfg.get("count", 1)
            weekend_count = sum(
                1 for c in completions
                if c.completed_at.weekday() in (5, 6)  # Saturday=5, Sunday=6
            )
            earned = weekend_count >= count_needed

        elif ct == "TIME_OF_DAY":
            before_hour = cfg.get("before_hour")
            after_hour = cfg.get("after_hour")
            for c in completions:
                hour = c.completed_at.hour
                if before_hour is not None and hour < before_hour:
                    earned = True
                    break
                if after_hour is not None and hour >= after_hour:
                    earned = True
                    break

        elif ct == "STREAK_DAYS":
            days_needed = cfg.get("days", 3)
            earned = _check_streak(completions, days_needed)

        elif ct == "MULTI_CATEGORY":
            count_needed = cfg.get("count", 2)
            unique_cats = set(c.category for c in completions)
            earned = len(unique_cats) >= count_needed

        elif ct == "FIRST_REVIEW":
            earned = review_count >= 1

        elif ct == "ACTIVITIES_CREATED":
            earned = activities_created_count >= cfg.get("count", 1)

        elif ct == "CREATOR_COMPLETIONS":
            earned = creator_completions_count >= cfg.get("count", 1)

        if earned:
            newly_earned.append({
                "id": badge.id,
                "name": badge.name,
                "description": badge.description,
                "emoji": badge.emoji,
                "color": badge.color,
            })

    return newly_earned


def _check_streak(completions, days_needed: int) -> bool:
    """Check if the user has completed activities on N consecutive days."""
    if not completions:
        return False

    # Get unique dates (sorted)
    dates = sorted(set(c.completed_at.date() for c in completions))
    if len(dates) < days_needed:
        return False

    streak = 1
    max_streak = 1
    for i in range(1, len(dates)):
        if dates[i] - dates[i - 1] == timedelta(days=1):
            streak += 1
            max_streak = max(max_streak, streak)
        else:
            streak = 1

    return max_streak >= days_needed


def get_badge_progress(
    user_xp: int,
    user_level: int,
    completions: List[Any],
    review_count: int,
    badge_definitions: List[Any],
    activities_created_count: int = 0,
    creator_completions_count: int = 0,
) -> Dict[str, Dict]:
    """
    Calculate current progress toward each badge.
    Returns {badge_id: {"current": N, "target": M}} for count-based badges.
    """
    progress = {}

    # Pre-compute stats
    total_completions = len(completions)
    weekend_count = sum(1 for c in completions if c.completed_at.weekday() in (5, 6))
    unique_cats = set(c.category for c in completions)
    cat_counts = defaultdict(int)
    for c in completions:
        cat_counts[c.category] += 1

    # Streak
    dates = sorted(set(c.completed_at.date() for c in completions))
    streak = 1
    max_streak = 1 if dates else 0
    for i in range(1, len(dates)):
        if dates[i] - dates[i - 1] == timedelta(days=1):
            streak += 1
            max_streak = max(max_streak, streak)
        else:
            streak = 1

    for badge in badge_definitions:
        ct = badge.condition_type
        cfg = badge.condition_config or {}

        if ct == "ACTIVITY_COUNT":
            progress[badge.id] = {"current": total_completions, "target": cfg.get("count", 1)}
        elif ct == "TOTAL_XP":
            progress[badge.id] = {"current": user_xp, "target": cfg.get("xp", 0)}
        elif ct == "LEVEL_REACHED":
            progress[badge.id] = {"current": user_level, "target": cfg.get("level", 1)}
        elif ct == "CATEGORY_COUNT":
            progress[badge.id] = {"current": cat_counts.get(cfg.get("category", ""), 0), "target": cfg.get("count", 1)}
        elif ct == "WEEKEND_COUNT":
            progress[badge.id] = {"current": weekend_count, "target": cfg.get("count", 1)}
        elif ct == "TIME_OF_DAY":
            # Boolean — either you have it or not
            has_it = False
            before_hour = cfg.get("before_hour")
            after_hour = cfg.get("after_hour")
            for c in completions:
                h = c.completed_at.hour
                if (before_hour and h < before_hour) or (after_hour and h >= after_hour):
                    has_it = True
                    break
            progress[badge.id] = {"current": 1 if has_it else 0, "target": 1}
        elif ct == "STREAK_DAYS":
            progress[badge.id] = {"current": max_streak, "target": cfg.get("days", 3)}
        elif ct == "MULTI_CATEGORY":
            progress[badge.id] = {"current": len(unique_cats), "target": cfg.get("count", 2)}
        elif ct == "FIRST_REVIEW":
            progress[badge.id] = {"current": min(review_count, 1), "target": 1}
        elif ct == "ACTIVITIES_CREATED":
            progress[badge.id] = {"current": activities_created_count, "target": cfg.get("count", 1)}
        elif ct == "CREATOR_COMPLETIONS":
            progress[badge.id] = {"current": creator_completions_count, "target": cfg.get("count", 1)}
        else:
            progress[badge.id] = {"current": 0, "target": 1}

    return progress
