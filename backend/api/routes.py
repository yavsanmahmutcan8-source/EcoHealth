from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func as sa_func
from typing import List, Optional
import requests
import os
import shutil
from pydantic import BaseModel
from db.session import get_db
from models.user import User
from models.activity import Activity
from models.category import Category
from models.review import Review
from models.badge_definition import BadgeDefinition
from models.completion_log import CompletionLog
from models.notification import Notification, NotificationType
from core.security import verify_password, get_password_hash, create_access_token
from api.deps import get_current_user, get_current_active_admin
from api.schemas import (
    UserCreate, UserOut, Token, ActivityCreate, ActivityOut, AdminUserUpdate, ActivityUpdate,
    ActivityCompletionResult, CategoryCreate, CategoryUpdate, CategoryOut,
    ReviewCreate, ReviewOut, ProfileUpdate,
    BadgeDefinitionCreate, BadgeDefinitionUpdate, BadgeDefinitionOut, NotificationOut
)
from services.recommendation import generate_match_scores
from services.gamification import process_activity_completion
from services.badge_evaluator import evaluate_badges, get_badge_progress

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
    from sqlalchemy import or_
    result = await db.execute(select(User).where(or_(User.username == form_data.username, User.email == form_data.username)))
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
    activity_in: ActivityUpdate,
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
    
    # 3. Process XP + level gamification
    calc_result = process_activity_completion(
        user_xp=current_user.xp,
        user_level=current_user.level,
        user_badges=current_user.badges or [],
        total_activities=current_user.completed_activities_count,
        activity_xp_reward=activity.xp_reward
    )
    
    # 4. Save XP/level progress to DB
    current_user.xp = calc_result["new_xp"]
    current_user.level = calc_result["new_level"]
    
    # 5. Create CompletionLog entry for badge evaluator
    log_entry = CompletionLog(
        user_id=current_user.id,
        activity_id=activity_id,
        category=activity.category or "Unknown"
    )
    db.add(log_entry)
    await db.flush()  # Flush so the log is visible to queries
    
    # 6. Run smart badge evaluator
    completions_result = await db.execute(
        select(CompletionLog).where(CompletionLog.user_id == current_user.id)
    )
    all_completions = completions_result.scalars().all()
    
    review_count_result = await db.execute(
        select(sa_func.count(Review.id)).where(Review.user_id == current_user.id)
    )
    review_count = review_count_result.scalar() or 0
    
    badge_defs_result = await db.execute(select(BadgeDefinition))
    badge_defs = badge_defs_result.scalars().all()
    
    new_badges = evaluate_badges(
        user_xp=current_user.xp,
        user_level=current_user.level,
        owned_badge_ids=current_user.badges or [],
        completions=all_completions,
        review_count=review_count,
        badge_definitions=badge_defs
    )
    
    # 7. Merge badges: old gamification badges + new smart badges
    all_badge_ids = list(set((current_user.badges or []) + [b["id"] for b in new_badges]))
    current_user.badges = all_badge_ids
    
    # 8. Create Notifications
    if calc_result["leveled_up"]:
        notif = Notification(
            user_id=current_user.id,
            type=NotificationType.LEVEL_UP,
            title="Level Up!",
            message=f"Congratulations! You reached Level {calc_result['new_level']}!"
        )
        db.add(notif)
        
    for b in new_badges:
        notif = Notification(
            user_id=current_user.id,
            type=NotificationType.BADGE_EARNED,
            title="Badge Earned!",
            message=f"You earned the '{b['name']}' badge!"
        )
        db.add(notif)
    
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    
    return {
        "new_xp": calc_result["new_xp"],
        "new_level": calc_result["new_level"],
        "leveled_up": calc_result["leveled_up"],
        "newly_unlocked_badges": calc_result["newly_unlocked_badges"] + new_badges,
        "total_badges": all_badge_ids
    }

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

@router.get("/admin/users", response_model=List[UserOut])
async def admin_get_users(
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User))
    return result.scalars().all()

# =============================================
# CATEGORY ENDPOINTS
# =============================================

@router.get("/categories", response_model=List[CategoryOut])
async def get_categories(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Category).order_by(Category.name))
    return result.scalars().all()

@router.post("/admin/categories", response_model=CategoryOut)
async def create_category(
    cat_in: CategoryCreate,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db)
):
    # Check for duplicate name
    existing = await db.execute(select(Category).where(Category.name == cat_in.name))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Category with this name already exists")
    new_cat = Category(**cat_in.dict())
    db.add(new_cat)
    await db.commit()
    await db.refresh(new_cat)
    return new_cat

@router.put("/admin/categories/{category_id}", response_model=CategoryOut)
async def update_category(
    category_id: int,
    cat_in: CategoryUpdate,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Category).where(Category.id == category_id))
    cat = result.scalars().first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    update_data = cat_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(cat, key, value)
    await db.commit()
    await db.refresh(cat)
    return cat

@router.delete("/admin/categories/{category_id}")
async def delete_category(
    category_id: int,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Category).where(Category.id == category_id))
    cat = result.scalars().first()
    if not cat:
        raise HTTPException(status_code=404, detail="Category not found")
    await db.delete(cat)
    await db.commit()
    return {"message": "Category deleted successfully"}

# =============================================
# REVIEW ENDPOINTS
# =============================================

@router.post("/activities/{activity_id}/reviews", response_model=ReviewOut)
async def create_review(
    activity_id: int,
    review_in: ReviewCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Validate rating range
    if not (1 <= review_in.rating <= 5):
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    # Check activity exists
    act_result = await db.execute(select(Activity).where(Activity.id == activity_id))
    if not act_result.scalars().first():
        raise HTTPException(status_code=404, detail="Activity not found")
    
    # Check if user already reviewed
    existing = await db.execute(
        select(Review).where(Review.user_id == current_user.id, Review.activity_id == activity_id)
    )
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="You have already reviewed this activity")
    
    new_review = Review(
        user_id=current_user.id,
        activity_id=activity_id,
        rating=review_in.rating,
        comment=review_in.comment
    )
    db.add(new_review)
    await db.commit()
    await db.refresh(new_review)
    
    # Badge hook: check FIRST_REVIEW badge
    review_count_result = await db.execute(
        select(sa_func.count(Review.id)).where(Review.user_id == current_user.id)
    )
    review_count = review_count_result.scalar() or 0
    if review_count == 1:  # First review ever — evaluate badges
        completions_result = await db.execute(
            select(CompletionLog).where(CompletionLog.user_id == current_user.id)
        )
        all_completions = completions_result.scalars().all()
        badge_defs_result = await db.execute(select(BadgeDefinition))
        badge_defs = badge_defs_result.scalars().all()
        new_badges = evaluate_badges(
            user_xp=current_user.xp,
            user_level=current_user.level,
            owned_badge_ids=current_user.badges or [],
            completions=all_completions,
            review_count=review_count,
            badge_definitions=badge_defs
        )
        if new_badges:
            current_user.badges = list(set((current_user.badges or []) + [b["id"] for b in new_badges]))
            db.add(current_user)
            
            for b in new_badges:
                notif = Notification(
                    user_id=current_user.id,
                    type=NotificationType.BADGE_EARNED,
                    title="Badge Earned!",
                    message=f"You earned the '{b['name']}' badge!"
                )
                db.add(notif)
                
            await db.commit()
    
    return ReviewOut(
        id=new_review.id,
        user_id=new_review.user_id,
        activity_id=new_review.activity_id,
        rating=new_review.rating,
        comment=new_review.comment,
        created_at=new_review.created_at,
        username=current_user.username
    )

@router.get("/activities/{activity_id}/reviews", response_model=List[ReviewOut])
async def get_reviews(
    activity_id: int,
    sort: Optional[str] = Query("date", regex="^(rating|date)$"),
    order: Optional[str] = Query("desc", regex="^(asc|desc)$"),
    db: AsyncSession = Depends(get_db)
):
    query = select(Review, User.username).join(User, Review.user_id == User.id).where(
        Review.activity_id == activity_id
    )
    
    if sort == "rating":
        col = Review.rating
    else:
        col = Review.created_at
    
    if order == "asc":
        query = query.order_by(col.asc())
    else:
        query = query.order_by(col.desc())
    
    result = await db.execute(query)
    rows = result.all()
    
    return [
        ReviewOut(
            id=review.id,
            user_id=review.user_id,
            activity_id=review.activity_id,
            rating=review.rating,
            comment=review.comment,
            created_at=review.created_at,
            username=username
        )
        for review, username in rows
    ]

@router.delete("/reviews/{review_id}")
async def delete_review(
    review_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Review).where(Review.id == review_id))
    review = result.scalars().first()
    if not review:
        raise HTTPException(status_code=404, detail="Review not found")
    # Only the author or an admin can delete
    if review.user_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized to delete this review")
    await db.delete(review)
    await db.commit()
    return {"message": "Review deleted successfully"}

@router.get("/activities/{activity_id}/rating")
async def get_activity_rating(
    activity_id: int,
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(
            sa_func.avg(Review.rating).label("average_rating"),
            sa_func.count(Review.id).label("review_count")
        ).where(Review.activity_id == activity_id)
    )
    row = result.one()
    return {
        "average_rating": round(float(row.average_rating), 1) if row.average_rating else None,
        "review_count": row.review_count or 0
    }

# =============================================
# BADGE ENDPOINTS
# =============================================

@router.get("/badges", response_model=List[BadgeDefinitionOut])
async def get_badges(db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(BadgeDefinition))
    return result.scalars().all()

@router.post("/admin/badges", response_model=BadgeDefinitionOut)
async def create_badge(
    badge_in: BadgeDefinitionCreate,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db)
):
    existing = await db.execute(select(BadgeDefinition).where(BadgeDefinition.id == badge_in.id))
    if existing.scalars().first():
        raise HTTPException(status_code=400, detail="Badge with this ID already exists")
    new_badge = BadgeDefinition(**badge_in.dict())
    db.add(new_badge)
    await db.commit()
    await db.refresh(new_badge)
    return new_badge

@router.put("/admin/badges/{badge_id}", response_model=BadgeDefinitionOut)
async def update_badge(
    badge_id: str,
    badge_in: BadgeDefinitionUpdate,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(BadgeDefinition).where(BadgeDefinition.id == badge_id))
    badge = result.scalars().first()
    if not badge:
        raise HTTPException(status_code=404, detail="Badge not found")
    update_data = badge_in.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(badge, key, value)
    await db.commit()
    await db.refresh(badge)
    return badge

@router.delete("/admin/badges/{badge_id}")
async def delete_badge(
    badge_id: str,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(BadgeDefinition).where(BadgeDefinition.id == badge_id))
    badge = result.scalars().first()
    if not badge:
        raise HTTPException(status_code=404, detail="Badge not found")
    await db.delete(badge)
    await db.commit()
    return {"message": "Badge deleted successfully"}

# =============================================
# BADGE PROGRESS ENDPOINT
# =============================================

@router.get("/users/me/badge-progress")
async def get_my_badge_progress(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    completions_result = await db.execute(
        select(CompletionLog).where(CompletionLog.user_id == current_user.id)
    )
    completions = completions_result.scalars().all()
    
    review_count_result = await db.execute(
        select(sa_func.count(Review.id)).where(Review.user_id == current_user.id)
    )
    review_count = review_count_result.scalar() or 0
    
    badge_defs_result = await db.execute(select(BadgeDefinition))
    badge_defs = badge_defs_result.scalars().all()
    
    progress = get_badge_progress(
        user_xp=current_user.xp,
        user_level=current_user.level,
        completions=completions,
        review_count=review_count,
        badge_definitions=badge_defs
    )
    
    return progress

# =============================================
# PROFILE ENDPOINTS
# =============================================

@router.put("/users/me/profile", response_model=UserOut)
async def update_my_profile(
    profile_in: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    if profile_in.username and profile_in.username != current_user.username:
        existing = await db.execute(select(User).where(User.username == profile_in.username))
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Username already taken")
        current_user.username = profile_in.username
    
    if profile_in.display_name is not None:
        current_user.display_name = profile_in.display_name
    if profile_in.bio is not None:
        current_user.bio = profile_in.bio
    
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user

AVATAR_DIR = "/app/static/avatars"

@router.post("/users/me/avatar", response_model=UserOut)
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    # Validate file
    if file.content_type not in ("image/jpeg", "image/png", "image/webp"):
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, or WebP images are allowed")
    
    contents = await file.read()
    if len(contents) > 2 * 1024 * 1024:  # 2MB limit
        raise HTTPException(status_code=400, detail="File too large (max 2MB)")
    
    os.makedirs(AVATAR_DIR, exist_ok=True)
    ext = file.filename.rsplit('.', 1)[-1] if '.' in file.filename else 'jpg'
    filename = f"{current_user.id}.{ext}"
    filepath = os.path.join(AVATAR_DIR, filename)
    
    with open(filepath, "wb") as f:
        f.write(contents)
    
    current_user.avatar_url = f"/static/avatars/{filename}"
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)
    return current_user

# =============================================
# NOTIFICATION ENDPOINTS
# =============================================

@router.get("/notifications", response_model=List[NotificationOut])
async def get_my_notifications(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id)
        .order_by(Notification.created_at.desc())
        .limit(50)
    )
    return result.scalars().all()

@router.put("/notifications/read-all")
async def mark_all_notifications_read(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Notification)
        .where(Notification.user_id == current_user.id, Notification.is_read == False)
    )
    unread = result.scalars().all()
    for notif in unread:
        notif.is_read = True
    await db.commit()
    return {"message": "All marked as read"}

@router.put("/notifications/{notif_id}/read", response_model=NotificationOut)
async def mark_notification_read(
    notif_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(Notification).where(Notification.id == notif_id))
    notif = result.scalars().first()
    if not notif:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notif.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    
    notif.is_read = True
    await db.commit()
    await db.refresh(notif)
    return notif

