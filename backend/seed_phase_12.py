"""Idempotent seed script for Phase 12 creator badges.

Run inside the backend container after deploy:
    sudo docker exec ecohealth_backend_prod python seed_phase_12.py
"""
import asyncio
from sqlalchemy.future import select

from db.session import async_session
from db.base import BadgeDefinition, User, Activity, Category, Review, CompletionLog, Notification  # noqa: F401


CREATOR_BADGES = [
    {
        "id": "route_maker",
        "name": "Route Maker",
        "description": "Create your first activity",
        "emoji": "🗺️",
        "color": "#0EA5E9",
        "condition_type": "ACTIVITIES_CREATED",
        "condition_config": {"count": 1},
    },
    {
        "id": "trail_architect",
        "name": "Trail Architect",
        "description": "Create 5 activities",
        "emoji": "🏗️",
        "color": "#8B5CF6",
        "condition_type": "ACTIVITIES_CREATED",
        "condition_config": {"count": 5},
    },
    {
        "id": "community_builder",
        "name": "Community Builder",
        "description": "Have your activities completed by 10 different explorers",
        "emoji": "🤝",
        "color": "#F97316",
        "condition_type": "CREATOR_COMPLETIONS",
        "condition_config": {"count": 10},
    },
]


async def seed():
    async with async_session() as session:
        added = 0
        for badge_data in CREATOR_BADGES:
            existing = await session.execute(
                select(BadgeDefinition).where(BadgeDefinition.id == badge_data["id"])
            )
            if existing.scalars().first():
                print(f"Badge '{badge_data['id']}' already exists. Skipping.")
                continue
            session.add(BadgeDefinition(**badge_data))
            added += 1
            print(f"Adding badge '{badge_data['id']}'.")
        await session.commit()
        print(f"Done. {added} new creator badge(s) inserted.")


if __name__ == "__main__":
    asyncio.run(seed())
