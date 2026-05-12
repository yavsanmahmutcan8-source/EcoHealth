from fastapi import APIRouter, Depends, HTTPException, status, Query, UploadFile, File
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func as sa_func
from sqlalchemy.orm import selectinload
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
from models.activity_feedback import ActivityFeedback
from models.report import ActivityReport, UserReport, ReportStatus
from datetime import datetime, timezone
from core.security import verify_password, get_password_hash, create_access_token
from api.deps import get_current_user, get_current_active_admin
from api.schemas import (
    UserCreate, UserOut, Token, ActivityCreate, ActivityOut, AdminUserUpdate, ActivityUpdate,
    ActivityCompletionBody, ActivityCompletionResult, CategoryCreate, CategoryUpdate, CategoryOut,
    ReviewCreate, ReviewOut, ProfileUpdate, InterestsUpdate,
    BadgeDefinitionCreate, BadgeDefinitionUpdate, BadgeDefinitionOut, NotificationOut,
    PublicUserOut, UserSearchOut,
    ActivityFeedbackCreate, ActivityFeedbackOut, BulkActivityAction, BulkActionResult,
    ActivityReportCreate, UserReportCreate, ReportResolve,
    ActivityReportOut, UserReportOut, ReportedActivitySummary, ReportedUserSummary,
    AdminWarnBody, AdminBanBody,
)
from services.recommendation import generate_match_scores
from services.gamification import process_activity_completion
from services.badge_evaluator import evaluate_badges, get_badge_progress
from services.calories import calculate_calories

router = APIRouter()

@router.get("/activities", response_model=List[ActivityOut])
async def get_all_activities(
    lat: float = None,
    lng: float = None,
    radius_km: float = 10.0,
    db: AsyncSession = Depends(get_db)
):
    from sqlalchemy import func
    query = select(Activity).options(selectinload(Activity.creator))

    # Public listing only shows published activities
    query = query.where(Activity.visibility_state == "publish")

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


@router.post("/activities", response_model=ActivityOut)
async def create_user_activity(
    activity_in: ActivityCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db)
):
    """Authenticated users (any role) can submit new routes. Non-admin submissions go to 'draft' and require admin approval."""
    activity_data = activity_in.dict(exclude={"latitude", "longitude"})
    # Admins publish immediately, regular users submit for review
    activity_data["visibility_state"] = "publish" if current_user.is_admin else "draft"
    # Non-admin submissions enter the review pipeline as 'pending_review'.
    if not current_user.is_admin:
        activity_data["submission_status"] = "pending_review"
    new_activity = Activity(**activity_data, creator_id=current_user.id)
    new_activity.location = f"SRID=4326;POINT({activity_in.longitude} {activity_in.latitude})"
    db.add(new_activity)
    await db.commit()
    await db.refresh(new_activity)

    # Re-fetch with creator eager-loaded so the response includes creator_username/avatar
    result = await db.execute(
        select(Activity).options(selectinload(Activity.creator)).where(Activity.id == new_activity.id)
    )
    activity = result.scalars().first()

    # Evaluate ACTIVITIES_CREATED badges for the creator
    await _evaluate_creator_badges(current_user, db)

    return activity

@router.post("/auth/register", response_model=UserOut)
async def register(user_in: UserCreate, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == user_in.username))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Username already registered")
        
    # Also block duplicate emails to give a clear error
    email_exists = await db.execute(select(User).where(User.email == user_in.email))
    if email_exists.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")

    hashed_pw = get_password_hash(user_in.password)
    new_user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=hashed_pw,
        age=user_in.age,
        sex=user_in.sex,
        weight_kg=user_in.weight_kg,
        height_cm=user_in.height_cm,
        fitness_level=user_in.fitness_level,
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
    if getattr(user, "is_banned", False):
        raise HTTPException(status_code=403, detail="This account has been banned.")

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
    result = await db.execute(select(Activity).options(selectinload(Activity.creator)))
    activities = result.scalars().all()

    # Load completed activity IDs from CompletionLog for repeat-penalty
    completed_result = await db.execute(
        select(CompletionLog.activity_id).where(CompletionLog.user_id == current_user.id)
    )
    completed_ids = [row[0] for row in completed_result.all()]

    scored_list = generate_match_scores(current_user, activities, completed_ids)

    # Store in Redis for 10 minutes (600 seconds)
    await redis.set(cache_key, json.dumps(scored_list), ex=600)

    return {"picked_for_you": scored_list, "cached": False}

async def _evaluate_creator_badges(user: User, db: AsyncSession):
    """Award ACTIVITIES_CREATED / CREATOR_COMPLETIONS badges if conditions are now satisfied."""
    activities_created_result = await db.execute(
        select(sa_func.count(Activity.id)).where(Activity.creator_id == user.id)
    )
    activities_created = activities_created_result.scalar() or 0

    completions_result = await db.execute(
        select(CompletionLog).where(CompletionLog.user_id == user.id)
    )
    all_completions = completions_result.scalars().all()

    review_count_result = await db.execute(
        select(sa_func.count(Review.id)).where(Review.user_id == user.id)
    )
    review_count = review_count_result.scalar() or 0

    badge_defs_result = await db.execute(select(BadgeDefinition))
    badge_defs = badge_defs_result.scalars().all()

    new_badges = evaluate_badges(
        user_xp=user.xp,
        user_level=user.level,
        owned_badge_ids=user.badges or [],
        completions=all_completions,
        review_count=review_count,
        badge_definitions=badge_defs,
        activities_created_count=activities_created,
        creator_completions_count=user.creator_completions_count or 0,
    )
    if new_badges:
        user.badges = list(set((user.badges or []) + [b["id"] for b in new_badges]))
        for b in new_badges:
            db.add(Notification(
                user_id=user.id,
                type=NotificationType.BADGE_EARNED,
                title="Badge Earned!",
                message=f"You earned the '{b['name']}' badge!"
            ))
        db.add(user)
        await db.commit()
    return new_badges


@router.get("/admin/activities", response_model=List[ActivityOut])
async def admin_list_activities(
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
    visibility_state: Optional[str] = None,
    submission_status: Optional[str] = None,
):
    """Admin view of ALL activities (drafts + published). Optional filter by
    visibility_state and/or submission_status."""
    query = select(Activity).options(selectinload(Activity.creator))
    if visibility_state:
        query = query.where(Activity.visibility_state == visibility_state)
    if submission_status:
        query = query.where(Activity.submission_status == submission_status)
    result = await db.execute(query.order_by(Activity.id.desc()))
    activities = result.scalars().all()

    # Attach report_count for each activity (single grouped query)
    if activities:
        ids = [a.id for a in activities]
        counts_q = (
            select(ActivityReport.activity_id, sa_func.count(ActivityReport.id))
            .where(ActivityReport.activity_id.in_(ids))
            .group_by(ActivityReport.activity_id)
        )
        counts = {row[0]: row[1] for row in (await db.execute(counts_q)).all()}
        for a in activities:
            # report_count is a column on the schema but not the model — Pydantic
            # picks it up from the attribute we set here.
            setattr(a, "report_count", counts.get(a.id, 0))
    return activities


@router.post("/admin/activities", response_model=ActivityOut)
async def create_activity(
    activity_in: ActivityCreate,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db)
):
    activity_data = activity_in.dict(exclude={"latitude", "longitude"})
    new_activity = Activity(**activity_data, creator_id=current_admin.id)
    new_activity.location = f"SRID=4326;POINT({activity_in.longitude} {activity_in.latitude})"
    db.add(new_activity)
    await db.commit()
    await db.refresh(new_activity)
    result = await db.execute(
        select(Activity).options(selectinload(Activity.creator)).where(Activity.id == new_activity.id)
    )
    return result.scalars().first()

@router.put("/admin/activities/{activity_id}", response_model=ActivityOut)
async def update_activity(
    activity_id: int,
    activity_in: ActivityUpdate,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(
        select(Activity).options(selectinload(Activity.creator)).where(Activity.id == activity_id)
    )
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
    body: Optional[ActivityCompletionBody] = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis = Depends(get_redis)
):
    # 1. Fetch activity (eager-load creator for XP bonus)
    result = await db.execute(
        select(Activity).options(selectinload(Activity.creator)).where(Activity.id == activity_id)
    )
    activity = result.scalars().first()

    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    # 2. Increment user completion count (or 0 guard for legacy NULL rows)
    current_user.completed_activities_count = (current_user.completed_activities_count or 0) + 1

    # 2b. Look up category to decide distance/time semantics
    cat_result = await db.execute(select(Category).where(Category.name == activity.category))
    category_obj = cat_result.scalars().first()
    activity_met = category_obj.calorie_met if category_obj else None
    requires_distance = bool(category_obj.requires_distance) if category_obj else True

    # 2c. Distance (only meaningful for distance-based categories). Loop activities
    # multiply per-loop distance by lap_count.
    lap_count = max(1, int(activity.lap_count or 1))
    single_distance = float(activity.distance_km or 0)
    distance_logged_km = single_distance * lap_count if requires_distance else 0.0
    current_user.total_distance_km = float(current_user.total_distance_km or 0) + distance_logged_km

    # 2d. Determine duration. Real elapsed session time (from frontend) takes
    # priority; otherwise fall back to activity.estimated_duration_minutes.
    if body and body.duration_seconds and body.duration_seconds > 0:
        duration_minutes = body.duration_seconds / 60.0
    else:
        # Estimated duration is per-lap; scale by lap_count for the calorie estimate.
        duration_minutes = (activity.estimated_duration_minutes or 60) * lap_count

    kcal_burned = calculate_calories(
        met=activity_met,
        weight_kg=current_user.weight_kg,
        duration_minutes=duration_minutes,
        sex=current_user.sex,
        age=current_user.age,
    )
    current_user.total_calories_burned = float(current_user.total_calories_burned or 0) + kcal_burned

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
    
    activities_created_result = await db.execute(
        select(sa_func.count(Activity.id)).where(Activity.creator_id == current_user.id)
    )
    activities_created = activities_created_result.scalar() or 0

    new_badges = evaluate_badges(
        user_xp=current_user.xp,
        user_level=current_user.level,
        owned_badge_ids=current_user.badges or [],
        completions=all_completions,
        review_count=review_count,
        badge_definitions=badge_defs,
        activities_created_count=activities_created,
        creator_completions_count=current_user.creator_completions_count or 0,
    )

    # 7. Merge badges: old gamification badges + new smart badges
    all_badge_ids = list(set((current_user.badges or []) + [b["id"] for b in new_badges]))
    current_user.badges = all_badge_ids

    # 7b. Reward the creator (if different user) with 10% XP bonus + completion count bump
    creator_to_evaluate = None
    if activity.creator_id and activity.creator_id != current_user.id and activity.creator is not None:
        creator = activity.creator
        bonus_xp = max(1, int((activity.xp_reward or 0) * 0.1))
        creator.xp = (creator.xp or 0) + bonus_xp
        creator.creator_completions_count = (creator.creator_completions_count or 0) + 1
        db.add(creator)
        creator_to_evaluate = creator
    
    # 8. Create Notifications
    # 8a. Always record an "Activity Completed" notification so the user sees
    # a feed entry for each finished session (alongside any badge/level pings).
    activity_title = activity.title or "your activity"
    completion_msg_parts = [f"You completed '{activity_title}'"]
    if kcal_burned and kcal_burned > 0:
        completion_msg_parts.append(f"— burned {int(round(kcal_burned))} kcal")
    if distance_logged_km and distance_logged_km > 0:
        completion_msg_parts.append(f"over {distance_logged_km:.2f} km")
    db.add(Notification(
        user_id=current_user.id,
        type=NotificationType.ACTIVITY_COMPLETED,
        title="Activity Completed!",
        message=" ".join(completion_msg_parts) + ".",
    ))

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

    # 7c. After commit, run badge evaluation for the creator (if any)
    if creator_to_evaluate is not None:
        await _evaluate_creator_badges(creator_to_evaluate, db)
        try:
            await redis.delete(f"dashboard_recs_user_{creator_to_evaluate.id}")
        except Exception:
            pass

    # Invalidate dashboard cache: completion changes recommendations (repeat penalty + creator XP)
    try:
        await redis.delete(f"dashboard_recs_user_{current_user.id}")
    except Exception:
        pass

    return {
        "new_xp": calc_result["new_xp"],
        "new_level": calc_result["new_level"],
        "leveled_up": calc_result["leveled_up"],
        "newly_unlocked_badges": calc_result["newly_unlocked_badges"] + new_badges,
        "total_badges": all_badge_ids,
        "kcal_burned": kcal_burned,
        "distance_logged_km": distance_logged_km,
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

@router.get("/activities/{activity_id}", response_model=ActivityOut)
async def get_activity_detail(
    activity_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Public single-activity fetch. Used by creator edit flow to prefill
    the route designer with the saved values."""
    result = await db.execute(
        select(Activity).options(selectinload(Activity.creator)).where(Activity.id == activity_id)
    )
    activity = result.scalars().first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    return activity


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

    activities_created_result = await db.execute(
        select(sa_func.count(Activity.id)).where(Activity.creator_id == current_user.id)
    )
    activities_created = activities_created_result.scalar() or 0

    badge_defs_result = await db.execute(select(BadgeDefinition))
    badge_defs = badge_defs_result.scalars().all()

    progress = get_badge_progress(
        user_xp=current_user.xp,
        user_level=current_user.level,
        completions=completions,
        review_count=review_count,
        badge_definitions=badge_defs,
        activities_created_count=activities_created,
        creator_completions_count=current_user.creator_completions_count or 0,
    )

    return progress

# =============================================
# PROFILE ENDPOINTS
# =============================================

@router.put("/users/me/profile", response_model=UserOut)
async def update_my_profile(
    profile_in: ProfileUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis = Depends(get_redis)
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

    # Health & fitness fields
    health_changed = False
    if profile_in.age is not None:
        current_user.age = profile_in.age
        health_changed = True
    if profile_in.sex is not None:
        current_user.sex = profile_in.sex
        health_changed = True
    if profile_in.weight_kg is not None:
        current_user.weight_kg = profile_in.weight_kg
        health_changed = True
    if profile_in.height_cm is not None:
        current_user.height_cm = profile_in.height_cm
        health_changed = True
    if profile_in.fitness_level is not None:
        valid_levels = {"beginner", "intermediate", "advanced", "athlete"}
        if profile_in.fitness_level not in valid_levels:
            raise HTTPException(status_code=400, detail="Invalid fitness_level")
        current_user.fitness_level = profile_in.fitness_level
        health_changed = True

    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)

    # Invalidate dashboard recommendations cache when health data changes
    if health_changed:
        try:
            await redis.delete(f"dashboard_recs_user_{current_user.id}")
        except Exception:
            pass

    return current_user


@router.put("/users/me/interests", response_model=UserOut)
async def update_my_interests(
    interests_in: InterestsUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    redis = Depends(get_redis)
):
    # Validate that submitted categories actually exist
    if interests_in.favorite_categories:
        cats_result = await db.execute(
            select(Category.name).where(Category.name.in_(interests_in.favorite_categories))
        )
        valid_names = {row[0] for row in cats_result.all()}
        unknown = [c for c in interests_in.favorite_categories if c not in valid_names]
        if unknown:
            raise HTTPException(status_code=400, detail=f"Unknown categories: {unknown}")

    current_user.favorite_categories = list(interests_in.favorite_categories)
    current_user.onboarding_complete = True
    db.add(current_user)
    await db.commit()
    await db.refresh(current_user)

    try:
        await redis.delete(f"dashboard_recs_user_{current_user.id}")
    except Exception:
        pass

    return current_user

# =============================================
# PUBLIC PROFILE & SEARCH (Phase 13)
# =============================================

@router.get("/users/search", response_model=List[UserSearchOut])
async def search_users(
    q: str = Query(..., min_length=1, max_length=64),
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    pattern = f"%{q.strip()}%"
    result = await db.execute(
        select(User)
        .where(
            sa_func.lower(User.username).ilike(sa_func.lower(pattern))
            | (User.display_name.is_not(None) & sa_func.lower(User.display_name).ilike(sa_func.lower(pattern)))
        )
        .order_by(User.username)
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/users/{username}", response_model=PublicUserOut)
async def get_public_profile(username: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.username == username))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    activities_created_result = await db.execute(
        select(sa_func.count(Activity.id)).where(Activity.creator_id == user.id)
    )
    activities_created = activities_created_result.scalar() or 0

    activities_completed_result = await db.execute(
        select(sa_func.count(CompletionLog.id)).where(CompletionLog.user_id == user.id)
    )
    activities_completed = activities_completed_result.scalar() or 0

    reviews_written_result = await db.execute(
        select(sa_func.count(Review.id)).where(Review.user_id == user.id)
    )
    reviews_written = reviews_written_result.scalar() or 0

    return PublicUserOut(
        id=user.id,
        username=user.username,
        display_name=user.display_name,
        bio=user.bio,
        avatar_url=user.avatar_url,
        level=user.level,
        xp=user.xp,
        badges=user.badges or [],
        favorite_categories=user.favorite_categories or [],
        activities_created=activities_created,
        activities_completed=activities_completed,
        reviews_written=reviews_written,
    )


@router.get("/users/{username}/activities")
async def get_user_completed_activities(username: str, db: AsyncSession = Depends(get_db)):
    user_result = await db.execute(select(User).where(User.username == username))
    user = user_result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    log_result = await db.execute(
        select(CompletionLog).where(CompletionLog.user_id == user.id).order_by(CompletionLog.completed_at.desc()).limit(50)
    )
    logs = log_result.scalars().all()
    activity_ids = [log.activity_id for log in logs]
    if not activity_ids:
        return []

    act_result = await db.execute(
        select(Activity).options(selectinload(Activity.creator)).where(Activity.id.in_(activity_ids))
    )
    activities = {a.id: a for a in act_result.scalars().all()}

    out = []
    for log in logs:
        a = activities.get(log.activity_id)
        if not a:
            continue
        out.append({
            "id": a.id,
            "title": a.title,
            "category": a.category,
            "difficulty": a.difficulty,
            "xp_reward": a.xp_reward,
            "completed_at": log.completed_at.isoformat() if log.completed_at else None,
        })
    return out


@router.get("/users/{username}/created-activities", response_model=List[ActivityOut])
async def get_user_created_activities(username: str, db: AsyncSession = Depends(get_db)):
    user_result = await db.execute(select(User).where(User.username == username))
    user = user_result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    result = await db.execute(
        select(Activity)
        .options(selectinload(Activity.creator))
        .where(Activity.creator_id == user.id, Activity.visibility_state == "publish")
        .order_by(Activity.id.desc())
    )
    return result.scalars().all()


@router.get("/users/{username}/reviews", response_model=List[ReviewOut])
async def get_user_reviews(username: str, db: AsyncSession = Depends(get_db)):
    user_result = await db.execute(select(User).where(User.username == username))
    user = user_result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    result = await db.execute(
        select(Review).where(Review.user_id == user.id).order_by(Review.created_at.desc())
    )
    rows = result.scalars().all()
    return [
        ReviewOut(
            id=r.id,
            user_id=r.user_id,
            activity_id=r.activity_id,
            rating=r.rating,
            comment=r.comment,
            created_at=r.created_at,
            username=user.username,
        )
        for r in rows
    ]


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


# ============================================================================
# Phase 15: bulk admin actions, review-feedback loop, reports + moderation
# ============================================================================

# ---------- Bulk admin actions on activities --------------------------------

@router.post("/admin/activities/bulk", response_model=BulkActionResult)
async def admin_bulk_activity_action(
    body: BulkActivityAction,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
):
    """Bulk publish / draft / delete a set of activities by id."""
    if not body.ids:
        return {"affected": 0, "action": body.action}
    action = (body.action or "").lower()

    if action == "delete":
        result = await db.execute(select(Activity).where(Activity.id.in_(body.ids)))
        rows = result.scalars().all()
        for a in rows:
            await db.delete(a)
        await db.commit()
        return {"affected": len(rows), "action": action}

    if action in ("publish", "draft"):
        new_state = "publish" if action == "publish" else "draft"
        result = await db.execute(select(Activity).where(Activity.id.in_(body.ids)))
        rows = result.scalars().all()
        for a in rows:
            a.visibility_state = new_state
            # Publishing clears any pending review state.
            if new_state == "publish":
                a.submission_status = None
        await db.commit()
        return {"affected": len(rows), "action": action}

    raise HTTPException(status_code=400, detail="Unknown bulk action")


# ---------- Activity feedback (admin -> creator) ---------------------------

@router.post("/admin/activities/{activity_id}/feedback", response_model=ActivityFeedbackOut)
async def admin_send_activity_feedback(
    activity_id: int,
    body: ActivityFeedbackCreate,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
):
    """Admin posts a feedback message on an activity. The activity is moved
    to 'changes_requested' state and the creator gets an in-app notification."""
    result = await db.execute(
        select(Activity).options(selectinload(Activity.creator)).where(Activity.id == activity_id)
    )
    activity = result.scalars().first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    fb = ActivityFeedback(
        activity_id=activity_id,
        admin_id=current_admin.id,
        message=body.message.strip(),
    )
    db.add(fb)

    # Mark the activity so the creator sees it needs changes.
    activity.submission_status = "changes_requested"
    # Force back to draft so it's not publicly visible while changes are pending.
    activity.visibility_state = "draft"

    if activity.creator_id and activity.creator_id != current_admin.id:
        db.add(Notification(
            user_id=activity.creator_id,
            type=NotificationType.ACTIVITY_FEEDBACK,
            title="Activity feedback received",
            message=f"Admin left feedback on '{activity.title}': {body.message.strip()[:160]}",
        ))

    await db.commit()
    await db.refresh(fb)
    return {
        "id": fb.id,
        "activity_id": fb.activity_id,
        "admin_id": fb.admin_id,
        "admin_username": current_admin.username,
        "message": fb.message,
        "created_at": fb.created_at,
    }


@router.get("/activities/{activity_id}/feedback", response_model=List[ActivityFeedbackOut])
async def list_activity_feedback(
    activity_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Creator (or admin) reads feedback messages on an activity."""
    act_result = await db.execute(select(Activity).where(Activity.id == activity_id))
    activity = act_result.scalars().first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    if not current_user.is_admin and activity.creator_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    fb_result = await db.execute(
        select(ActivityFeedback)
        .where(ActivityFeedback.activity_id == activity_id)
        .order_by(ActivityFeedback.created_at.desc())
    )
    rows = fb_result.scalars().all()

    # Hydrate admin usernames in one extra query
    admin_ids = list({r.admin_id for r in rows})
    admins_map = {}
    if admin_ids:
        a_result = await db.execute(select(User).where(User.id.in_(admin_ids)))
        admins_map = {u.id: u.username for u in a_result.scalars().all()}

    return [
        {
            "id": r.id,
            "activity_id": r.activity_id,
            "admin_id": r.admin_id,
            "admin_username": admins_map.get(r.admin_id),
            "message": r.message,
            "created_at": r.created_at,
        }
        for r in rows
    ]


@router.get("/users/me/activities", response_model=List[ActivityOut])
async def list_my_activities(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Creator-facing list of every activity I created, regardless of
    visibility_state/submission_status. Used to surface 'changes requested'
    items on the dashboard."""
    q = (
        select(Activity)
        .options(selectinload(Activity.creator))
        .where(Activity.creator_id == current_user.id)
        .order_by(Activity.id.desc())
    )
    rows = (await db.execute(q)).scalars().all()
    return rows


@router.put("/activities/{activity_id}", response_model=ActivityOut)
async def update_my_activity(
    activity_id: int,
    activity_in: ActivityUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Creator updates their own activity. Non-admin callers cannot change
    visibility_state/submission_status directly — those are managed by the
    review pipeline (resubmit / admin feedback). Editing automatically flips
    the activity back to 'pending_review' so the admin sees the new version."""
    result = await db.execute(
        select(Activity).options(selectinload(Activity.creator)).where(Activity.id == activity_id)
    )
    activity = result.scalars().first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    if activity.creator_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    update_data = activity_in.dict(exclude={"latitude", "longitude"}, exclude_unset=True)
    # Strip fields non-admins shouldn't be able to set directly.
    if not current_user.is_admin:
        update_data.pop("visibility_state", None)
        update_data.pop("submission_status", None)
    for key, value in update_data.items():
        setattr(activity, key, value)

    if activity_in.latitude is not None and activity_in.longitude is not None:
        activity.location = f"SRID=4326;POINT({activity_in.longitude} {activity_in.latitude})"

    # Editing an activity that was awaiting changes re-enters the review queue.
    if not current_user.is_admin:
        activity.submission_status = "pending_review"
        activity.visibility_state = "draft"

    await db.commit()
    await db.refresh(activity)
    return activity


@router.post("/activities/{activity_id}/resubmit", response_model=ActivityOut)
async def resubmit_activity_for_review(
    activity_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Creator marks their activity as ready for re-review after addressing
    admin feedback. Flips submission_status back to 'pending_review'."""
    result = await db.execute(
        select(Activity).options(selectinload(Activity.creator)).where(Activity.id == activity_id)
    )
    activity = result.scalars().first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    if activity.creator_id != current_user.id and not current_user.is_admin:
        raise HTTPException(status_code=403, detail="Not authorized")

    activity.submission_status = "pending_review"
    activity.visibility_state = "draft"
    await db.commit()
    await db.refresh(activity)
    return activity


# ---------- User-facing report endpoints -----------------------------------

VALID_REPORT_REASONS = {
    "dangerous_route", "out_of_date", "does_not_exist",
    "spam", "offensive_content", "harassment", "other",
}


@router.post("/reports/activity")
async def report_activity(
    body: ActivityReportCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    act_result = await db.execute(select(Activity).where(Activity.id == body.activity_id))
    activity = act_result.scalars().first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")
    if body.reason not in VALID_REPORT_REASONS:
        raise HTTPException(status_code=400, detail="Invalid report reason")

    # Prevent the same user spamming duplicate reports against the same
    # activity — only one OPEN report per (reporter, activity).
    dup = await db.execute(
        select(ActivityReport).where(
            ActivityReport.reporter_id == current_user.id,
            ActivityReport.activity_id == body.activity_id,
            ActivityReport.status.in_([ReportStatus.PENDING, ReportStatus.WARNED]),
        )
    )
    if dup.scalars().first():
        raise HTTPException(status_code=409, detail="You already reported this activity")

    db.add(ActivityReport(
        reporter_id=current_user.id,
        activity_id=body.activity_id,
        reason=body.reason,
        details=(body.details or "").strip() or None,
    ))
    await db.commit()
    return {"message": "Report submitted"}


@router.post("/reports/user")
async def report_user(
    body: UserReportCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if body.reported_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot report yourself")
    if body.reason not in VALID_REPORT_REASONS:
        raise HTTPException(status_code=400, detail="Invalid report reason")
    user_result = await db.execute(select(User).where(User.id == body.reported_user_id))
    target = user_result.scalars().first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    dup = await db.execute(
        select(UserReport).where(
            UserReport.reporter_id == current_user.id,
            UserReport.reported_user_id == body.reported_user_id,
            UserReport.status.in_([ReportStatus.PENDING, ReportStatus.WARNED]),
        )
    )
    if dup.scalars().first():
        raise HTTPException(status_code=409, detail="You already reported this user")

    db.add(UserReport(
        reporter_id=current_user.id,
        reported_user_id=body.reported_user_id,
        reason=body.reason,
        details=(body.details or "").strip() or None,
    ))
    await db.commit()
    return {"message": "Report submitted"}


# ---------- Admin report dashboards ----------------------------------------

@router.get("/admin/reports/activities", response_model=List[ReportedActivitySummary])
async def admin_reported_activities(
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
):
    """Summary view: one row per reported activity, sorted by report count desc."""
    q = (
        select(
            ActivityReport.activity_id,
            Activity.title,
            User.username.label("creator_username"),
            Activity.visibility_state,
            sa_func.count(ActivityReport.id).label("report_count"),
            sa_func.count(sa_func.nullif(ActivityReport.status != ReportStatus.PENDING, True)).label("pending_count"),
            sa_func.max(ActivityReport.created_at).label("latest_report_at"),
        )
        .join(Activity, Activity.id == ActivityReport.activity_id)
        .join(User, User.id == Activity.creator_id, isouter=True)
        .group_by(ActivityReport.activity_id, Activity.title, User.username, Activity.visibility_state)
        .order_by(sa_func.count(ActivityReport.id).desc(), sa_func.max(ActivityReport.created_at).desc())
    )
    rows = (await db.execute(q)).all()
    return [
        {
            "activity_id": r.activity_id,
            "title": r.title,
            "creator_username": r.creator_username,
            "visibility_state": r.visibility_state,
            "report_count": r.report_count or 0,
            "pending_count": r.pending_count or 0,
            "latest_report_at": r.latest_report_at,
        }
        for r in rows
    ]


@router.get("/admin/reports/users", response_model=List[ReportedUserSummary])
async def admin_reported_users(
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(
            UserReport.reported_user_id,
            User.username,
            User.display_name,
            User.is_banned,
            sa_func.count(UserReport.id).label("report_count"),
            sa_func.count(sa_func.nullif(UserReport.status != ReportStatus.PENDING, True)).label("pending_count"),
            sa_func.max(UserReport.created_at).label("latest_report_at"),
        )
        .join(User, User.id == UserReport.reported_user_id)
        .group_by(UserReport.reported_user_id, User.username, User.display_name, User.is_banned)
        .order_by(sa_func.count(UserReport.id).desc(), sa_func.max(UserReport.created_at).desc())
    )
    rows = (await db.execute(q)).all()
    return [
        {
            "user_id": r.reported_user_id,
            "username": r.username,
            "display_name": r.display_name,
            "is_banned": bool(r.is_banned),
            "report_count": r.report_count or 0,
            "pending_count": r.pending_count or 0,
            "latest_report_at": r.latest_report_at,
        }
        for r in rows
    ]


@router.get("/admin/reports/activities/{activity_id}", response_model=List[ActivityReportOut])
async def admin_activity_report_detail(
    activity_id: int,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
):
    q = (
        select(ActivityReport, User.username, Activity.title)
        .join(User, User.id == ActivityReport.reporter_id)
        .join(Activity, Activity.id == ActivityReport.activity_id)
        .where(ActivityReport.activity_id == activity_id)
        .order_by(ActivityReport.created_at.desc())
    )
    rows = (await db.execute(q)).all()
    return [
        {
            "id": r.ActivityReport.id,
            "reporter_id": r.ActivityReport.reporter_id,
            "reporter_username": r.username,
            "activity_id": r.ActivityReport.activity_id,
            "activity_title": r.title,
            "reason": r.ActivityReport.reason,
            "details": r.ActivityReport.details,
            "status": r.ActivityReport.status.value if hasattr(r.ActivityReport.status, "value") else str(r.ActivityReport.status),
            "created_at": r.ActivityReport.created_at,
            "resolved_at": r.ActivityReport.resolved_at,
            "resolution_note": r.ActivityReport.resolution_note,
        }
        for r in rows
    ]


@router.get("/admin/reports/users/{user_id}", response_model=List[UserReportOut])
async def admin_user_report_detail(
    user_id: int,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
):
    reporter_alias = sa_func.coalesce  # placeholder; use plain join
    from sqlalchemy.orm import aliased
    Reporter = aliased(User)
    Target = aliased(User)
    q = (
        select(UserReport, Reporter.username.label("reporter_username"), Target.username.label("reported_username"))
        .join(Reporter, Reporter.id == UserReport.reporter_id)
        .join(Target, Target.id == UserReport.reported_user_id)
        .where(UserReport.reported_user_id == user_id)
        .order_by(UserReport.created_at.desc())
    )
    rows = (await db.execute(q)).all()
    return [
        {
            "id": r.UserReport.id,
            "reporter_id": r.UserReport.reporter_id,
            "reporter_username": r.reporter_username,
            "reported_user_id": r.UserReport.reported_user_id,
            "reported_username": r.reported_username,
            "reason": r.UserReport.reason,
            "details": r.UserReport.details,
            "status": r.UserReport.status.value if hasattr(r.UserReport.status, "value") else str(r.UserReport.status),
            "created_at": r.UserReport.created_at,
            "resolved_at": r.UserReport.resolved_at,
            "resolution_note": r.UserReport.resolution_note,
        }
        for r in rows
    ]


# ---------- Admin report resolution + moderation ---------------------------

def _now_utc():
    return datetime.now(timezone.utc)


async def _close_activity_reports(activity_id: int, status_value: ReportStatus, note: Optional[str], admin_id: int, db: AsyncSession):
    rows = (await db.execute(
        select(ActivityReport).where(
            ActivityReport.activity_id == activity_id,
            ActivityReport.status.in_([ReportStatus.PENDING, ReportStatus.WARNED]),
        )
    )).scalars().all()
    for r in rows:
        r.status = status_value
        r.resolved_at = _now_utc()
        r.resolved_by_id = admin_id
        if note:
            r.resolution_note = note


async def _close_user_reports(user_id: int, status_value: ReportStatus, note: Optional[str], admin_id: int, db: AsyncSession):
    rows = (await db.execute(
        select(UserReport).where(
            UserReport.reported_user_id == user_id,
            UserReport.status.in_([ReportStatus.PENDING, ReportStatus.WARNED]),
        )
    )).scalars().all()
    for r in rows:
        r.status = status_value
        r.resolved_at = _now_utc()
        r.resolved_by_id = admin_id
        if note:
            r.resolution_note = note


@router.post("/admin/reports/activities/{activity_id}/resolve")
async def admin_resolve_activity_reports(
    activity_id: int,
    body: ReportResolve,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
):
    """Resolve all pending reports for an activity. Optionally unpublish
    or delete the activity in the same call."""
    act_result = await db.execute(select(Activity).where(Activity.id == activity_id))
    activity = act_result.scalars().first()
    if not activity:
        raise HTTPException(status_code=404, detail="Activity not found")

    action = (body.action or "").lower()
    if action == "dismiss":
        await _close_activity_reports(activity_id, ReportStatus.DISMISSED, body.note, current_admin.id, db)
    elif action == "unpublish":
        activity.visibility_state = "draft"
        await _close_activity_reports(activity_id, ReportStatus.RESOLVED, body.note, current_admin.id, db)
        # Optionally notify the creator
        if activity.creator_id and activity.creator_id != current_admin.id:
            db.add(Notification(
                user_id=activity.creator_id,
                type=NotificationType.ACTIVITY_FEEDBACK,
                title="Activity unpublished",
                message=(body.note or "Your activity was unpublished after community reports.")[:240],
            ))
    elif action == "delete":
        await db.delete(activity)
    elif action == "resolved":
        # No content change, just mark all reports closed
        await _close_activity_reports(activity_id, ReportStatus.RESOLVED, body.note, current_admin.id, db)
    else:
        raise HTTPException(status_code=400, detail="Unknown action")

    await db.commit()
    return {"message": "Reports updated", "action": action}


@router.post("/admin/users/{user_id}/warn")
async def admin_warn_user(
    user_id: int,
    body: AdminWarnBody,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
):
    """Send an in-app warning notification to a user. Marks the user's open
    reports as WARNED so the admin can review whether the issue recurs."""
    user_result = await db.execute(select(User).where(User.id == user_id))
    target = user_result.scalars().first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    msg = (body.message or "").strip()
    if not msg:
        raise HTTPException(status_code=400, detail="Warning message is required")

    db.add(Notification(
        user_id=target.id,
        type=NotificationType.ADMIN_WARNING,
        title="Warning from EcoHealth Admin",
        message=msg[:600],
    ))
    # Move pending reports against this user into WARNED so the next batch
    # of reports clearly indicates the warning didn't stop the behaviour.
    open_reports = (await db.execute(
        select(UserReport).where(
            UserReport.reported_user_id == user_id,
            UserReport.status == ReportStatus.PENDING,
        )
    )).scalars().all()
    for r in open_reports:
        r.status = ReportStatus.WARNED
        r.resolved_by_id = current_admin.id
        r.resolution_note = f"Warning issued: {msg[:200]}"
    await db.commit()
    return {"message": "Warning sent", "reports_marked_warned": len(open_reports)}


@router.post("/admin/users/{user_id}/ban")
async def admin_ban_user(
    user_id: int,
    body: AdminBanBody,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
):
    user_result = await db.execute(select(User).where(User.id == user_id))
    target = user_result.scalars().first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if target.is_admin:
        raise HTTPException(status_code=400, detail="Cannot ban an admin")
    target.is_banned = True
    target.banned_at = _now_utc()
    target.ban_reason = (body.reason or "").strip() or None
    await _close_user_reports(user_id, ReportStatus.RESOLVED, body.reason, current_admin.id, db)
    await db.commit()
    return {"message": "User banned"}


@router.post("/admin/users/{user_id}/unban")
async def admin_unban_user(
    user_id: int,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
):
    user_result = await db.execute(select(User).where(User.id == user_id))
    target = user_result.scalars().first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    target.is_banned = False
    target.banned_at = None
    target.ban_reason = None
    await db.commit()
    return {"message": "User unbanned"}


@router.post("/admin/reports/users/{user_id}/dismiss")
async def admin_dismiss_user_reports(
    user_id: int,
    body: ReportResolve,
    current_admin: User = Depends(get_current_active_admin),
    db: AsyncSession = Depends(get_db),
):
    """Close pending user reports without taking moderation action."""
    await _close_user_reports(user_id, ReportStatus.DISMISSED, body.note, current_admin.id, db)
    await db.commit()
    return {"message": "Reports dismissed"}
