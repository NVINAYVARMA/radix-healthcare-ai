# RADIX — Autonomous Healthcare AI Diagnostic Workstation

AI-powered emergency radiology triage and backlog prioritization engine for radiologists.

---

## 🚀 How to Run Locally from GitHub

If you or another user want to run RADIX locally on your machine, follow these steps:

### 1. Clone the Repository
```bash
git clone https://github.com/NVINAYVARMA/radix-healthcare-ai.git
cd radix-healthcare-ai
```

---

### 2. Start the Backend (FastAPI)

Open a terminal in the project root:

```bash
# Navigate to backend
cd backend

# Create virtual environment
python -m venv .venv

# Activate virtual environment
# On Windows:
.venv\Scripts\activate
# On macOS / Linux:
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Start backend server
python run.py
```
> The API server will start at **`http://localhost:8000`** (Swagger docs at `http://localhost:8000/docs`).

---

### 3. Start the Frontend (React + Vite)

Open a **second terminal** in the project root:

```bash
# Navigate to frontend
cd frontend

# Install Node dependencies
npm install

# Start Vite dev server
npm run dev
```
> The frontend workstation will start at **`http://localhost:5173`**.

---

### 4. Open in Browser
Visit **`http://localhost:5173`** to access the live RADIX workstation.

---

## 🌐 Sharing Localhost over the Internet (No Deployment Needed)

If you are running the app on your computer and want to give a coworker or tester immediate access to your running localhost:

```bash
# In your terminal:
npx localtunnel --port 5173
```
Localtunnel will output a public URL (e.g. `https://rapid-doctor-ai.loca.lt`) that anyone can open on their phone or computer to view your local server!

---

## 📦 Tech Stack
- **Frontend**: React 18, Vite, Framer Motion, Lucide Icons, React Router 6
- **Backend**: Python 3.12, FastAPI, PyTorch, Torchvision, SQLite / SQLAlchemy
- **Deployment**: Netlify / Render / Railway / Docker
