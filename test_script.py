import requests
import json
import time
import subprocess

BASE_URL = "https://52.58.30.77.nip.io/api"
session = requests.Session()

print("1. Registering user...")
resp = session.post(f"{BASE_URL}/auth/register", json={
    "username": "testadmin99",
    "email": "admin99@example.com",
    "password": "testpassword",
    "age": 25,
    "weight_kg": 70,
    "height_cm": 175
})
if resp.status_code == 400 and "already registered" in resp.text:
    print("User already registered")
else:
    print(resp.status_code, resp.text)

print("2. Making user admin via SSH...")
cmd = "ssh -o StrictHostKeyChecking=no -i ~/.ssh/id_ed25519_ecohealth ubuntu@52.58.30.77 \"sudo docker exec ecohealth_db_prod psql -U ecohealth_admin -d ecohealth_production_db -c \\\"UPDATE \\\\\\\"user\\\\\\\" SET is_admin=true WHERE username='testadmin99';\\\"\""
subprocess.run(cmd, shell=True)

print("3. Logging in...")
resp = session.post(f"{BASE_URL}/auth/login", data={"username": "testadmin99", "password": "testpassword"})
token = resp.json()["access_token"]
headers = {"Authorization": f"Bearer {token}"}

print("4. Creating Activity...")
act_payload = {
    "title": "Central Park Run",
    "description": "A nice run in the park",
    "category": "Running",
    "difficulty": 2,
    "latitude": 40.785091,
    "longitude": -73.968285,
    "visibility_state": "publish"
}
resp = session.post(f"{BASE_URL}/admin/activities", json=act_payload, headers=headers)
print("Create Status:", resp.status_code, resp.text)
act_id = resp.json()["id"]

print("5. Updating Activity...")
update_payload = {"difficulty": 3}
resp = session.put(f"{BASE_URL}/admin/activities/{act_id}", json=update_payload, headers=headers)
print("Update Status:", resp.status_code, resp.text)

print("6. Testing Spatial Query (Within 10km of Times Square)...")
# Times Square is ~ 40.7580, -73.9855
resp = session.get(f"{BASE_URL}/activities?lat=40.7580&lng=-73.9855&radius_km=10")
print("Spatial Status:", resp.status_code)
activities = resp.json()
print("Found activities:", len(activities))
for a in activities:
    print(f" - {a['title']} (lat={a['latitude']}, lng={a['longitude']})")

print("7. Testing Spatial Query (Far away - LA)...")
resp = session.get(f"{BASE_URL}/activities?lat=34.0522&lng=-118.2437&radius_km=10")
print("Far Spatial Status:", resp.status_code, "Found:", len(resp.json()))

print("8. Deleting Activity...")
resp = session.delete(f"{BASE_URL}/admin/activities/{act_id}", headers=headers)
print("Delete Status:", resp.status_code, resp.text)

print("ALL TESTS COMPLETED.")
