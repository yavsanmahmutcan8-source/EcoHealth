from typing import List, Dict, Any

def calculate_bmi(weight_kg: float, height_cm: float) -> float:
    if not weight_kg or not height_cm:
        return 22.0  # Default average BMI if data is missing
    height_m = height_cm / 100.0
    return weight_kg / (height_m ** 2)

def determine_fitness_capacity(age: int, bmi: float, user_level: int) -> float:
    """
    Estimates a user's physical capability on a scale of 1.0 to 5.0.
    - 2.5 is average starting point.
    - Good BMI (18.5 - 25) adds capacity.
    - Higher user_level (from doing activities) adds capacity.
    - Very high age reduces peak intensity slightly.
    """
    capacity = 2.5
    
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

def generate_match_scores(user: Any, activities: List[Any]) -> List[Dict]:
    """
    Takes a User model and a list of Activity models.
    Returns a sorted list of activities with their "Match Percentage".
    """
    # 1. Understand the user
    bmi = calculate_bmi(user.weight_kg, user.height_cm)
    fitness_capacity = determine_fitness_capacity(user.age, bmi, user.level)
    
    scored_activities = []
    
    # 2. Score each activity
    for activity in activities:
        # We compare the user's fitness capacity (1-5) to the activity difficulty (1-5)
        # Optimal distance is 0. If it's too hard, penalty. If it's way too easy, small penalty (boring).
        difficulty_diff = activity.difficulty - fitness_capacity
        
        if difficulty_diff > 0:
            # Activity is harder than capacity -> -20% per point of difficulty
            penalty = difficulty_diff * 20
        else:
            # Activity is easier -> -5% per point of easiness (less severe, just less stimulating)
            penalty = abs(difficulty_diff) * 5
            
        # Base score is 100% minus the penalty
        match_score = round(max(0.0, 100 - penalty), 1)
        
        scored_activities.append({
            "activity_id": activity.id,
            "title": activity.title,
            "difficulty": activity.difficulty,
            "match_score_percentage": match_score
        })
        
    # 3. Sort by highest match score first
    scored_activities.sort(key=lambda x: x["match_score_percentage"], reverse=True)
    return scored_activities
