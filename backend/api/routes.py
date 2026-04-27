from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List
import requests
from pydantic import BaseModel
from db.session import get_db
from models.user import User
from models.activity import Activity
from core.security import verify_password, get_password_hash, create_access_token
from api.deps import get_current_user, get_current_active_admin
from api.schemas import UserCreate, UserOut, Token, ActivityCreate, ActivityOut, AdminUserUpdate
from services.recommendation import generate_match_scores
from services.gamification import process_activity_completion
from api.schemas import ActivityCompletionResult

router = APIRouter()

@router.get("/activities", response_model=List[ActivityOut])
async def get_all_activities(
    lat: float = None, 
    lng: float = None, 
    radius_km: float = 10.0, 
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import func
    query = select(Activity)
    
    if lat is not None and lng is not None:
        query = query.where(
            func.ST_DWithin(
                Activity.location, 
                func.ST_GeogFromText(f'SRID=4326;POINT({lng} {lat})'), 
                radius_km * 1000
            )
        )
        
    result = await db.execute(query)
    return result.scalars().all()

@router.post("/auth/register", response_model=UserOut)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == user_in.username))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Username already registered")
        
    hashed_pw = get_password_hash(user_in.password)
    new_user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=hashed_pw,
        age=user_in.age,
        weight_kg=user_in.weight_kg,
        height_cm=user_in.height_cm
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    return new_user

@router.post("/auth/login", response_model=Token)
async def login(form_data: OAuth2PasswordRequestForm = Depends(), db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == form_data.username))
    user = result.scalars().first()
    
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Incorrect username or password")
        
    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

class GoogleAuth(BaseModel):
    credential: str

@router.post("/auth/google", response_model=Token)
async def google_login(payload: GoogleAuth, db: AsyncSession = Depends(get_db)):
    # Since useGoogleLogin in React returns an access_token by default, we fetch user info from Google
    resp = requests.get(
        "https://www.googleapis.com/oauth2/v3/userinfo",
        headers={"Authorization": f"Bearer {payload.credential}"}
    )
    if resp.status_code != 200:
        raise HTTPException(status_code=400, detail="Invalid Google Token")
        
    user_info = resp.json()
    email = user_info['email']
    name = user_info.get('name', '')
    
    # Check if user exists
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    
    if not user:
        # Create Google SSO user without a real password
        username_base = email.split('@')[0]
        # Check if username exists, append a suffix if it does
        username = username_base
        
        user_result = await db.execute(select(User).where(User.username == username))
        if user_result.scalars().first():
            import random
            username = f"{username_base}_{random.randint(1000, 9999)}"

        hashed_pw = get_password_hash("google_sso_managed_password_" + email)
        user = User(
            username=username,
            email=email,
            hashed_password=hashed_pw,
            age=30, # Default values
            weight_kg=70.0,
            height_cm=170.0
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)

    access_token = create_access_token(data={"sub": user.username})
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/users/me", response_model=UserOut)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user

from core.cache import get_redis
import json

@router.get("/dashboard/recommendations")
async def get_dashboard_recommendations(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis = Depends(get_redis)
):
    cache_key = f"dashboard_recs_user_{current_user.id}"
    cached_data = await redis.get(cache_key)
    
    if cached_data:
        # Return cached recommendations if they exist (speeds up dashboard to < 200ms)
        return {"picked_for_you": json.loads(cached_data), "cached": True}

    # If no cache, perform heavy DB lookup and Match Score calculation
    result = await db.execute(select(Activity))
    activities = result.scalars().all()
    
    scored_list = generate_match_scores(current_user, activities)
    
    # Store in Redis for 10 minutes (600 seconds)
    await redis.set(cache_key, json.dumps(scored_list), ex=600)
    
    return {"picked_for_you": scored_list, "cached": False}

@router.post("/admin/activities", response_model=ActivityOut)
async def create_activity(
    activity_in: ActivityCreate, 
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db)
):
    activity_data = activity_in.dict(exclude={"latitude", "longitude"})
    new_activity = Activity(**activity_data)
    new_activity.location = f"SRID=4326;POINT({activity_in.longitude} {activity_in.latitude})"
    db.add(new_activity)
    await db.commit()
    await db.refresh(new_activity)
    return new_activity

@router.put("/admin/activities/{activity_id}", response_model=ActivityOut)
async def update_activity(
    activity_id: int,
    activity_in: ActivityCreate,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Activity).where(Activity.id == activity_id))
    activity = result.scalars().first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
        
    update_data = activity_in.dict(exclude={"latitude", "longitude"}, exclude_unset=True)
    for key, value in update_data.items():
        setattr(activity, key, value)
        
    if activity_in.latitude is not None and activity_in.longitude is not None:
        activity.location = f"SRID=4326;POINT({activity_in.longitude} {activity_in.latitude})"
        
    await db.commit()
    await db.refresh(activity)
    return activity

@router.delete("/admin/activities/{activity_id}")
async def delete_activity(
    activity_id: int,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Activity).where(Activity.id == activity_id))
    activity = result.scalars().first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
        
    await db.delete(activity)
    await db.commit()
    return {"message": "Activity deleted successfully"}

@router.post("/activities/{activity_id}/complete", response_model=ActivityCompletionResult)
async def complete_activity(
    activity_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # 1. Fetch activity
    result = await db.execute(select(Activity).where(Activity.id == activity_id))
    activity = result.scalars().first()
    
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
        
    # 2. Increment user completion count
    current_user.completed_activities_count += 1
    
    # 3. Process gamification
    calc_result = process_activity_completion(
        user_xp=current_user.xp,
        user_level=current_user.level,
        user_badges=current_user.badges,
        total_activities=current_user.completed_activities_count,
        activity_xp_reward=activity.xp_reward
    )
    
    # 4. Save progress to DB
    current_user.xp = calc_result["new_xp"]
    current_user.level = calc_result["new_level"]
    current_user.badges = calc_result["total_badges"]
    
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    
    return calc_result

@router.put("/admin/users/{user_id}", response_model=UserOut)
async def admin_update_user(
    user_id: int,
    user_in: AdminUserUpdate,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    update_data = user_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(user, key, value)
        
    await db.commit()
    await db.refresh(user)
    return user
