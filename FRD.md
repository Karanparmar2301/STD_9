# Functional Requirements Document (FRD)

**Project:** Student Smart Dashboard & AI Learning Platform
**Version:** 2.0
**Date:** March 2026
**Classification:** Internal Technical Documentation
**Status:** Final

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [System Architecture Overview](#2-system-architecture-overview)
3. [User Roles and Access Levels](#3-user-roles-and-access-levels)
4. [Complete Module List](#4-complete-module-list)
5. [Feature List per Module](#5-feature-list-per-module)
6. [Functional Description of Each Feature](#6-functional-description-of-each-feature)
7. [Workflow Descriptions](#7-workflow-descriptions)
8. [API Endpoints](#8-api-endpoints)
9. [Database Interaction Overview](#9-database-interaction-overview)
10. [System Dependencies](#10-system-dependencies)
11. [Assumptions and Constraints](#11-assumptions-and-constraints)

---

## 1. Project Overview

### 1.1 Purpose

The **Student Smart Dashboard** is a comprehensive, full-stack educational management platform designed for Class 8 students. It consolidates academic management tools — including homework tracking, attendance monitoring, a digital NCERT textbook library, performance analytics, and school announcements — into a single, unified interface. The platform is augmented by an AI-powered study assistant built on a Retrieval-Augmented Generation (RAG) pipeline that answers academic questions using uploaded textbook content as its exclusive knowledge source.

### 1.2 Scope

The system encompasses:
- A **React + Vite** single-page frontend application
- A **FastAPI + Python** RESTful backend
- A **local-first data storage** approach using JSON files (no external database)
- A **RAG pipeline** integrating Groq LLM and local Qdrant vector stores
- A **rule-based AI Insight Engine** for personalized academic analysis

### 1.3 Objectives

| # | Objective |
|:--|:--|
| 1 | Provide students with a single platform for all academic activities |
| 2 | Enable real-time tracking of homework, attendance, and performance |
| 3 | Deliver AI-powered, textbook-grounded academic support |
| 4 | Generate automated, contextual insights from student behaviour data |
| 5 | Offer a zero-database-configuration deployment experience |

---

## 2. System Architecture Overview

### 2.1 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     CLIENT TIER                             │
│    React 18 + Vite 5  ·  Redux Toolkit  ·  Framer Motion   │
│    Axios HTTP Client  ·  Recharts  ·  React Router          │
└───────────────────────────┬─────────────────────────────────┘
                            │  HTTP / REST API (JWT Bearer)
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                    APPLICATION TIER                         │
│           FastAPI + Uvicorn  ·  Python 3.10+                │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│   │ Auth Module  │  │ API Routers  │  │  Middleware Layer │ │
│   │ (JWT/bcrypt) │  │ (25+ routes) │  │  (CORS, Activity)│ │
│   └──────────────┘  └──────────────┘  └──────────────────┘ │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐ │
│   │ AI Insight   │  │ RAG Pipeline │  │ Activity Engine  │ │
│   │   Engine     │  │ (Groq+Qdrant)│  │  (Event Logger)  │ │
│   └──────────────┘  └──────────────┘  └──────────────────┘ │
└───────────────────────────┬─────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│                     DATA TIER                               │
│  users.json · activities.json · insights.json               │
│  uploads/ (PDFs, profile photos)  ·  Qdrant vector stores  │
└─────────────────────────────────────────────────────────────┘
```

### 2.2 Technology Stack

| Layer | Technology | Version | Role |
|:--|:--|:--|:--|
| **Frontend** | React | 18.2.0 | UI framework |
| **Frontend** | Vite | 5.x | Build tool & dev server |
| **Frontend** | Redux Toolkit | 2.0.1 | Global state management |
| **Frontend** | Framer Motion | 10.16.x | Animations & transitions |
| **Frontend** | Recharts | 3.7.0 | Data visualisation |
| **Frontend** | Axios | 1.6.2 | HTTP API client |
| **Backend** | FastAPI | 0.109+ | REST API framework |
| **Backend** | Uvicorn | 0.27+ | ASGI server |
| **Backend** | python-jose | 3.3.0 | JWT encoding/decoding |
| **Backend** | passlib (bcrypt) | 1.7.4 | Password hashing |
| **Backend** | python-dotenv | — | Environment config |
| **AI** | Groq API | — | LLM inference & Vision OCR |
| **AI** | Qdrant (local) | — | Vector database (RAG) |
| **AI** | HuggingFace (BAAI/bge) | — | Text embedding model |
| **Storage** | JSON files | — | users, insights, activities |

### 2.3 Component Interaction

```
Frontend (React)
    │── [Redux Store] manages global state slices:
    │       authSlice · homeworkSlice · activitySlice
    │       insightsSlice · performanceSlice · gamificationSlice (UI only)
    │
    │── [Axios API Service] sends authenticated requests to:
    │
Backend (FastAPI / main.py)
    │── JWT middleware validates Bearer token on every protected route
    │── Routes data to:
    │       activity_engine.py   → logs events to activities.json
    │       ai_insight_engine.py → generates insights to insights.json
    │       rag/rag_pipeline.py  → retrieves textbook answers via Groq+Qdrant
    │       _load_users()/_save_users() → reads/writes users.json
    │
Local JSON Data Store
    ├── users.json      (profiles, auth data)
    ├── activities.json (event logs per user)
    └── insights.json   (AI insights per user, 7-day TTL)
```

---

## 3. User Roles and Access Levels

### 3.1 Role Definitions

| Role | Description | Access Level |
|:--|:--|:--|
| **Student** | Primary user of the platform | Full access to all student-facing features |
| **Admin** | System operator with elevated privileges | ZIP cache management; direct backend control |

### 3.2 Student Permissions

| Feature | Permission |
|:--|:--|
| View own profile | ✅ Read |
| Edit own profile | ✅ Write |
| Upload profile photo | ✅ Write |
| View homework assignments | ✅ Read |
| Submit homework answers | ✅ Write |
| View attendance records | ✅ Read |
| Mark daily attendance | ✅ Write |
| Access digital book library | ✅ Read |
| Track chapter reading progress | ✅ Write |
| Download subject ZIP archives | ✅ Read |
| Use AI study assistant | ✅ Read/Write |
| View AI insights | ✅ Read |
| Dismiss / complete insights | ✅ Write |
| View timetable | ✅ Read |
| View announcements | ✅ Read |
| View performance analytics | ✅ Read |
| Access other users' data | ❌ Denied |

### 3.3 Admin Permissions

Admins inherit all student permissions, plus:

| Feature | Permission |
|:--|:--|
| Clear subject ZIP cache | ✅ Write |
| Trigger AI insight regeneration | ✅ Write |
| Direct backend API access | ✅ Full |

### 3.4 Authorization Enforcement

All protected endpoints require a valid JWT `Bearer` token in the `Authorization` header. The token payload contains the user's `uid`, which is cross-checked against the requested resource's `uid` parameter. Requests where these do not match receive an `HTTP 403 Forbidden` response.

---

## 4. Complete Module List

| # | Module | Description |
|:--|:--|:--|
| M1 | **Authentication & Session** | User registration, login, JWT lifecycle |
| M2 | **User Profile Management** | Personal, academic, parent, extracurricular data |
| M3 | **Academic Dashboard** | Welcome screen, KPI cards, quick actions, activity feed |
| M4 | **Homework Management** | Assignment display, filtering, answer submission |
| M5 | **Attendance Tracking** | Calendar view, progress stats, daily marking |
| M6 | **Digital Book Library** | Subject browser, PDF reader, chapter progress |
| M7 | **Performance Analytics** | Subject grades, skill breakdown, trend charts |
| M8 | **AI Insight Engine** | Rule-based insight generation, management, lifecycle |
| M9 | **AI Study Assistant (RAG)** | Textbook-grounded Q&A, intent routing, OCR |
| M10 | **Timetable** | Weekly schedule viewer, PDF export |
| M11 | **Announcements** | Categorised school notices, read tracking |
| M12 | **Activity Tracking** | Event logging, activity feed, statistics |

---

## 5. Feature List per Module

### M1 — Authentication & Session
- User registration with field validation
- Secure password hashing (bcrypt via passlib)
- JWT issuance on successful login (HS256)
- Token expiry management (configurable via `JWT_EXPIRE_DAYS`)
- Silent token verification on page load

### M2 — User Profile Management
- Multi-section profile (Personal · Academic · Parents · Extracurricular)
- Profile photo upload with MIME and size validation
- Static file serving for uploaded avatars
- Profile completion modal guiding new users

### M3 — Academic Dashboard
- Animated KPI summary cards (Chapters Read, Overall Average, Attendance, Homework)
- Four-bar progress overview (Books progress, Homework %, Attendance %, Academic Average)
- Clickable quick-action cards with gradient styling (7 actions)
- AI Insights panel (top 3 active insights)
- Live activity timeline from Redux store
- Dynamic motivation messages based on performance data

### M4 — Homework Management
- Fetch all homework assignments for the student's class
- Filter assignments by subject (10 subject filters)
- Pending/Completed tabs with animated transitions
- Per-card answer submission with real-time validation
- Duplicate submission prevention
- Stats grid: Total, Pending, Completed, Completion Rate %

### M5 — Attendance Tracking
- Calendar-view of daily attendance status
- Attendance progress bar and percentage display
- Weekly goal tracker
- Achievement badge display (e.g., "Perfect Month")
- Daily attendance marking endpoint

### M6 — Digital Book Library
- Browse 9 NCERT subjects with progress indicators
- Per-subject chapter listing with completion badges
- In-browser PDF viewer with scroll & time tracking
- Auto-completion detection (70% scroll OR 2 minutes read)
- Bulk ZIP download of entire subject with intelligent caching
- Cached ZIP invalidation (Admin)
- Reading progress persisted per user per chapter

### M7 — Performance Analytics
- Deterministic per-subject grade cards (seeded by UID for consistency)
- Subject flip-cards showing marks, grade, trend, and skill breakdown
- Overall average calculation and display
- Performance trend indicators (positive/negative/neutral)
- Grade badge display with colour coding

### M8 — AI Insight Engine
- Rule-based behavioral analysis (no LLM calls — fully deterministic)
- Triggers: activity count, homework completion, attendance rate, exam scores
- Insight types: Praise · Warning · Suggestion · Performance Improvement
- Insight severity levels: HIGH · MEDIUM · LOW
- User-facing actions: Dismiss · Mark as Completed
- Auto-expiry of insights after 7 days
- Maximum 20 active insights per user
- Insight statistics endpoint (by type, severity, status)
- Manual insight regeneration trigger

### M9 — AI Study Assistant (RAG)
- Context-aware chat with student name personalisation
- Automatic intent classification (RAG · greeting · motivation · homework · games · math · spelling · progress)
- RAG pipeline routing for academic questions
- Strictly textbook-grounded answers (Qdrant retrieval + Groq generation)
- Subject-specific retrieval filtering
- OCR support: upload images of questions → extract text → feed to RAG
- Chat history persistence per user
- Conversation context maintained across turns

### M10 — Timetable
- Hardcoded weekly 6-day class schedule per class-section
- "Now" indicator pulsating on the current class slot
- Next-Class widget showing upcoming period
- PDF export functionality
- Timetable grid component with configurable periods

### M11 — Announcements
- 20 hardcoded announcements across 6 categories: Student · Meeting · Event · Sports · Holiday · Important
- Priority levels: normal · high
- Per-announcement read/unread tracking (in-session)
- Unread count badge in Sidebar and Topbar
- Expandable announcement cards

### M12 — Activity Tracking
- Event logging for all major user interactions
- Standardised `EventType` enum for consistent categorisation
- Activity storage with 100-event rolling cap per user (FIFO)
- Recent activity feed (newest first)
- Activity statistics: count by type, count by subject, total events
- Auto-logging middleware (`@track_activity` decorator) for endpoints

---

## 6. Functional Description of Each Feature

### 6.1 Authentication — JWT Local Auth

**Description:** The system implements a fully self-contained authentication mechanism. User accounts are stored in a local `users.json` file. Passwords never leave the server in plaintext — they are hashed using bcrypt before storage.

**Process:**
1. On `POST /auth/signup`, the backend validates input, hashes the password, assigns a UUID, and writes the new user record to `users.json`.
2. On `POST /auth/login`, the backend locates the user record, verifies the password hash, and issues a signed JWT containing the user's `uid` and `email`.
3. Every protected route calls `verify_supabase_token()`, which decodes and validates the JWT signature and expiry. On failure, it raises `HTTP 401`.

**Configuration:** Controlled via `.env` keys — `JWT_SECRET`, `JWT_ALGORITHM` (default: `HS256`), `JWT_EXPIRE_DAYS` (default: `7`).

---

### 6.2 Profile Management — Multi-section Student Profile

**Description:** Student profiles are divided into four structured sections, each containing domain-specific fields.

| Section | Key Fields |
|:--|:--|
| **Personal** | `student_name`, `dob`, `gender`, `blood_group`, `address`, `phone` |
| **Academic** | `class_section`, `roll_number`, `admission_number`, `prev_term_grade`, `school_name` |
| **Parent / Guardian** | `father_name`, `mother_name`, `parent_contact`, `parent_email`, `emergency_contact` |
| **Extracurricular** | `sports`, `arts`, `music`, `clubs`, `achievements`, `awards`, `leadership_role` |

**Photo Upload:** Accepts `multipart/form-data`. Validates MIME type (`image/jpeg`, `image/png`, `image/webp`) and file size (≤ 5MB). Stores in `backend/uploads/profile_photos/`. Returns a publicly accessible URL via static file serving.

---

### 6.3 Digital Book System — Smart PDF Reader

**Description:** Students access NCERT subject PDFs via a paginated browser. The system tracks reading behaviour to mark chapters complete.

**Completion Criteria (OR logic):**
- Scroll depth ≥ 70% of the PDF page
- Time spent reading ≥ 120 seconds (2 minutes)

**Chapter Completion Flow:**
1. Frontend sends `POST /api/books/{uid}/progress` with `{subject, chapter, scroll_percent, time_spent}`.
2. Backend marks the chapter as `completed: true` in the user's profile.
3. Response includes `isCompleted` flag and `xpEarned: 0` (gamification disabled).

**ZIP Download Flow:**
1. Frontend calls `GET /api/books/{subject}/download-all`.
2. Backend checks for a cached ZIP at `backend/uploads/{subject}.zip`.
3. If absent or stale, it compresses all subject PDFs atomically into a new ZIP.
4. Returns the ZIP as a `FileResponse`.

---

### 6.4 AI Insight Engine — Rule-Based Analyser

**Description:** The `AIInsightEngine` class (`backend/ai_insight_engine.py`) analyses student data from multiple sources and generates structured, categorised insights without any LLM calls — making it deterministic, fast, and free.

**Insight Triggers:**

| Condition | Insight |
|:--|:--|
| `attendance_rate < 75%` | ⚠️ HIGH — Attendance warning |
| `activities_today >= 5` | 🌟 LOW — Engagement praise |
| `last_activity > 3 days ago` | 💡 MEDIUM — Re-engagement suggestion |
| `homework_completed == homework_total` | 🎉 LOW — Full completion praise |
| `avg_score < 60%` | 🚨 HIGH — Performance alert |
| `avg_score increased vs last period` | 📈 LOW — Improvement praise |

**Lifecycle:**
- Insights stored in `insights.json` with UUIDs, timestamps, and status (`active` / `dismissed` / `completed`).
- Auto-expire 7 days after creation.
- Maximum 20 active per user (oldest removed when cap reached).

---

### 6.5 AI Study Assistant (RAG) — Textbook-Grounded Q&A

**Description:** The AI assistant (`/api/assistant/chat`) uses a multi-step pipeline to answer student questions with content sourced exclusively from uploaded NCERT PDFs.

**Pipeline Steps:**

| Step | Component | Action |
|:--|:--|:--|
| 1. Receive | `main.py` | Accept question + optional image upload |
| 2. Classify | `classify_intent()` | Categorise intent (RAG, greeting, math, etc.) |
| 3. Retrieve | `rag/retriever.py` | Query Qdrant for top-K relevant text chunks |
| 4. Rerank | `rag/reranker.py` | Re-order chunks by semantic relevance |
| 5. Generate | `rag/rag_pipeline.py` | Send chunks + question to Groq LLM |
| 6. Respond | `main.py` | Return answer + sources to frontend |
| 7. Log | `activity_engine` | Record `AI_QUESTION_ASKED` event |

**OCR Support:** When an image is uploaded, `rag/image_reader.py` sends it to Groq Vision API, extracts the text, and substitutes it as the question.

**Non-RAG Intents:** Greetings, motivation requests, homework status, timetable info, and general tips are handled by dedicated response builders — not sent to the RAG pipeline — to preserve response speed.

---

### 6.6 Performance Analytics — Academic Dashboard

**Description:** Each student has a deterministic performance profile generated from a UID-seeded hash. This ensures consistent, realistic data without requiring actual exam data entry.

**Subject Performance Data (per subject):**

| Field | Description |
|:--|:--|
| `marks` | Seeded integer score (0–100) |
| `grade` | Letter grade computed from marks |
| `trend` | `positive` / `negative` / `neutral` |
| `skill_breakdown` | Dict of sub-skills with individual scores |
| `teacher_comment` | Auto-generated contextual comment |
| `exam_count` | Number of exams taken (seeded) |

**Overall Average:** Computed as the mean of all subject marks.

---

### 6.7 Activity Tracking — Event Logger

**Description:** The `ActivityEngine` class provides a clean API for logging any student interaction as a typed event. All events are stored in `backend/activities.json` with a rolling 100-event cap per user.

**Event Types (EventType Enum):**

| Category | Event Types |
|:--|:--|
| Homework | `HOMEWORK_OPENED`, `HOMEWORK_COMPLETED`, `HOMEWORK_SUBMITTED` |
| Attendance | `ATTENDANCE_MARKED`, `ATTENDANCE_MISSED` |
| Books | `BOOK_OPENED`, `PDF_VIEWED`, `SUBJECT_VIEWED` |
| Performance | `EXAM_SUBMITTED`, `SCORE_IMPROVED`, `PERFORMANCE_VIEWED` |
| AI | `AI_QUESTION_ASKED`, `AI_SUGGESTION_FOLLOWED` |
| General | `LOGIN`, `PROFILE_UPDATED`, `ANNOUNCEMENT_READ` |

---

## 7. Workflow Descriptions

### 7.1 User Onboarding Workflow

```
1. Student navigates to /login (redirected by Auth Guard if not logged in)
2. Clicks "Sign Up" → fills registration form
3. POST /auth/signup → backend hashes password → writes to users.json
4. Backend issues JWT → stored in Redux (authSlice)
5. ProfileCompletionModal appears, prompting section-by-section data entry
6. Dashboard loads with welcome animation
7. LOGIN event logged → AI Insight Engine evaluates initial state
```

### 7.2 AI Study Assistant Query Workflow

```
1. Student types question in chat interface (or uploads image)
2. If image: backend calls Groq Vision → extracts text → replaces question
3. classify_intent() determines category:
     ├── "what is photosynthesis?" → intent: 'rag'
     ├── "motivate me" → intent: 'motivation'
     └── "what's my homework?" → intent: 'homework'
4. For RAG intent:
     a. Qdrant retriever fetches top-5 textbook chunks
     b. Reranker orders by relevance score
     c. Chunks + question sent to Groq (Mixtral/LLaMA)
     d. Grounded answer returned with source citations
5. Chat history persisted locally
6. AI_QUESTION_ASKED event logged to activities.json
7. Response rendered with markdown formatting in frontend
```

### 7.3 PDF Reading & Progress Workflow

```
1. Student opens Subject Library → selects subject
2. SubjectPage lists all available PDF chapters
3. Student clicks chapter → PDFViewer opens
4. Frontend: scroll tracker + timer run in parallel
5. Either condition triggers completion:
     ├── scroll_percent >= 70 → POST /api/books/{uid}/progress
     └── time_spent >= 120s  → POST /api/books/{uid}/progress
6. Backend marks chapter completed in user profile
7. Chapter card updates with ✅ badge
8. BOOK_OPENED / PDF_VIEWED events logged
```

### 7.4 AI Insight Generation Workflow

```
1. Trigger: API call to POST /api/insights/generate (manual or automatic)
2. AIInsightEngine.analyze_user_activity() executes:
     a. Load user's recent activities (last 50)
     b. Evaluate attendance rate from profile
     c. Evaluate homework completion ratio
     d. Check last activity timestamp (inactivity detection)
     e. Evaluate subject performance averages
3. For each triggered rule: create Insight object with:
     - title, description, recommendation
     - type, severity, confidence, subject (if applicable)
     - UUID, UTC timestamp, status: 'active'
4. InsightStore.add_insight() persists to insights.json
     - Purges expired insights (> 7 days)
     - Enforces 20-insight cap (removes oldest)
5. Frontend fetches via GET /api/insights/{uid}
6. DashboardOverview renders top-3 active insights as cards
```

### 7.5 Homework Submission Workflow

```
1. Student views pending homework → selects assignment
2. Types answer → clicks Submit
3. POST /api/homework/submit → backend:
     a. Verifies JWT (403 if uid mismatch)
     b. Checks for duplicate submission (400 if already done)
     c. Fetches correct_answer from homework record
     d. Compares student_answer (case-insensitive)
4. If INCORRECT → return {correct: false, message: "Try again"}
5. If CORRECT:
     a. Record submission in homework_submissions
     b. Update user profile stats
     c. Return {correct: true, stats: {total, completed, pending}}
6. Frontend updates tab count, moves card to Completed tab
```

---

## 8. API Endpoints

### 8.1 Authentication

| Method | Endpoint | Description | Auth |
|:--|:--|:--|:--|
| `POST` | `/auth/signup` | Create new student account | ❌ Public |
| `POST` | `/auth/login` | Authenticate and receive JWT | ❌ Public |

### 8.2 Profile Management

| Method | Endpoint | Description | Auth |
|:--|:--|:--|:--|
| `GET` | `/api/profile/{uid}` | Get full student profile | ✅ JWT |
| `PUT` | `/api/profile/{uid}` | Update profile fields | ✅ JWT |
| `POST` | `/api/profile/{uid}/photo` | Upload profile photo (multipart) | ✅ JWT |

### 8.3 Academic Dashboard

| Method | Endpoint | Description | Auth |
|:--|:--|:--|:--|
| `GET` | `/api/timetable/{uid}` | Fetch weekly timetable | ✅ JWT |
| `GET` | `/api/holidays/2026` | Fetch 2026 holiday calendar | ✅ JWT |
| `GET` | `/api/announcements/{uid}` | Get all announcements + read status | ✅ JWT |
| `POST` | `/api/announcement/read` | Mark announcement as read | ✅ JWT |

### 8.4 Homework

| Method | Endpoint | Description | Auth |
|:--|:--|:--|:--|
| `GET` | `/api/homework/{uid}` | Get pending & completed assignments | ✅ JWT |
| `POST` | `/api/homework/submit` | Submit homework answer | ✅ JWT |

### 8.5 Attendance

| Method | Endpoint | Description | Auth |
|:--|:--|:--|:--|
| `GET` | `/api/attendance` | Get attendance records (mock data) | ✅ JWT |
| `POST` | `/api/attendance` | Mark daily attendance | ✅ JWT |

### 8.6 Digital Books

| Method | Endpoint | Description | Auth |
|:--|:--|:--|:--|
| `GET` | `/api/books` | List all subjects + progress overview | ✅ JWT |
| `GET` | `/api/books/{subject}` | List chapters for a subject | ✅ JWT |
| `POST` | `/api/books/{uid}/progress` | Update chapter reading progress | ✅ JWT |
| `GET` | `/api/books/{uid}/progress-all` | Get all subject progress data | ✅ JWT |
| `GET` | `/api/books/{subject}/zip-info` | Get ZIP archive metadata | ✅ JWT |
| `GET` | `/api/books/{subject}/download-all` | Download subject as ZIP file | ✅ JWT |
| `DELETE` | `/api/books/{subject}/zip-cache` | Clear cached ZIP (Admin) | ✅ JWT |

### 8.7 Games & Activities

| Method | Endpoint | Description | Auth |
|:--|:--|:--|:--|
| `POST` | `/api/game/complete` | Record game session completion | ✅ JWT |
| `GET` | `/api/games/stats/{uid}` | Get games played statistics | ✅ JWT |
| `GET` | `/api/activities/{uid}` | Get recent activity log | ✅ JWT |
| `GET` | `/api/activities/stats/{uid}` | Get activity statistics | ✅ JWT |

### 8.8 Performance Analytics

| Method | Endpoint | Description | Auth |
|:--|:--|:--|:--|
| `GET` | `/api/performance/{uid}` | Full academic performance dashboard | ✅ JWT |
| `GET` | `/api/subject-details/{uid}/{subject}` | Subject-specific flip-card data | ✅ JWT |
| `GET` | `/api/analytics/student/{uid}` | Game analytics summary | ✅ JWT |
| `GET` | `/api/analytics/performance/{uid}` | XP & progress chart data | ✅ JWT |

### 8.9 AI Insights

| Method | Endpoint | Description | Auth |
|:--|:--|:--|:--|
| `GET` | `/api/insights/{uid}` | Get active AI insights for user | ✅ JWT |
| `POST` | `/api/insights/dismiss` | Dismiss an insight | ✅ JWT |
| `POST` | `/api/insights/complete` | Mark insight as completed | ✅ JWT |
| `POST` | `/api/insights/generate` | Trigger insight analysis | ✅ JWT |
| `GET` | `/api/insights/stats/{uid}` | Get insight statistics | ✅ JWT |

### 8.10 AI Study Assistant (RAG)

| Method | Endpoint | Description | Auth |
|:--|:--|:--|:--|
| `POST` | `/api/assistant/chat` | Primary chat endpoint (intent-aware) | ✅ JWT |
| `GET` | `/api/assistant/history/{uid}` | Get chat history | ✅ JWT |
| `POST` | `/api/assistant/rag-chat` | Direct RAG endpoint (supports image) | ✅ JWT |
| `POST` | `/chat` | Lightweight fallback chat endpoint | ✅ JWT |

---

## 9. Database Interaction Overview

### 9.1 Storage Architecture

The system uses a **local-first JSON storage pattern** as its primary persistence layer. There is no external database (PostgreSQL, MySQL, etc.). All data is read from and written to JSON files on the server's local filesystem.

> **Note:** The codebase contains a `supabase_query()` function that is effectively a no-op — it returns empty results silently. This is a legacy scaffold; active data operations use the JSON layer exclusively.

### 9.2 Data Stores

#### `users.json` — Primary User Store

```json
{
  "uid-xxxx": {
    "uid": "string",
    "email": "string",
    "password_hash": "string (bcrypt)",
    "student_name": "string",
    "class_section": "string",
    "roll_number": "string",
    "phone": "string",
    "dob": "string",
    "gender": "string",
    "blood_group": "string",
    "address": "string",
    "father_name": "string",
    "mother_name": "string",
    "parent_contact": "string",
    "parent_email": "string",
    "school_name": "string",
    "prev_term_grade": "string",
    "sports": "string",
    "arts": "string",
    "clubs": "string",
    "achievements": "string",
    "profile_photo_url": "string",
    "attendance_percentage": "number",
    "homework_completed": "number",
    "homework_total": "number",
    "games_played": "number",
    "book_progress": { "chapter_key": { "completed": true, "timestamp": "..." } },
    "created_at": "ISO timestamp"
  }
}
```

#### `activities.json` — Activity Event Log

```json
{
  "uid-xxxx": [
    {
      "event_id": "uuid",
      "user_id": "string",
      "event_type": "HOMEWORK_COMPLETED",
      "title": "string",
      "description": "string",
      "subject": "string | null",
      "xp_earned": 0,
      "impact_score": 1,
      "metadata": {},
      "timestamp": "ISO timestamp"
    }
  ]
}
```

> **Capacity:** Maximum 100 events per user. Oldest events are discarded when the cap is reached (FIFO).

#### `insights.json` — AI Insight Store

```json
{
  "uid-xxxx": [
    {
      "insight_id": "uuid",
      "type": "PERFORMANCE_IMPROVEMENT | ATTENDANCE_WARNING | ...",
      "severity": "HIGH | MEDIUM | LOW",
      "title": "string",
      "description": "string",
      "recommendation": "string",
      "subject": "string | null",
      "confidence": 0.85,
      "status": "active | dismissed | completed",
      "timestamp": "ISO timestamp",
      "updated_at": "ISO timestamp | null"
    }
  ]
}
```

> **Capacity:** Maximum 20 active insights per user. TTL: 7 days from `timestamp`.

### 9.3 File Storage

| Path | Contents |
|:--|:--|
| `backend/uploads/profile_photos/` | User profile images (JPG, PNG, WebP) |
| `backend/data/` | Source NCERT PDF files per subject |
| `backend/uploads/Std_8_{subject}/` | Processed/chunked PDF fragments |
| `backend/uploads/{subject}.zip` | Cached subject ZIP archives |
| `backend/rag/` | Qdrant vector store data directory |

---

## 10. System Dependencies

### 10.1 Backend Dependencies

| Package | Version | Purpose |
|:--|:--|:--|
| `fastapi` | `≥0.109.0` | API framework |
| `uvicorn` | `≥0.27.0` | ASGI server |
| `python-jose[cryptography]` | `3.3.0` | JWT auth |
| `passlib[bcrypt]` | `1.7.4` | Password hashing |
| `python-dotenv` | `*` | .env loading |
| `pydantic` | `v2` | Request/response validation |
| `python-multipart` | `*` | File upload handling |
| `groq` | `*` | Groq LLM API client |
| `qdrant-client` | `*` | Qdrant vector store |
| `langchain` | `≥0.2` | RAG orchestration |
| `langchain-community` | `*` | HuggingFace embeddings bridge |
| `sentence-transformers` | `*` | BAAI/bge embedding model |
| `PyMuPDF` / `pdfplumber` | `*` | PDF text extraction |

### 10.2 Frontend Dependencies

| Package | Version | Purpose |
|:--|:--|:--|
| `react` | `18.2.0` | UI library |
| `react-dom` | `18.2.0` | DOM rendering |
| `vite` | `5.x` | Build tool & dev server |
| `@reduxjs/toolkit` | `2.0.1` | State management |
| `react-redux` | `9.x` | React-Redux bindings |
| `react-router-dom` | `6.x` | Client-side routing |
| `axios` | `1.6.2` | HTTP client |
| `framer-motion` | `10.16.x` | Animations |
| `recharts` | `3.7.0` | SVG charts |

### 10.3 External Services

| Service | Usage | Required |
|:--|:--|:--|
| **Groq API** | LLM inference (RAG answers) + Vision OCR | ✅ Yes (for AI features) |
| **HuggingFace Hub** | Download `BAAI/bge-large-en-v1.5` model | ✅ First run only |

### 10.4 Runtime Environment

| Requirement | Detail |
|:--|:--|
| OS | Windows (primary; cross-platform compatible) |
| Python | 3.10+ |
| Node.js | 18+ (LTS) |
| RAM | Minimum 4GB (8GB recommended for embedding model) |
| Disk | Minimum 2GB for PDF data + vector stores |
| Network | Required only for Groq API calls |

---

## 11. Assumptions and Constraints

### 11.1 Assumptions

| # | Assumption |
|:--|:--|
| A1 | One user per device session; multi-account management is not required |
| A2 | All NCERT PDFs are pre-loaded into `backend/data/` before deployment |
| A3 | The Groq API key is set in `.env` for all AI features to function |
| A4 | The embedding model (`BAAI/bge-large-en-v1.5`) is downloaded on first backend startup |
| A5 | Attendance data is mock-generated; real integration is a future enhancement |
| A6 | Timetable data is hardcoded for Class 8 sections; changes require code edits |
| A7 | The system is deployed on a single server (no horizontal scaling) |
| A8 | A single `.venv` Python virtual environment is used for the backend |

### 11.2 Constraints

| # | Constraint | Impact |
|:--|:--|:--|
| C1 | **No external database** — all data is stored in local JSON files | Single-server deployment only; no replication |
| C2 | **JSON file concurrency** — no transaction isolation on file writes | Potential race conditions under high concurrent write load |
| C3 | **Activities capped at 100 per user** | Oldest events are permanently lost when cap is exceeded |
| C4 | **Insights capped at 20 per user** with 7-day TTL | Historical insight data is not preserved long-term |
| C5 | **Groq API dependency** for AI features | If Groq is unavailable, the AI assistant cannot generate answers |
| C6 | **Embedding model is CPU-bound** (no GPU acceleration configured) | Backend startup is slow (~30-60 seconds) on first load |
| C7 | **Homework data sourced from `supabase_query()`** which is a no-op | Homework features require future database integration to function fully |
| C8 | **No email verification** on signup | Accounts can be created with any email format |
| C9 | **No password reset flow** | Users who forget passwords cannot self-serve recovery |
| C10 | **Profile photos are local only** | Photos are not replicated or backed up externally |

### 11.3 Known Limitations

- The `supabase_query()` function is present throughout `main.py` but always returns `[]`. Features that depend on it (e.g., alumni-style homework from a database table) will return empty or placeholder data.
- Attendance marking is accepted by the API but does not yet update a persistent attendance record in `users.json`; the UI displays mock-generated data.
- Games functionality tracks a `games_played` counter in `users.json` but does not store individual game session data.
- The analytics endpoint (`/api/analytics/performance/{uid}`) returns empty chart arrays since the `xp_events` table (expected by legacy Supabase code) does not exist.

---

## Appendix A — Environment Configuration

```env
# ── Authentication ──────────────────────────────────
JWT_SECRET=your_super_secret_key_here
JWT_ALGORITHM=HS256
JWT_EXPIRE_DAYS=7

# ── Server ───────────────────────────────────────────
CORS_ORIGINS=http://localhost:3000,http://127.0.0.1:3000

# ── AI (Groq) ────────────────────────────────────────
GROQ_API_KEY=gsk_your_groq_api_key_here
```

---

## Appendix B — Key File Reference

| File | Role |
|:--|:--|
| `main.py` | FastAPI application — all routes, middleware, helper functions |
| `backend/activity_engine.py` | Activity event logger and engine |
| `backend/activity_store.py` | JSON persistence for activity events |
| `backend/activity_middleware.py` | `@track_activity` decorator for auto-logging |
| `backend/ai_insight_engine.py` | Rule-based student insight analyser |
| `backend/insight_store.py` | CRUD + TTL + cap management for insights.json |
| `backend/rag/rag_pipeline.py` | End-to-end RAG orchestrator |
| `backend/rag/retriever.py` | Qdrant vector search |
| `backend/rag/reranker.py` | Semantic result re-ranking |
| `backend/rag/embeddings.py` | HuggingFace embedding model wrapper |
| `backend/rag/image_reader.py` | Groq Vision OCR for image queries |
| `frontend/src/store/` | All Redux Toolkit state slices |
| `frontend/src/services/api.js` | Centralised Axios API service |
| `frontend/src/components/` | All reusable UI components |
| `frontend/src/pages/` | Route-level page components |
| `users.json` | Primary user data store |
| `insights.json` | AI insight persistence |
| `backend/activities.json` | Student event activity log |

---

*Document generated by automated codebase analysis — March 2026.*
*This FRD reflects the current state of the codebase as of the documented version.*
