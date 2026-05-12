from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
import jwt
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from db.session import get_db
from models.user import User
from core.config import settings

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except jwt.PyJWTError:
        raise credentials_exception
        
    query = select(User).where(User.username == username)
    result = await db.execute(query)
    user = result.scalars().first()
    
    if user is None:
        raise credentials_exception
    # Banned users can authenticate against the token but every API call is
    # rejected so they can't post reviews, file reports, create activities,
    # etc. The frontend force-logs-them-out when it sees a 403 here.
    if getattr(user, "is_banned", False):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is banned",
        )
    return user

async def get_current_active_admin(current_user: User = Depends(get_current_user)):
    if not current_user.is_admin:
        raise HTTPException(status_code=403, detail="The user doesn't have enough privileges")
    return current_user
