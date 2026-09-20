from fastapi import APIRouter
from app.api.health import router as health_router
from app.api.studies import router as studies_router
from app.api.queue import router as queue_router
from app.api.analytics import router as analytics_router
from app.api.auth import router as auth_router
from app.api.reviewed import router as reviewed_router

api_router = APIRouter()

# Mount health routes (/api/v1/health)
api_router.include_router(health_router)

# Mount auth routes (/api/v1/auth)
api_router.include_router(auth_router)

# Mount study routes (/api/v1/studies)
api_router.include_router(studies_router)

# Mount queue routes (/api/v1/queue)
api_router.include_router(queue_router)

# Mount analytics routes (/api/v1/analytics)
api_router.include_router(analytics_router)

# Mount reviewed studies archive routes (/api/v1/reviewed-studies)
api_router.include_router(reviewed_router)
