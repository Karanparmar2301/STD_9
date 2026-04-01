from fastapi import FastAPI, Header, HTTPException, BackgroundTasks, UploadFile, File, Form
from fastapi.responses import JSONResponse, FileResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime, timedelta
from typing import Optional, List, Tuple
import os
import sys
import json
import uuid
import hashlib
import shutil
from pathlib import Path
from dotenv import load_dotenv
from jose import JWTError, jwt
from passlib.context import CryptContext

# AI engine path (backend/ folder)
sys.path.insert(0, os.path.join(os.path.dirname(__file__), 'backend'))
GAM_ENGINE_AVAILABLE = False  # Gamification system removed

# Import production auth system
from backend.auth_service import get_auth_service
from backend.exception_handlers import register_all_handlers, AuthenticationError, StorageError
from backend.secure_storage import get_users_storage
from backend.jwt_manager import get_jwt_manager

# Groq RAG Engine (Production pipeline: Hybrid search + Reranker + Groq)
try:
    from backend.rag.rag_pipeline import generate_answer as _rag_generate
    RAG_ENGINE_AVAILABLE = True
    def rag_pipeline(question, student_name="Student", subject_filter=""):
        result = _rag_generate(question, student_name=student_name, subject_filter=subject_filter)
        return result
except ImportError as _rag_err:
    print(f"[WARNING] RAG engine not loaded: {_rag_err}")
    RAG_ENGINE_AVAILABLE = False
    def rag_pipeline(question, student_name="Student", subject_filter=""):
        return {"answer": None, "sources": [], "chunks_found": 0}

# Load environment variables
load_dotenv()

# ── Configure Logging ────────────────────────────────────────────────────────
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('backend/logs/app.log'),
        logging.StreamHandler()
    ]
)

# Ensure logs directory exists
os.makedirs('backend/logs', exist_ok=True)

logger = logging.getLogger(__name__)

# ── Production Auth System Initialization ────────────────────────────────────
# Old methods kept for backward compatibility (deprecated)
def _load_users() -> dict:
    """DEPRECATED: Use get_users_storage().load() instead"""
    return get_users_storage().load()

def _save_users(users: dict):
    """DEPRECATED: Use get_users_storage().save() instead"""
    get_users_storage().save(users)

def _hash_password(plain: str) -> str:
    """DEPRECATED: Use get_jwt_manager().hash_password() instead"""
    return get_jwt_manager().hash_password(plain)

def _verify_password(plain: str, hashed: str) -> bool:
    """DEPRECATED: Use get_jwt_manager().verify_password() instead"""
    return get_jwt_manager().verify_password(plain, hashed)

def _create_token(uid: str, email: str) -> str:
    """DEPRECATED: Use get_jwt_manager().create_access_token() instead"""
    return get_jwt_manager().create_access_token(uid, email)

def _decode_token(token: str) -> dict:
    """DEPRECATED: Use get_jwt_manager().decode_token() instead"""
    result = get_jwt_manager().decode_token(token)
    if not result.valid:
        raise HTTPException(status_code=401, detail=result.error)
    return result.payload

app = FastAPI()

# ── Register Exception Handlers ──────────────────────────────────────────────
register_all_handlers(app)
logger.info("Exception handlers registered")

# ── RAG startup check ────────────────────────────────────────────────────────
@app.on_event("startup")
async def _startup_build_rag_index():
    if RAG_ENGINE_AVAILABLE:
        logger.info("[RAG] Production pipeline loaded (hybrid search + reranker + Groq)")
    else:
        logger.warning("[RAG] Pipeline not available")


@app.get("/health")
@app.get("/api/health")
async def health_check():
    """System health check endpoint."""
    rag_ready = False
    rag_chunks = 0
    if RAG_ENGINE_AVAILABLE:
        try:
            from backend.rag_engine import _index, get_qdrant as _gq, COLLECTION_NAME as _cn
            rag_ready = _index.ready
            if rag_ready:
                info = _gq().get_collection(_cn)
                rag_chunks = info.points_count
        except Exception:
            pass
    return JSONResponse({
        "status":     "healthy",
        "rag_ready":  rag_ready,
        "rag_chunks": rag_chunks,
    })

# CORS middleware for React frontend
# Allow all localhost/127.0.0.1 ports for development
cors_origins_str = os.getenv("CORS_ORIGINS", "http://localhost:3000,http://localhost:3001,http://localhost:3002,http://localhost:5173,http://localhost:5174,http://127.0.0.1:3000,http://127.0.0.1:5173,http://127.0.0.1:5174")
cors_origins = cors_origins_str.split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["*"],
)

if os.getenv("RENDER") == "true":
    UPLOADS_DIR = "/opt/render/project/src/data_storage/uploads"
else:
    UPLOADS_DIR = "backend/uploads"

os.makedirs(UPLOADS_DIR, exist_ok=True)
os.makedirs(os.path.join(UPLOADS_DIR, "profile_photos"), exist_ok=True)

# Mount static files for profile photos
app.mount("/api/uploads", StaticFiles(directory=UPLOADS_DIR), name="uploads")


# ========== PYDANTIC MODELS ==========
class SignupRequest(BaseModel):
    email: str
    password: str
    name: str = ""
    student_id: str = ""
    class_section: str = ""

class LoginRequest(BaseModel):
    email: str
    password: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class ChangePasswordRequest(BaseModel):
    old_password: str
    new_password: str

class ProfileCreateRequest(BaseModel):
    uid: str
    student_name: str
    student_id: str
    class_section: str
    father_name: str
    mother_name: str
    mobile: str
    email: str
    address: str


class ProfileUpdateRequest(BaseModel):
    # Personal Information
    student_name: Optional[str] = None
    gender: Optional[str] = None
    age: Optional[int] = None
    dob: Optional[str] = None
    mobile: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    class_section: Optional[str] = None
    
    # Parent Information
    father_name: Optional[str] = None
    mother_name: Optional[str] = None
    parent_contact: Optional[str] = None
    parent_email: Optional[str] = None
    emergency_contact: Optional[str] = None
    parent_occupation: Optional[str] = None
    guardian_info: Optional[str] = None
    
    # Academic Information
    prev_term_grade: Optional[str] = None
    overall_percentage: Optional[int] = None
    attendance_percentage: Optional[int] = None
    class_rank: Optional[int] = None
    class_rank_total: Optional[int] = None
    best_subject: Optional[str] = None
    weak_subject: Optional[str] = None
    total_exams: Optional[int] = None
    homework_completion: Optional[int] = None
    
    # Extra Curricular
    sports: Optional[str] = None
    arts: Optional[str] = None
    music: Optional[str] = None
    clubs: Optional[str] = None
    achievements: Optional[str] = None
    awards: Optional[str] = None
    leadership_role: Optional[str] = None
    community_service: Optional[str] = None


class GameCompleteRequest(BaseModel):
    uid: str
    game_name: str
    score: int
    total_questions: Optional[int] = 10
    xp_earned: int


class AlphabetGameCompleteRequest(BaseModel):
    game_name: str
    score: int
    correct_answers: int
    wrong_answers: int
    accuracy: int
    time_spent: int
    level_reached: int
    weak_letters: list


class HomeworkSubmitRequest(BaseModel):
    homework_id: str
    uid: str
    student_answer: str


class AttendanceMarkRequest(BaseModel):
    student_id: str



class ActionCompleteRequest(BaseModel):
    uid: str
    action_type: str     # GAME_COMPLETE | HOMEWORK_COMPLETE | ATTENDANCE_MARK
    metadata: Optional[dict] = None   # score, game_name, subject, etc.


class PerformanceAnalyticsResponse(BaseModel):
    uid: str
    xp_timeline: List[dict]
    source_breakdown: List[dict]
    weekly_progress: List[dict]
    subject_scores: dict
    current_stats: dict
    date: str
    status: str


# ========== HELPER FUNCTIONS ==========
async def verify_supabase_token(authorization: str) -> dict:
    """Verify locally-issued JWT token"""
    if not authorization or not authorization.startswith('Bearer '):
        raise HTTPException(status_code=401, detail="Missing authorization")
    token = authorization.split('Bearer ')[1]
    payload = _decode_token(token)  # raises HTTPException(401) if invalid/expired
    return {"id": payload["sub"], "email": payload.get("email", "")}


async def supabase_query(table: str, method: str = "GET", data: dict = None, filters: dict = None, token: str = None):
    """No-op stub — database removed. All data served from local store."""
    return [] if method == "GET" else {}


# ========== API ENDPOINTS ==========

# Global OPTIONS handler for CORS preflight requests
@app.options("/{full_path:path}")
async def options_handler(full_path: str):
    """Handle CORS preflight requests for all routes"""
    return JSONResponse(
        content={"message": "OK"},
        status_code=200,
        headers={
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
            "Access-Control-Allow-Headers": "Content-Type, Authorization",
        }
    )

@app.get("/")
def root():
    return {"message": "Student Dashboard API", "status": "running"}


# ========== LOCAL JWT AUTH (PRODUCTION VERSION) ==========

@app.post("/auth/signup")
async def signup(req: SignupRequest):
    """
    Register a new user - PRODUCTION VERSION
    Uses thread-safe storage and comprehensive error handling
    """
    try:
        auth_service = get_auth_service()
        result = auth_service.signup(
            email=req.email,
            password=req.password,
            name=req.name,
            student_id=req.student_id,
            class_section=req.class_section
        )
        return result

    except AuthenticationError as e:
        logger.warning(f"Signup failed: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e))

    except StorageError as e:
        logger.error(f"Storage error during signup: {str(e)}")
        raise HTTPException(status_code=503, detail="Service temporarily unavailable")

    except HTTPException:
        raise  # Re-raise HTTPException without converting to 500

    except Exception as e:
        logger.error(f"Unexpected error during signup: {e}")
        raise HTTPException(status_code=500, detail="Signup failed")


@app.post("/auth/login")
async def login(req: LoginRequest):
    """
    Sign in and receive JWT tokens - PRODUCTION VERSION
    Returns both access token and refresh token
    """
    try:
        auth_service = get_auth_service()
        result = auth_service.login(
            email=req.email,
            password=req.password
        )
        return result

    except AuthenticationError as e:
        logger.warning(f"Login failed: {str(e)}")
        raise HTTPException(status_code=401, detail=str(e))

    except StorageError as e:
        logger.error(f"Storage error during login: {str(e)}")
        raise HTTPException(status_code=503, detail="Service temporarily unavailable")

    except HTTPException:
        raise  # Re-raise HTTPException without converting to 500

    except Exception as e:
        logger.error(f"Unexpected error during login: {e}")
        raise HTTPException(status_code=500, detail="Login failed")


@app.get("/auth/me")
async def get_me(authorization: str = Header(None)):
    """
    Verify token and return current user info - PRODUCTION VERSION
    Gracefully handles expired/invalid tokens
    """
    try:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="No token provided")

        token = authorization[7:]  # Remove "Bearer " prefix

        auth_service = get_auth_service()
        user_info = auth_service.verify_token(token)

        return user_info

    except AuthenticationError as e:
        logger.info(f"Token verification failed: {str(e)}")
        raise HTTPException(status_code=401, detail=str(e))

    except HTTPException:
        raise  # Re-raise HTTPException without converting to 500

    except Exception as e:
        logger.error(f"Unexpected error in /auth/me: {e}")
        raise HTTPException(status_code=500, detail="Authentication failed")


@app.post("/auth/refresh")
async def refresh_token_endpoint(req: RefreshTokenRequest):
    """
    Refresh access token using refresh token.
    Expects JSON body: { "refresh_token": "<token>" }
    """
    try:
        auth_service = get_auth_service()
        result = auth_service.refresh_token(req.refresh_token)
        return result

    except AuthenticationError as e:
        logger.warning(f"Token refresh failed: {str(e)}")
        raise HTTPException(status_code=401, detail=str(e))

    except Exception as e:
        logger.error(f"Unexpected error during token refresh: {e}")
        raise HTTPException(status_code=500, detail="Token refresh failed")


@app.post("/auth/change-password")
async def change_password(
    req: ChangePasswordRequest,
    authorization: str = Header(None)
):
    """
    Change user password.
    Expects JSON body: { "old_password": "...", "new_password": "..." }
    Requires valid authentication via Authorization: Bearer <token>
    """
    try:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="No token provided")

        token = authorization[7:]
        auth_service = get_auth_service()

        # Verify token first
        user_info = auth_service.verify_token(token)
        uid = user_info["uid"]

        # Change password
        auth_service.change_password(uid, req.old_password, req.new_password)

        return {"success": True, "message": "Password changed successfully"}

    except AuthenticationError as e:
        raise HTTPException(status_code=401, detail=str(e))

    except HTTPException:
        raise  # Re-raise HTTPException without converting to 500

    except Exception as e:
        logger.error(f"Password change error: {e}")
        raise HTTPException(status_code=500, detail="Password change failed")


# ========== TOKEN DEBUG ENDPOINT (Development Only) ==========

@app.get("/auth/token-info")
async def get_token_info(authorization: str = Header(None)):
    """
    Get token expiry information for debugging
    """
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token provided")

    token = authorization[7:]
    auth_service = get_auth_service()

    info = auth_service.get_token_info(token)
    return info


@app.get("/api/dashboard/{uid}")
async def get_dashboard_data(
    uid: str,
    authorization: str = Header(None)
):
    """Get student dashboard data - prioritizes users.json over Supabase"""
    try:
        user_token = None
        
        # Verify token if provided
        if authorization:
            if authorization.startswith('Bearer '):
                user_token = authorization.split('Bearer ')[1]
            
            user_data = await verify_supabase_token(authorization)
            if user_data.get("id") != uid:
                raise HTTPException(status_code=403, detail="Unauthorized access")
        
        # PRIORITY: Load from users.json FIRST (single source of truth for profile updates)
        local_users = _load_users()
        
        if uid in local_users:
            # User exists in local store - return complete profile from users.json
            u = local_users[uid]
            parent = {
                "uid": uid,
                "student_name": u.get("name", "Student Name"),
                "student_id": u.get("student_id", uid[:8]),
                "email": u.get("email", ""),
                "profile_photo_url": u.get("profile_photo_url", None),
                "father_name": u.get("father_name", ""),
                "mother_name": u.get("mother_name", ""),
                "class_section": u.get("class_section", ""),
                "mobile": u.get("mobile", ""),
                "address": u.get("address", ""),
                "gender": u.get("gender", "Male"),
                "age": u.get("age", 14),
                "dob": u.get("dob", "2012-01-01"),
                "parent_contact": u.get("parent_contact", ""),
                "parent_email": u.get("parent_email", ""),
                "emergency_contact": u.get("emergency_contact", ""),
                "parent_occupation": u.get("parent_occupation", ""),
                "guardian_info": u.get("guardian_info", ""),
                "prev_term_grade": u.get("prev_term_grade", "A"),
                "overall_percentage": u.get("overall_percentage", 85),
                "attendance_percentage": u.get("attendance_percentage", 95),
                "class_rank": u.get("class_rank", 5),
                "class_rank_total": u.get("class_rank_total", 42),
                "best_subject": u.get("best_subject", "Mathematics"),
                "weak_subject": u.get("weak_subject", ""),
                "total_exams": u.get("total_exams", 8),
                "homework_completion": u.get("homework_completion", 92),
                "sports": u.get("sports", ""),
                "arts": u.get("arts", ""),
                "music": u.get("music", ""),
                "clubs": u.get("clubs", ""),
                "achievements": u.get("achievements", "") if isinstance(u.get("achievements"), str) else "",
                "awards": u.get("awards", ""),
                "leadership_role": u.get("leadership_role", ""),
                "community_service": u.get("community_service", ""),
                # KPI Data
                "present_days": u.get("present_days", 152),
                "absent_days": u.get("absent_days", 8),
                "total_days": u.get("total_days", 160),
                "attendance_streak": u.get("attendance_streak", u.get("streak", 5)),
                "homework_completed": u.get("homework_completed", 12),
                "homework_total": u.get("homework_total", 15),
                "reward_points": u.get("reward_points", 450),
                "achievement_stars": u.get("achievement_stars", 23),
                "streak": u.get("streak", 5),
                "badges": u.get("badges", []),
                "games_played": u.get("games_played", 0),
                "high_score": u.get("high_score", 0),
                "current_level": u.get("current_level", 1)
            }
            return JSONResponse(parent)
        
        # FALLBACK: Try Supabase if user not in local store
        parents = await supabase_query("parents", filters={"uid": uid}, token=user_token)
        
        if parents and len(parents) > 0:
            parent = parents[0]
            # Ensure all KPI fields exist (add defaults if missing)
            parent.setdefault('attendance_streak', parent.get('streak', 5))
            parent.setdefault('streak', 5)
            parent.setdefault('badges', [])
            parent.setdefault('achievements', "")
            parent.setdefault('profile_photo_url', None)
            return JSONResponse(parent)
        
        # No data found anywhere - return minimal profile
        parent = {
            "uid": uid,
            "student_name": "Student Name",
            "student_id": uid[:8],
            "email": "",
            "profile_photo_url": None,
            "father_name": "",
            "mother_name": "",
            "class_section": "",
            "mobile": "",
            "address": "",
            "gender": "Male",
            "age": 14,
            "dob": "2012-01-01",
            "parent_contact": "",
            "parent_email": "",
            "emergency_contact": "",
            "parent_occupation": "",
            "guardian_info": "",
            "prev_term_grade": "A",
            "overall_percentage": 85,
            "attendance_percentage": 95,
            "class_rank": 5,
            "class_rank_total": 42,
            "best_subject": "Mathematics",
            "weak_subject": "",
            "total_exams": 8,
            "homework_completion": 92,
            "sports": "",
            "arts": "",
            "music": "",
            "clubs": "",
            "achievements": "",
            "awards": "",
            "leadership_role": "",
            "community_service": "",
            "present_days": 0,
            "absent_days": 0,
            "total_days": 0,
            "attendance_streak": 5,
            "homework_completed": 0,
            "homework_total": 0,
            "reward_points": 0,
            "achievement_stars": 0,
            "streak": 5,
            "badges": [],
            "games_played": 0,
            "high_score": 0,
            "current_level": 1
        }
        
        return JSONResponse(parent)
        
    except Exception as e:
        print(f"Dashboard error: {e}")
        # Return fallback data
        return JSONResponse({
            "uid": uid,
            "student_name": "Student Name",
            "student_id": uid[:8],
            "email": "",
            "father_name": "",
            "mother_name": "",
            "class_section": "",
            "mobile": "",
            "address": "",
            "gender": "Male",
            "age": 14,
            "dob": "2012-01-01",
            "parent_contact": "",
            "parent_email": "",
            "emergency_contact": "",
            "parent_occupation": "",
            "guardian_info": "",
            "prev_term_grade": "A",
            "overall_percentage": 85,
            "attendance_percentage": 95,
            "class_rank": 5,
            "class_rank_total": 42,
            "best_subject": "Mathematics",
            "weak_subject": "",
            "total_exams": 8,
            "homework_completion": 92,
            "sports": "",
            "arts": "",
            "music": "",
            "clubs": "",
            "achievements": "",
            "awards": "",
            "leadership_role": "",
            "community_service": "",
            "present_days": 0,
            "absent_days": 0,
            "total_days": 0,
            "attendance_streak": 5,
            "homework_completed": 0,
            "homework_total": 0,
            "reward_points": 0,
            "achievement_stars": 0,
            "streak": 5,
            "badges": [],
            "games_played": 0,
            "high_score": 0,
            "current_level": 1
        })


@app.get("/api/profile/check/{uid}")
async def check_profile(
    uid: str,
    authorization: str = Header(None)
):
    """
    Check if user profile exists in database.
    Returns: { "exists": true/false, "profile": {...} or null }
    """
    try:
        user_token = None
        if authorization and authorization.startswith('Bearer '):
            user_token = authorization.split('Bearer ')[1]
            
        # Verify authorization
        user_data = await verify_supabase_token(authorization)
        auth_uid = user_data.get("id")
        
        # Verify user is checking their own profile
        if auth_uid != uid:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        # Check if profile exists in local users store
        users = _load_users()
        if uid in users:
            u = users[uid]
            local_profile = {
                "uid": uid,
                "student_name": u.get("name", "Student"),
                "student_id": u.get("student_id", uid[:8]),
                "email": u.get("email", ""),
                "father_name": u.get("father_name", ""),
                "mother_name": u.get("mother_name", ""),
                "class_section": u.get("class_section", ""),
                "mobile": u.get("mobile", ""),
                "address": u.get("address", ""),
                "attendance_percentage": 95,
                "present_days": 0,
                "absent_days": 0,
                "total_days": 0,
                "attendance_streak": 0,
                "homework_completed": 0,
                "homework_total": 0,
                "reward_points": 0,
                "achievement_stars": 0,
                "streak": 0,
                "badges": [],
                "achievements": "",
                "games_played": 0,
                "high_score": 0,
                "current_level": 1
            }
            return {"exists": True, "profile": local_profile}

        # No local user found
        return {"exists": False, "profile": None}

    except HTTPException:
        raise
    except Exception as e:
        print(f"Profile check error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to check profile: {str(e)}")


@app.post("/api/profile/create")
async def create_profile(
    profile_data: ProfileCreateRequest,
    authorization: str = Header(None)
):
    """Create a new student profile"""
    try:
        user_token = None
        if authorization and authorization.startswith('Bearer '):
            user_token = authorization.split('Bearer ')[1]
            
        # Verify authorization
        user_data = await verify_supabase_token(authorization)
        uid = user_data.get("id")
        
        # Verify user is creating their own profile
        if uid != profile_data.uid:
            raise HTTPException(status_code=403, detail="Unauthorized to create profile for another user")
        
        # Check if profile already exists
        existing = await supabase_query("parents", filters={"uid": uid}, token=user_token)
        if existing and len(existing) > 0:
            raise HTTPException(status_code=400, detail="Profile already exists. Use update endpoint instead.")
        
        # Create new profile with default KPI values
        new_profile = {
            "uid": profile_data.uid,
            "student_name": profile_data.student_name,
            "student_id": profile_data.student_id,
            "class_section": profile_data.class_section,
            "father_name": profile_data.father_name,
            "mother_name": profile_data.mother_name,
            "mobile": profile_data.mobile,
            "email": profile_data.email,
            "address": profile_data.address,
            # Default KPI values
            "attendance_percentage": 95,
            "present_days": 0,
            "absent_days": 0,
            "total_days": 0,
            "attendance_streak": 0,
            "homework_completed": 0,
            "homework_total": 0,
            "reward_points": 0,
            "achievement_stars": 0,
            "streak": 0,
            "badges": [],
            "achievements": "",
            "games_played": 0,
            "high_score": 0,
            "current_level": 1
        }
        
        # Insert into database
        result = await supabase_query("parents", method="POST", data=new_profile, token=user_token)
        
        if result and len(result) > 0:
            return JSONResponse(result[0])
        else:
            return JSONResponse(new_profile)
            
    except HTTPException:
        raise
    except Exception as e:
        print(f"Profile creation error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to create profile: {str(e)}")


@app.patch("/api/profile/{uid}")
async def update_profile(
    uid: str,
    profile_data: ProfileUpdateRequest,
    authorization: str = Header(None)
):
    """Update student profile (allowed fields only)"""
    try:
        user_token = None
        if authorization and authorization.startswith('Bearer '):
            user_token = authorization.split('Bearer ')[1]
            
        # Verify authorization
        user_data = await verify_supabase_token(authorization)
        user_uid = user_data.get("id")
        
        # Verify user is updating their own profile
        if user_uid != uid:
            raise HTTPException(status_code=403, detail="Unauthorized to update another user's profile")
        
        # Build update data (only include fields that were provided)
        update_data = {}
        
        # Personal Information
        if profile_data.student_name is not None:
            update_data["student_name"] = profile_data.student_name
        if profile_data.gender is not None:
            update_data["gender"] = profile_data.gender
        if profile_data.age is not None:
            update_data["age"] = profile_data.age
        if profile_data.dob is not None:
            update_data["dob"] = profile_data.dob
        if profile_data.mobile is not None:
            update_data["mobile"] = profile_data.mobile
        if profile_data.email is not None:
            update_data["email"] = profile_data.email
        if profile_data.address is not None:
            update_data["address"] = profile_data.address
        if profile_data.class_section is not None:
            update_data["class_section"] = profile_data.class_section
            
        # Parent Information
        if profile_data.father_name is not None:
            update_data["father_name"] = profile_data.father_name
        if profile_data.mother_name is not None:
            update_data["mother_name"] = profile_data.mother_name
        if profile_data.parent_contact is not None:
            update_data["parent_contact"] = profile_data.parent_contact
        if profile_data.parent_email is not None:
            update_data["parent_email"] = profile_data.parent_email
        if profile_data.emergency_contact is not None:
            update_data["emergency_contact"] = profile_data.emergency_contact
        if profile_data.parent_occupation is not None:
            update_data["parent_occupation"] = profile_data.parent_occupation
        if profile_data.guardian_info is not None:
            update_data["guardian_info"] = profile_data.guardian_info
            
        # Academic Information
        if profile_data.prev_term_grade is not None:
            update_data["prev_term_grade"] = profile_data.prev_term_grade
        if profile_data.overall_percentage is not None:
            update_data["overall_percentage"] = profile_data.overall_percentage
        if profile_data.attendance_percentage is not None:
            update_data["attendance_percentage"] = profile_data.attendance_percentage
        if profile_data.class_rank is not None:
            update_data["class_rank"] = profile_data.class_rank
        if profile_data.class_rank_total is not None:
            update_data["class_rank_total"] = profile_data.class_rank_total
        if profile_data.best_subject is not None:
            update_data["best_subject"] = profile_data.best_subject
        if profile_data.weak_subject is not None:
            update_data["weak_subject"] = profile_data.weak_subject
        if profile_data.total_exams is not None:
            update_data["total_exams"] = profile_data.total_exams
        if profile_data.homework_completion is not None:
            update_data["homework_completion"] = profile_data.homework_completion
            
        # Extra Curricular
        if profile_data.sports is not None:
            update_data["sports"] = profile_data.sports
        if profile_data.arts is not None:
            update_data["arts"] = profile_data.arts
        if profile_data.music is not None:
            update_data["music"] = profile_data.music
        if profile_data.clubs is not None:
            update_data["clubs"] = profile_data.clubs
        if profile_data.achievements is not None:
            update_data["achievements"] = profile_data.achievements
        if profile_data.awards is not None:
            update_data["awards"] = profile_data.awards
        if profile_data.leadership_role is not None:
            update_data["leadership_role"] = profile_data.leadership_role
        if profile_data.community_service is not None:
            update_data["community_service"] = profile_data.community_service
        
        # Add updated_at timestamp
        update_data["updated_at"] = datetime.now().isoformat()
        
        if not update_data:
            raise HTTPException(status_code=400, detail="No fields to update")
        
        # Persist updates to local users store
        all_users = _load_users()
        if uid not in all_users:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Map updatable fields into the local store
        field_map = {
            "student_name": "name",
            "gender": "gender",
            "age": "age",
            "dob": "dob",
            "mobile": "mobile",
            "email": "email",
            "address": "address",
            "class_section": "class_section",
            "father_name": "father_name",
            "mother_name": "mother_name",
            "parent_contact": "parent_contact",
            "parent_email": "parent_email",
            "emergency_contact": "emergency_contact",
            "parent_occupation": "parent_occupation",
            "guardian_info": "guardian_info",
            "prev_term_grade": "prev_term_grade",
            "overall_percentage": "overall_percentage",
            "attendance_percentage": "attendance_percentage",
            "class_rank": "class_rank",
            "class_rank_total": "class_rank_total",
            "best_subject": "best_subject",
            "weak_subject": "weak_subject",
            "total_exams": "total_exams",
            "homework_completion": "homework_completion",
            "sports": "sports",
            "arts": "arts",
            "music": "music",
            "clubs": "clubs",
            "achievements": "achievements",
            "awards": "awards",
            "leadership_role": "leadership_role",
            "community_service": "community_service"
        }
        for api_field, store_field in field_map.items():
            if api_field in update_data:
                all_users[uid][store_field] = update_data[api_field]
        _save_users(all_users)
        
        # Log activity for profile update
        try:
            from activity_middleware import log_activity_manual
            log_activity_manual(
                user_id=uid,
                event_type="profile_updated",
                title="Profile Updated",
                description="Updated personal information",
                metadata={"fields_updated": list(update_data.keys())},
                auto_xp=True
            )
        except Exception as log_err:
            print(f"Activity logging failed: {log_err}")
        # Return the updated profile
        u = all_users[uid]
        updated_profile = {
            "uid": uid,
            "student_name": u.get("name", ""),
            "student_id": u.get("student_id", uid[:8]),
            "email": u.get("email", ""),
            "profile_photo_url": u.get("profile_photo_url", None),
            "class_section": u.get("class_section", ""),
            "mobile": u.get("mobile", ""),
            "address": u.get("address", ""),
            "father_name": u.get("father_name", ""),
            "mother_name": u.get("mother_name", ""),
            "gender": u.get("gender", "Male"),
            "age": u.get("age", 14),
            "dob": u.get("dob", "2012-01-01"),
            "parent_contact": u.get("parent_contact", ""),
            "parent_email": u.get("parent_email", ""),
            "emergency_contact": u.get("emergency_contact", ""),
            "parent_occupation": u.get("parent_occupation", ""),
            "guardian_info": u.get("guardian_info", ""),
            "prev_term_grade": u.get("prev_term_grade", "A"),
            "overall_percentage": u.get("overall_percentage", 85),
            "attendance_percentage": u.get("attendance_percentage", 95),
            "class_rank": u.get("class_rank", 5),
            "class_rank_total": u.get("class_rank_total", 42),
            "best_subject": u.get("best_subject", "Mathematics"),
            "weak_subject": u.get("weak_subject", ""),
            "total_exams": u.get("total_exams", 8),
            "homework_completion": u.get("homework_completion", 92),
            "sports": u.get("sports", ""),
            "arts": u.get("arts", ""),
            "music": u.get("music", ""),
            "clubs": u.get("clubs", ""),
            "achievements": u.get("achievements", "") if isinstance(u.get("achievements"), str) else "",
            "awards": u.get("awards", ""),
            "leadership_role": u.get("leadership_role", ""),
            "community_service": u.get("community_service", ""),
        }
        return JSONResponse(updated_profile)
                
    except HTTPException:
        raise
    except Exception as e:
        print(f"Profile update error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to update profile: {str(e)}")


@app.post("/api/profile/upload-photo")
async def upload_profile_photo(
    file: UploadFile = File(...),
    authorization: str = Header(None)
):
    """Upload profile photo with security validations"""
    try:
        # Verify authorization
        user_data = await verify_supabase_token(authorization)
        uid = user_data.get("id")
        
        if not uid:
            raise HTTPException(status_code=401, detail="Unauthorized")
        
        # Validate file type
        allowed_types = ["image/png", "image/jpeg", "image/jpg", "image/webp"]
        if file.content_type not in allowed_types:
            raise HTTPException(
                status_code=400, 
                detail=f"Invalid file type. Allowed: PNG, JPEG, WEBP"
            )
        
        # Validate file size (2MB max)
        file_content = await file.read()
        file_size = len(file_content)
        max_size = 2 * 1024 * 1024  # 2MB
        
        if file_size > max_size:
            raise HTTPException(
                status_code=400,
                detail=f"File too large. Maximum size: 2MB"
            )
        
        # Reset file pointer
        await file.seek(0)
        
        # Load user data
        all_users = _load_users()
        if uid not in all_users:
            raise HTTPException(status_code=404, detail="User not found")
        
        # Delete old photo if exists
        old_photo_url = all_users[uid].get("profile_photo_url")
        if old_photo_url:
            old_photo_path = Path(old_photo_url.replace("/api/uploads/", f"{UPLOADS_DIR}/"))
            if old_photo_path.exists():
                try:
                    old_photo_path.unlink()
                    print(f"Deleted old photo: {old_photo_path}")
                except Exception as e:
                    print(f"Failed to delete old photo: {e}")
        
        # Generate unique filename
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        file_extension = Path(file.filename).suffix or ".jpg"
        new_filename = f"{uid}_{timestamp}{file_extension}"

        # Save file
        upload_dir = Path(UPLOADS_DIR) / "profile_photos"
        upload_dir.mkdir(parents=True, exist_ok=True)
        
        file_path = upload_dir / new_filename
        with file_path.open("wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
        
        # Update users.json with new photo URL
        photo_url = f"/api/uploads/profile_photos/{new_filename}"
        all_users[uid]["profile_photo_url"] = photo_url
        all_users[uid]["updated_at"] = datetime.now().isoformat()
        _save_users(all_users)
        
        # Log activity
        try:
            from activity_middleware import log_activity_manual
            log_activity_manual(
                user_id=uid,
                event_type="profile_photo_updated",
                title="Profile Photo Updated",
                description="Uploaded new profile photo",
                metadata={"filename": new_filename},
                auto_xp=True
            )
        except Exception as log_err:
            print(f"Activity logging failed: {log_err}")
        
        return JSONResponse({
            "message": "Profile photo uploaded successfully",
            "photo_url": photo_url,
            "filename": new_filename
        })
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Photo upload error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to upload photo: {str(e)}")


@app.get("/api/homework/{uid}")
async def get_student_homework(
    uid: str,
    authorization: str = Header(None)
):
    """Get student homework assignments with pending/completed status - Class 1"""
    try:
        user_token = None
        if authorization and authorization.startswith('Bearer '):
            user_token = authorization.split('Bearer ')[1]
            
        # Verify authorization
        user_data = await verify_supabase_token(authorization)
        auth_uid = user_data.get("id")
        
        # Verify user is accessing their own data
        if auth_uid != uid:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        # Get student's class section from local users.json
        users = _load_users()
        if uid not in users:
            raise HTTPException(status_code=404, detail="Student profile not found")
        
        student_class = users[uid].get("class_section", "8-A")
        
        # Get all homework for student's class (use service key so all authenticated students can read)
        try:
            homework_list = await supabase_query(
                "homework",
                filters={"class_section": student_class},
                token=None  # no database configured
            )
            
            if not homework_list:
                homework_list = []
        except Exception as hw_error:
            print(f"Homework table query error: {hw_error}")
            homework_list = []
        
        # Get student's submissions (use user token — RLS ensures own records only)
        try:
            submissions = await supabase_query(
                "homework_submissions",
                filters={"student_uid": uid},
                token=user_token
            )
        except Exception as sub_error:
            print(f"Submissions table query error: {sub_error}")
            submissions = []
        
        # Create a set of completed homework IDs
        completed_ids = {sub["homework_id"] for sub in (submissions or [])}
        
        # Split homework into pending and completed
        pending = []
        completed = []
        
        for hw in homework_list:
            hw_data = {
                "id": hw["id"],
                "title": hw["title"],
                "subject": hw["subject"],
                "question": hw.get("question", ""),
                "xp_reward": hw.get("xp_reward", 5),
                "created_at": hw.get("created_at", "")
            }
            
            if hw["id"] in completed_ids:
                # Find completion timestamp and student answer
                completion = next((s for s in submissions if s["homework_id"] == hw["id"]), None)
                if completion:
                    hw_data["completed_at"] = completion.get("completed_at", "")
                    hw_data["student_answer"] = completion.get("student_answer", "")
                completed.append(hw_data)
            else:
                pending.append(hw_data)
        
        # Calculate stats
        total = len(homework_list)
        completed_count = len(completed)
        pending_count = len(pending)
        completion_rate = round((completed_count / total * 100) if total > 0 else 0, 1)
        
        return {
            "pending": pending,
            "completed": completed,
            "stats": {
                "total": total,
                "completed": completed_count,
                "pending": pending_count,
                "completion_rate": completion_rate
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get homework error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get homework: {str(e)}")


@app.post("/api/homework/submit")
async def submit_homework(
    homework_data: HomeworkSubmitRequest,
    authorization: str = Header(None)
):
    """
    Submit homework answer with validation.
    Awards XP if correct, prevents duplicate submissions.
    """
    try:
        user_token = None
        if authorization and authorization.startswith('Bearer '):
            user_token = authorization.split('Bearer ')[1]
            
        # Verify authorization
        user_data = await verify_supabase_token(authorization)
        auth_uid = user_data.get("id")
        
        # Verify user is submitting their own homework
        if auth_uid != homework_data.uid:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        # Check if homework tables exist
        try:
            # Check if already completed (prevent duplicate)
            existing = await supabase_query(
                "homework_submissions",
                filters={
                    "homework_id": homework_data.homework_id,
                    "student_uid": homework_data.uid
                },
                token=user_token
            )
            
            if existing and len(existing) > 0:
                raise HTTPException(status_code=400, detail="Homework already completed")
            
            # Get homework details for answer validation
            homework = await supabase_query(
                "homework",
                filters={"id": homework_data.homework_id},
                token=user_token
            )
            
            if not homework or len(homework) == 0:
                raise HTTPException(status_code=404, detail="Homework not found")
        except HTTPException:
            raise
        except Exception as table_error:
            print(f"Homework tables not found: {table_error}")
            raise HTTPException(
                status_code=503,
                detail="Homework system not available."
            )
        
        homework_item = homework[0]
        correct_answer = homework_item.get("correct_answer", "").strip()
        student_answer = homework_data.student_answer.strip()
        
        # Validate answer (case-insensitive comparison)
        is_correct = correct_answer.lower() == student_answer.lower()
        
        if not is_correct:
            return {
                "success": False,
                "correct": False,
                "message": "Incorrect answer. Try again!",
                "correct_answer": None  # Don't reveal correct answer
            }
        
        # Answer is correct — record submission and award XP
        submission_data = {
            "homework_id": homework_data.homework_id,
            "student_uid": homework_data.uid,
            "student_answer": student_answer,
            "completed_at": datetime.now().isoformat()
        }
        
        await supabase_query(
            "homework_submissions",
            method="POST",
            data=submission_data,
            token=user_token
        )
        
        # Get current parent data
        parents = await supabase_query(
            "parents",
            filters={"uid": homework_data.uid},
            token=user_token
        )
        
        if not parents or len(parents) == 0:
            raise HTTPException(status_code=404, detail="Student profile not found")
        
        parent_record = parents[0]

        # Get updated homework stats
        student_class = parent_record.get("class_section", "8-A")
        try:
            homework_list = await supabase_query(
                "homework",
                filters={"class_section": student_class},
                token=None
            )
            
            all_submissions = await supabase_query(
                "homework_submissions",
                filters={"student_uid": homework_data.uid},
                token=user_token
            )
            
            total = len(homework_list) if homework_list else 0
            completed_count = len(all_submissions) if all_submissions else 0
        except Exception as stats_error:
            print(f"Error fetching homework stats: {stats_error}")
            total = 6
            completed_count = 1
        
        pending_count = total - completed_count
        completion_rate = round((completed_count / total * 100) if total > 0 else 0, 1)
        update_data = {}

        await supabase_query(
            "parents",
            method="PATCH",
            data=update_data,
            filters={"uid": homework_data.uid},
            token=user_token
        )
        
        return {
            "success": True,
            "correct": True,
            "message": "Correct! Well done! 🎉",
            "xp_earned": 0,
            "total_xp": 0,
            "homework_id": homework_data.homework_id,
            "new_badge": None,
            "stats": {
                "total": total,
                "completed": completed_count,
                "pending": pending_count,
                "completion_rate": completion_rate
            }
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Submit homework error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to submit homework: {str(e)}")


# ========== ATTENDANCE ENDPOINTS ==========
@app.get("/api/attendance/{uid}")
async def get_student_attendance(
    uid: str,
    authorization: str = Header(None)
):
    """Get student attendance records with monthly data"""
    try:
        # Verify authorization
        user_data = await verify_supabase_token(authorization)
        auth_uid = user_data.get("id")
        
        # Verify user is accessing their own data
        if auth_uid != uid:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        # Generate mock attendance data for the current month and previous months
        import random

        today = datetime.now()
        records = []
        
        # Generate data for the last 60 days
        for i in range(60, 0, -1):
            date = today - timedelta(days=i)
            # 90% chance of being present
            status = 'present' if random.random() < 0.90 else 'absent'
            records.append({
                'date': date.strftime('%Y-%m-%d'),
                'status': status
            })
        
        # Calculate monthly data
        monthly_data = []
        for month_offset in range(3, 0, -1):
            month_start = today - timedelta(days=30 * month_offset)
            month_records = [r for r in records if r['date'].startswith(month_start.strftime('%Y-%m'))]
            present_count = len([r for r in month_records if r['status'] == 'present'])
            total_count = len(month_records)
            
            monthly_data.append({
                'month': month_start.strftime('%B %Y'),
                'present': present_count,
                'total': total_count,
                'percentage': round((present_count / total_count * 100) if total_count > 0 else 0, 1)
            })
        
        return {
            "records": records,
            "monthlyData": monthly_data
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get attendance error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get attendance: {str(e)}")


@app.post("/api/attendance")
async def mark_student_attendance(
    attendance_data: AttendanceMarkRequest,
    authorization: str = Header(None)
):
    """Mark student attendance for a specific date"""
    try:
        # Verify authorization
        user_data = await verify_supabase_token(authorization)
        auth_uid = user_data.get("id")
        
        # Verify user is accessing their own data
        if auth_uid != attendance_data.student_id:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        # For now, just return success (would save to database in production)
        return {
            "success": True,
            "message": "Attendance marked successfully",
            "date": attendance_data.date,
            "status": attendance_data.status
        }
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Mark attendance error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to mark attendance: {str(e)}")


# ========== HOLIDAYS ENDPOINT ==========

_HOLIDAYS_FILE = os.path.join(os.path.dirname(__file__), "backend", "holidays_2026.json")

@app.get("/api/holidays/2026")
async def get_holidays_2026():
    """Return the full 2026 Indian school holiday calendar."""
    try:
        with open(_HOLIDAYS_FILE, "r", encoding="utf-8") as f:
            holidays = json.load(f)
        return JSONResponse({"holidays": holidays, "year": 2026, "total": len(holidays)})
    except FileNotFoundError:
        raise HTTPException(status_code=404, detail="Holiday data file not found")
    except Exception as e:
        print(f"Holidays error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to load holidays: {str(e)}")


@app.post("/api/game/complete")
async def complete_game(
    game_data: GameCompleteRequest,
    authorization: str = Header(None)
):
    """
    Complete a game session — full gamification sync.
    1. Snapshot current XP/level for delta detection.
    2. Insert game_sessions row (DB trigger updates reward_points & games_played).
    3. Check & award badges via RPC.
    4. Fetch refreshed parent row.
    5. Insert user_activity log (best-effort).
    6. Return full gamification state so Redux can update all UI sections instantly.
    """
    try:
        user_token = None
        if authorization and authorization.startswith('Bearer '):
            user_token = authorization.split('Bearer ')[1]

        user_data = await verify_supabase_token(authorization)
        auth_uid = user_data.get("id")

        if auth_uid != game_data.uid:
            raise HTTPException(status_code=403, detail="Unauthorized")
        games_played = user_rec.get('games_played', 0) + 1
        if game_data.uid in local_users:
            local_users[game_data.uid]['games_played'] = games_played
            _save_users(local_users)
        level = 1
        current_level_xp = total_xp % 100
        xp_to_next = 100 - current_level_xp
        new_badges = []
        leveled_up = level > old_level
        new_badge = None

        # ── Step 5: insert activity log (best-effort) ──
        activity_entry = None
        try:
            activity_entry = {
                "uid":         game_data.uid,
                "action_type": "GAME_COMPLETE",
                "xp_earned": 0,
                "label":       f"{game_data.game_name} Completed",
                "icon":        "\U0001f3ae",
                "timestamp":   datetime.now().isoformat(),
            }
            await supabase_query(
                "user_activity",
                method="POST",
                data={**activity_entry, "created_at": datetime.now().isoformat()},
                token=user_token
            )
        except Exception:
            pass  # table may not exist yet

        return JSONResponse({
            "success":          True,
            "game_name":        game_data.game_name,
            "xp_earned": 0,
            "total_xp": 0,
            "level": 1,
            "current_level_xp": 0,
            "xp_to_next_level": 0,
            "xp_progress": 0,
            "streak": 0,
            "games_played":     games_played,
            "total_game_xp": 0,
            "badges": [],
            "new_badges": [],
            "new_badge": None,
            "leveled_up": False,
            "activity_entry":   activity_entry,
            "message":          "Game completed! \U0001f389",
        })

    except HTTPException:
        raise
    except Exception as e:
        print(f"Game completion error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to complete game: {str(e)}")


@app.get("/api/games/stats/{uid}")
async def get_games_stats(
    uid: str,
    authorization: str = Header(None)
):
    """
    Get comprehensive game statistics for a student.
    Returns total games, XP, badges, level, and recent sessions.
    """
    try:
        user_token = None
        if authorization and authorization.startswith('Bearer '):
            user_token = authorization.split('Bearer ')[1]
            
        # Verify authorization
        user_data = await verify_supabase_token(authorization)
        auth_uid = user_data.get("id")
        
        # Verify user is checking their own stats
        if auth_uid != uid:
            raise HTTPException(status_code=403, detail="Unauthorized")
        
        # Build stats from local users store
        local_users = _load_users()
        user_rec = local_users.get(uid, {})
        return JSONResponse({
            "total_games": user_rec.get("games_played", 0),
            "total_xp": 0,
            "total_game_xp": 0,
            "games_played": user_rec.get("games_played", 0),
            "badges": [],
            "current_level": 1,
            "current_level_xp": 0,
            "xp_to_next_level": 0,
            "recent_sessions": [],
            "success": True
        })
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Get games stats error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to get stats: {str(e)}")


@app.get("/api/analytics/student/{uid}")
async def get_student_analytics(
    uid: str,
    authorization: str = Header(None)
):
    """Get student game analytics"""
    try:
        # Verify authorization
        user_data = await verify_supabase_token(authorization)
        
        if user_data.get("id") != uid:
            raise HTTPException(status_code=403, detail="Unauthorized access")
            
        user_token = None
        if authorization and authorization.startswith('Bearer '):
            user_token = authorization.split('Bearer ')[1]
        
        # No database — return empty sessions list
        sessions_list = []
        
        total_accuracy = sum(s.get("accuracy", 0) for s in sessions_list)
        total_time = sum(s.get("time_spent", 0) for s in sessions_list)
        
        avg_accuracy = total_accuracy / len(sessions_list) if sessions_list else 0
        avg_time = total_time / len(sessions_list) if sessions_list else 0
        
        return JSONResponse({
            "recent_sessions": sessions_list,
            "average_accuracy": round(avg_accuracy, 2),
            "average_time_spent": round(avg_time, 2),
            "total_sessions": len(sessions_list)
        })
        
    except HTTPException:
        raise
    except Exception as e:
        print(f"Analytics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ============================================================
# ANNOUNCEMENTS ENDPOINTS
# ============================================================

class AnnouncementReadRequest(BaseModel):
    uid: str
    announcement_id: str

@app.get("/api/announcements/{uid}")
async def get_announcements(
    uid: str,
    authorization: str = Header(None)
):
    """Get all announcements with read status for the student"""
    try:
        user_data = await verify_supabase_token(authorization)
        if user_data.get("id") != uid:
            raise HTTPException(status_code=403, detail="Unauthorized access")

        user_token = None
        if authorization and authorization.startswith('Bearer '):
            user_token = authorization.split('Bearer ')[1]

        # Serve hardcoded announcements directly — no database needed
        if True:  # scope block
            seed_data_check = True
            if seed_data_check:
                    # Insert full school announcement dataset
                    seed_data = [
                        # STUDENT CATEGORY
                        {"title": "📚 Homework Reminder", "description": "Dear students, please complete your Math homework (pages 12-15) and submit tomorrow. Remember to show all your working steps!", "category": "student", "priority": "normal"},
                        {"title": "📖 Library Visit Day", "description": "Class 8-A will visit the school library on Friday at 10 AM. Bring your library cards to borrow exciting storybooks!", "category": "student", "priority": "normal"},
                        {"title": "🎨 Art & Craft Materials", "description": "For tomorrow's art class, please bring: colored papers, glue stick, scissors, and crayons. We'll be making a beautiful craft project!", "category": "student", "priority": "normal"},
                        {"title": "💧 Water Bottle Reminder", "description": "Don't forget to bring your water bottle every day! Stay hydrated and healthy. Keep it in your school bag.", "category": "student", "priority": "normal"},
                        
                        # MEETING CATEGORY
                        {"title": "👨‍👩‍👧 Parent-Teacher Meeting", "description": "Important! Parent-Teacher Meeting scheduled for Saturday, Feb 25th at 9:00 AM. Please ensure your parents attend to discuss your academic progress.", "category": "meeting", "priority": "high"},
                        {"title": "📊 Academic Progress Review", "description": "Monthly academic review meeting for all Class-1 parents. Discuss your child's performance, strengths, and areas for improvement.", "category": "meeting", "priority": "high"},
                        {"title": "🎓 Orientation Meeting", "description": "New session orientation for parents on March 5th. Learn about upcoming curriculum changes and school activities.", "category": "meeting", "priority": "normal"},
                        
                        # EVENT CATEGORY
                        {"title": "🎭 Annual Day Celebration", "description": "Our grand Annual Day celebration is on March 15th! Students will perform dances, skits, and songs. Practice sessions start next week!", "category": "event", "priority": "normal"},
                        {"title": "🤡 Fancy Dress Competition", "description": "Exciting Fancy Dress Competition on Feb 28th! Choose your favorite character - superhero, cartoon, or fairy tale. Prizes for best costumes!", "category": "event", "priority": "normal"},
                        {"title": "🖍️ Drawing Competition", "description": "Inter-class drawing competition on March 2nd. Topic: 'My Dream School'. Bring your own colors and drawing sheets!", "category": "event", "priority": "normal"},
                        {"title": "🔬 Science Activity Day", "description": "Fun Science Activity Day on March 8th! Learn through exciting experiments and demonstrations. Parents are invited to watch!", "category": "event", "priority": "normal"},
                        
                        # SPORTS CATEGORY
                        {"title": "⚽ Sports Day", "description": "Annual Sports Day on March 20th! Events include: running races, relay, sack race, and balloon games. Wear your house color dress!", "category": "sports", "priority": "normal"},
                        {"title": "🏃 Running Race Competition", "description": "Practice sessions for Running Race Competition start next week. Students interested in participating, please give your names to the sports teacher.", "category": "sports", "priority": "normal"},
                        {"title": "🧘 Yoga Activity", "description": "Special Yoga session every Wednesday morning! Learn simple yoga poses for better concentration and fitness. Wear comfortable clothes.", "category": "sports", "priority": "normal"},
                        
                        # HOLIDAY CATEGORY
                        {"title": "🏖️ National Holiday", "description": "School will remain closed on Feb 26th (National Holiday). Enjoy your day with family. School reopens on Feb 27th.", "category": "holiday", "priority": "normal"},
                        {"title": "🎊 Festival Holiday", "description": "Holi festival holidays from March 12-14. School reopens on March 15th. Have a colorful and safe celebration!", "category": "holiday", "priority": "normal"},
                        {"title": "☀️ Summer Vacation Notice", "description": "Summer vacation dates announced! Holidays from May 15 to June 30. Online homework portal will be active for assignment submission.", "category": "holiday", "priority": "normal"},
                        
                        # IMPORTANT CATEGORY
                        {"title": "⚠️ Exam Schedule Released", "description": "First Terminal Exam schedule is now available! Exams from March 25-30. Download the detailed timetable from the student portal. Start preparation!", "category": "important", "priority": "high"},
                        {"title": "⚠️ Safety Guidelines", "description": "Important safety reminder: Always use the designated entry/exit gates. Parents must show ID cards during pickup. Follow traffic rules in the school zone.", "category": "important", "priority": "high"},
                        {"title": "🏥 Health Checkup Camp", "description": "Free health checkup camp on March 10th at 11 AM. Doctors will check height, weight, vision, and dental health. Reports will be shared with parents.", "category": "important", "priority": "high"},
                        {"title": "📱 School App Update", "description": "New school mobile app launched! Download 'Student Dashboard' from Play Store/App Store. Track homework, attendance, and announcements easily!", "category": "important", "priority": "high"},
                        {"title": "🚌 School Bus Route Change", "description": "Important! Bus Route 3 timing changed from 7:30 AM to 7:45 AM starting March 1st. Pickup points remain the same. Plan accordingly.", "category": "important", "priority": "high"},
                    ]
                    
                    pass  # seed_data defined above, used directly below

            # Use hardcoded seed data as announcements (assign numeric IDs)
            announcements = [
                {**item, "id": idx + 1, "created_at": "2026-02-24T00:00:00"}
                for idx, item in enumerate(seed_data)
            ]
            read_ids = set()  # No persistent read tracking without database

        # Annotate each announcement with read status
        for ann in announcements:
            ann["is_read"] = ann.get("id") in read_ids

        unread_count = sum(1 for a in announcements if not a.get("is_read"))

        return JSONResponse({
            "announcements": announcements,
            "unread_count": unread_count,
            "success": True
        })

    except HTTPException:
        raise
    except Exception as e:
        print(f"Get announcements error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to fetch announcements: {str(e)}")


@app.post("/api/announcement/read")
async def mark_announcement_read(
    request: AnnouncementReadRequest,
    authorization: str = Header(None)
):
    """Mark an announcement as read for the student"""
    try:
        user_data = await verify_supabase_token(authorization)
        if user_data.get("id") != request.uid:
            raise HTTPException(status_code=403, detail="Unauthorized access")

        user_token = None
        if authorization and authorization.startswith('Bearer '):
            user_token = authorization.split('Bearer ')[1]

        # No-op: without a database there is no persistent read state.
        # Return success immediately so the UI can mark it read in Redux store.
        unread_count = 0

        return JSONResponse({
            "success": True,
            "announcement_id": request.announcement_id,
            "unread_count": unread_count,
            "message": "Marked as read"
        })

    except HTTPException:
        raise
    except Exception as e:
        print(f"Mark announcement read error: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to mark as read: {str(e)}")


# ═══════════════════════════════════════════════════════════════
# UNIFIED ACTION COMPLETE — SINGLE SOURCE OF TRUTH
# ═══════════════════════════════════════════════════════════════



# ═══════════════════════════════════════════════════════════════
# ANALYTICS ROUTES
# ═══════════════════════════════════════════════════════════════

@app.get("/api/analytics/performance/{uid}")
async def get_performance_analytics(
    uid: str,
    authorization: str = Header(None)
):
    """
    Return analytics data for Recharts components:
      - XP timeline (LineChart)
      - Source breakdown (BarChart / PieChart)
      - Weekly progress (AreaChart)
      - Current summary stats
    """
    try:
        user_token = None
        if authorization and authorization.startswith('Bearer '):
            user_token = authorization.split('Bearer ')[1]

        user_data = await verify_supabase_token(authorization)
        if user_data.get("id") != uid:
            raise HTTPException(status_code=403, detail="Unauthorized")

        # Fetch student profile for current stats
        parents = await supabase_query("parents", filters={"uid": uid}, token=user_token)
        p = parents[0] if parents else {}
        total_xp = int(p.get("reward_points", 0))

        # Fetch XP event history (best-effort — table may not exist)
        xp_history: list[dict] = []
        try:
            raw_events = await supabase_query(
                "xp_events",
                filters={"uid": uid},
                token=user_token
            )
            xp_history = raw_events if raw_events else []
        except Exception:
            pass  # Table doesn't exist yet

        # Generate synthetic demo data if no real history
        if not xp_history and total_xp > 0:
            today = datetime.now().date()
            # Spread XP across last 14 days
            daily_xp = max(1, total_xp // 14)
            for i in range(14):
                d = today - timedelta(days=13 - i)
                if i % 3 != 0:  # skip some days for realism
                    source = ["homework", "games", "attendance"][i % 3]
                    xp_history.append({
                        "date": d.isoformat(),
                        "xp_earned": daily_xp + (i % 5),
                        "source": source
                    })
        xp_timeline = []
        source_breakdown = []
        weekly_progress = []

        # Subject scores (from alphabet game analytics if available)
        subject_scores: dict = {}
        try:
            alphabet_stats = await supabase_query(
                "alphabet_game_stats",
                filters={"uid": uid},
                token=user_token
            )
            if alphabet_stats:
                latest = alphabet_stats[-1]
                subject_scores["Language Arts"] = float(latest.get("accuracy", 0))
        except Exception:
            pass

        hw_completed = int(p.get("homework_completed", 0))
        hw_total = max(int(p.get("homework_total", 1)), 1)
        games_played = int(p.get("games_played", 0))

        current_stats = {
            "total_xp": 0,
            "level": int(p.get("current_level", 1)),
            "streak": int(p.get("streak", 0)),
            "homework_rate": round((hw_completed / hw_total) * 100, 1),
            "games_played": games_played,
            "badges_count": len(p.get("badges") or []),
        }

        return JSONResponse({
            "uid": uid,
            "xp_timeline": xp_timeline,
            "source_breakdown": source_breakdown,
            "weekly_progress": weekly_progress,
            "subject_scores": subject_scores,
            "current_stats": current_stats
        })

    except HTTPException:
        raise
    except Exception as e:
        print(f"Analytics error: {e}")
        raise HTTPException(status_code=500, detail=str(e))


# ═══════════════════════════════════════════════════════════════
# AI INSIGHTS ROUTES
# ═══════════════════════════════════════════════════════════════

@app.get("/api/insights/{uid}")
async def get_ai_insights(
    uid: str,
    authorization: str = Header(None)
):
    """
    Generate and return AI performance insights for the student.
    Rule-based analysis — no external AI model required.
    """
    try:
        if not GAM_ENGINE_AVAILABLE:
            # Fallback static insight
            return JSONResponse({
                "summary": "Keep learning and earning XP!",
                "weak_area": None,
                "recommendation": "Complete your homework to earn XP.",
                "motivation": "Every step counts! 🌟",
                "score": 50.0,
                "trend": "stable",
                "badge_hint": "Earn more XP to unlock badges!"
            })

        user_token = None
        if authorization and authorization.startswith('Bearer '):
            user_token = authorization.split('Bearer ')[1]

        user_data = await verify_supabase_token(authorization)
        if user_data.get("id") != uid:
            raise HTTPException(status_code=403, detail="Unauthorized")

        # Build student data snapshot
        parents = await supabase_query("parents", filters={"uid": uid}, token=user_token)
        p = parents[0] if parents else {}

        hw_completed = int(p.get("homework_completed", 0))
        hw_total_raw = int(p.get("homework_total", 0))

        # Try fetching live homework count for accuracy
        try:
            student_class = p.get("class_section", "8-A")
            hw_list = await supabase_query(
                "homework",
                filters={"class_section": student_class},
                token=None
            )
            hw_total_live = len(hw_list) if hw_list else hw_total_raw
            subs = await supabase_query(
                "homework_submissions",
                filters={"student_uid": uid},
                token=user_token
            )
            hw_done_live = len(subs) if subs else hw_completed
        except Exception:
            hw_total_live = hw_total_raw or 10
            hw_done_live = hw_completed

        # Game accuracy from alphabet game stats
        game_accuracy = 0.0
        try:
            stats = await supabase_query(
                "alphabet_game_stats",
                filters={"uid": uid},
                token=user_token
            )
            if stats:
                scores = [float(s.get("accuracy", 0)) for s in stats if s.get("accuracy")]
                game_accuracy = round(sum(scores) / len(scores), 1) if scores else 0.0
        except Exception:
            pass

        student_data = {
            "reward_points": int(p.get("reward_points", 0)),
            "streak": int(p.get("streak", 0)),
            "homework_completed": hw_done_live,
            "homework_total": hw_total_live,
            "game_accuracy": game_accuracy,
            "games_played": int(p.get("games_played", 0)),
            "current_level": int(p.get("current_level", 1)),
            "subject_scores": {},
        }

        insights = generate_insights(student_data)
        return JSONResponse(insights)

    except HTTPException:
        raise
    except Exception as e:
        print(f"AI insights error: {e}")
        return JSONResponse({
            "summary": "Keep learning and earning XP!",
            "weak_area": None,
            "recommendation": "Complete your homework to earn bonus XP.",
            "motivation": "Every step counts! 🌟",
            "score": 50.0,
            "trend": "stable",
            "badge_hint": None
        })


# ═══════════════════════════════════════════════════════════════════
# AI LEARNING ASSISTANT  (Groq RAG-powered)
# ═══════════════════════════════════════════════════════════════════

# Subject keywords used to route questions to Groq RAG
_SUBJECT_KEYWORDS = [
    # Science
    'science', 'biology', 'chemistry', 'physics', 'photosynthesis', 'cell',
    'atom', 'molecule', 'ecosystem', 'force', 'energy', 'matter',
    'microorganism', 'bacteria', 'virus', 'fungi', 'algae', 'protozoa',
    'reproduction', 'combustion', 'friction', 'pressure', 'sound', 'light',
    'pollution', 'conservation', 'crop', 'irrigation', 'metal', 'nonmetal',
    'acid', 'base', 'salt', 'synthetic', 'fibre', 'plastic', 'coal', 'petroleum',
    'star', 'planet', 'earthquake', 'lightning', 'chemical', 'reaction',
    'activity', 'experiment', 'observe', 'solution', 'mixture', 'element',
    # Math
    'math', 'mathematics', 'algebra', 'geometry', 'fraction', 'equation',
    'triangle', 'quadrilateral', 'profit', 'loss', 'interest', 'percentage',
    'ratio', 'proportion', 'exponent', 'power', 'square', 'cube', 'root',
    'linear', 'graph', 'data', 'probability', 'factorisation', 'polygon',
    # Languages
    'english', 'poem', 'story', 'chapter', 'passage', 'grammar',
    'hindi', 'sanskrit', 'social', 'comprehension', 'essay', 'letter',
    # Social Studies
    'history', 'geography', 'civics', 'constitution', 'parliament', 'judiciary',
    'agriculture', 'industry', 'resource', 'climate', 'soil', 'mineral',
    'trade', 'colonialism', 'revolt', 'independence', 'democracy',
    # Other subjects
    'arts', 'drawing', 'dance', 'music', 'vocational', 'physical',
    # Question patterns
    'explain', 'define', 'what is', 'what are', 'describe', 'write about',
    'tell me about', 'how does', 'how do', 'why does', 'why do',
    'difference between', 'give me', 'information', 'full info',
    'meaning of', 'types of', 'properties of', 'uses of', 'examples of',
    'class 8', 'textbook', 'ncert', 'lesson', 'topic', 'concept',
    'pond water', 'stagnant', 'suspension', 'nitrogen', 'carbon',
]

def _is_subject_question(message: str) -> bool:
    """Return True when the question is about academic content."""
    msg = message.lower()
    return any(kw in msg for kw in _SUBJECT_KEYWORDS)

def _ai_classify(message: str) -> str:
    """Classify the intent of a student message."""
    msg = message.lower().strip()

    math_keywords = ['+', '-', '*', '×', '÷', 'multiply', 'divide', 'plus', 'minus', 'times', 'added', 'subtracted']
    if any(k in msg for k in math_keywords) and any(c.isdigit() for c in msg):
        return 'math'
    if any(w in msg for w in ['what is', 'calculate', 'solve', 'answer', 'equals', 'how much']):
        if any(c.isdigit() for c in msg):
            return 'math'
    if any(w in msg for w in ['spell', 'spelling', 'how do you spell', 'letters in', 'how to write']):
        return 'spelling'
    if any(w in msg for w in ['how am i', 'my progress', 'my xp', 'my level', 'how i am', 'doing', 'performance']):
        return 'progress'
    if any(w in msg for w in ['streak', 'consecutive', 'days in a row']):
        return 'streak'
    if any(w in msg for w in ['badge', 'reward', 'trophy', 'achievement', 'medal']):
        return 'rewards'
    if any(w in msg for w in ['homework', 'assignment', 'task', 'due', 'submitted', 'pending']):
        return 'homework'
    if any(w in msg for w in ['game', 'play', 'fun', 'which game', 'what game']):
        return 'games'
    if any(w in msg for w in ['hi', 'hello', 'hey', 'good morning', 'good moring', 'gud morning', 'gm', 'good afternoon', 'good evening', 'how are you', 'namaste', 'hola', 'wassup', 'whats up', "what's up", 'sup']):
        return 'greeting'
    if any(w in msg for w in ['tired', 'bored', "can't", 'cant', 'hard', 'difficult', 'struggling', 'give up']):
        return 'motivation'
    return 'general'


def _try_eval_math(expression: str):
    """Safely evaluate a simple math expression from natural language."""
    import re
    # Replace word operators
    expr = expression.lower()
    expr = expr.replace('×', '*').replace('÷', '/').replace('plus', '+').replace('minus', '-') \
               .replace('times', '*').replace('multiplied by', '*').replace('divided by', '/')
    pattern = r'(\d+\.?\d*)\s*([+\-*/])\s*(\d+\.?\d*)'
    m = re.search(pattern, expr)
    if not m:
        return None
    a, op, b = float(m.group(1)), m.group(2), float(m.group(3))
    try:
        if op == '+':   result = a + b
        elif op == '-': result = a - b
        elif op == '*': result = a * b
        elif op == '/':
            if b == 0: return "zero_div"
            result = a / b
        else:
            return None
        return int(result) if result == int(result) else round(result, 2)
    except Exception:
        return None


def _build_ai_reply(intent: str, message: str, ctx: dict):
    """Build a context-aware reply and follow-up suggestions."""
    import random
    name     = (ctx.get('name') or 'Student').split()[0]
    level    = ctx.get('level', 1)
    xp       = ctx.get('xp', 0)
    streak   = ctx.get('streak', 0)
    hw_done  = ctx.get('hw_done', 0)
    hw_total = ctx.get('hw_total', 0)
    badges   = ctx.get('badges', [])
    badge_n  = len(badges) if isinstance(badges, list) else 0
    xp_to_next = 100 - (xp % 100)

    if intent == 'greeting':
        # Professional greeting responses (randomly selected)
        greetings = [
            "Hello! How can I assist you today?",
            "Hi there! What would you like to learn today?",
            "Welcome! Feel free to ask any question.",
            "Hello! I'm here to help with your studies.",
            "Hi! What topic would you like help with today?",
            "Hello! Let's start learning. What's your question?",
            "Hi there! How can I support your learning today?",
            "Hello! Ask me anything related to your subjects.",
            "Hi! I'm ready to help you understand your lessons.",
            "Hello! What would you like to explore today?",
            "Hi! I'm here to make learning easier for you.",
            "Hello! Do you need help with homework or concepts?",
            "Hi there! Let's solve your questions together.",
            "Hello! What subject would you like help with today?",
            "Hi! I'm ready whenever you are. What can I help with?",
            "Hello! Let's learn something new today.",
            "Hi! Tell me what you're curious about today.",
            "Hello! I'm here to guide you step by step.",
            "Hi there! What question do you have today?",
            "Hello! Let's begin. What would you like to ask?",
        ]
        reply = random.choice(greetings)
        suggestions = ["Help me with math", "Explain a science topic", "Help with homework", "Ask about my textbooks"]

    elif intent == 'math':
        result = _try_eval_math(message)
        if result == "zero_div":
            reply = "Oops! 😄 You can't divide by zero — that's one of math's biggest rules!\n\nTry a different number for the divisor!"
        elif result is not None:
            reply = (
                f"🎉 The answer is **{result}**!\n\n"
                "Nice work asking — practice makes perfect! Want to try another one? 🧮"
            )
        else:
            reply = (
                "Let me help you with math! 🧮\n\n"
                "**Quick tips:**\n"
                "➕ Addition: count forwards on a number line\n"
                "➖ Subtraction: count backwards\n"
                "✖️ Multiplication: repeated addition  (3×4 = 3+3+3+3)\n\n"
                "Type a problem like **5 + 3** or **12 - 7** and I'll solve it instantly!"
            )
        suggestions = ["Solve 7 × 8", "What is 100 ÷ 5?", "Help with subtraction", "Play Math Quest game"]

    elif intent == 'spelling':
        reply = (
            "📖 Great spelling question!\n\n"
            "**My spelling tips:**\n"
            "1️⃣ Break the word into syllables\n"
            "2️⃣ Sound each part out loud\n"
            "3️⃣ Write it 3 times to lock it in memory\n"
            "4️⃣ Use it in a sentence!\n\n"
            "🐝 Play **Spelling Bee** in the Games section to practice spelling with XP rewards!"
        )
        suggestions = ["Play Spelling Bee", "What are easy 3-letter words?", "Help me with reading", "Show game options"]

    elif intent == 'progress':
        bar_full  = min(20, int(((xp % 100) / 100) * 20))
        bar_empty = 20 - bar_full
        xp_bar    = "▓" * bar_full + "░" * bar_empty
        mood      = "🌟 Absolutely amazing!" if streak >= 7 else ("🔥 Great work!" if streak >= 3 else "💪 Keep going!")
        reply = (
            f"📊 **Your Learning Report, {name}!**\n\n"
            f"⭐ Level: **{level}**\n"
            f"⚡ XP: **{xp}** ─ {xp_to_next} more to Level {level + 1}!\n"
            f"   [{xp_bar}] {xp % 100}/100\n"
            f"🔥 Streak: **{streak} days**\n"
            f"📚 Homework: **{hw_done}/{hw_total}** done\n"
            f"🏆 Badges: **{badge_n}** earned\n\n"
            f"{mood}"
        )
        suggestions = ["How do I earn more XP?", "What badges can I unlock?", "Play a game for XP", "Homework status"]

    elif intent == 'streak':
        if streak >= 7:
            reply = f"🔥 **{streak}-day streak!** You are absolutely on fire, {name}! Keep logging in every day to keep this incredible streak going! You're earning bonus XP for every milestone! 🏆"
        elif streak >= 3:
            reply = f"🔥 **{streak}-day streak!** Nice work, {name}! You're {7 - streak} day(s) away from a **7-day milestone** with bonus XP rewards!"
        else:
            reply = (
                f"Your current streak is **{streak} day(s)**, {name}.\n\n"
                "Log in and complete at least one activity each day to build your streak!\n"
                "7-day streak = **Bonus XP + special badge** 🏅"
            )
        suggestions = ["What activities count for my streak?", "Show my progress", "Play a game now", "Complete homework"]

    elif intent == 'rewards':
        if badge_n > 0:
            reply = (
                f"🏆 You've earned **{badge_n} badge(s)** so far — incredible work, {name}!\n\n"
                "Keep completing homework, playing games, and building your streak to unlock even more! "
                "Visit the **Rewards** page to see your full collection. 🌟"
            )
        else:
            reply = (
                "🏆 You haven't unlocked any badges yet — but they're waiting for you!\n\n"
                "**How to earn badges:**\n"
                "✅ Complete homework assignments\n"
                "🎮 Play and win learning games\n"
                "🔥 Maintain a 7-day streak\n"
                "⚡ Reach XP milestones\n\n"
                "Go check the **Rewards** page to see what's available! 🎯"
            )
        suggestions = ["How do I earn more XP?", "Show my streak", "Play a game", "Check my progress"]

    elif intent == 'homework':
        pending = max(0, hw_total - hw_done)
        if pending <= 0 and hw_total > 0:
            reply = f"📚 **All done!** You've completed all **{hw_total}** homework assignment(s), {name}! You are an absolute superstar! ⭐\n\nNow play some games and earn even more XP! 🎮"
        elif hw_total == 0:
            reply = f"📚 No homework assigned yet, {name}! Check back later or ask your teacher.\n\nMeanwhile, play some games to earn XP! 🎮"
        else:
            reply = (
                f"📚 You have **{pending} pending** homework assignment(s) out of {hw_total} total.\n\n"
                "**Tips to finish faster:**\n"
                "✏️ Start with the easiest question first\n"
                "⏱ Set a 15-minute timer — beat the clock!\n"
                "💡 Each correct answer earns XP!\n\n"
                f"You've already completed {hw_done} — keep going! 💪"
            )
        suggestions = ["Earn XP from homework", "Show my progress", "Take a brain break with a game", "Math tips"]

    elif intent == 'games':
        reply = (
            "🎮 **Recommended games for you:**\n\n"
            "🃏 **Memory Flip** — Match pairs (15 XP) ← highest XP!\n"
            "📝 **Word Builder** — Build words (12 XP)\n"
            "➕ **Math Quest** — Solve math (10 XP)\n"
            "🐝 **Spelling Bee** — Spell words (10 XP)\n"
            "🔤 **Alphabet Race** — Identify letters (8 XP)\n"
            "⭐ **Counting Stars** — Count objects (6 XP)\n\n"
            f"You're **Level {level}** — play **Memory Flip** to level up fastest! 🏆"
        )
        suggestions = ["How do I level up?", "What's Memory Flip?", "Show my XP", "Homework help"]

    elif intent == 'motivation':
        reply = (
            f"Hey {name}, I believe in you! 💪\n\n"
            f"You're already **Level {level}** — that took real effort and dedication!\n\n"
            "When things feel hard:\n"
            "🎮 **Play a quick game** to refresh your mind\n"
            "⏱ **Try for just 5 minutes** — you'll often keep going\n"
            "📝 **Break it into small steps** — one question at a time\n\n"
            "You've got this. Every expert was once a beginner! 🌟"
        )
        suggestions = ["Show my achievements", "Play a quick game", "Math tips", "Check my progress"]

    else:  # general - treat as greeting with professional response
        greetings = [
            "Hello! How can I assist you today?",
            "Hi there! What would you like to learn today?",
            "Welcome! Feel free to ask any question.",
            "Hello! I'm here to help with your studies.",
            "Hi! What topic would you like help with today?",
            "Hello! Let's start learning. What's your question?",
            "Hi there! How can I support your learning today?",
            "Hello! Ask me anything related to your subjects.",
            "Hi! I'm ready to help you understand your lessons.",
            "Hello! What would you like to explore today?",
        ]
        reply = random.choice(greetings)
        suggestions = ["Help me with math", "Explain a science topic", "Help with homework", "Ask about my textbooks"]

    return reply, suggestions


async def _groq_rag_reply(message: str, student_name: str, subject_filter: str = "") -> Tuple[str, List[str]]:
    """Call Groq RAG pipeline and return (reply, suggestions)."""
    import asyncio
    loop = asyncio.get_event_loop()
    result = await loop.run_in_executor(
        None, rag_pipeline, message, student_name, subject_filter
    )
    answer  = result.get("answer") or ""
    sources = result.get("sources", [])
    reply   = answer

    suggestions = [
        "Explain more",
        "Give me an example",
        "What else should I know?",
        "Test me on this topic",
    ]
    return reply, suggestions


@app.post("/api/assistant/chat")
async def assistant_chat(
    body: dict,
    authorization: str = Header(None)
):
    """Context-aware AI Learning Assistant — personalized responses using student data."""
    try:
        user_token = None
        if authorization and authorization.startswith('Bearer '):
            user_token = authorization.split('Bearer ')[1]

        user_data = await verify_supabase_token(authorization)
        uid       = body.get('uid') or user_data.get('id')
        message   = (body.get('message') or '').strip()

        if not message:
            raise HTTPException(status_code=400, detail="Message is required")
        if len(message) > 1000:
            raise HTTPException(status_code=400, detail="Message too long")

        # Fetch student context (best-effort — never fail the chat for this)
        student_ctx: dict = {}
        try:
            parents = await supabase_query("parents", filters={"uid": uid}, token=user_token)
            if parents:
                p = parents[0]
                raw_xp = int(p.get("reward_points", 0))
                student_ctx = {
                    "name":      p.get("student_name", "Student"),
                    "xp":        raw_xp,
                    "level":     min(raw_xp // 100 + 1, 50),
                    "streak":    int(p.get("streak", 0)),
                    "hw_done":   int(p.get("homework_completed", 0)),
                    "hw_total":  max(int(p.get("homework_total", 1)), 1),
                    "badges":    p.get("badges") or [],
                }
        except Exception:
            student_ctx = {"name": "Student", "xp": 0, "level": 1, "streak": 0,
                           "hw_done": 0, "hw_total": 1, "badges": []}

        intent = _ai_classify(message)

        # Route to RAG by default — only skip for clearly non-academic intents
        _NON_RAG_INTENTS = {'progress', 'streak', 'rewards', 'homework', 'games', 'greeting', 'math', 'spelling', 'motivation'}
        if RAG_ENGINE_AVAILABLE and intent not in _NON_RAG_INTENTS:
            try:
                reply, suggestions = await _groq_rag_reply(
                    message, student_ctx.get("name", "Student")
                )
                intent = "rag"
            except Exception as _rag_exc:
                print(f"[RAG fallback] {_rag_exc}")
                reply, suggestions = _build_ai_reply(intent, message, student_ctx)
        else:
            reply, suggestions = _build_ai_reply(intent, message, student_ctx)

        # Best-effort: persist to chat_messages table
        try:
            now_iso = datetime.now().isoformat()
            await supabase_query("chat_messages", method="POST",
                data={"uid": uid, "role": "user",      "message": message, "timestamp": now_iso},
                token=user_token)
            await supabase_query("chat_messages", method="POST",
                data={"uid": uid, "role": "assistant", "message": reply,   "timestamp": now_iso},
                token=user_token)
        except Exception:
            pass

        return JSONResponse({
            "reply":       reply,
            "suggestions": suggestions,
            "timestamp":   datetime.now().isoformat(),
            "intent":      intent,
        })

    except HTTPException:
        raise
    except Exception as e:
        print(f"Assistant chat error: {e}")
        raise HTTPException(status_code=500, detail="Assistant temporarily unavailable")


@app.get("/api/assistant/history/{uid}")
async def assistant_history(uid: str, authorization: str = Header(None)):
    """Load last 40 chat messages for a student (20 exchanges)."""
    try:
        user_token = None
        if authorization and authorization.startswith('Bearer '):
            user_token = authorization.split('Bearer ')[1]

        user_data = await verify_supabase_token(authorization)
        if user_data.get("id") != uid:
            raise HTTPException(status_code=403, detail="Unauthorized")

        try:
            msgs = await supabase_query("chat_messages", filters={"uid": uid}, token=user_token)
            msgs = sorted(msgs or [], key=lambda x: x.get("timestamp", ""))[-40:]
        except Exception:
            msgs = []

        return JSONResponse({"messages": msgs})

    except HTTPException:
        raise
    except Exception as e:
        print(f"Chat history error: {e}")
        return JSONResponse({"messages": []})


# ── Phase 8: Simple /chat endpoint (used by askAI helper) ────────────────────
# Image text extraction helper
def _extract_image_text(image_bytes: bytes, mime_type: str) -> str:
    """Extract text from uploaded image using Groq Vision + OCR fallback."""
    try:
        from backend.rag.image_reader import extract_text_from_image
        return extract_text_from_image(image_bytes, mime_type)
    except Exception as e:
        print(f"[image] text extraction failed: {e}")
        return ""

@app.post("/chat")
async def simple_chat(
    message: str = Form(...),
    image: UploadFile = File(None),
):
    question = message.strip()
    if not RAG_ENGINE_AVAILABLE:
        raise HTTPException(status_code=503, detail="RAG engine not available")

    # Extract text from image if provided
    if image:
        contents = await image.read()
        mime = image.content_type or "image/png"
        import asyncio
        extracted = await asyncio.get_event_loop().run_in_executor(
            None, _extract_image_text, contents, mime
        )
        if extracted:
            question = f"{question} {extracted}".strip() if question else extracted

    import asyncio
    result = await asyncio.get_event_loop().run_in_executor(
        None, rag_pipeline, question
    )
    return {
        "question": question,
        "answer": result.get("answer", ""),
        "sources": result.get("sources", []),
        "chunks_found": result.get("chunks_found", 0),
        "elapsed_sec": result.get("elapsed_sec"),
        "language": result.get("language", "english"),
    }


# ── Dedicated Groq RAG Chat endpoint ─────────────────────────────────────────
@app.post("/api/assistant/rag-chat")
async def rag_chat(
    message: str = Form(None),
    student_name: str = Form("Student"),
    subject_filter: str = Form(""),
    image: UploadFile = File(None),
    authorization: str = Header(None),
    background_tasks: BackgroundTasks = None,
):
    """
    Groq-powered RAG chat endpoint.
    Retrieves relevant NCERT PDF chunks, then answers via Groq llama3-8b-8192.
    Accepts optional image upload for OCR-based questions.
    Falls back to rule-based reply if Groq is unavailable.
    """
    try:
        message        = (message or "").strip()
        student_name   = (student_name or "Student")
        subject_filter = (subject_filter or "")

        # Extract text from image if provided
        if image:
            contents = await image.read()
            mime = image.content_type or "image/png"
            import asyncio as _aio
            extracted = await _aio.get_event_loop().run_in_executor(
                None, _extract_image_text, contents, mime
            )
            if extracted:
                message = f"{message} {extracted}".strip() if message else extracted

        if not message:
            raise HTTPException(status_code=400, detail="message is required")
        if len(message) > 3000:
            raise HTTPException(status_code=400, detail="Message too long")

        if not RAG_ENGINE_AVAILABLE:
            raise HTTPException(status_code=503, detail="RAG engine not available")

        import asyncio
        loop = asyncio.get_event_loop()
        result = await loop.run_in_executor(
            None, rag_pipeline, message, student_name, subject_filter
        )

        answer  = result.get("answer", "")
        sources = result.get("sources", [])
        reply   = answer

        return JSONResponse({
            "reply":        reply,
            "answer":       answer,
            "sources":      sources,
            "chunks_found": result.get("chunks_found", 0),
            "elapsed_sec":  result.get("elapsed_sec"),
            "suggestions":  ["Explain more", "Give me an example", "What else?", "Test me on this"],
            "timestamp":    datetime.now().isoformat(),
            "intent":       "rag",
        })

    except HTTPException:
        raise
    except Exception as e:
        print(f"RAG chat error: {e}")
        raise HTTPException(status_code=500, detail="RAG assistant temporarily unavailable")


@app.post("/api/assistant/rebuild-index")
async def rebuild_rag_index(authorization: str = Header(None)):
    """Rebuild index is handled by Qdrant — no local index to rebuild."""
    return JSONResponse({"status": "ok", "message": "RAG uses Qdrant cloud — no local rebuild needed"})



#  DIGITAL BOOK SYSTEM — Professional NCERT Smart Reader
# ════════════════════════════════════════════════════════════
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse, StreamingResponse
import zipfile, io, re as _re, mimetypes, pathlib

# Serve uploaded PDFs as static files
_UPLOADS_DIR = os.path.join(os.path.dirname(__file__), "backend", "uploads")
os.makedirs(_UPLOADS_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=_UPLOADS_DIR), name="uploads")

# ── ZIP Cache ────────────────────────────────────────────────────────────────
import logging as _logging
_zip_logger = _logging.getLogger("zip_downloads")


def _get_zip_path(subject: str) -> str:
    """Returns the expected cache path for a subject's full ZIP."""
    return os.path.join(_UPLOADS_DIR, f"{subject}_full.zip")


def _create_zip_if_not_exists(subject: str, folder: str) -> str:
    """
    Build a cached ZIP of all PDFs in *folder*.
    First call  → O(n) — builds ZIP once, saves to disk.
    Later calls → O(1) — returns cached path immediately.
    Uses atomic rename to avoid serving partial files.
    """
    zip_path = _get_zip_path(subject)
    if os.path.exists(zip_path):
        return zip_path  # Cache hit

    pdfs = sorted(
        [f for f in os.listdir(folder) if f.lower().endswith(".pdf")],
        key=_sort_key,
    )
    if not pdfs:
        raise HTTPException(status_code=404, detail="No PDFs found for this subject")

    tmp_path = zip_path + ".tmp"
    try:
        with zipfile.ZipFile(tmp_path, "w", zipfile.ZIP_DEFLATED) as zf:
            for pdf in pdfs:
                zf.write(os.path.join(folder, pdf), pdf)
        os.replace(tmp_path, zip_path)  # Atomic rename
    except Exception as exc:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)
        raise HTTPException(status_code=500, detail=f"ZIP generation failed: {exc}")

    return zip_path


def _invalidate_zip_cache(subject: str):
    """Delete cached ZIP so next download re-generates it (call after admin upload)."""
    zip_path = _get_zip_path(subject)
    if os.path.exists(zip_path):
        try:
            os.remove(zip_path)
        except OSError:
            pass


def _log_zip_download(subject: str, uid: str):
    """Background task: non-blocking async download log."""
    _zip_logger.info(
        "[ZIP_DOWNLOAD] subject=%s uid=%s timestamp=%s",
        subject, uid, datetime.utcnow().isoformat(),
    )
    print(f"[ZIP_DOWNLOAD] subject={subject}  uid={uid}  at={datetime.utcnow().isoformat()}")


# ── Subject slug → folder validation (prevent path traversal) ──
_SAFE_SLUG = _re.compile(r"^[A-Za-z0-9_]+$")

def _validate_subject(subject: str) -> str:
    """Ensure slug is safe (alphanumeric + underscore only)."""
    if not _SAFE_SLUG.match(subject):
        raise HTTPException(status_code=400, detail="Invalid subject identifier")
    folder = os.path.join(_UPLOADS_DIR, subject)
    if not os.path.isdir(folder):
        raise HTTPException(status_code=404, detail=f"Subject '{subject}' not found")
    return folder


def _nice_title(filename: str) -> str:
    """
    Smart chapter title from filename:
      intro.pdf / INTRO.pdf     → Intro
      index.pdf / INDEX.pdf     → Index
      unit.pdf  / UNIT.pdf      → Unit
      chapter1.pdf              → Chapter 1
      Chapter 1.pdf             → Chapter 1
      chapter_3.pdf             → Chapter 3
    """
    stem = pathlib.Path(filename).stem
    stem_clean = stem.replace("_", " ").replace("-", " ").strip()
    lower = stem_clean.lower()
    # Named specials
    if lower == "intro":
        return "Intro"
    if lower == "index":
        return "Index"
    if lower == "unit":
        return "Unit"
    # "chapter1" or "chapter 1" or "Chapter  3"
    m = _re.match(r"(?i)(chapter)\s*(\d+)(.*)", stem_clean)
    if m:
        suffix = m.group(3).strip(" -–—")
        title = f"Chapter {m.group(2)}"
        if suffix:
            title += f" - {suffix}"
        return title
    return stem_clean.title()


_REFERENCE_STEMS = {"index", "intro", "annexure", "warm up and cool down"}

def _is_reference(filename: str) -> bool:
    stem = pathlib.Path(filename).stem.lower().replace("-", " ").replace("_", " ").strip()
    return stem in _REFERENCE_STEMS


def _sort_key(filename: str):
    """
    Sort order:
      0 → Index (always first)
      1 → Intro
      2 → Unit
      3 → Chapter 1, 2, 3 … (numeric)
      4 → everything else (Annexure, Warm-up, etc.) alphabetical
    """
    stem = pathlib.Path(filename).stem.lower().replace("-", " ").replace("_", " ").strip()
    if stem == "index":
        return (0, 0, stem)
    if stem == "intro":
        return (1, 0, stem)
    if stem == "unit":
        return (2, 0, stem)
    m = _re.search(r"(\d+)", stem)
    if m:
        return (3, int(m.group(1)), stem)
    return (4, 0, stem)


def _get_user_book_progress(uid: str, subject: str) -> dict:
    """Read book progress for a user+subject from users.json."""
    users = _load_users()
    user = users.get(uid, {})
    books = user.get("books", {})
    return books.get(subject, {})


def _save_user_book_progress(uid: str, subject: str, progress: dict):
    """Persist book progress for a user+subject into users.json."""
    users = _load_users()
    if uid not in users:
        return
    user = users[uid]
    if "books" not in user:
        user["books"] = {}
    user["books"][subject] = progress
    _save_users(users)


# ── Helper to optionally verify JWT (returns uid or None) ──
def _optional_auth(authorization: str | None) -> str | None:
    """Return uid if a valid token is present, else None."""
    if not authorization or not authorization.startswith("Bearer "):
        return None
    try:
        payload = _decode_token(authorization[7:])
        return payload.get("sub")
    except Exception:
        return None


def _require_auth(authorization: str | None) -> str:
    """Return uid or raise 401."""
    uid = _optional_auth(authorization)
    if not uid:
        raise HTTPException(status_code=401, detail="Authentication required")
    return uid


# ══════════════ BOOK API ENDPOINTS ══════════════

@app.get("/api/books")
def list_all_subjects(authorization: str = Header(None)):
    """Return list of all subjects that have at least one PDF."""
    if not os.path.isdir(_UPLOADS_DIR):
        return JSONResponse([], headers={"Cache-Control": "no-store"})
    uid = _optional_auth(authorization)
    result = []
    for name in sorted(os.listdir(_UPLOADS_DIR)):
        folder = os.path.join(_UPLOADS_DIR, name)
        if os.path.isdir(folder):
            pdfs = [f for f in os.listdir(folder) if f.lower().endswith(".pdf")]
            count = len(pdfs)
            if count == 0:
                continue
            # Index/Intro/Annexure/Warm-up are reference material, not counted as chapters
            chapter_count = len([f for f in pdfs if not _is_reference(f)])
            # Include progress if user is authenticated
            progress_data = {}
            if uid:
                progress_data = _get_user_book_progress(uid, name)
            completed = progress_data.get("completedChapters", [])
            result.append({
                "slug": name,
                "count": chapter_count,
                "completedCount": len(completed),
                "lastOpened": progress_data.get("lastOpened", None),
                "lastOpenedAt": progress_data.get("lastOpenedAt", None),
            })
    return JSONResponse(result, headers={"Cache-Control": "no-store"})


@app.get("/api/books/{subject}")
def list_subject_pdfs(subject: str, authorization: str = Header(None)):
    """List all PDFs for a given subject folder, with per-chapter progress."""
    # Validate slug (prevent path traversal)
    if not _SAFE_SLUG.match(subject):
        raise HTTPException(status_code=400, detail="Invalid subject identifier")
    folder = os.path.join(_UPLOADS_DIR, subject)
    # If folder doesn't exist or is empty, return empty list (no error)
    if not os.path.isdir(folder):
        return JSONResponse([], headers={"Cache-Control": "no-store"})
    uid = _optional_auth(authorization)
    progress_data = {}
    if uid:
        progress_data = _get_user_book_progress(uid, subject)
    completed_chapters = progress_data.get("completedChapters", [])
    last_opened_id = progress_data.get("lastOpened", None)

    files = sorted(
        [f for f in os.listdir(folder) if f.lower().endswith(".pdf")],
        key=_sort_key,
    )
    data = [
        {
            "id": i,
            "title": _nice_title(f),
            "file": f"/uploads/{subject}/{f}",
            "filename": f,
            "completed": i in completed_chapters,
            "isLastOpened": i == last_opened_id,
            "is_index": _is_reference(f),
        }
        for i, f in enumerate(files)
    ]
    return JSONResponse(data, headers={"Cache-Control": "no-store"})


@app.get("/api/books/{subject}/zip-info")
def get_zip_info(subject: str, authorization: str = Header(None)):
    """
    Return ZIP metadata: size in bytes/MB, chapter count, and whether
    a cached ZIP already exists (so the frontend can show 'instant' vs 'building').
    Auth is optional — this is public metadata, no sensitive data exposed.
    """
    # Soft auth check only — no 401 raised, just pass through
    _optional_auth(authorization)

    if not _SAFE_SLUG.match(subject):
        raise HTTPException(status_code=400, detail="Invalid subject identifier")
    folder = os.path.join(_UPLOADS_DIR, subject)
    if not os.path.isdir(folder):
        raise HTTPException(status_code=404, detail=f"Subject '{subject}' not found")

    zip_path = _get_zip_path(subject)
    cached = os.path.exists(zip_path)

    if cached:
        size_bytes = os.path.getsize(zip_path)
    else:
        pdfs = [f for f in os.listdir(folder) if f.lower().endswith(".pdf")]
        size_bytes = sum(os.path.getsize(os.path.join(folder, f)) for f in pdfs) if pdfs else 0

    chapter_count = len([f for f in os.listdir(folder)
                          if f.lower().endswith(".pdf")
                          and not _is_reference(f)])
    return {
        "subject": subject,
        "cached": cached,
        "size_bytes": size_bytes,
        "size_mb": round(size_bytes / (1024 * 1024), 2),
        "chapter_count": chapter_count,
    }


@app.get("/api/books/{subject}/download-all")
def download_all_pdfs(
    subject: str,
    background_tasks: BackgroundTasks,
    authorization: str = Header(None),
):
    """
    Download the full subject ZIP (cached on first call).

    Performance:
      First download  → O(n) — builds & caches ZIP once
      All subsequent  → O(1) — FileResponse from disk cache

    RBAC: authenticated students and admins only.
    """
    # ── Security: RBAC ──────────────────────────────────────────────────────
    uid = _require_auth(authorization)
    users_store = _load_users()
    role = users_store.get(uid, {}).get("role", "student")
    if role not in ("student", "admin"):
        raise HTTPException(status_code=403, detail="Access denied")

    # ── Validation ──────────────────────────────────────────────────────────
    if not _SAFE_SLUG.match(subject):
        raise HTTPException(status_code=400, detail="Invalid subject identifier")
    folder = os.path.join(_UPLOADS_DIR, subject)
    if not os.path.isdir(folder):
        raise HTTPException(status_code=404, detail=f"Subject '{subject}' not found")

    # ── Build or fetch cached ZIP ────────────────────────────────────────────
    zip_path = _create_zip_if_not_exists(subject, folder)

    # ── Async logging (non-blocking) ─────────────────────────────────────────
    background_tasks.add_task(_log_zip_download, subject, uid)

    nice_name = subject.replace("_", " ").title()
    return FileResponse(
        path=zip_path,
        filename=f"{nice_name}_Full.zip",
        media_type="application/zip",
        headers={
            "Cache-Control": "public, max-age=86400",
        },
    )


@app.delete("/api/books/{subject}/zip-cache")
def clear_zip_cache(subject: str, authorization: str = Header(None)):
    """
    Admin-only: invalidate cached ZIP for a subject.
    Call this after uploading new chapters so next download re-builds the ZIP.
    """
    uid = _require_auth(authorization)
    users_store = _load_users()
    role = users_store.get(uid, {}).get("role", "student")
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")

    if not _SAFE_SLUG.match(subject):
        raise HTTPException(status_code=400, detail="Invalid subject identifier")

    _invalidate_zip_cache(subject)
    return {"success": True, "message": f"ZIP cache cleared for '{subject}'"}


# ── Reading Progress Tracking ──

class BookProgressRequest(BaseModel):
    chapter_id: int
    action: str = "read"   # "read" | "complete"
    time_spent: int = 0    # seconds spent reading
    scroll_pct: int = 0    # max scroll percentage reached


@app.post("/api/books/{uid}/progress")
async def update_book_progress(
    uid: str,
    req: BookProgressRequest,
    subject: str = None,
    authorization: str = Header(None),
):
    """
    Track reading progress. Auto-marks chapter as completed when:
    - scroll_pct >= 70   OR
    - time_spent >= 120  (2 minutes)
    - action == "complete"
    """
    auth_uid = _require_auth(authorization)
    if auth_uid != uid:
        raise HTTPException(status_code=403, detail="Unauthorized")

    # Subject comes as query param  e.g. /api/books/{uid}/progress?subject=Std_8_math
    if not subject:
        raise HTTPException(status_code=400, detail="subject query param required")
    _validate_subject(subject)

    progress = _get_user_book_progress(uid, subject)
    if "completedChapters" not in progress:
        progress["completedChapters"] = []
    if "readingTime" not in progress:
        progress["readingTime"] = {}

    # Update last opened
    progress["lastOpened"] = req.chapter_id
    progress["lastOpenedAt"] = datetime.utcnow().isoformat()

    # Accumulate reading time
    ch_key = str(req.chapter_id)
    progress["readingTime"][ch_key] = progress["readingTime"].get(ch_key, 0) + req.time_spent

    # Auto-complete when thresholds met
    should_complete = (
        req.action == "complete"
        or req.scroll_pct >= 70
        or progress["readingTime"].get(ch_key, 0) >= 120
    )
    _save_user_book_progress(uid, subject, progress)

    return {
        "success": True,
        "completed": req.chapter_id in progress["completedChapters"],
        "completedChapters": progress["completedChapters"],
        "totalCompleted": len(progress["completedChapters"]),
        "xpEarned": 0,
        "badgeEarned": None,
        "newlyCompleted": newly_completed,
    }


@app.get("/api/books/{uid}/progress-all")
async def get_all_book_progress(uid: str, authorization: str = Header(None)):
    """Return reading progress for ALL subjects for a given user."""
    auth_uid = _require_auth(authorization)
    if auth_uid != uid:
        raise HTTPException(status_code=403, detail="Unauthorized")

    users = _load_users()
    user = users.get(uid, {})
    return user.get("books", {})


# ── Timetable ────────────────────────────────────────────────────────────────

TIMETABLE_DATA = {
    "slots": [
        {"id": "L1",    "label": "Lecture 1", "start": "07:00", "end": "07:40", "is_break": False},
        {"id": "L2",    "label": "Lecture 2", "start": "07:40", "end": "08:20", "is_break": False},
        {"id": "L3",    "label": "Lecture 3", "start": "08:20", "end": "09:00", "is_break": False},
        {"id": "BR1",   "label": "Break",     "start": "09:00", "end": "09:20", "is_break": True},
        {"id": "L4",    "label": "Lecture 4", "start": "09:00", "end": "09:40", "is_break": False},
        {"id": "BR2",   "label": "Break",     "start": "09:40", "end": "10:00", "is_break": True},
        {"id": "L5",    "label": "Lecture 5", "start": "10:00", "end": "10:40", "is_break": False},
        {"id": "L6",    "label": "Lecture 6", "start": "10:40", "end": "11:20", "is_break": False},
        {"id": "L7",    "label": "Lecture 7", "start": "11:20", "end": "12:00", "is_break": False},
    ],
    "schedule": {
        "Monday": {
            "L1":  {"subject": "Sanskrit",      "teacher": "Meera Iyer"},
            "L2":  {"subject": "Mathematics",   "teacher": "Rajan Shah"},
            "L3":  {"subject": "PT",            "teacher": "Sanjay Kulkarni"},
            "BR1": {"subject": "Break",         "teacher": ""},
            "L4":  {"subject": "Science",       "teacher": "Neelam Joshi"},
            "BR2": {"subject": "Break",         "teacher": ""},
            "L5":  {"subject": "English",       "teacher": "Deepa Nair"},
            "L6":  {"subject": "Voc. Education", "teacher": "Rekha Sharma"},
            "L7":  {"subject": "Social Science","teacher": "Manoj Trivedi"},
        },
        "Tuesday": {
            "L1":  {"subject": "Sanskrit",      "teacher": "Meera Iyer"},
            "L2":  {"subject": "English",       "teacher": "Deepa Nair"},
            "L3":  {"subject": "Mathematics",   "teacher": "Rajan Shah"},
            "BR1": {"subject": "Break",         "teacher": ""},
            "L4":  {"subject": "Voc. Education", "teacher": "Rekha Sharma"},
            "BR2": {"subject": "Break",         "teacher": ""},
            "L5":  {"subject": "PT",            "teacher": "Sanjay Kulkarni"},
            "L6":  {"subject": "Social Science", "teacher": "Manoj Trivedi"},
            "L7":  {"subject": "Hindi",         "teacher": "Seema Yadav"},
        },
        "Wednesday": {
            "L1":  {"subject": "Voc. Education", "teacher": "Rekha Sharma"},
            "L2":  {"subject": "Mathematics",   "teacher": "Rajan Shah"},
            "L3":  {"subject": "PT",            "teacher": "Sanjay Kulkarni"},
            "BR1": {"subject": "Break",         "teacher": ""},
            "L4":  {"subject": "Science",       "teacher": "Neelam Joshi"},
            "BR2": {"subject": "Break",         "teacher": ""},
            "L5":  {"subject": "Sanskrit",      "teacher": "Meera Iyer"},
            "L6":  {"subject": "English",       "teacher": "Deepa Nair"},
            "L7":  {"subject": "Hindi",         "teacher": "Seema Yadav"},
        },
        "Thursday": {
            "L1":  {"subject": "Science",       "teacher": "Neelam Joshi"},
            "L2":  {"subject": "Social Science","teacher": "Manoj Trivedi"},
            "L3":  {"subject": "English",       "teacher": "Deepa Nair"},
            "BR1": {"subject": "Break",         "teacher": ""},
            "L4":  {"subject": "Fine Art",      "teacher": "Anita Mehta"},
            "BR2": {"subject": "Break",         "teacher": ""},
            "L5":  {"subject": "Hindi",         "teacher": "Seema Yadav"},
            "L6":  {"subject": "Voc. Education", "teacher": "Rekha Sharma"},
            "L7":  {"subject": "Mathematics",   "teacher": "Rajan Shah"},
        },
        "Friday": {
            "L1":  {"subject": "Science",       "teacher": "Neelam Joshi"},
            "L2":  {"subject": "Voc. Education", "teacher": "Rekha Sharma"},
            "L3":  {"subject": "Sanskrit",      "teacher": "Meera Iyer"},
            "BR1": {"subject": "Break",         "teacher": ""},
            "L4":  {"subject": "Fine Art",      "teacher": "Anita Mehta"},
            "BR2": {"subject": "Break",         "teacher": ""},
            "L5":  {"subject": "English",       "teacher": "Deepa Nair"},
            "L6":  {"subject": "Mathematics",   "teacher": "Rajan Shah"},
            "L7":  {"subject": "Social Science","teacher": "Manoj Trivedi"},
        },
        "Saturday": {
            "L1":  {"subject": "Hindi",         "teacher": "Seema Yadav"},
            "L2":  {"subject": "Sanskrit",      "teacher": "Meera Iyer"},
            "L3":  {"subject": "Mathematics",   "teacher": "Rajan Shah"},
            "BR1": {"subject": "Break",         "teacher": ""},
            "L4":  {"subject": "Science",       "teacher": "Neelam Joshi"},
            "BR2": {"subject": "Break",         "teacher": ""},
            "L5":  {"subject": "Voc. Education", "teacher": "Rekha Sharma"},
            "L6":  {"subject": "Fine Art",      "teacher": "Anita Mehta"},
            "L7":  None,
        },
    }
}


@app.get("/api/timetable/{uid}")
async def get_timetable(uid: str, authorization: str = Header(None)):
    """Return the weekly timetable for the given student."""
    _require_auth(authorization)
    return {
        "uid": uid,
        "class": "8",
        "section": "A",
        "slots": TIMETABLE_DATA["slots"],
        "schedule": TIMETABLE_DATA["schedule"],
    }


# ═══════════════════════════════════════════════════════════════
# PERFORMANCE DASHBOARD
# ═══════════════════════════════════════════════════════════════

# Deterministic seed so each uid always gets the same scores
def _uid_seed(uid: str) -> int:
    return sum(ord(c) * (i + 1) for i, c in enumerate(uid[:12] or "student"))

@app.get("/api/performance/{uid}")
async def get_performance(uid: str, authorization: str = Header(None)):
    """
    Return per-subject academic performance data for the Class 8 dashboard.
    Grades are deterministic per-uid so they stay consistent between refreshes.
    """
    _require_auth(authorization)

    # Try to load real data from Supabase (best-effort)
    real_data: dict = {}
    try:
        parents = await supabase_query("parents", filters={"uid": uid})
        if parents:
            real_data = parents[0]
    except Exception:
        pass

    # Deterministic base scores (seeded by uid)
    seed = int(hashlib.md5(uid.encode()).hexdigest(), 16) % 1000

    SUBJECTS = [
        {"name": "Mathematics",          "base": 88},
        {"name": "English",              "base": 82},
        {"name": "Hindi",                "base": 79},
        {"name": "Science",              "base": 91},
        {"name": "Fine Arts",            "base": 75},
        {"name": "Social Science",       "base": 83},
        {"name": "Sanskrit",             "base": 72},
        {"name": "Physical Education",   "base": 95},
        {"name": "Vocational Education", "base": 80},
    ]

    def _grade(avg: int) -> str:
        if avg >= 90: return "A+"
        if avg >= 80: return "A"
        if avg >= 70: return "B"
        if avg >= 60: return "C"
        return "D"

    subjects_out = []
    for i, subj in enumerate(SUBJECTS):
        # Vary by ±8 based on uid + subject index, keep in 55–98 range
        variation = ((seed + i * 37) % 17) - 8
        avg = max(55, min(98, subj["base"] + variation))
        trend = ((seed + i * 13) % 11) - 4   # -4 to +6
        subjects_out.append({
            "name":  subj["name"],
            "avg":   avg,
            "trend": trend,
            "grade": _grade(avg),
        })

    overall = round(sum(s["avg"] for s in subjects_out) / len(subjects_out))
    top = max(subjects_out, key=lambda s: s["avg"])
    growth = ((seed % 10) - 3)  # -3 to +6

    # Monthly performance trend (last 8 months)
    MONTHS = ["Jul", "Aug", "Sep", "Oct", "Nov", "Dec", "Jan", "Feb"]
    monthly = []
    running = max(45, overall - 12)
    for i, month in enumerate(MONTHS):
        step = ((seed + i * 7) % 7) - 2
        running = max(50, min(100, running + step))
        monthly.append({"month": month, "avg": running})
    monthly[-1]["avg"] = overall  # last point = current average

    # How many exams completed (from profile or deterministic)
    exams_completed = int(real_data.get("homework_completed", (seed % 18) + 12))

    return {
        "uid":            uid,
        "overallAverage": overall,
        "growth":         growth,
        "topSubject":     top["name"],
        "examsCompleted": exams_completed,
        "subjects":       subjects_out,
        "monthly":        monthly,
    }


@app.get("/api/subject-details/{uid}/{subject}")
async def get_subject_details(uid: str, subject: str, authorization: str = Header(None)):
    """
    Return comprehensive subject intelligence integrating performance, timetable,
    attendance, and AI insights for the flip card back side.
    """
    _require_auth(authorization)
    
    seed = int(hashlib.md5(uid.encode()).hexdigest(), 16) % 1000
    
    # ── 1. Subject name normalization (map frontend names to timetable names) ──
    SUBJECT_MAP = {
        "Mathematics": "Mathematics",
        "English": "English",
        "Hindi": "Hindi",
        "Science": "Science",
        "Fine Arts": "Fine Art",
        "Social Science": "Social Science",
        "Sanskrit": "Sanskrit",
        "Physical Education": "PT",
        "Vocational Education": "Voc. Education",
    }
    timetable_subject = SUBJECT_MAP.get(subject, subject)
    
    # ── 2. Extract teacher and schedule from TIMETABLE_DATA ──
    teacher = None
    weekly_periods = 0
    days_scheduled = []
    next_class_info = None
    last_class_info = None
    
    # Parse timetable to find subject occurrences
    schedule = TIMETABLE_DATA.get("schedule", {})
    slots = TIMETABLE_DATA.get("slots", [])
    
    from datetime import datetime, timedelta
    today = datetime.now()
    day_names = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"]
    today_day_name = day_names[today.weekday()] if today.weekday() < 6 else None
    
    # Build list of all occurrences
    occurrences = []
    for day_name, day_schedule in schedule.items():
        for slot_id, lesson in day_schedule.items():
            if lesson and isinstance(lesson, dict) and lesson.get("subject") == timetable_subject:
                if not teacher:
                    teacher = lesson.get("teacher", "Assigned")
                weekly_periods += 1
                if day_name not in days_scheduled:
                    days_scheduled.append(day_name)
                
                # Find slot details
                slot_detail = next((s for s in slots if s["id"] == slot_id), None)
                if slot_detail:
                    occurrences.append({
                        "day": day_name,
                        "slot": slot_id,
                        "start": slot_detail["start"],
                        "end": slot_detail["end"],
                    })
    
    # Sort occurrences by day order
    day_order = {d: i for i, d in enumerate(day_names)}
    occurrences.sort(key=lambda x: (day_order.get(x["day"], 99), x["start"]))
    
    # Find next upcoming class
    current_day_idx = today.weekday()
    for occ in occurrences:
        occ_day_idx = day_order.get(occ["day"], 99)
        if occ_day_idx > current_day_idx:
            next_class_info = {
                "day": occ["day"],
                "time": occ["start"],
                "relative": "This " + occ["day"],
            }
            break
        elif occ_day_idx == current_day_idx:
            # Check if time has passed
            now_time = today.strftime("%H:%M")
            if occ["start"] > now_time:
                next_class_info = {
                    "day": "Today",
                    "time": occ["start"],
                    "relative": "Today",
                }
                break
    
    # If no upcoming class this week, get first class of next week
    if not next_class_info and occurrences:
        first_occ = occurrences[0]
        next_class_info = {
            "day": first_occ["day"],
            "time": first_occ["start"],
            "relative": "Next " + first_occ["day"],
        }
    
    # Find last class (most recent past occurrence)
    for occ in reversed(occurrences):
        occ_day_idx = day_order.get(occ["day"], 99)
        if occ_day_idx < current_day_idx:
            last_class_info = {
                "day": occ["day"],
                "time": occ["start"],
                "relative": "Last " + occ["day"],
            }
            break
    
    if not last_class_info and current_day_idx > 0:
        # Default to previous day occurrence
        last_class_info = {
            "day": day_names[(current_day_idx - 1) % 6],
            "time": "07:40",
            "relative": "Yesterday",
        }
    
    # ── 3. Performance data (from existing performance endpoint logic) ──
    SUBJECTS_BASE = {
        "Mathematics": 88, "English": 82, "Hindi": 79, "Science": 91,
        "Fine Arts": 75, "Social Science": 83, "Sanskrit": 72,
        "Physical Education": 95, "Vocational Education": 80,
    }
    base_score = SUBJECTS_BASE.get(subject, 75)
    subject_idx = list(SUBJECTS_BASE.keys()).index(subject) if subject in SUBJECTS_BASE else 0
    
    variation = ((seed + subject_idx * 37) % 17) - 8
    average_score = max(55, min(98, base_score + variation))
    trend = ((seed + subject_idx * 13) % 11) - 4
    
    def _grade(avg: int) -> str:
        if avg >= 90: return "A+"
        if avg >= 80: return "A"
        if avg >= 70: return "B"
        if avg >= 60: return "C"
        return "D"
    
    grade = _grade(average_score)
    
    # Calculate rank (deterministic, 1-40 based on score)
    rank = max(1, min(40, 41 - (average_score // 2)))
    
    # ── 4. Attendance percentage (deterministic per subject) ──
    attendance_pct = max(75, min(98, 85 + ((seed + subject_idx * 7) % 14)))
    
    # ── 5. Total exams (deterministic) ──
    total_exams = 4 + ((seed + subject_idx) % 3)  # 4-6 exams
    
    # ── 6. Last 4 exam scores with labels ──
    exam_labels = ["Unit Test 1", "Unit Test 2", "Mid-term", "Monthly Test"]
    last_scores = []
    for i in range(min(4, total_exams)):
        score = max(60, min(98, average_score + ((seed + subject_idx * 11 + i * 17) % 21) - 10))
        last_scores.append({
            "label": exam_labels[i] if i < len(exam_labels) else f"Test {i+1}",
            "score": score,
        })
    
    # ── 7. Skill breakdown (4 sub-skills per subject) ──
    SKILL_MAP = {
        "Mathematics": ["Algebra", "Geometry", "Arithmetic", "Data Handling"],
        "English": ["Reading", "Writing", "Grammar", "Speaking"],
        "Hindi": ["Reading", "Writing", "Grammar", "Literature"],
        "Science": ["Physics", "Chemistry", "Biology", "Experiments"],
        "Fine Arts": ["Drawing", "Painting", "Craft", "Design"],
        "Social Science": ["History", "Geography", "Civics", "Economics"],
        "Sanskrit": ["Grammar", "Literature", "Translation", "Poetry"],
        "Physical Education": ["Athletics", "Team Sports", "Fitness", "Yoga"],
        "Vocational Education": ["Practical Skills", "Theory", "Projects", "Safety"],
    }
    skills = SKILL_MAP.get(subject, ["Skill 1", "Skill 2", "Skill 3", "Skill 4"])
    skill_breakdown = []
    for i, skill_name in enumerate(skills):
        skill_score = max(60, min(98, average_score + ((seed + subject_idx * 19 + i * 23) % 25) - 12))
        skill_breakdown.append({
            "name": skill_name,
            "score": skill_score,
        })
    
    # ── 8. AI-generated insight ──
    insight = ""
    if average_score >= 85 and attendance_pct >= 90:
        insight = f"Excellent performance in {subject}! Your consistent attendance is driving your success."
    elif average_score >= 80:
        top_skill = max(skill_breakdown, key=lambda s: s["score"])
        weak_skill = min(skill_breakdown, key=lambda s: s["score"])
        insight = f"You excel in {top_skill['name']} but need improvement in {weak_skill['name']}."
    elif trend > 0:
        insight = f"Great progress! You've improved by {trend}% this term. Keep up the momentum."
    elif attendance_pct < 85:
        insight = f"Attendance is {attendance_pct}%. Attending more classes will help boost performance."
    else:
        insight = f"Focus on {skill_breakdown[0]['name']} to strengthen your {subject} foundation."
    
    # ── 9. Teacher feedback (deterministic sample) ──
    FEEDBACK_POOL = [
        "Good improvement this term. Focus on problem-solving speed.",
        "Consistent effort shown. Keep practicing regularly.",
        "Excellent grasp of concepts. Aim for deeper understanding.",
        "Active participation appreciated. Work on accuracy.",
        "Strong fundamentals. Practice more application questions.",
    ]
    feedback_idx = (seed + subject_idx * 31) % len(FEEDBACK_POOL)
    teacher_feedback = FEEDBACK_POOL[feedback_idx]
    
    # ── 10. Assemble response ──
    return {
        "subject": subject,
        "teacher": teacher or "Assigned",
        "weekly_periods": weekly_periods,
        "days_scheduled": ", ".join(days_scheduled[:3]) if days_scheduled else "TBD",
        "section": "8-A",
        "academic_year": "2025–26",
        "next_class": next_class_info or {"day": "TBD", "time": "TBD", "relative": "TBD"},
        "last_class": last_class_info or {"day": "TBD", "time": "TBD", "relative": "TBD"},
        "average_score": average_score,
        "rank": rank,
        "grade": grade,
        "trend": trend,
        "attendance_pct": attendance_pct,
        "total_exams": total_exams,
        "last_scores": last_scores,
        "skill_breakdown": skill_breakdown,
        "insight": insight,
        "teacher_feedback": teacher_feedback,
    }


# ═══════════════════════════════════════════════════════════════════════════════
# ACTIVITY ENGINE ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

from backend.activity_engine import activity_engine, EventType
from backend.activity_middleware import (
    log_activity_manual,
    log_login,
    log_subject_viewed,
    log_homework_completed,
    log_book_opened,
    log_pdf_viewed
)


@app.get("/api/activities/{uid}")
async def get_user_activities(uid: str, limit: int = 20):
    """
    Get recent activities for a user
    
    Query params:
        - limit: Number of activities to return (default: 20, max: 100)
    """
    try:
        limit = min(limit, 100)  # Cap at 100
        activities = activity_engine.get_user_activities(uid, limit)
        
        return {
            "success": True,
            "activities": activities,
            "count": len(activities)
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/activities/stats/{uid}")
async def get_activity_stats(uid: str):
    """Get activity statistics for a user"""
    try:
        stats = activity_engine.get_activity_stats(uid)
        return {
            "success": True,
            "stats": stats
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/activities/log")
async def log_activity_endpoint(request: dict):
    """
    Manually log an activity
    
    Body:
        {
            "user_id": "uid",
            "event_type": "homework_completed",
            "title": "Optional title",
            "description": "Optional description",
            "subject": "Optional subject",
            "metadata": {}
        }
    """
    try:
        user_id = request.get('user_id')
        event_type = request.get('event_type')
        
        if not user_id or not event_type:
            return {"success": False, "error": "user_id and event_type required"}
        
        event = log_activity_manual(
            user_id=user_id,
            event_type=event_type,
            title=request.get('title'),
            description=request.get('description'),
            subject=request.get('subject'),
            metadata=request.get('metadata')
        )
        
        return {
            "success": True,
            "event": event
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


# ═══════════════════════════════════════════════════════════════════════════════
# AI INSIGHT ENGINE ENDPOINTS
# ═══════════════════════════════════════════════════════════════════════════════

from backend.insight_store import InsightStore
from backend.ai_insight_engine import AIInsightEngine

insight_store = InsightStore()
insight_engine = AIInsightEngine()


@app.get("/api/insights/{uid}")
async def get_user_insights(
    uid: str, 
    status: str = None,
    limit: int = 20
):
    """
    Get insights for a user
    
    Query params:
        - status: Filter by status (active, dismissed, completed)
        - limit: Number of insights to return (default: 20, max: 50)
    """
    try:
        limit = min(limit, 50)
        insights = insight_store.get_user_insights(uid, status=status, limit=limit)
        
        return {
            "success": True,
            "insights": insights,
            "count": len(insights)
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.get("/api/insights/stats/{uid}")
async def get_insight_stats(uid: str):
    """Get insight statistics for a user"""
    try:
        stats = insight_store.get_insight_stats(uid)
        return {
            "success": True,
            "stats": stats
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/insights/dismiss")
async def dismiss_insight(request: dict):
    """
    Dismiss an insight
    
    Body:
        {
            "user_id": "uid",
            "insight_id": "insight_id"
        }
    """
    try:
        user_id = request.get('user_id')
        insight_id = request.get('insight_id')
        
        if not user_id or not insight_id:
            return {"success": False, "error": "user_id and insight_id required"}
        
        success = insight_store.dismiss_insight(user_id, insight_id)
        
        return {
            "success": success,
            "message": "Insight dismissed" if success else "Insight not found"
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/insights/complete")
async def complete_insight(request: dict):
    """
    Mark an insight as completed
    
    Body:
        {
            "user_id": "uid",
            "insight_id": "insight_id"
        }
    """
    try:
        user_id = request.get('user_id')
        insight_id = request.get('insight_id')
        
        if not user_id or not insight_id:
            return {"success": False, "error": "user_id and insight_id required"}
        
        success = insight_store.complete_insight(user_id, insight_id)
        
        return {
            "success": success,
            "message": "Insight completed" if success else "Insight not found"
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


@app.post("/api/insights/generate")
async def generate_insights(request: dict):
    """
    Manually trigger insight generation for a user
    
    Body:
        {
            "user_id": "uid"
        }
    """
    try:
        user_id = request.get('user_id')
        
        if not user_id:
            return {"success": False, "error": "user_id required"}
        
        # Gather data
        activities = activity_engine.get_user_activities(user_id, limit=50)
        
        gam_data = {}
        try:
            from backend.gamification_engine import GamificationEngine
            gam_engine = GamificationEngine()
            gam_data = gam_engine.get_user_state(user_id)
        except ImportError:
            pass
        
        # Generate insights
        insights = insight_engine.analyze_user_activity(
            user_id=user_id,
            activities=activities,
            gamification_data=gam_data
        )
        
        return {
            "success": True,
            "insights": insights,
            "count": len(insights)
        }
    except Exception as e:
        return {"success": False, "error": str(e)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="127.0.0.1", port=8000)
