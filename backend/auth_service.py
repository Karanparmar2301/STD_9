"""
auth_service.py
High-level authentication service: signup, login, token refresh, and verify.
"""
import logging
import uuid
from datetime import datetime
from typing import Optional

from backend.exception_handlers import AuthenticationError, StorageError
from backend.jwt_manager import get_jwt_manager
from backend.secure_storage import get_users_storage

logger = logging.getLogger(__name__)

_auth_service_instance = None


class AuthService:
    """Handles user registration, login, and JWT token lifecycle."""

    def __init__(self):
        self._jwt = get_jwt_manager()
        self._storage = get_users_storage()
        logger.info("AuthService initialised")

    # ── Signup ───────────────────────────────────────────────────────────────

    def signup(self, email: str, password: str, name: str = "", student_id: str = "", class_section: str = "") -> dict:
        """Register a new user and return access + refresh tokens."""
        email = email.strip().lower()

        if not email or not password:
            raise AuthenticationError("Email and password are required.")

        if len(password) < 6:
            raise AuthenticationError("Password must be at least 6 characters.")

        # Check duplicate
        existing = self._storage.get_user_by_email(email)
        if existing:
            raise AuthenticationError("An account with this email already exists.")

        uid = str(uuid.uuid4())
        password_hash = self._jwt.hash_password(password)

        user_record = {
            "uid": uid,
            "email": email,
            "name": name or email.split("@")[0],
            "student_id": student_id or f"STU_{uid[:6].upper()}",
            "class_section": class_section,
            "password_hash": password_hash,
            "role": "student",
            "created_at": datetime.utcnow().isoformat(),
        }

        self._storage.upsert_user(uid, user_record)
        logger.info("New user registered: %s (%s)", email, uid)

        access_token = self._jwt.create_access_token(uid, email)
        refresh_token = self._jwt.create_refresh_token(uid, email)

        return {
            "access_token": access_token,
            "token": access_token,          # alias expected by frontend
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "uid": uid,
            "email": email,
            "name": user_record["name"],
        }

    # ── Login ────────────────────────────────────────────────────────────────

    def login(self, email: str, password: str) -> dict:
        """Verify credentials and return access + refresh tokens."""
        email = email.strip().lower()

        if not email or not password:
            raise AuthenticationError("Email and password are required.")

        user = self._storage.get_user_by_email(email)
        if not user:
            raise AuthenticationError("Invalid email or password.")

        password_hash = user.get("password_hash", "")
        if not password_hash or not self._jwt.verify_password(password, password_hash):
            raise AuthenticationError("Invalid email or password.")

        uid = user["uid"]
        access_token = self._jwt.create_access_token(uid, email)
        refresh_token = self._jwt.create_refresh_token(uid, email)

        logger.info("User logged in: %s (%s)", email, uid)

        return {
            "access_token": access_token,
            "token": access_token,          # alias expected by frontend
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "uid": uid,
            "email": email,
            "name": user.get("name", ""),
        }

    # ── Token verify ─────────────────────────────────────────────────────────

    def verify_token(self, token: str) -> dict:
        """Decode a JWT and return basic user info. Raises AuthenticationError if invalid."""
        result = self._jwt.decode_token(token)
        if not result.valid:
            raise AuthenticationError(f"Invalid or expired token: {result.error}")

        payload = result.payload
        uid = payload.get("sub")
        email = payload.get("email", "")

        return {"uid": uid, "email": email, "id": uid}

    # ── Token refresh ────────────────────────────────────────────────────────

    def refresh_token(self, refresh_token: str) -> dict:
        """Issue a new access token from a valid refresh token."""
        result = self._jwt.decode_token(refresh_token)
        if not result.valid:
            raise AuthenticationError("Invalid or expired refresh token.")

        payload = result.payload
        if payload.get("type") != "refresh":
            raise AuthenticationError("Token is not a refresh token.")

        uid = payload["sub"]
        email = payload.get("email", "")
        new_access = self._jwt.create_access_token(uid, email)

        return {
            "access_token": new_access,
            "token_type": "bearer",
            "uid": uid,
            "email": email,
        }

    # ── Change password ──────────────────────────────────────────────────────

    def change_password(self, uid: str, old_password: str, new_password: str) -> None:
        """Update user password after verifying the old one."""
        user = self._storage.get_user(uid)
        if not user:
            raise AuthenticationError("User not found.")

        if not self._jwt.verify_password(old_password, user.get("password_hash", "")):
            raise AuthenticationError("Current password is incorrect.")

        if len(new_password) < 6:
            raise AuthenticationError("New password must be at least 6 characters.")

        user["password_hash"] = self._jwt.hash_password(new_password)
        user["updated_at"] = datetime.utcnow().isoformat()
        self._storage.upsert_user(uid, user)
        logger.info("Password changed for user %s", uid)

    # ── Token info (debug) ───────────────────────────────────────────────────

    def get_token_info(self, token: str) -> dict:
        """Return token payload info for debugging (non-sensitive)."""
        result = self._jwt.decode_token(token)
        if not result.valid:
            return {"valid": False, "error": result.error}

        payload = result.payload
        import datetime as dt
        exp_ts = payload.get("exp")
        exp_str = dt.datetime.utcfromtimestamp(exp_ts).isoformat() if exp_ts else None

        return {
            "valid": True,
            "uid": payload.get("sub"),
            "email": payload.get("email"),
            "type": payload.get("type", "access"),
            "expires_at": exp_str,
        }


def get_auth_service() -> AuthService:
    global _auth_service_instance
    if _auth_service_instance is None:
        _auth_service_instance = AuthService()
    return _auth_service_instance
