"""
secure_storage.py
Thread-safe JSON file storage for user records.
"""
import json
import logging
import os
import threading
from pathlib import Path
from typing import Optional

from backend.exception_handlers import StorageError

logger = logging.getLogger(__name__)

# Default path: users.json at the project root
_DEFAULT_USERS_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "users.json")

_storage_instance: Optional["UsersStorage"] = None
_instance_lock = threading.Lock()


class UsersStorage:
    """Thread-safe persistent storage for user records backed by a JSON file."""

    def __init__(self, path: str = _DEFAULT_USERS_PATH):
        self._path = Path(path)
        self._lock = threading.Lock()
        # Create file with empty dict if it doesn't exist
        if not self._path.exists():
            self._path.parent.mkdir(parents=True, exist_ok=True)
            self._path.write_text("{}", encoding="utf-8")
        logger.info("UsersStorage initialised at %s", self._path)

    def load(self) -> dict:
        """Load and return all users as a dict keyed by uid."""
        with self._lock:
            try:
                text = self._path.read_text(encoding="utf-8").strip()
                if not text:
                    return {}
                return json.loads(text)
            except json.JSONDecodeError as e:
                logger.error("Corrupt users.json: %s", e)
                raise StorageError(f"Failed to parse users store: {e}") from e
            except OSError as e:
                logger.error("Cannot read users.json: %s", e)
                raise StorageError(f"Failed to read users store: {e}") from e

    def save(self, users: dict) -> None:
        """Atomically write the users dict to disk."""
        with self._lock:
            try:
                tmp = self._path.with_suffix(".tmp")
                tmp.write_text(json.dumps(users, indent=2, ensure_ascii=False), encoding="utf-8")
                tmp.replace(self._path)
            except OSError as e:
                logger.error("Cannot write users.json: %s", e)
                raise StorageError(f"Failed to save users store: {e}") from e

    def get_user(self, uid: str) -> Optional[dict]:
        users = self.load()
        return users.get(uid)

    def get_user_by_email(self, email: str) -> Optional[dict]:
        users = self.load()
        email_lower = email.lower()
        for user in users.values():
            if user.get("email", "").lower() == email_lower:
                return user
        return None

    def upsert_user(self, uid: str, user_data: dict) -> None:
        users = self.load()
        users[uid] = user_data
        self.save(users)


def get_users_storage() -> UsersStorage:
    global _storage_instance
    if _storage_instance is None:
        with _instance_lock:
            if _storage_instance is None:
                _storage_instance = UsersStorage()
    return _storage_instance
