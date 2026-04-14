from backend.services.gamification import process_activity_completion, calculate_level_from_xp
from backend.services.recommendation import generate_match_scores
from backend.services.geofence import verify_user_presence

# 1. MOCK DATA SETUP
class MockUser:
    def __init__(self, age, weight, height, level, xp, badges):
        self.age = age
        self.weight_kg = weight
        self.height_cm = height
        self.level = level
        self.xp = xp
        self.badges = badges

class MockActivity:
    def __init__(self, id, title, difficulty, lat, lon):
        self.id = id
        self.title = title
        self.difficulty = difficulty
        self.latitude = lat
        self.longitude = lon

# Create a test user
test_user = MockUser(age=25, weight=75, height=180, level=1, xp=0, badges=[])

# Create some test activities
activities = [
    MockActivity(1, "Easy Park Stroll", difficulty=1, lat=50.1, lon=8.6),
    MockActivity(2, "Mountain Hike", difficulty=4, lat=50.2, lon=8.7),
    MockActivity(3, "Moderate Trail", difficulty=3, lat=50.15, lon=8.65)
]

print("--- 🌳 ECOHEALTH LOGIC TEST 🌳 ---")

# 2. TEST RECOMMENDATION ENGINE
print("\n[1] Testing Recommendation Engine...")
recommendations = generate_match_scores(test_user, activities)
for rec in recommendations:
    print(f" > Activity: {rec['title']} | Difficulty: {rec['difficulty']} | Match: {rec['match_score_percentage']}%")

# 3. TEST GAMIFICATION (EARNING XP)
print("\n[2] Testing Gamification & Level Up...")
# Simulate finishing a 300 XP activity
result = process_activity_completion(
    user_xp=test_user.xp,
    user_level=test_user.level,
    user_badges=test_user.badges,
    total_activities=1, # This was our 1st activity
    activity_xp_reward=300
)
print(f" > XP Gained: 300")
print(f" > New Total XP: {result['new_xp']}")
print(f" > New Level: {result['new_level']}")
if result['leveled_up']:
    print(f" > 🎉 LEVEL UP DETECTED!")
if result['newly_unlocked_badges']:
    print(f" > 🎖 NEW BADGES: {[b['name'] for b in result['newly_unlocked_badges']]}")

# 4. TEST GEOFENCING
print("\n[3] Testing Geofencing (Verification)...")
# User says they are at (50.101, 8.601) - very close to Activity #1
verification = verify_user_presence(
    user_lat=50.101, user_lon=8.601, 
    activity_lat=50.1, activity_lon=8.6, 
    require_gps=True
)
print(f" > Status: {'✅ Verified' if verification['verified'] else '❌ Failed'}")
print(f" > Distance: {verification['distance_meters']} meters")
print(f" > Message: {verification['message']}")

print("\n--- TEST COMPLETE ---")
