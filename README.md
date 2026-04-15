# Student Smart Dashboard

Student Smart Dashboard is a full-stack school dashboard for Class 8 workflows.
It includes authentication, homework, attendance, books, analytics, profile management, and an AI assistant chat experience.

## Current Status

- Legacy RAG implementation has been removed from this repository.
- RAG-related services, ingestion scripts, health checks, and routes were deleted to prepare for a clean rebuild.
- The AI assistant currently runs in non-RAG mode.

## Quick Start

### Backend

Run from project root:

```powershell
.venv\Scripts\python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Backend URLs:

- API base: http://127.0.0.1:8000
- Swagger docs: http://127.0.0.1:8000/docs
- Health: http://127.0.0.1:8000/api/health

### Frontend

```powershell
cd frontend
npm install
npm run dev
```

Frontend URL:

- http://localhost:3000

### One-command local start

```powershell
.\start-servers.bat
```

## Core Features

- Local auth with JWT and secure password hashing
- Student profile and profile photo upload
- Homework tracking and submission
- Attendance and timetable views
- Books and chapter progress tracking
- Activity and insight pipelines
- AI assistant chat endpoint (non-RAG)

## Project Layout

```text
student dashboard/
|- main.py
|- requirements.txt
|- users.json
|- insights.json
|- backend/
|  |- auth_service.py
|  |- jwt_manager.py
|  |- secure_storage.py
|  |- activity_engine.py
|  |- ai_insight_engine.py
|  |- uploads/
|  |- data/
|- frontend/
|  |- src/
|  |- package.json
```

## API Notes

Important assistant endpoints:

- POST /api/assistant/chat
- GET /api/assistant/history/{uid}
- POST /chat (legacy compatibility endpoint)

## Environment

Create a local .env with at least:

```env
JWT_SECRET=replace_with_a_secure_secret
JWT_ALGORITHM=HS256
JWT_EXPIRE_DAYS=7
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
```

## RAG Rebuild Plan

This repository is now ready for a clean RAG implementation from scratch.

1. Define new RAG architecture and data contracts.
2. Add new RAG modules under a fresh folder structure.
3. Introduce ingestion and retrieval gradually behind feature flags.
4. Reconnect frontend flows only after backend contracts are stable.
