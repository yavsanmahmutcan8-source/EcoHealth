from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from core.config import settings

app = FastAPI(
    title=settings.PROJECT_NAME,
    version="1.0.0",
    description="Backend API for EcoHealth - Nature Guide and Health Coach"
)

# Set all CORS enabled origins
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # Should be restricted in production
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from api.routes import router as api_router
app.include_router(api_router, prefix="/api")

# Serve uploaded files (avatars, etc.)
from fastapi.staticfiles import StaticFiles
import os
os.makedirs("/app/static/avatars", exist_ok=True)
app.mount("/static", StaticFiles(directory="/app/static"), name="static")

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "app": settings.PROJECT_NAME}
