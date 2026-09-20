# RADIX Deployment Guide (Render & Railway)

Your RADIX Healthcare AI application is fully configured and containerized for **1-click full-stack deployment** on **Render** or **Railway**.

---

## What Has Been Configured

1. **Multi-Stage Production Dockerfile (`Dockerfile`)**:
   - **Stage 1**: Builds the React diagnostic workstation (`npm run build`).
   - **Stage 2**: Sets up Python 3.12 with CPU-optimized PyTorch and all AI dependencies.
   - **Single Unified Port**: FastAPI serves both the REST API endpoints (`/api/v1`) and the React frontend (`/`) with client-side SPA fallback. No CORS errors or cross-domain issues.

2. **Render Blueprint (`render.yaml`)**:
   - Declares the web service, Docker environment, free tier specification, and `/health` health check.

3. **Railway Config (`railway.json`)**:
   - Specifies Dockerfile builder, restart policies, and health check timeout.

4. **Git Repository Initialized**:
   - Initial commit created with clean `.gitignore` protecting secrets, local databases, and temporary caches.

---

## Option A: Deploy on Render.com (Recommended - Free & Easy)

### Step 1: Push your code to GitHub
If you haven't created a GitHub repository yet:
1. Go to [github.com/new](https://github.com/new) and create a new repository named `radix-healthcare-ai`.
2. In your terminal, run:
```bash
git remote add origin https://github.com/YOUR_GITHUB_USERNAME/radix-healthcare-ai.git
git branch -M main
git push -u origin main
```

### Step 2: Deploy on Render
1. Go to [dashboard.render.com](https://dashboard.render.com) (sign up with GitHub).
2. Click **New +** in the top right corner and select **Blueprint**.
3. Connect your `radix-healthcare-ai` repository.
4. Render will read [`render.yaml`](file:///c:/Users/nvssv/Downloads/Radix%20%282%29/Radix/render.yaml) automatically and prompt you to click **Apply**.
5. Render will build and launch your application at a free live URL: `https://radix-healthcare-ai.onrender.com`.

---

## Option B: Deploy on Railway.app

### Step 1: Push code to GitHub (as in Option A above)

### Step 2: Deploy on Railway
1. Go to [railway.app](https://railway.app) (log in with GitHub).
2. Click **New Project** -> **Deploy from GitHub repo**.
3. Select your `radix-healthcare-ai` repository.
4. Railway will automatically detect [`Dockerfile`](file:///c:/Users/nvssv/Downloads/Radix%20%282%29/Radix/Dockerfile) and [`railway.json`](file:///c:/Users/nvssv/Downloads/Radix%20%282%29/Radix/railway.json).
5. Click **Deploy Now**.
6. Once deployed, go to **Settings** -> **Networking** -> **Generate Domain** to get your public live URL (e.g. `https://radix-production.up.railway.app`).

---

## Verification & Health Check
Both platforms will automatically monitor:
- Health endpoint: `GET /health` -> `{"status": "ok"}`
- API Documentation: `GET /docs` (Swagger UI)
- Web Application: `GET /` (RADIX Triage Worklist)
