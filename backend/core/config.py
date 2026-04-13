from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "EcoHealth"
    SECRET_KEY: str = "very-secret-ecohealth-key-for-development" # Will be changed in production
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60 * 24 * 7 # 7 days
    
    # Database
    DATABASE_URL: str = "postgresql+asyncpg://ecohealth:ecohealth_password@localhost:5432/ecohealth_db"
    
    # Redis
    REDIS_URL: str = "redis://localhost:6379/0"

    class Config:
        env_file = ".env"

settings = Settings()
