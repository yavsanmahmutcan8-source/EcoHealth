import asyncio
from sqlalchemy.future import select
from db.session import async_session
from db.base import User, Activity, Review, Category, BadgeDefinition, CompletionLog, Notification # Load all
from core.security import get_password_hash

async def reset_password(email: str, new_password: str):
    async with async_session() as session:
        result = await session.execute(select(User).where(User.email == email))
        user = result.scalars().first()
        if user:
            user.hashed_password = get_password_hash(new_password)
            await session.commit()
            print(f"Password reset successful for {email}")
        else:
            print(f"User with email {email} not found")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 3:
        print("Usage: python reset_password.py <email> <new_password>")
    else:
        asyncio.run(reset_password(sys.argv[1], sys.argv[2]))
