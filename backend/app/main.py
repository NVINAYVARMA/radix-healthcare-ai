import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, FileResponse
from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.database.init_db import init_db
from app.api.router import api_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    setup_logging()
    logger.info(f"Starting {settings.PROJECT_NAME} (v{settings.VERSION}) in [{settings.ENV}] mode...")
    init_db()
    logger.info("Application startup completed.")
    yield
    # Shutdown
    logger.info("Application shutdown.")


app = FastAPI(
    title=settings.PROJECT_NAME,
    version=settings.VERSION,
    description="RadiX AI - Prioritization and reading backlog orchestration backend.",
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
)

# Configure CORS
origins = settings.CORS_ORIGINS if isinstance(settings.CORS_ORIGINS, list) else [settings.CORS_ORIGINS]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins or ["*"],
    allow_origin_regex=r"https?://.*",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Root health endpoint specified in Description.md Phase 1
@app.get("/health", tags=["Health"])
def root_health():
    """Simple health endpoint returning {'status': 'ok'} as specified in Phase 1."""
    return {"status": "ok"}


# Include API v1 routes
app.include_router(api_router, prefix=settings.API_V1_STR)


# Local storage file serving route for local development
@app.get("/api/v1/storage/{file_path:path}", tags=["Storage"])
async def get_stored_file(file_path: str):
    """Serves stored imaging files when running in local storage mode."""
    clean_path = file_path.lstrip("/\\")
    full_path = os.path.abspath(os.path.join(settings.STORAGE_LOCAL_DIR, clean_path))
    if not os.path.exists(full_path):
        return JSONResponse(status_code=404, content={"message": "File not found"})
    return FileResponse(full_path)


# Mount frontend dist static build if present for unified full-stack hosting
frontend_dist_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "../../frontend/dist"))
if os.path.isdir(frontend_dist_dir):
    from fastapi.staticfiles import StaticFiles

    assets_dir = os.path.join(frontend_dist_dir, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="frontend_assets")

    avatars_dir = os.path.join(frontend_dist_dir, "avatars")
    if os.path.isdir(avatars_dir):
        app.mount("/avatars", StaticFiles(directory=avatars_dir), name="frontend_avatars")

    @app.get("/{full_path:path}")
    async def serve_spa(full_path: str):
        # Exclude backend API routes and documentation endpoints
        if (
            full_path.startswith("api/")
            or full_path.startswith("api")
            or full_path in ("docs", "redoc", "openapi.json", "health")
        ):
            return JSONResponse(status_code=404, content={"detail": "Not Found"})
        file_path = os.path.join(frontend_dist_dir, full_path)
        if full_path and os.path.isfile(file_path):
            return FileResponse(file_path)
        index_file = os.path.join(frontend_dist_dir, "index.html")
        if os.path.isfile(index_file):
            return FileResponse(index_file)
        return JSONResponse(status_code=404, content={"detail": "Frontend build not found"})


# Global Exception Handler
@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    logger.error(f"Unhandled error processing {request.method} {request.url.path}: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"message": "Internal server error", "detail": str(exc) if settings.ENV == "development" else None}
    )
