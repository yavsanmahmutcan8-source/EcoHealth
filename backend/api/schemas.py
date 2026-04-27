from pydantic import BaseModel, EmailStr
from typing import Optional, List

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
    weight_kg: Optional[float] = None
    height_cm: Optional[float] = None

class UserOut(BaseModel):
    id: int
    username: str
    email: str
    age: Optional[int]
    xp: int
    level: int
    badges: List[str]
    is_admin: bool = False

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
    route_polyline: Optional[str] = None
    map_boundaries: Optional[str] = None
    visibility_state: Optional[str] = None

class ActivityOut(ActivityCreate):
    id: int
    
    class Config:
        from_attributes = True

class ActivityCompletionResult(BaseModel):
    new_xp: int
    new_level: int
    leveled_up: bool
    newly_unlocked_badges: list
    total_badges: List[str]
