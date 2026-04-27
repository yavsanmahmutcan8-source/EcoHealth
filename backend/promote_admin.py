import asyncio
import sys
from sqlalchemy.future import select
from db.session import async_session
from models.user import User

async def promote_user(username: str):
    async with async_session() as session:
        result = await session.execute(select(User).where(User.username == username))
        user = result.scalars().first()
        
        if not user:
            print(f"User '{username}' not found.")
            return
        
        user.is_admin = True
        await session.commit()
        print(f"User '{username}' has been promoted to Admin.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python promote_admin.py <username>")
    else:
        asyncio.run(promote_user(sys.argv[1]))
