# PS-H01 — The Reading Backlog
## Problem Statement & My Role

> **Project:** RadiX AI  
> **My role:** Backend & Architecture / Data Engineer

---

## 1. Problem Statement

### The Problem

The problem focuses on a **medical imaging reading backlog**, particularly in situations such as rural or remote healthcare where imaging studies may accumulate while only a limited number of radiologists are available.

A typical situation is:

- Many imaging studies arrive within a short period.
- A single remote radiologist may be responsible for reviewing them.
- The studies are not necessarily equally urgent.
- A simple first-in-first-out worklist can delay potentially important cases.
- The system needs to help the radiologist decide **which study should be reviewed earlier**.

The goal is therefore not to replace the radiologist, but to create an **AI-assisted prioritization system** that organizes the worklist according to signals extracted from the imaging studies.

### Expected Prototype Scenario

The prototype should be able to demonstrate a scenario such as:

**40 chest X-rays arriving overnight → one remote radiologist → AI analyzes the studies → studies are assigned explainable priority scores → the worklist is reordered → the radiologist reviews the highest-priority studies first.**

### Important Safety Boundary

The system is intended for **prioritization and workflow assistance**, not autonomous diagnosis.

The AI should:

- identify patterns or signals that may require earlier review,
- produce a priority score,
- provide confidence and explanation information,
- help reorder the worklist.

The AI should **not**:

- make a final diagnosis,
- replace a radiologist,
- make autonomous clinical decisions,
- be presented as a definitive medical decision-maker.

The prototype should use public, de-identified data or simulated studies rather than real patient scans.

---

## 2. Proposed Solution — RadiX AI

### One-Line Description

**RadiX AI is an AI-powered, explainable radiology worklist prioritization system that analyzes incoming imaging studies and helps radiologists identify which studies should be reviewed earlier.**

### Core Workflow

```text
Image Intake
     ↓
AI Pattern Analysis
     ↓
Explainable Priority Score
     ↓
Queue Reordering
     ↓
Radiologist Review
```

The system turns an unordered or arrival-ordered backlog into a **priority-aware worklist**.

---

## 3. System Architecture

The architecture should remain simple enough for a hackathon prototype while keeping the components clearly separated.

```text
                    ┌──────────────────────┐
                    │   React Frontend     │
                    │  Radiologist UI      │
                    └──────────┬───────────┘
                               │
                               ▼
                    ┌──────────────────────┐
                    │     FastAPI API      │
                    │   Backend Layer      │
                    └──────────┬───────────┘
                               │
             ┌─────────────────┼─────────────────┐
             ▼                 ▼                 ▼
      ┌────────────┐    ┌──────────────┐   ┌────────────┐
      │ Study      │    │ Priority     │   │ Review     │
      │ Service    │    │ Engine       │   │ Service    │
      └─────┬──────┘    └──────┬───────┘   └─────┬──────┘
            │                  │                 │
            └──────────────────┼─────────────────┘
                               ▼
                    ┌──────────────────────┐
                    │ Supabase PostgreSQL  │
                    │ + Storage            │
                    └──────────────────────┘

                         ▲
                         │
                  ┌──────┴───────┐
                  │ AI Inference │
                  │ Service      │
                  └──────────────┘
```

### Main Components

1. **Frontend**
   - Radiologist dashboard
   - Prioritized worklist
   - Study details
   - Priority explanations
   - Review controls
   - Analytics

2. **FastAPI Backend**
   - Main orchestration layer
   - Receives imaging studies
   - Calls the AI inference service
   - Calculates priority
   - Stores results
   - Provides queue APIs
   - Records reviews and overrides

3. **AI Inference Service**
   - Receives an image
   - Runs the trained model
   - Returns a structured score and confidence
   - Can initially be mocked while the ML model is under development

4. **Priority Engine**
   - Converts AI output and workflow information into a priority score
   - Applies waiting-time/fairness logic
   - Assigns priority levels

5. **Database & Storage**
   - PostgreSQL for structured study and audit data
   - Object storage for image files

---

# 4. MY JOB — Backend & Architecture

I am responsible for building the **backend orchestration and system architecture**.

My backend sits between the frontend, AI model, and database.

### My responsibility in one sentence

> **I build the backend that receives imaging studies, invokes AI inference, converts model results into transparent priority scores, manages the radiology queue, stores the complete workflow history, and exposes APIs for the frontend and evaluation system.**

---

## 5. My Main Responsibilities

### 5.1 Backend API Development

I will build the backend using **Python + FastAPI**.

The backend will provide APIs for:

- uploading studies,
- retrieving studies,
- processing the queue,
- retrieving the prioritized queue,
- submitting radiologist reviews,
- applying manual priority overrides,
- retrieving analytics.

Suggested API structure:

```text
/api/v1/studies
/api/v1/queue
/api/v1/reviews
/api/v1/analytics
```

---

## 6. API Endpoints

### Upload Study

```http
POST /api/v1/studies
```

Purpose:

- receive an image,
- store the image,
- create a study record,
- start AI processing.

Example response:

```json
{
  "study_id": "XR-0023",
  "status": "PROCESSING"
}
```

---

### Get Study

```http
GET /api/v1/studies/{study_id}
```

Returns:

- study metadata,
- AI score,
- confidence,
- priority,
- priority factors,
- status,
- review information.

---

### Get Studies

```http
GET /api/v1/studies
```

Used for retrieving studies with filters such as:

```text
?status=PENDING_REVIEW
?priority=HIGH
?limit=20
```

---

### Process Queue

```http
POST /api/v1/queue/process
```

Purpose:

- process pending studies,
- call AI inference,
- calculate priority,
- update database,
- make studies available in the prioritized worklist.

Example response:

```json
{
  "processed": 40,
  "high": 8,
  "medium": 17,
  "standard": 15
}
```

---

### Get Prioritized Queue

```http
GET /api/v1/queue
```

The backend returns studies sorted by:

```text
priority_score DESC
arrival_time ASC
```

The second rule provides deterministic tie-breaking.

---

### Submit Review

```http
PATCH /api/v1/studies/{study_id}/review
```

Used when the radiologist:

- starts a review,
- completes a review,
- adds notes,
- marks the study as reviewed.

---

### Manual Priority Override

```http
PATCH /api/v1/studies/{study_id}/priority
```

Example:

```json
{
  "manual_priority": "HIGH",
  "reason": "Radiologist override"
}
```

Important:

**The manual override must not overwrite the original AI result.**

Both should be preserved for auditability.

---

### Analytics

```http
GET /api/v1/analytics/overview
GET /api/v1/analytics/queue-comparison
```

These APIs allow the evaluation/dashboard team to calculate:

- total studies,
- high/medium/standard counts,
- average processing time,
- average priority score,
- queue ordering,
- prioritization performance,
- false-negative rate,
- workflow efficiency.

---

# 7. Database Design

I will manage the main database structure.

## Table: `studies`

Stores the main study information.

```text
studies
├── id
├── study_id
├── modality
├── image_path
├── arrival_time
├── status
├── ai_score
├── ai_confidence
├── priority_score
├── priority_level
├── image_quality_score
├── manual_priority
├── override_reason
├── created_at
└── updated_at
```

Example:

```text
study_id: XR-0023
modality: X-RAY
status: PENDING_REVIEW
ai_score: 87
ai_confidence: 91
priority_score: 88.6
priority_level: HIGH
```

---

## Table: `priority_factors`

Stores why a study received its priority.

```text
priority_factors
├── id
├── study_id
├── factor_name
├── factor_value
├── weight
├── contribution
├── description
└── created_at
```

Example:

```text
factor_name: AI_SIGNAL
factor_value: 87
weight: 0.70
contribution: 60.9
description: AI model detected a high-priority imaging pattern
```

This table is important because the system should not only say:

> "Priority = 89"

It should also be able to explain:

> "Priority increased because of the AI signal, confidence, waiting time, and image quality."

---

## Table: `review_logs`

Tracks the human workflow.

```text
review_logs
├── id
├── study_id
├── action
├── review_status
├── timestamp
├── reviewer_id
└── notes
```

Example actions:

```text
OPENED
STARTED_REVIEW
COMPLETED_REVIEW
PRIORITY_OVERRIDE
ADDED_NOTE
```

---

## Table: `users`

Stores application users.

```text
users
├── id
├── name
├── email
├── role
└── created_at
```

Roles:

```text
RADIOLOGIST
ADMIN
```

---

## Table: `model_runs`

Stores AI execution information.

```text
model_runs
├── id
├── study_id
├── model_name
├── model_version
├── score
├── confidence
├── processing_time_ms
└── created_at
```

This allows us to measure AI processing time and keep track of which model generated a result.

---

# 8. Image Storage

Images should **not** be stored directly as binary data inside PostgreSQL.

Instead:

```text
Image
  ↓
Supabase Storage
  ↓
image_path stored in PostgreSQL
```

Example:

```text
storage:
studies/XR-0023/image.png

database:
image_path = studies/XR-0023/image.png
```

This keeps the database focused on structured data.

---

# 9. Study Lifecycle

Every study should move through controlled states.

```text
UPLOADED
    ↓
PROCESSING
    ↓
PRIORITIZED
    ↓
PENDING_REVIEW
    ↓
IN_REVIEW
    ↓
REVIEWED
```

If AI processing fails:

```text
PROCESSING
    ↓
FAILED
```

This state-based design makes the backend easier to debug and makes the workflow visible to the frontend.

---

# 10. Priority Engine

The priority engine is one of my most important responsibilities.

The AI model provides an AI-related signal, but the backend converts that information into a **workflow priority**.

A prototype scoring formula can be:

```text
priority_score =
    (ai_score × 0.70)
    + (confidence × 0.10)
    + (waiting_score × 0.10)
    + (quality_score × 0.10)
```

All components are normalized to 0–100.

Example:

```text
AI score       = 87
Confidence     = 91
Waiting score  = 60
Quality score  = 95

Priority =
(87 × 0.70)
+ (91 × 0.10)
+ (60 × 0.10)
+ (95 × 0.10)

= 85.5
```

The exact weights should be treated as prototype parameters and validated during testing rather than presented as clinically validated weights.

---

# 11. Priority Levels

The backend can convert the numerical score into workflow categories.

Example:

```text
80–100 → HIGH
50–79  → MEDIUM
0–49   → STANDARD
```

These thresholds are prototype configuration values and can be adjusted during evaluation.

---

# 12. Waiting-Time Fairness

A pure AI ranking could potentially keep low-scoring studies at the bottom for too long.

Therefore, waiting time can provide a **capped adjustment**.

Conceptually:

```text
waiting_adjustment =
    min(max_waiting_bonus, calculated_bonus)
```

The cap prevents waiting time from completely overwhelming the AI signal.

The goal is:

```text
AI prioritization
       +
fair queue management
       ↓
better workflow ordering
```

---

# 13. AI Integration

The backend should not depend directly on the internal implementation of the ML model.

Instead, define a fixed interface.

### AI output

```json
{
  "score": 87,
  "confidence": 0.91,
  "model_name": "DenseNet121",
  "model_version": "1.0"
}
```

The backend then converts it into its own representation:

```json
{
  "ai_score": 87,
  "confidence": 91,
  "priority_score": 88.6,
  "priority_level": "HIGH"
}
```

---

# 14. Mock AI First

To avoid blocking the entire team while the ML member develops the model, I should implement:

```text
AI Service
├── MockAIProvider
└── RealAIProvider
```

During early development:

```text
Image
 ↓
Mock AI
 ↓
Fake score
 ↓
Priority Engine
 ↓
Queue
```

Later:

```text
Image
 ↓
Real AI Model
 ↓
Actual score
 ↓
Priority Engine
 ↓
Queue
```

This means the backend can be completed before the final model is ready.

---

# 15. Suggested Backend Folder Structure

```text
backend/
│
├── app/
│   ├── main.py
│   │
│   ├── api/
│   │   ├── studies.py
│   │   ├── queue.py
│   │   ├── reviews.py
│   │   └── analytics.py
│   │
│   ├── services/
│   │   ├── study_service.py
│   │   ├── ai_service.py
│   │   ├── priority_service.py
│   │   ├── queue_service.py
│   │   └── review_service.py
│   │
│   ├── models/
│   │   ├── study.py
│   │   ├── priority.py
│   │   └── review.py
│   │
│   ├── schemas/
│   │   ├── study.py
│   │   ├── queue.py
│   │   └── review.py
│   │
│   ├── database/
│   │   ├── connection.py
│   │   └── queries.py
│   │
│   ├── core/
│   │   ├── config.py
│   │   └── security.py
│   │
│   └── utils/
│       ├── scoring.py
│       └── timestamps.py
│
├── tests/
│
├── requirements.txt
└── .env
```

---

# 16. Backend Development Order

I should implement the backend in this order:

### Phase 1 — Project Setup

- Create FastAPI project.
- Configure environment variables.
- Configure Supabase connection.
- Create basic health endpoint.

```http
GET /health
```

Expected:

```json
{
  "status": "ok"
}
```

---

### Phase 2 — Database

Create:

- `studies`
- `priority_factors`
- `review_logs`
- `users`
- `model_runs`

Also configure image storage.

---

### Phase 3 — Study Upload

Implement:

```http
POST /api/v1/studies
```

Workflow:

```text
Request
 ↓
Validate image
 ↓
Upload image
 ↓
Create study
 ↓
Set status = PROCESSING
```

---

### Phase 4 — Mock AI

Implement the AI provider interface and mock provider.

```text
Study
 ↓
MockAIProvider
 ↓
score + confidence
```

---

### Phase 5 — Priority Engine

Implement:

- score calculation,
- waiting-time adjustment,
- priority classification,
- factor generation.

---

### Phase 6 — Queue

Implement:

```http
GET /api/v1/queue
```

Sorting:

```text
priority_score DESC
arrival_time ASC
```

Do not store a permanent queue position.

The queue should be calculated from the current study state and scores.

---

### Phase 7 — Real AI Integration

Replace:

```text
MockAIProvider
```

with:

```text
RealAIProvider
```

without changing the rest of the backend.

---

### Phase 8 — Review Workflow

Implement:

- start review,
- complete review,
- notes,
- manual priority override,
- audit logging.

---

### Phase 9 — Analytics

Expose:

- number of studies,
- priority distribution,
- average processing time,
- queue comparison,
- review status,
- AI processing statistics.

---

### Phase 10 — Frontend Integration

Give the frontend developer the API contract.

The frontend should be able to retrieve:

```json
{
  "study_id": "XR-0023",
  "image_url": "...",
  "priority_score": 88.6,
  "priority_level": "HIGH",
  "ai_score": 87,
  "confidence": 91,
  "status": "PENDING_REVIEW",
  "arrival_time": "..."
}
```

---

# 17. Testing Responsibilities

I should write backend tests for:

### Priority calculation

```text
AI score changes → priority changes correctly
```

### Priority levels

```text
90 → HIGH
65 → MEDIUM
30 → STANDARD
```

### Waiting time

Verify that waiting-time adjustments are capped.

### Queue sorting

Verify:

```text
HIGH before MEDIUM
MEDIUM before STANDARD
```

and:

```text
same priority → earlier arrival first
```

### API tests

Test:

```text
POST /studies
GET /studies
POST /queue/process
GET /queue
PATCH /review
PATCH /priority
GET /analytics
```

---

# 18. 40-Study Demo

The final backend should support a complete simulation.

```text
40 images
   ↓
Upload
   ↓
AI processing
   ↓
Priority calculation
   ↓
Database persistence
   ↓
Queue sorting
   ↓
Radiologist dashboard
```

The demo should show:

1. Studies arriving in the system.
2. AI processing.
3. Priority scores being generated.
4. The queue being reordered.
5. The highest-priority studies appearing first.
6. The radiologist opening and reviewing a study.
7. Review information being recorded.
8. Analytics showing the difference between arrival order and prioritized order.

---

# 19. Logging

The backend should produce useful logs.

Example:

```text
[INFO] Study XR-0023 uploaded
[INFO] AI processing started
[INFO] AI processing completed in 2.31s
[INFO] Priority score calculated: 89
[INFO] Study XR-0023 added to review queue
[INFO] Study XR-0023 marked as reviewed
```

This will make debugging and the live demo much easier.

---

# 20. Error Handling

The backend should handle failures cleanly.

### Invalid image

```text
400 Bad Request
```

### AI failure

```text
study.status = FAILED
```

### AI timeout

```text
retry
    ↓
if still failing
    ↓
FAILED
```

### Database failure

```text
500 Internal Server Error
```

The frontend should receive meaningful error messages rather than raw exceptions.

---

# 21. Security

Sensitive credentials must remain on the backend.

Examples:

```text
SUPABASE_URL
SUPABASE_SERVICE_KEY
AI_SERVICE_KEY
```

These belong in:

```text
.env
```

They should never be exposed in the React frontend.

CORS should also be configured to allow only the required frontend origins.

---

# 22. Explainability Data

The backend should make explanation information available to the frontend.

For each study, the API should be able to return information such as:

```json
{
  "priority_score": 88.6,
  "priority_level": "HIGH",
  "factors": [
    {
      "name": "AI signal",
      "contribution": 60.9
    },
    {
      "name": "Confidence",
      "contribution": 9.1
    },
    {
      "name": "Waiting time",
      "contribution": 6.0
    },
    {
      "name": "Image quality",
      "contribution": 9.5
    }
  ]
}
```

This allows the UI to display:

> **Why is this study high priority?**

without exposing internal implementation details unnecessarily.

---

# 23. Important Architecture Decision

### Do NOT build microservices for the hackathon.

Use a **modular monolith**:

```text
FastAPI
 ├── Study Module
 ├── AI Module
 ├── Priority Module
 ├── Queue Module
 ├── Review Module
 └── Analytics Module
```

This provides separation without creating unnecessary deployment and communication complexity.

For the prototype, there is no strong need for:

- Kubernetes,
- Redis,
- Celery,
- multiple backend deployments,
- complex event buses.

The architecture can be extended later if the system needs production-scale asynchronous processing.

---

# 24. Definition of Done for My Part

My backend work is complete when this flow works end-to-end:

```text
Upload Image
      ↓
Create Study
      ↓
AI Inference
      ↓
Calculate Priority
      ↓
Save Results
      ↓
GET /queue
      ↓
Correctly Ordered Worklist
      ↓
Radiologist Review
      ↓
Review Logged
      ↓
Analytics Updated
```

And the 40-study simulation works without manually editing the database.

---

# 25. What I Need From Other Team Members

### From AI/ML Member

I need a stable inference contract:

```json
{
  "score": 87,
  "confidence": 0.91,
  "model_name": "DenseNet121",
  "model_version": "1.0"
}
```

The internal model implementation should remain independent of the backend.

### From Frontend Member

I need the frontend to consume documented API endpoints rather than connecting directly to the database.

### From Explainability/Evaluation Member

I need:

- required evaluation metrics,
- expected explanation fields,
- model metadata,
- evaluation labels/results where applicable.

---

# 26. Team Integration

The four roles connect like this:

```text
                ┌─────────────────┐
                │   AI / ML       │
                │ Member 1        │
                └────────┬────────┘
                         │
                         ▼
                ┌─────────────────┐
                │ Backend +       │
                │ Architecture    │
                │ Me / Member 2   │
                └────────┬────────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
      ┌───────────────┐     ┌────────────────┐
      │ Frontend      │     │ Explainability │
      │ Member 3      │     │ & Evaluation   │
      └───────────────┘     │ Member 4       │
                            └────────────────┘
```

My backend is the integration layer connecting the other three components.

---

# 27. How I Should Explain My Work to Judges

### Short version

> **“I designed the backend architecture and built the orchestration layer for the system. It receives imaging studies, triggers AI inference, converts the model output into an explainable priority score, manages the dynamic reading queue, stores study and review information, and exposes APIs to the radiologist dashboard.”**

### Technical version

> **“The backend is implemented as a modular FastAPI service with separate study, AI, priority, queue, review, and analytics modules. AI inference is abstracted behind a provider interface so we can switch from a mock model to the actual ML model without changing the queue logic. The priority engine combines the AI signal with confidence, waiting time, and image-quality information, while keeping manual radiologist overrides separate for auditability.”**

---

# 28. Key Technical Story

The backend is not just a CRUD API.

Its main purpose is **orchestration**.

```text
Imaging Study
     ↓
Validation
     ↓
AI Inference
     ↓
Priority Calculation
     ↓
Explanation Factors
     ↓
Queue Management
     ↓
Radiologist Review
     ↓
Audit + Analytics
```

That is the main technical story I should communicate.

---

# 29. Final Project Summary

**RadiX AI** addresses the problem of medical imaging backlogs by using AI-assisted prioritization to help a limited radiology workforce decide which studies should be reviewed earlier.

The system does not attempt to replace the radiologist. Instead, it acts as a workflow-assistance layer:

```text
AI analyzes
     ↓
Backend prioritizes
     ↓
Radiologist decides
```

My role is to build the backend infrastructure that makes this complete workflow possible.

---

## My Deliverables Checklist

- [ ] FastAPI project
- [ ] Environment/configuration
- [ ] Supabase connection
- [ ] Database schema
- [ ] Image storage integration
- [ ] Study upload API
- [ ] Study retrieval API
- [ ] Mock AI provider
- [ ] Real AI provider interface
- [ ] Priority engine
- [ ] Waiting-time adjustment
- [ ] Queue API
- [ ] Review API
- [ ] Manual priority override
- [ ] Review/audit logs
- [ ] Analytics API
- [ ] Error handling
- [ ] Logging
- [ ] Unit tests
- [ ] API tests
- [ ] 40-study simulation
- [ ] Frontend API documentation
- [ ] Final architecture diagram

---

## Bottom Line

**My responsibility is to make the entire system work together.**

The ML member produces the AI signal.

The frontend member displays the worklist.

The explainability/evaluation member validates and explains the results.

**I build the layer that connects all of them into one reliable workflow.**
