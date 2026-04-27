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

    # Optional map data
    route_polyline: Optional[str] = None
    map_boundaries: Optional[str] = None
    visibility_state: Optional[str] = "publish"

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
