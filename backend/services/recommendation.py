from typing import List, Dict, Any, Iterable, Set


FITNESS_LEVEL_BASE = {
    "beginner": 1.5,
    "intermediate": 2.5,
    "advanced": 3.5,
    "athlete": 4.5,
}


def calculate_bmi(weight_kg: float, height_cm: float) -> float:
    if not weight_kg or not height_cm:
        return 22.0  # Default average BMI if data is missing
    height_m = height_cm / 100.0
    return weight_kg / (height_m ** 2)


def determine_fitness_capacity(age: int, bmi: float, user_level: int, fitness_level: str = None) -> float:
    """
    Estimates a user's physical capability on a scale of 1.0 to 5.0.
    - If `fitness_level` is set, use it as the base (overrides the average 2.5 default).
    - Good BMI (18.5 - 25) adds capacity.
    - Higher user_level (from doing activities) adds capacity.
    - Very high age reduces peak intensity slightly.
    """
    capacity = FITNESS_LEVEL_BASE.get((fitness_level or "").lower(), 2.5)

    # BMI Factor
    if 18.5 <= bmi <= 25.0:
        capacity += 1.0
    elif 25.0 < bmi <= 30.0:
        capacity -= 0.5
    elif bmi > 30.0:
        capacity -= 1.0

    # Age Factor
    if age and age < 30:
        capacity += 0.5
    elif age and age > 50:
        capacity -= 0.5

    # Gamification Factor (Active users get fitter)
    # Give max +1.5 capacity for being level 10+
    level_bonus = min(user_level * 0.15, 1.5)
    capacity += level_bonus

    # Bound between 1.0 and 5.0
    return max(1.0, min(5.0, capacity))


def generate_match_scores(
    user: Any,
    activities: List[Any],
    completed_activity_ids: Iterable[int] = None,
) -> List[Dict]:
    """
    Takes a User model and a list of Activity models.
    Returns a sorted list of activities with their "Match Percentage".

    v2 enhancements:
    - +15% boost when activity.category is in user.favorite_categories
    - -30% penalty when activity has already been completed by this user
    - fitness_level (when set) replaces the 2.5 base capacity
    """
    bmi = calculate_bmi(user.weight_kg, user.height_cm)
    fitness_capacity = determine_fitness_capacity(
        user.age, bmi, user.level, getattr(user, "fitness_level", None)
    )

    favorites: Set[str] = set(getattr(user, "favorite_categories", None) or [])
    completed_ids: Set[int] = set(completed_activity_ids or [])

    scored_activities = []

    for activity in activities:
        difficulty_diff = activity.difficulty - fitness_capacity

        if difficulty_diff > 0:
            penalty = difficulty_diff * 20  # -20% per point of "too hard"
        else:
            penalty = abs(difficulty_diff) * 5  # -5% per point of "too easy"

        match_score = 100 - penalty

        boosts = []

        if activity.category and activity.category in favorites:
            match_score += 15
            boosts.append("favorite_category")

        if activity.id in completed_ids:
            match_score -= 30
            boosts.append("already_completed")

        match_score = round(max(0.0, min(100.0, match_score)), 1)

        scored_activities.append({
            "id": activity.id,
            "activity_id": activity.id,
            "title": activity.title,
            "category": activity.category,
            "difficulty": activity.difficulty,
            "xp_reward": activity.xp_reward,
            "latitude": activity.latitude,
            "longitude": activity.longitude,
            "route_polyline": activity.route_polyline,
            "estimated_duration_minutes": activity.estimated_duration_minutes,
            "creator_id": getattr(activity, "creator_id", None),
            "creator_username": getattr(activity, "creator_username", None),
            "creator_avatar_url": getattr(activity, "creator_avatar_url", None),
            "creator_is_admin": getattr(activity, "creator_is_admin", None),
            "match_score_percentage": match_score,
            "match_reasons": boosts,
        })

    scored_activities.sort(key=lambda x: x["match_score_percentage"], reverse=True)
    return scored_activities
