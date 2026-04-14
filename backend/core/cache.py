import redis.asyncio as aioredis
from core.config import settings

redis_cache = aioredis.from_url(settings.REDIS_URL, encoding="utf-8", decode_responses=True)

async def get_redis():
    """
    Dependency to get the Redis connection pool.
    """
    return redis_cache
