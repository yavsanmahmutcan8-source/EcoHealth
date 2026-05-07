import asyncio
from sqlalchemy.future import select
from db.session import async_session
from db.base import User, Activity  # Ensure all models are loaded

async def list_users():
    async with async_session() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()
        for u in users:
            print(f"ID: {u.id} | Username: {u.username} | Email: {u.email} | IsAdmin: {u.is_admin}")

if __name__ == "__main__":
    asyncio.run(list_users())
