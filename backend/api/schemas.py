from pydantic import BaseModel, EmailStr
from typing import Optional, List, Dict, Any
from datetime import datetime

# Token Schemas
class Token(BaseModel):
    access_token: str
    token_type: str

class TokenData(BaseModel):
    username: Optional[str] = None

# User Schemas
class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    age: Optional[int] = None
    sex: Optional[str] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    fitness_level: Optional[str] = None

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    age: Optional[int] = None
    sex: Optional[str] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    fitness_level: Optional[str] = None
    xp: int
    level: int
    badges: List[str]
    is_admin: bool = False
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    total_distance_km: Optional[float] = 0
    total_calories_burned: Optional[float] = 0
    completed_activities_count: Optional[int] = 0
    onboarding_complete: bool = False
    favorite_categories: Optional[List[str]] = []

    class Config:
        from_attributes = True

class ProfileUpdate(BaseModel):
    display_name: Optional[str] = None
    bio: Optional[str] = None
    username: Optional[str] = None
    age: Optional[int] = None
    sex: Optional[str] = None
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None
    fitness_level: Optional[str] = None

class InterestsUpdate(BaseModel):
    favorite_categories: List[str]


# Public profile (no email/weight/height/admin status leak)
class PublicUserOut(BaseModel):
    id: int
    username: str
    display_name: Optional[str] = None
    bio: Optional[str] = None
    avatar_url: Optional[str] = None
    level: int
    xp: int
    badges: List[str] = []
    favorite_categories: Optional[List[str]] = []
    activities_created: int = 0
    activities_completed: int = 0
    reviews_written: int = 0

    class Config:
        from_attributes = True


class UserSearchOut(BaseModel):
    id: int
    username: str
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    level: int

    class Config:
        from_attributes = True

class AdminUserUpdate(BaseModel):
    xp: Optional[int] = None
    level: Optional[int] = None
    badges: Optional[List[str]] = None

# Activity Schemas
class ActivityCreate(BaseModel):
    title: str
    description: Optional[str] = None
    category: str
    difficulty: int
    latitude: float
    longitude: float
    xp_reward: Optional[int] = 50
    estimated_duration_minutes: Optional[int] = 60
    distance_km: Optional[float] = 0
    is_loop: Optional[bool] = False
    lap_count: Optional[int] = 1

    # Optional map data
    route_polyline: Optional[str] = None
    map_boundaries: Optional[str] = None
    visibility_state: Optional[str] = "publish"

class ActivityUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    difficulty: Optional[int] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    xp_reward: Optional[int] = None
    estimated_duration_minutes: Optional[int] = None
    distance_km: Optional[float] = None
    is_loop: Optional[bool] = None
    lap_count: Optional[int] = None
    route_polyline: Optional[str] = None
    map_boundaries: Optional[str] = None
    visibility_state: Optional[str] = None
    submission_status: Optional[str] = None

class ActivityOut(ActivityCreate):
    id: int
    average_rating: Optional[float] = None
    review_count: Optional[int] = 0
    creator_id: Optional[int] = None
    creator_username: Optional[str] = None
    creator_avatar_url: Optional[str] = None
    creator_is_admin: Optional[bool] = None
    submission_status: Optional[str] = None
    report_count: Optional[int] = 0

    class Config:
        from_attributes = True

class ActivityCompletionBody(BaseModel):
    # Real elapsed time from frontend session timer (seconds).
    # When provided this drives the calorie calculation; otherwise the
    # backend falls back to activity.estimated_duration_minutes.
    duration_seconds: Optional[int] = None

class ActivityCompletionResult(BaseModel):
    new_xp: int
    new_level: int
    leveled_up: bool
    newly_unlocked_badges: list
    total_badges: List[str]
    kcal_burned: Optional[float] = 0
    distance_logged_km: Optional[float] = 0

# Category Schemas
class CategoryCreate(BaseModel):
    name: str
    emoji: str = "📍"
    color: str = "#4CAF50"
    calorie_met: Optional[float] = 4.0
    requires_distance: Optional[bool] = True

class CategoryUpdate(BaseModel):
    name: Optional[str] = None
    emoji: Optional[str] = None
    color: Optional[str] = None
    calorie_met: Optional[float] = None
    requires_distance: Optional[bool] = None

class CategoryOut(BaseModel):
    id: int
    name: str
    emoji: str
    color: str
    calorie_met: float = 4.0
    requires_distance: bool = True

    class Config:
        from_attributes = True

# Review Schemas
class ReviewCreate(BaseModel):
    rating: int  # 1-5
    comment: Optional[str] = None

class ReviewOut(BaseModel):
    id: int
    user_id: int
    activity_id: int
    rating: int
    comment: Optional[str]
    created_at: datetime
    username: Optional[str] = None  # populated by join
    is_hidden: bool = False  # author-visible only; everyone else gets it filtered out

    class Config:
        from_attributes = True

# Badge Definition Schemas
class BadgeDefinitionCreate(BaseModel):
    id: str
    name: str
    description: str
    emoji: str = "🏆"
    color: str = "#FFB300"
    condition_type: str
    condition_config: Dict[str, Any] = {}

class BadgeDefinitionUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    emoji: Optional[str] = None
    color: Optional[str] = None
    condition_type: Optional[str] = None
    condition_config: Optional[Dict[str, Any]] = None

class BadgeDefinitionOut(BaseModel):
    id: str
    name: str
    description: str
    emoji: str
    color: str
    condition_type: str
    condition_config: Dict[str, Any]

    class Config:
        from_attributes = True

# --- Phase 15: feedback, reports, moderation ----------------------------

class ActivityFeedbackCreate(BaseModel):
    message: str

class ActivityFeedbackOut(BaseModel):
    id: int
    activity_id: int
    admin_id: int
    admin_username: Optional[str] = None
    message: str
    created_at: datetime

    class Config:
        from_attributes = True

class BulkActivityAction(BaseModel):
    ids: List[int]
    # one of: "publish", "draft", "delete"
    action: str

class BulkActionResult(BaseModel):
    affected: int
    action: str

class ActivityReportCreate(BaseModel):
    activity_id: int
    reason: str
    details: Optional[str] = None

class UserReportCreate(BaseModel):
    reported_user_id: int
    reason: str
    details: Optional[str] = None

class ReportResolve(BaseModel):
    # one of: "dismiss", "warn", "ban", "unpublish", "resolved"
    action: str
    note: Optional[str] = None
    # When action="warn" or "ban" admin can include a message shown to the
    # reported user as a notification.
    user_message: Optional[str] = None

class ActivityReportOut(BaseModel):
    id: int
    reporter_id: int
    reporter_username: Optional[str] = None
    activity_id: int
    activity_title: Optional[str] = None
    reason: str
    details: Optional[str] = None
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None
    resolution_note: Optional[str] = None

    class Config:
        from_attributes = True

class UserReportOut(BaseModel):
    id: int
    reporter_id: int
    reporter_username: Optional[str] = None
    reported_user_id: int
    reported_username: Optional[str] = None
    reason: str
    details: Optional[str] = None
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None
    resolution_note: Optional[str] = None

    class Config:
        from_attributes = True

class ReportedActivitySummary(BaseModel):
    activity_id: int
    title: str
    creator_username: Optional[str] = None
    visibility_state: Optional[str] = None
    report_count: int
    pending_count: int
    latest_report_at: Optional[datetime] = None

class ReportedUserSummary(BaseModel):
    user_id: int
    username: str
    display_name: Optional[str] = None
    is_banned: bool = False
    report_count: int
    pending_count: int
    latest_report_at: Optional[datetime] = None

class AdminWarnBody(BaseModel):
    message: str
    # Optional click-through context. If review_id is set, the notification
    # also auto-hides the comment so the warned user sees a moderation marker.
    activity_id: Optional[int] = None
    review_id: Optional[int] = None

class AdminBanBody(BaseModel):
    reason: Optional[str] = None

class NotificationOut(BaseModel):
    id: int
    user_id: int
    type: str
    title: str
    message: str
    is_read: bool
    link: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True
