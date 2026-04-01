<div align="center">

<br/>

<img src="https://readme-typing-svg.demolab.com?font=Fira+Code&size=32&duration=2800&pause=2000&color=6366F1&center=true&vCenter=true&width=700&lines=🎓+Student+Smart+Dashboard;AI-Powered+Learning+Platform;Class+8+%E2%80%A2+FastAPI+%2B+React" alt="Typing SVG" />

<br/>

<p align="center">
  <a href="#"><img src="https://img.shields.io/badge/React-18.2.0-61DAFB?style=for-the-badge&logo=react&logoColor=black" /></a>
  <a href="#"><img src="https://img.shields.io/badge/FastAPI-0.109+-009688?style=for-the-badge&logo=fastapi&logoColor=white" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Redux_Toolkit-2.0.1-764ABC?style=for-the-badge&logo=redux&logoColor=white" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Vite-5.x-646CFF?style=for-the-badge&logo=vite&logoColor=white" /></a>
  <a href="#"><img src="https://img.shields.io/badge/Python-3.10+-3776AB?style=for-the-badge&logo=python&logoColor=white" /></a>
  <a href="#"><img src="https://img.shields.io/badge/License-MIT-22C55E?style=for-the-badge" /></a>
</p>

<p align="center">
  <b>A premium, production-ready school ERP & AI Study platform built for Class 8 students.</b><br/>
  Track academic progress · Manage homework · Explore digital books · Study smarter with an AI-powered RAG assistant.
</p>

<br/>

---

</div>

## ⚡ Quick Start

> **Zero external databases required.** All user data is stored locally via JWT & `users.json`.

```powershell
# Navigate to the project root
cd "c:\student dashboard"

# 🚀 Launch both Backend & Frontend in one command
.\start-servers.bat
```

<div align="center">

| 🌟 Service | 🔗 URL |
|:---:|:---:|
| **🖥️ Student Dashboard UI** | [http://localhost:3000](http://localhost:3000) |
| **⚙️ FastAPI Backend** | [http://127.0.0.1:8000](http://127.0.0.1:8000) |
| **📖 Interactive API Docs** | [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs) |

</div>

---

## ✨ Feature Overview

<table>
<tr>
<td width="50%">

### 🛡️ Authentication
Fully local JWT-based signup & login.
No cloud dependency — passwords hashed with **bcrypt**, tokens verified via **python-jose**.

### 📊 Smart Dashboard
Real-time KPI cards for Attendance, Homework, and Academic Performance — with animated progress bars and clickable navigation.

### 🗓️ Timetable
Interactive 6-day class schedule with a **"Now"** pulsating indicator, Next-Class widgets, and PDF export.

### 📝 Homework Manager
View, filter by subject, and submit answers with instant validation — organized into Pending/Completed tabs.

</td>
<td width="50%">

### 🤖 AI Study Assistant
A full **RAG (Retrieval-Augmented Generation)** pipeline powered by **Groq** and **Qdrant** vector stores. Answers are sourced strictly from uploaded NCERT textbooks — no hallucinations.

### 📈 Performance Analytics
Deterministic subject performance dashboards seeded by UID, featuring flip-cards, skill breakdowns, trend analysis, and AI-powered insights.

### 📚 Digital Library
9 pre-loaded NCERT textbooks with an in-browser PDF viewer, chapter progress tracking, and bulk ZIP download.

### 🌓 Dynamic Theming
Seamless dark/light mode tied to global Redux state with smooth CSS transitions.

</td>
</tr>
</table>

---

## 🏗️ Architecture

```
c:\student dashboard\
│
├── .env                          # JWT secrets & CORS config
├── main.py                       # FastAPI application entry point
├── users.json                    # Local user & profile storage
├── insights.json                 # AI-generated insight storage
├── start-servers.bat             # One-click launcher (backend + frontend)
│
├── backend/                      # ⚙️ Python Engine Layer
│   ├── activity_engine.py        # Event tracking (logins, reads, submissions)
│   ├── activity_store.py         # Activity JSON persistence layer
│   ├── ai_insight_engine.py      # Rule-based insight analyzer
│   ├── insight_store.py          # Insight CRUD + auto-expiry (7 days)
│   ├── activity_middleware.py    # Auto-logging decorator for endpoints
│   ├── holidays_2026.json        # Academic calendar dataset
│   │
│   ├── rag/                      # 🧠 RAG Pipeline
│   │   ├── rag_pipeline.py       # Core RAG orchestrator (Groq + Qdrant)
│   │   ├── chunker.py            # Text chunking for vector indexing
│   │   ├── embeddings.py         # HuggingFace embedding models
│   │   ├── retriever.py          # Hybrid semantic search
│   │   ├── reranker.py           # Result re-ranking layer
│   │   └── image_reader.py       # OCR & Groq Vision for image queries
│   │
│   ├── data/                     # 📚 NCERT Source PDFs & vector stores
│   └── uploads/                  # Processed uploads & profile photos
│
└── frontend/                     # 💻 React / Vite GUI Layer
    └── src/
        ├── components/           # 🧱 Reusable UI Components
        │   ├── AIAssistant.jsx       # RAG Chat Interface
        │   ├── DashboardOverview.jsx # KPI grid + Activity feed + Insights
        │   ├── Performance.jsx       # Subject analytics (Recharts)
        │   ├── Books.jsx             # Digital library browser
        │   ├── Homework.jsx          # Assignment manager
        │   ├── Attendance.jsx        # Attendance calendar & stats
        │   ├── HolidayKPI.jsx        # Holiday calendar widget
        │   └── Topbar.jsx / Sidebar.jsx  # Navigation shell
        │
        ├── pages/                # 🛣️ Route-Level Views
        │   ├── Dashboard.jsx         # Central hub controller
        │   ├── ProfilePage.jsx       # Student profile management
        │   ├── PDFViewer.jsx         # Full in-browser PDF reader
        │   └── SubjectPage.jsx       # Per-subject chapter explorer
        │
        └── store/                # 🗄️ Redux State Slices
            ├── authSlice.js          # Auth & session management
            ├── homeworkSlice.js      # Homework state & submission
            ├── activitySlice.js      # Activity tracking
            ├── insightsSlice.js      # AI insights state
            ├── performanceSlice.js   # Performance KPI state
            └── gamificationSlice.js  # UI interaction state
```

---

## 🧠 AI Study Assistant (RAG Pipeline)

The AI tutor is **grounded entirely in your textbooks** — not a generic chatbot.

```
Student asks a question
        │
        ▼
┌───────────────────┐    ┌──────────────────┐    ┌──────────────────────┐
│  Intent Classifier │───▶│  Qdrant Retriever │───▶│   Groq LLM (Mixtral) │
│  (route question)  │    │  (vector search)  │    │   (answer generation) │
└───────────────────┘    └──────────────────┘    └──────────────────────┘
        │                         │                          │
   Non-RAG intents           Top-K chunks                Textbook-grounded
   (greeting, tips)          from NCERT PDFs              accurate answer
```

**Supported features:**
- 📖 Subject-filtered textbook retrieval
- 🖼️ Image upload with OCR (Groq Vision API)
- 💬 Persistent chat history per user
- 🔀 Automatic intent classification (RAG / motivation / games / progress)

---

## 🔒 Authentication Flow

```
1. Signup  →  bcrypt password hash  →  stored in users.json
2. Login   →  hash verification     →  JWT issued (HS256)
3. Request →  Bearer token in header →  Verified via python-jose
4. Session →  React stores JWT      →  Auto-loaded on each page visit
```

Environment variables (`.env`):
```env
JWT_SECRET=your_secret_key
JWT_ALGORITHM=HS256
JWT_EXPIRE_DAYS=7
CORS_ORIGINS=http://localhost:3000
```

---

## 📊 AI Insight Engine

The insight engine analyzes student data to produce **actionable, personalized suggestions**:

| Trigger | Insight Type | Example |
|:---|:---|:---|
| Attendance < 75% | ⚠️ Warning | *"Your attendance has dropped. Consistent presence matters!"* |
| 5+ activities in one day | 🌟 Praise | *"Incredible study session today!"* |
| Inactive for 3+ days | 💡 Suggestion | *"It's been a while. Open a textbook to get back on track."* |
| All homework submitted | 🎉 Achievement | *"Full homework completion this week!"* |

Insights auto-expire after **7 days** and are capped at **20 active insights** per user.

---

## 🛠️ Development Commands

<table>
<tr>
<th>Task</th>
<th>Command</th>
</tr>
<tr>
<td>🚀 Start all servers</td>
<td><code>.\start-servers.bat</code></td>
</tr>
<tr>
<td>🔄 Restart all servers</td>
<td><code>.\restart-servers.bat</code></td>
</tr>
<tr>
<td>⚙️ Backend only (manual)</td>
<td><code>.venv\Scripts\python -m uvicorn main:app --reload --host 127.0.0.1 --port 8000</code></td>
</tr>
<tr>
<td>💻 Frontend only (manual)</td>
<td><code>cd frontend && npm run dev</code></td>
</tr>
<tr>
<td>📦 Install frontend deps</td>
<td><code>cd frontend && npm install</code></td>
</tr>
<tr>
<td>🐍 Install backend deps</td>
<td><code>.venv\Scripts\pip install -r requirements.txt</code></td>
</tr>
</table>

---

## 🚀 Tech Stack at a Glance

<table>
<tr>
<th>Layer</th>
<th>Technology</th>
<th>Purpose</th>
</tr>
<tr>
<td rowspan="5"><b>⚙️ Backend</b></td>
<td>FastAPI + Uvicorn</td>
<td>RESTful API server (ASGI)</td>
</tr>
<tr>
<td>python-jose + passlib</td>
<td>JWT auth + bcrypt hashing</td>
</tr>
<tr>
<td>Qdrant (local)</td>
<td>Vector store for RAG retrieval</td>
</tr>
<tr>
<td>Groq API</td>
<td>LLM inference & OCR vision</td>
</tr>
<tr>
<td>HuggingFace (BAAI/bge)</td>
<td>Text embedding models</td>
</tr>
<tr>
<td rowspan="5"><b>💻 Frontend</b></td>
<td>React 18 + Vite 5</td>
<td>UI framework & build tooling</td>
</tr>
<tr>
<td>Redux Toolkit</td>
<td>Global state management</td>
</tr>
<tr>
<td>Framer Motion</td>
<td>Animations & transitions</td>
</tr>
<tr>
<td>Recharts</td>
<td>Data visualization charts</td>
</tr>
<tr>
<td>Axios</td>
<td>HTTP client for API calls</td>
</tr>
<tr>
<td rowspan="2"><b>🗄️ Storage</b></td>
<td>users.json</td>
<td>User profiles & session data</td>
</tr>
<tr>
<td>insights.json / activities.json</td>
<td>AI insights & activity logs</td>
</tr>
</table>

---

<div align="center">

**Built with ❤️ using modern Web & AI best practices**

`React` · `FastAPI` · `RAG` · `Groq` · `Redux` · `Framer Motion`

<sub>MIT Licensed · Class 8 Smart Learning Platform · 2026</sub>

</div>
