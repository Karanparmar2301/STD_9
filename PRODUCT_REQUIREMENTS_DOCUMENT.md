# Product Requirements Document

## Product Overview

The product is a local-first, AI-enabled student learning dashboard focused on Class 8 academic workflows. It combines authentication, profile management, attendance, homework tracking, announcements, books/PDF reading, timetable, performance analytics, activity tracking, and an AI assistant (including RAG over uploaded textbooks).

Primary implementation stack:
- Frontend: React + Vite + Redux Toolkit + Framer Motion + Recharts
- Backend: FastAPI + JWT auth + JSON storage
- AI/RAG: Groq LLM + Qdrant vector search + sentence-transformers reranker
- Data persistence: JSON files and local file system assets (no relational DB configured)

There are two backend entrypoints:
- Main production-like backend: main.py at workspace root
- Legacy/minimal backend chatbot: backend/main.py

## Goals and Objectives

1. Provide students with one consolidated portal for day-to-day school operations.
2. Enable progress visibility across attendance, homework, books, and performance.
3. Offer textbook-grounded AI assistance through RAG for safer academic responses.
4. Track user learning behavior and generate actionable insights.
5. Keep deployment simple with local JSON-based persistence and minimal infra requirements.

## Target Users

1. Primary: Class 8 students.
2. Secondary (data model presence only): Parents (parent metadata fields, parent-meeting announcement category).
3. Operational role (partially implemented): Admin for book ZIP cache control.
4. Not implemented as active user-facing dashboards: Teacher, Parent dashboard, Admin dashboard.

## System Architecture Overview

### High-Level Architecture

1. React SPA calls backend via Vite proxy.
2. FastAPI serves auth, dashboard APIs, books, analytics, activity/insight systems, and AI assistant endpoints.
3. Persistent data is stored in local JSON/files:
   - users.json
   - backend/activities.json
   - insights.json
   - backend/uploads/*
   - backend/holidays_2026.json
4. RAG subsystem:
   - Upload and content corpus under backend/data and backend/uploads
   - Vector DB via Qdrant collection class8_textbooks
   - Embeddings with BAAI/bge-large-en-v1.5
   - Hybrid retrieval + reranking + translation + Groq answer generation

### Runtime Routing

- frontend/vite.config.js proxies:
  - /api -> http://127.0.0.1:8000
  - /auth -> http://127.0.0.1:8000
  - /chat -> http://127.0.0.1:8000
  - /uploads -> http://127.0.0.1:8000

## Step 1 - Project Structure Analysis

### Complete First-Party Structure

The following includes all first-party files/folders in the workspace (excluding dependency/cache directories like node_modules, .venv, __pycache__).

```text
FRD.md
README.md
main.py
requirements.txt
package.json
restart-servers.bat
start-servers.bat
users.json
insights.json

backend/.env
backend/activities.json
backend/activity_engine.py
backend/activity_middleware.py
backend/activity_store.py
backend/ai_insight_engine.py
backend/ai_insights.py
backend/chunk_documents.py
backend/create_embeddings.py
backend/holidays_2026.json
backend/insight_store.py
backend/load_documents.py
backend/main.py
backend/rag_logs.jsonl
backend/rag_pipeline.py
backend/retrieve_documents.py
backend/store_vectors_qdrant.py

backend/data/Arts book.pdf
backend/data/English book.pdf
backend/data/Hindi book.pdf
backend/data/Maths book.pdf
backend/data/physical education.pdf
backend/data/Sanskrit book.pdf
backend/data/Science book.pdf
backend/data/Social science book.pdf
backend/data/vocational education.pdf

backend/data/subject_stores/arts/fingerprint.txt
backend/data/subject_stores/arts/index.faiss
backend/data/subject_stores/arts/store.pkl
backend/data/subject_stores/english/fingerprint.txt
backend/data/subject_stores/english/index.faiss
backend/data/subject_stores/english/store.pkl
backend/data/subject_stores/hindi/fingerprint.txt
backend/data/subject_stores/hindi/index.faiss
backend/data/subject_stores/hindi/store.pkl
backend/data/subject_stores/mathematics/fingerprint.txt
backend/data/subject_stores/mathematics/index.faiss
backend/data/subject_stores/mathematics/store.pkl
backend/data/subject_stores/physical_education/fingerprint.txt
backend/data/subject_stores/physical_education/index.faiss
backend/data/subject_stores/physical_education/store.pkl
backend/data/subject_stores/sanskrit/fingerprint.txt
backend/data/subject_stores/sanskrit/index.faiss
backend/data/subject_stores/sanskrit/store.pkl
backend/data/subject_stores/science/fingerprint.txt
backend/data/subject_stores/science/index.faiss
backend/data/subject_stores/science/store.pkl
backend/data/subject_stores/social_studies/fingerprint.txt
backend/data/subject_stores/social_studies/index.faiss
backend/data/subject_stores/social_studies/store.pkl
backend/data/subject_stores/vocational_education/fingerprint.txt
backend/data/subject_stores/vocational_education/index.faiss
backend/data/subject_stores/vocational_education/store.pkl

backend/rag/__init__.py
backend/rag/chunker.py
backend/rag/embeddings.py
backend/rag/image_reader.py
backend/rag/loader.py
backend/rag/rag_pipeline.py
backend/rag/reingest.py
backend/rag/reranker.py
backend/rag/retriever.py
backend/rag/translator.py

backend/uploads/Std_8_eng_full.zip
backend/uploads/Std_8_math_full.zip
backend/uploads/profile_photos/41647fe0-1b2e-4800-a1d9-9684d7bb595b_20260307_154147.jpg

backend/uploads/Std_8_arts/Chapter 1.pdf
backend/uploads/Std_8_arts/Chapter 2.pdf
backend/uploads/Std_8_arts/Chapter 3.pdf
backend/uploads/Std_8_arts/Chapter 4.pdf
backend/uploads/Std_8_arts/Chapter 6.pdf
backend/uploads/Std_8_arts/Chapter 7.pdf
backend/uploads/Std_8_arts/Chapter 8.pdf
backend/uploads/Std_8_arts/Chapter 9.pdf
backend/uploads/Std_8_arts/Chapter 10.pdf
backend/uploads/Std_8_arts/Chapter 11.pdf
backend/uploads/Std_8_arts/Chapter 12.pdf
backend/uploads/Std_8_arts/Chapter 13.pdf
backend/uploads/Std_8_arts/Chapter 14.pdf
backend/uploads/Std_8_arts/Chapter 15.pdf
backend/uploads/Std_8_arts/Chapter 16.pdf
backend/uploads/Std_8_arts/Chapter 17.pdf
backend/uploads/Std_8_arts/Chapter 18.pdf
backend/uploads/Std_8_arts/Chapter 19.pdf
backend/uploads/Std_8_arts/Index.pdf

backend/uploads/Std_8_eng/Chapter 1.pdf
backend/uploads/Std_8_eng/Chapter 2.pdf
backend/uploads/Std_8_eng/Chapter 3.pdf
backend/uploads/Std_8_eng/Chapter 4.pdf
backend/uploads/Std_8_eng/Chapter 5.pdf
backend/uploads/Std_8_eng/INTRO.pdf
backend/uploads/Std_8_eng/UNIT.pdf

backend/uploads/Std_8_hindi/Chapter 1.pdf
backend/uploads/Std_8_hindi/Chapter 2.pdf
backend/uploads/Std_8_hindi/Chapter 3.pdf
backend/uploads/Std_8_hindi/Chapter 4.pdf
backend/uploads/Std_8_hindi/Chapter 5.pdf
backend/uploads/Std_8_hindi/Chapter 6.pdf
backend/uploads/Std_8_hindi/Chapter 7.pdf
backend/uploads/Std_8_hindi/Chapter 8.pdf
backend/uploads/Std_8_hindi/Chapter 9.pdf
backend/uploads/Std_8_hindi/Chapter 10.pdf
backend/uploads/Std_8_hindi/Index.pdf

backend/uploads/Std_8_math/Chapter 1.pdf
backend/uploads/Std_8_math/Chapter 2.pdf
backend/uploads/Std_8_math/Chapter 3.pdf
backend/uploads/Std_8_math/Chapter 4.pdf
backend/uploads/Std_8_math/Chapter 5.pdf
backend/uploads/Std_8_math/Chapter 6.pdf
backend/uploads/Std_8_math/Chapter 7.pdf
backend/uploads/Std_8_math/Index.pdf

backend/uploads/Std_8_physed/Annexure.pdf
backend/uploads/Std_8_physed/Chapter 1.pdf
backend/uploads/Std_8_physed/Chapter 2.pdf
backend/uploads/Std_8_physed/Chapter 3.pdf
backend/uploads/Std_8_physed/Chapter 4.pdf
backend/uploads/Std_8_physed/Chapter 5.pdf
backend/uploads/Std_8_physed/Chapter 6.pdf
backend/uploads/Std_8_physed/Index.pdf
backend/uploads/Std_8_physed/Warm-up and cool down.pdf

backend/uploads/Std_8_sanskrit/Chapter 1.pdf
backend/uploads/Std_8_sanskrit/Chapter 2.pdf
backend/uploads/Std_8_sanskrit/Chapter 3.pdf
backend/uploads/Std_8_sanskrit/Chapter 4.pdf
backend/uploads/Std_8_sanskrit/Chapter 5.pdf
backend/uploads/Std_8_sanskrit/Chapter 6.pdf
backend/uploads/Std_8_sanskrit/Chapter 7.pdf
backend/uploads/Std_8_sanskrit/Chapter 8.pdf
backend/uploads/Std_8_sanskrit/Chapter 9.pdf
backend/uploads/Std_8_sanskrit/Chapter 10.pdf
backend/uploads/Std_8_sanskrit/Chapter 11.pdf
backend/uploads/Std_8_sanskrit/Chapter 12.pdf
backend/uploads/Std_8_sanskrit/Chapter 13.pdf
backend/uploads/Std_8_sanskrit/Chapter 14.pdf
backend/uploads/Std_8_sanskrit/Chapter 15.pdf
backend/uploads/Std_8_sanskrit/Chapter 16.pdf
backend/uploads/Std_8_sanskrit/Chapter 17.pdf
backend/uploads/Std_8_sanskrit/index.pdf

backend/uploads/Std_8_science/Chapter 1.pdf
backend/uploads/Std_8_science/Chapter 2.pdf
backend/uploads/Std_8_science/Chapter 3.pdf
backend/uploads/Std_8_science/Chapter 4.pdf
backend/uploads/Std_8_science/Chapter 5.pdf
backend/uploads/Std_8_science/Chapter 6.pdf
backend/uploads/Std_8_science/Chapter 7.pdf
backend/uploads/Std_8_science/Chapter 8.pdf
backend/uploads/Std_8_science/Chapter 9.pdf
backend/uploads/Std_8_science/Chapter 10.pdf
backend/uploads/Std_8_science/Chapter 11.pdf
backend/uploads/Std_8_science/Chapter 12.pdf
backend/uploads/Std_8_science/Chapter 13.pdf
backend/uploads/Std_8_science/INDEX.pdf
backend/uploads/Std_8_science/INTRO.pdf

backend/uploads/Std_8_social/Chapter 1.pdf
backend/uploads/Std_8_social/Chapter 2.pdf
backend/uploads/Std_8_social/Chapter 3.pdf
backend/uploads/Std_8_social/Chapter 4.pdf
backend/uploads/Std_8_social/Chapter 5.pdf
backend/uploads/Std_8_social/Chapter 6.pdf
backend/uploads/Std_8_social/Chapter 7.pdf
backend/uploads/Std_8_social/Index.pdf
backend/uploads/Std_8_social/intro.pdf

backend/uploads/Std_8_voced/Chapter 1.pdf
backend/uploads/Std_8_voced/Chapter 2.pdf
backend/uploads/Std_8_voced/Chapter 3.pdf
backend/uploads/Std_8_voced/Chapter 4.pdf
backend/uploads/Std_8_voced/Chapter 5.pdf
backend/uploads/Std_8_voced/Chapter 6.pdf
backend/uploads/Std_8_voced/Chapter 7.pdf
backend/uploads/Std_8_voced/Chapter 8.pdf
backend/uploads/Std_8_voced/Index.pdf

frontend/index.html
frontend/package.json
frontend/package-lock.json
frontend/vite.config.js

frontend/src/App.css
frontend/src/App.jsx
frontend/src/index.css
frontend/src/main.jsx

frontend/src/components/AIAssistant.css
frontend/src/components/AIAssistant.jsx
frontend/src/components/AIInsightCard.css
frontend/src/components/AIInsightCard.jsx
frontend/src/components/AnalyticsDashboard.css
frontend/src/components/AnalyticsDashboard.jsx
frontend/src/components/Announcements.css
frontend/src/components/Announcements.jsx
frontend/src/components/Attendance.css
frontend/src/components/Attendance.jsx
frontend/src/components/Books.css
frontend/src/components/Books.jsx
frontend/src/components/CelebrationScreen.css
frontend/src/components/CelebrationScreen.jsx
frontend/src/components/DashboardOverview.css
frontend/src/components/DashboardOverview.jsx
frontend/src/components/HolidayKPI.css
frontend/src/components/HolidayKPI.jsx
frontend/src/components/Homework.css
frontend/src/components/Homework.jsx
frontend/src/components/HomeworkCard.css
frontend/src/components/HomeworkCard.jsx
frontend/src/components/ImageCropModal.css
frontend/src/components/ImageCropModal.jsx
frontend/src/components/InfoCard.css
frontend/src/components/InfoCard.jsx
frontend/src/components/Performance.css
frontend/src/components/Performance.jsx
frontend/src/components/ProfileCompletionModal.css
frontend/src/components/ProfileCompletionModal.jsx
frontend/src/components/ProfileEditDrawer.css
frontend/src/components/ProfileEditDrawer.jsx
frontend/src/components/ProfileMenu.css
frontend/src/components/ProfileMenu.jsx
frontend/src/components/Sidebar.css
frontend/src/components/Sidebar.jsx
frontend/src/components/SkeletonLoader.css
frontend/src/components/SkeletonLoader.jsx
frontend/src/components/Timetable.css
frontend/src/components/Timetable.jsx
frontend/src/components/Topbar.css
frontend/src/components/Topbar.jsx

frontend/src/components/attendance/AttendanceCalendar.css
frontend/src/components/attendance/AttendanceCalendar.jsx
frontend/src/components/attendance/AttendanceProgress.css
frontend/src/components/attendance/AttendanceProgress.jsx
frontend/src/components/attendance/AttendanceStatsCard.css
frontend/src/components/attendance/AttendanceStatsCard.jsx
frontend/src/components/attendance/WeeklyGoalTracker.css
frontend/src/components/attendance/WeeklyGoalTracker.jsx

frontend/src/components/notifications/AttendanceReminder.css
frontend/src/components/notifications/AttendanceReminder.jsx

frontend/src/components/timetable/NextClassWidget.css
frontend/src/components/timetable/NextClassWidget.jsx
frontend/src/components/timetable/SubjectCard.css
frontend/src/components/timetable/SubjectCard.jsx
frontend/src/components/timetable/TimetableGrid.css
frontend/src/components/timetable/TimetableGrid.jsx

frontend/src/pages/Auth.css
frontend/src/pages/Dashboard.css
frontend/src/pages/Dashboard.jsx
frontend/src/pages/Login.jsx
frontend/src/pages/PDFViewer.css
frontend/src/pages/PDFViewer.jsx
frontend/src/pages/ProfilePage.css
frontend/src/pages/ProfilePage.jsx
frontend/src/pages/ProfilePage_OLD.css.bak
frontend/src/pages/ProfilePage_OLD.jsx.bak
frontend/src/pages/ProfilePage_SIMPLE.css.bak
frontend/src/pages/ProfilePage_SIMPLE.jsx.bak
frontend/src/pages/Signup.jsx
frontend/src/pages/SubjectPage.css
frontend/src/pages/SubjectPage.jsx

frontend/src/services/api.js

frontend/src/store/activitySlice.js
frontend/src/store/aiSlice.js
frontend/src/store/announcementsSlice.js
frontend/src/store/attendanceSlice.js
frontend/src/store/authSlice.js
frontend/src/store/gamesSlice.js
frontend/src/store/gamificationSlice.js
frontend/src/store/holidaysSlice.js
frontend/src/store/homeworkSlice.js
frontend/src/store/index.js
frontend/src/store/insightsSlice.js
frontend/src/store/performanceSlice.js
frontend/src/store/studentSlice.js
frontend/src/store/ThemeContext.jsx
frontend/src/store/timetableSlice.js
frontend/src/store/uiSlice.js
```

### Folder-to-Purpose Relationships

1. Root level:
   - main.py is the main API application.
   - users.json and insights.json are persistent stores.
   - start/restart batch files orchestrate local startup.
2. backend/:
   - Legacy service and AI utility pipelines.
   - Activity and insight engines with JSON persistence.
   - RAG pipeline and ingest tools.
3. backend/data and backend/uploads:
   - Textbook source files and chapter-level content distribution.
   - Precomputed FAISS stores and cache artifacts.
4. frontend/src/pages:
   - Route-level pages (auth, dashboard, profile, subject, PDF viewer).
5. frontend/src/components:
   - Feature panels and reusable UI blocks.
6. frontend/src/store:
   - Domain-oriented Redux slices and orchestrated listener middleware.
7. frontend/src/services:
   - HTTP client abstraction and endpoint wrappers.

## Step 2 - Feature Extraction

### Implemented Features with File Mapping

1. JWT Authentication (signup/login/session restore)
   - Description: Local account creation and login with JWT token issuance, token validation, and guarded routes.
   - Surface: Login/Signup pages and PrivateRoute.
   - Files: main.py, frontend/src/store/authSlice.js, frontend/src/pages/Login.jsx, frontend/src/pages/Signup.jsx, frontend/src/App.jsx, frontend/src/services/api.js

2. Student Dashboard Shell and Section Navigation
   - Description: Sidebar/topbar navigation across dashboard modules with section-based rendering.
   - Surface: Dashboard page + Sidebar/Topbar.
   - Files: frontend/src/pages/Dashboard.jsx, frontend/src/components/Sidebar.jsx, frontend/src/components/Topbar.jsx, frontend/src/store/uiSlice.js

3. Student Profile Create/Edit + Photo Upload
   - Description: Profile existence check, creation/update flow, structured personal/parent/academic/extracurricular metadata, image upload and crop.
   - Surface: Profile completion modal, profile drawer/page.
   - Files: main.py, frontend/src/pages/ProfilePage.jsx, frontend/src/components/ProfileCompletionModal.jsx, frontend/src/components/ProfileEditDrawer.jsx, frontend/src/components/ImageCropModal.jsx, frontend/src/store/studentSlice.js

4. Homework Management and Submission Validation
   - Description: Class-based homework retrieval, pending/completed split, answer validation, duplicate prevention, completion stats.
   - Surface: Homework section with tabs and filters.
   - Files: main.py, frontend/src/components/Homework.jsx, frontend/src/components/HomeworkCard.jsx, frontend/src/store/homeworkSlice.js

5. Attendance Tracking and Analytics UI
   - Description: Fetch/mark attendance, derived risk/streak metrics, calendar and weekly summaries, holiday-aware selectors.
   - Surface: Attendance dashboard widgets.
   - Files: main.py, frontend/src/components/Attendance.jsx, frontend/src/components/attendance/*, frontend/src/store/attendanceSlice.js, frontend/src/store/holidaysSlice.js, backend/holidays_2026.json

6. Announcements Feed with Read Status
   - Description: Category-filtered announcements, search, read marking, unread indicators in UI.
   - Surface: Announcements panel and topbar badge.
   - Files: main.py, frontend/src/components/Announcements.jsx, frontend/src/store/announcementsSlice.js

7. Digital Books Catalog and Subject Library
   - Description: Subject listing, chapter listing, favorites, per-subject progress summaries, download all as ZIP with cache.
   - Surface: Books dashboard and subject page.
   - Files: main.py, frontend/src/components/Books.jsx, frontend/src/pages/SubjectPage.jsx, frontend/src/services/api.js, backend/uploads/*

8. PDF Reader with Progress Tracking
   - Description: Chapter viewer with previous/next, zoom/fullscreen controls, completion thresholds (time/scroll/action), activity logging.
   - Surface: PDFViewer page.
   - Files: frontend/src/pages/PDFViewer.jsx, main.py, frontend/src/store/activitySlice.js

9. Timetable Management and Next Class UI
   - Description: Fixed class timetable API with printable/exportable UI and next class components.
   - Surface: Timetable module.
   - Files: main.py, frontend/src/components/Timetable.jsx, frontend/src/components/timetable/*, frontend/src/store/timetableSlice.js

10. Performance Dashboard and Subject Intelligence
   - Description: Deterministic performance generation by uid, monthly trends, subject-level modal intelligence integrating timetable and analytics context.
   - Surface: Performance page and subject details modal.
   - Files: main.py, frontend/src/components/Performance.jsx, frontend/src/store/performanceSlice.js

11. Activity Tracking Engine
   - Description: Event logging, recent feed, per-type and per-subject stats, manual logging endpoint.
   - Surface: Dashboard timeline and backend APIs.
   - Files: backend/activity_engine.py, backend/activity_store.py, backend/activity_middleware.py, main.py, frontend/src/store/activitySlice.js

12. Insight Engine (Rule-Based)
   - Description: Insight generation, persistence, status lifecycle (active/dismissed/completed), severity filtering.
   - Surface: Dashboard insight cards and insight APIs.
   - Files: backend/ai_insight_engine.py, backend/insight_store.py, main.py, frontend/src/store/insightsSlice.js, frontend/src/components/AIInsightCard.jsx

13. AI Assistant (Intent + RAG Routing)
   - Description: Conversational assistant with intent routing; personal queries can use rule/chat mode; academic queries route to RAG.
   - Surface: AI Assistant module and chat history.
   - Files: main.py, frontend/src/components/AIAssistant.jsx, frontend/src/store/aiSlice.js, frontend/src/services/api.js

14. RAG Textbook QA (Hybrid Retrieval)
   - Description: Hybrid vector+keyword retrieval, reranking, multilingual translation, optional OCR image assist, source-aware generation.
   - Surface: /api/assistant/rag-chat and /chat endpoints.
   - Files: backend/rag/rag_pipeline.py, backend/rag/retriever.py, backend/rag/reranker.py, backend/rag/translator.py, backend/rag/image_reader.py, backend/rag/embeddings.py

15. Startup/Operations Scripts
   - Description: One-click backend+frontend startup and restart flows.
   - Files: start-servers.bat, restart-servers.bat

## Step 3 - Module Identification

### Module Matrix

1. Authentication Module
   - Purpose: Secure user signup/login/session.
   - Core functionality: JWT create/verify, password hashing, /auth APIs, route protection.
   - Related files: main.py, frontend/src/store/authSlice.js, frontend/src/App.jsx, frontend/src/pages/Login.jsx, frontend/src/pages/Signup.jsx
   - Dependencies: python-jose, passlib[bcrypt], axios, react-router-dom

2. Student Dashboard Module
   - Purpose: Central student workspace and navigation shell.
   - Core functionality: Section switching, KPI initialization, profile completeness checks.
   - Related files: frontend/src/pages/Dashboard.jsx, frontend/src/components/Sidebar.jsx, frontend/src/components/Topbar.jsx, frontend/src/store/uiSlice.js
   - Dependencies: Redux store slices, framer-motion

3. Profile and Identity Module
   - Purpose: Manage student profile and guardian/academic metadata.
   - Core functionality: Check/create/update profile, photo upload.
   - Related files: main.py, frontend/src/pages/ProfilePage.jsx, frontend/src/store/studentSlice.js
   - Dependencies: FastAPI multipart support, local users.json storage

4. Attendance Module
   - Purpose: Attendance observability and engagement checks.
   - Core functionality: Records fetch, mark attendance, trend/risk selectors, holiday overlay.
   - Related files: main.py, frontend/src/components/Attendance.jsx, frontend/src/store/attendanceSlice.js, frontend/src/store/holidaysSlice.js
   - Dependencies: holidays_2026.json

5. Homework Module
   - Purpose: Assignment completion management.
   - Core functionality: Assignment retrieval, answer validation, pending/completed statuses.
   - Related files: main.py, frontend/src/components/Homework.jsx, frontend/src/store/homeworkSlice.js
   - Dependencies: auth token, users.json context

6. Announcements Module
   - Purpose: Student communications stream.
   - Core functionality: Fetch categorized announcements, mark read, unread counts.
   - Related files: main.py, frontend/src/components/Announcements.jsx, frontend/src/store/announcementsSlice.js
   - Dependencies: auth middleware, Redux filtering

7. Books and Reader Module
   - Purpose: Digital textbook navigation and reading progress.
   - Core functionality: Subject/chapter listing, ZIP download and cache controls, chapter progress update.
   - Related files: main.py, frontend/src/components/Books.jsx, frontend/src/pages/SubjectPage.jsx, frontend/src/pages/PDFViewer.jsx
   - Dependencies: backend/uploads, users.json books object

8. Timetable Module
   - Purpose: Class schedule visibility.
   - Core functionality: Weekly schedule API, next class derivation in UI.
   - Related files: main.py, frontend/src/components/Timetable.jsx, frontend/src/store/timetableSlice.js
   - Dependencies: hardcoded timetable structure in backend

9. Performance and Analytics Module
   - Purpose: Academic performance visibility.
   - Core functionality: Subject averages, trend charts, subject detail intelligence.
   - Related files: main.py, frontend/src/components/Performance.jsx, frontend/src/store/performanceSlice.js
   - Dependencies: deterministic seeded scoring, Recharts

10. Activity Tracking Module
    - Purpose: Behavioral telemetry for student actions.
    - Core functionality: Event logging, feed retrieval, stats.
    - Related files: backend/activity_engine.py, backend/activity_store.py, main.py, frontend/src/store/activitySlice.js
    - Dependencies: backend/activities.json

11. Insight Module
    - Purpose: AI-like recommendations from deterministic rules.
    - Core functionality: Insight generation, persistence, status transitions, stats.
    - Related files: backend/ai_insight_engine.py, backend/insight_store.py, main.py, frontend/src/store/insightsSlice.js
    - Dependencies: backend activity data and optional gamification context

12. AI Assistant and RAG Module
    - Purpose: Conversational support with textbook-grounded answers.
    - Core functionality: chat history, intent routing, rag-chat, OCR-assisted queries, multilingual support.
    - Related files: main.py, backend/rag/*, frontend/src/components/AIAssistant.jsx, frontend/src/store/aiSlice.js
    - Dependencies: Groq API key, Qdrant, sentence-transformers, langchain components

13. Gamification Module
    - Purpose: XP/streak/badge progression orchestration.
    - Core functionality: state calculation, listener-based action completion calls.
    - Related files: frontend/src/store/gamificationSlice.js, frontend/src/store/index.js
    - Dependencies: completeAction endpoint contract

14. Admin Capability Module (Partial)
    - Purpose: restricted maintenance action for book ZIP cache.
    - Core functionality: admin-only cache invalidation.
    - Related files: main.py (/api/books/{subject}/zip-cache), users.json role field
    - Dependencies: role in users.json

15. Teacher/Parent/Admin Panel Modules
    - Status: Not implemented as dedicated dashboards.
    - Notes: Parent fields and parent-meeting announcements exist, but no separate authenticated parent/teacher/admin UI flows.

## Step 4 - Functionality Mapping

### Key User Flows

1. Signup/Login Flow
   - Signup posts to /auth/signup.
   - Login posts to /auth/login and stores authToken.
   - Session check verifies /auth/me and then fetches /api/dashboard/{uid}.

2. Dashboard Initialization Flow
   - Dashboard checks profile existence.
   - Initializes attendance/gamification state from user payload.
   - Loads module-specific data when sections are opened.

3. Homework Submission Flow
   - Fetch pending/completed with /api/homework/{uid}.
   - Submit answer to /api/homework/submit.
   - On correct answer, UI moves item and updates stats; listener can trigger gamification completion action.

4. Book Reading Flow
   - /api/books returns subjects and progress.
   - /api/books/{subject} returns chapter metadata.
   - PDF viewer updates /api/books/{uid}/progress based on time/scroll/complete action.

5. AI Assistant Flow
   - User message enters aiSlice.
   - If non-personal/academic intent, request attempts RAG endpoint.
   - Fallback to assistant chat endpoint if needed.
   - Optional image is sent for OCR-enhanced question context.

6. Insight Lifecycle Flow
   - Insights fetched from /api/insights/{uid}.
   - User dismisses/completes via /api/insights/dismiss or /api/insights/complete.
   - Stats fetched from /api/insights/stats/{uid}.

### Permissions and Access Control

1. Token requirement
   - Most /api endpoints expect Bearer auth and validate uid ownership.
2. UID ownership
   - Common pattern: auth uid must match route/body uid to read/write personal data.
3. Role-based checks
   - /api/books/{subject}/download-all allows role student or admin.
   - /api/books/{subject}/zip-cache is admin-only.
4. Public-ish metadata
   - /api/books/{subject}/zip-info is soft-auth (optional auth accepted).

### Data Flow

1. Frontend state -> API services -> backend endpoints -> JSON/file stores -> response -> Redux slice update -> component render.
2. Activity and insight engines persist separately in backend/activities.json and insights.json.
3. Book progress is embedded per user under users.json books object.
4. RAG flow:
   - Query -> hybrid retrieval from Qdrant -> reranking -> optional translate -> Groq completion -> response.

### UI Interaction Patterns

1. Section-based dashboard rendering with animation transitions.
2. Notification and unread badges derived from announcements/homework slices.
3. Subject and chapter navigation via React Router dynamic params.
4. Optimistic/near-real-time updates in homework, gamification, and insights.

## Step 5 - System Roles

### Role Inventory and Capabilities

1. Student (implemented primary role)
   - Access: Entire student dashboard features (auth, profile, attendance, homework, announcements, books, timetable, performance, assistant).
   - Control: Own profile, own progress, own activity/insights, own chat context.
   - Restriction: Cannot access another uid resources.

2. Admin (partial/operational role)
   - Access: Special backend operation for ZIP cache invalidation.
   - Control: Can clear subject ZIP cache via /api/books/{subject}/zip-cache.
   - Restriction: No dedicated admin panel or broader admin APIs.

3. Teacher (not implemented as authenticated role)
   - Current state: No teacher auth role checks or teacher dashboard routes/components.
   - Presence: Implied only in timetable teacher names and announcement content.

4. Parent (not implemented as authenticated role)
   - Current state: No parent login role or parent dashboard.
   - Presence: Parent profile fields exist in student profile, and meeting announcements include parent context.

## Step 6 - PRD Core Sections

## Feature List

1. Local JWT authentication
2. Private route protection
3. Student profile CRUD and photo upload
4. Dashboard KPI initialization
5. Homework management and answer validation
6. Attendance tracking with risk intelligence
7. Announcement feed with read states
8. Digital library with per-subject progress
9. PDF chapter viewer with reading telemetry
10. Timetable view and export/print
11. Performance overview and subject details modal
12. Activity feed and activity stats
13. AI insight generation and lifecycle actions
14. AI assistant with history and suggestions
15. RAG chat with hybrid retrieval and multilingual support

## Functional Requirements

1. The system shall require JWT for protected APIs and reject invalid tokens.
2. The system shall only return/update data for the authenticated uid on user-scoped routes.
3. The system shall persist users, activities, and insights to local JSON stores.
4. The system shall support chapter reading progress tracking and completion thresholds.
5. The system shall provide deterministic performance outputs for stable user experience.
6. The system shall expose assistant chat and rag-chat endpoints with graceful fallback behavior.
7. The system shall expose activity/insight status operations for dashboard consumption.
8. The system shall support admin-only ZIP cache invalidation.

## User Flows

1. Authenticate -> enter dashboard -> consume modules.
2. Enter books -> open subject -> open chapter -> read -> progress update.
3. Enter homework -> submit answer -> immediate result -> stats refresh.
4. Ask AI question -> response returned via RAG or fallback assistant.
5. Review insights -> dismiss or complete -> list updates.

## UI Components

Core page-level components:
1. Login
2. Signup
3. Dashboard
4. ProfilePage
5. SubjectPage
6. PDFViewer

Core feature components:
1. DashboardOverview
2. Attendance and attendance subcomponents
3. Homework and HomeworkCard
4. Announcements
5. Books
6. Timetable and timetable subcomponents
7. Performance
8. AIAssistant
9. ProfileMenu/ProfileEditDrawer/ProfileCompletionModal

## Data Flow

1. users.json stores account and profile fields, role, and book progress.
2. backend/activities.json stores event streams by user id.
3. insights.json stores insight entities by user id and lifecycle status.
4. backend/uploads stores chapter PDFs and generated ZIP bundles.
5. backend/data and backend/data/subject_stores store source documents and local vector artifacts.

## API Surface Summary

Main API (main.py) endpoint groups:
1. Health: /health, /api/health
2. Auth: /auth/signup, /auth/login, /auth/me
3. Profile and dashboard: /api/dashboard/{uid}, /api/profile/*
4. Learning operations: /api/homework/*, /api/attendance, /api/holidays/2026
5. Games/analytics: /api/game/complete, /api/games/stats/{uid}, /api/analytics/*
6. Announcements: /api/announcements/{uid}, /api/announcement/read
7. Assistant: /api/assistant/chat, /api/assistant/history/{uid}, /api/assistant/rag-chat, /api/assistant/rebuild-index, /chat
8. Books: /api/books*, /api/books/{uid}/progress*
9. Timetable/performance: /api/timetable/{uid}, /api/performance/{uid}, /api/subject-details/{uid}/{subject}
10. Activity/insight engines: /api/activities/*, /api/insights/*

Legacy backend service (backend/main.py):
1. /chat
2. /

## Gaps, Constraints, and Risks

1. Role model mismatch:
   - Requested enterprise roles (admin/teacher/parent/student) are not fully implemented; student is primary role.
2. Duplicate route definition risk:
   - /api/insights/{uid} appears more than once in main.py, which may cause handler override confusion.
3. Database abstraction remnants:
   - supabase_query stubs remain but return no-op data; some logic references DB tables and then falls back.
4. Mixed legacy/new AI pipelines:
   - backend/rag_pipeline.py and backend/rag/rag_pipeline.py coexist; root app uses backend/rag/* path.
5. Local JSON persistence scalability:
   - Concurrency, locking, and growth limits are not handled like production-grade DB storage.

## Future Scope

1. Implement first-class multi-role architecture (student/teacher/parent/admin) with dedicated route guards and dashboards.
2. Replace JSON stores with transactional datastore (PostgreSQL or equivalent) and migrations.
3. Normalize backend into modular routers/services and remove duplicate/legacy endpoint conflicts.
4. Add comprehensive automated tests for API contracts, auth ownership checks, and role-based access.
5. Add admin content management for books/homework/announcements instead of hardcoded or stubbed sources.
6. Harden RAG observability and safety controls with clear source traceability and model fallback policies.

## Appendix - Key Implementation Files by Concern

1. Auth and session: main.py, frontend/src/store/authSlice.js, frontend/src/App.jsx
2. Profile and users: main.py, users.json, frontend/src/store/studentSlice.js, frontend/src/pages/ProfilePage.jsx
3. Homework and attendance: main.py, frontend/src/store/homeworkSlice.js, frontend/src/store/attendanceSlice.js
4. Announcements: main.py, frontend/src/components/Announcements.jsx, frontend/src/store/announcementsSlice.js
5. Books and PDF reading: main.py, backend/uploads/*, frontend/src/components/Books.jsx, frontend/src/pages/SubjectPage.jsx, frontend/src/pages/PDFViewer.jsx
6. Performance/timetable: main.py, frontend/src/components/Performance.jsx, frontend/src/components/Timetable.jsx
7. Activity/insights: backend/activity_*.py, backend/ai_insight_engine.py, backend/insight_store.py, frontend/src/store/activitySlice.js, frontend/src/store/insightsSlice.js
8. AI assistant and RAG: main.py, backend/rag/*, frontend/src/components/AIAssistant.jsx, frontend/src/store/aiSlice.js
