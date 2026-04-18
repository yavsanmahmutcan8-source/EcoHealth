from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from typing import List

from db.session import get_db
from models.user import User
from models.activity import Activity
from core.security import verify_password, get_password_hash, create_access_token
from api.deps import get_current_user, get_current_active_admin
from api.schemas import UserCreate, UserOut, Token, ActivityCreate, ActivityOut
from services.recommendation import generate_match_scores

router = APIRouter()

@router.get("/activities", response_model=List[ActivityOut])
async def get_all_activities(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Activity))
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
    new_activity = Activity(**activity_in.dict())
    db.add(new_activity)
    await db.commit()
    await db.refresh(new_activity)
    return new_activity
