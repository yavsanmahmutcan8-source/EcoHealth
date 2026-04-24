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

    # Google Auth
    GOOGLE_CLIENT_ID: str = "480390592998-1dh6uuku2fj28k02dubd93deglqed9b6.apps.googleusercontent.com"
    GOOGLE_CLIENT_SECRET: str = "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"

    class Config:
        env_file = ".env"

settings = Settings()
