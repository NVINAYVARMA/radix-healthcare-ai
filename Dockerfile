# ==============================================================================
# RADIX Healthcare AI Platform - Multi-Stage Production Dockerfile
# Hosts both the React Diagnostic Frontend & FastAPI Orchestration Backend
# ==============================================================================

# STAGE 1: Frontend Build Environment
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm install

COPY frontend/ ./
RUN npm run build

# STAGE 2: Python Runtime Environment
FROM python:3.12-slim AS runtime
WORKDIR /app

# Install essential system utilities
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install Python backend requirements (CPU-optimized PyTorch for fast cloud container boot)
COPY backend/requirements.txt ./backend/
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir --extra-index-url https://download.pytorch.org/whl/cpu -r backend/requirements.txt

# Copy Backend Application Code
COPY backend/ ./backend/

# Copy Pre-Built Frontend Distribution from Stage 1
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose Default Port (Dynamic on Render / Railway via $PORT)
ENV PORT=8000 \
    HOST=0.0.0.0 \
    ENV=production \
    PYTHONUNBUFFERED=1

EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:${PORT:-8000}/health || exit 1

# Launch Application (FastAPI serves both API at /api/v1 and React SPA at /)
WORKDIR /app/backend
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
