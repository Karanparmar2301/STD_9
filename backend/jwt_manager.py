"""
jwt_manager.py
JWT token creation, decoding, and password hashing utilities.
"""
import os
import logging
from datetime import datetime, timedelta
from dataclasses import dataclass, field
from typing import Optional

from jose import JWTError, jwt
from passlib.context import CryptContext

logger = logging.getLogger(__name__)

# ── Password hashing context ─────────────────────────────────────────────────
_pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


@dataclass
class TokenResult:
    valid: bool
    payload: dict = field(default_factory=dict)
    error: Optional[str] = None


# ── Singleton JWTManager ─────────────────────────────────────────────────────
_jwt_manager_instance = None


class JWTManager:
    def __init__(self):
        self.secret = os.getenv("JWT_SECRET", "super-secret-student-dashboard-key-2026")
        self.algorithm = os.getenv("JWT_ALGORITHM", "HS256")
        self.expire_days = int(os.getenv("JWT_EXPIRE_DAYS", "30"))
        self.refresh_expire_days = int(os.getenv("JWT_REFRESH_EXPIRE_DAYS", "90"))
        logger.info("JWTManager initialised (algorithm=%s, expire=%dd)", self.algorithm, self.expire_days)

    # ── Password helpers ─────────────────────────────────────────────────────

    def hash_password(self, plain: str) -> str:
        return _pwd_context.hash(plain)

    def verify_password(self, plain: str, hashed: str) -> bool:
        try:
            return _pwd_context.verify(plain, hashed)
        except Exception:
            return False

    # ── Token creation ───────────────────────────────────────────────────────

    def create_access_token(self, uid: str, email: str) -> str:
        expire = datetime.utcnow() + timedelta(days=self.expire_days)
        payload = {
            "sub": uid,
            "email": email,
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "access",
        }
        return jwt.encode(payload, self.secret, algorithm=self.algorithm)

    def create_refresh_token(self, uid: str, email: str) -> str:
        expire = datetime.utcnow() + timedelta(days=self.refresh_expire_days)
        payload = {
            "sub": uid,
            "email": email,
            "exp": expire,
            "iat": datetime.utcnow(),
            "type": "refresh",
        }
        return jwt.encode(payload, self.secret, algorithm=self.algorithm)

    # ── Token decoding ───────────────────────────────────────────────────────

    def decode_token(self, token: str) -> TokenResult:
        try:
            payload = jwt.decode(token, self.secret, algorithms=[self.algorithm])
            return TokenResult(valid=True, payload=payload)
        except JWTError as e:
            logger.debug("JWT decode failed: %s", e)
            return TokenResult(valid=False, error=str(e))


def get_jwt_manager() -> JWTManager:
    global _jwt_manager_instance
    if _jwt_manager_instance is None:
        _jwt_manager_instance = JWTManager()
    return _jwt_manager_instance
