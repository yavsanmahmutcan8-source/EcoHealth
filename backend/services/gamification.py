import math
from typing import List, Dict

# Example static list of badges
AVAILABLE_BADGES = [
    {"id": "first_step", "name": "First Step", "description": "Completed your first activity!", "requirement": {"type": "activity_count", "value": 1}},
    {"id": "level_5_hiker", "name": "Trailblazer", "description": "Reached Level 5", "requirement": {"type": "level", "value": 5}},
    {"id": "1000_xp_club", "name": "Nature Lover", "description": "Earned 1000 Total XP", "requirement": {"type": "xp", "value": 1000}}
]

def calculate_level_from_xp(xp: int) -> int:
    """
    RPG-style level calculation.
    Level 1: 0 - 99 XP
    Level 2: 100 - 299 XP
    Level 3: 300 - 599 XP 
    Uses formula: Level = floor(sqrt(XP / 100)) + 1
    """
    if xp < 0:
        return 1
    new_level = math.floor(math.sqrt(xp / 100)) + 1
    return int(new_level)

def check_new_badges(
    current_xp: int, 
    current_level: int, 
    total_activities_completed: int, 
    owned_badge_ids: List[str]
) -> List[Dict]:
    """
    Evaluates unlocking conditions for badges the user doesn't already have.
    """
    newly_unlocked = []
    
    for badge in AVAILABLE_BADGES:
        if badge["id"] in owned_badge_ids:
            continue
            
        req_type = badge["requirement"]["type"]
        req_val = badge["requirement"]["value"]
        
        unlocked = False
        if req_type == "activity_count" and total_activities_completed >= req_val:
            unlocked = True
        elif req_type == "level" and current_level >= req_val:
            unlocked = True
        elif req_type == "xp" and current_xp >= req_val:
            unlocked = True
            
        if unlocked:
            newly_unlocked.append(badge)
            
    return newly_unlocked

def process_activity_completion(
    user_xp: int, 
    user_level: int, 
    user_badges: List[str], 
    total_activities: int,
    activity_xp_reward: int
) -> dict:
    """
    Core function called when a user finishes an activity.
    Updates XP, Level, and checks for badges.
    """
    new_xp = user_xp + activity_xp_reward
    new_level = calculate_level_from_xp(new_xp)
    
    # We pretend total_activities has already been incremented by 1 in the database before calling this
    new_badges = check_new_badges(new_xp, new_level, total_activities, user_badges)
    
    leveled_up = new_level > user_level
    
    # Return structured results to be saved to DB by the API router
    return {
        "new_xp": new_xp,
        "new_level": new_level,
        "leveled_up": leveled_up,
        "newly_unlocked_badges": new_badges,
        "total_badges": user_badges + [b["id"] for b in new_badges]
    }
