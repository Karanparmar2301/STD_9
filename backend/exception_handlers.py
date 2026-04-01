"""
exception_handlers.py
Custom exceptions and FastAPI exception handlers for the Student Dashboard.
"""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import logging

logger = logging.getLogger(__name__)


# ── Custom Exception Classes ─────────────────────────────────────────────────

class AuthenticationError(Exception):
    """Raised when authentication fails (wrong credentials, expired token, etc.)"""
    pass


class StorageError(Exception):
    """Raised when reading/writing persistent storage fails."""
    pass


class NotFoundError(Exception):
    """Raised when a requested resource does not exist."""
    pass


# ── FastAPI Exception Handlers ───────────────────────────────────────────────

def register_all_handlers(app: FastAPI) -> None:
    """Register all custom exception handlers onto the FastAPI app."""

    @app.exception_handler(AuthenticationError)
    async def authentication_error_handler(request: Request, exc: AuthenticationError):
        logger.warning(f"AuthenticationError on {request.url}: {exc}")
        return JSONResponse(
            status_code=401,
            content={"detail": str(exc)},
        )

    @app.exception_handler(StorageError)
    async def storage_error_handler(request: Request, exc: StorageError):
        logger.error(f"StorageError on {request.url}: {exc}")
        return JSONResponse(
            status_code=503,
            content={"detail": "Service temporarily unavailable. Please try again."},
        )

    @app.exception_handler(NotFoundError)
    async def not_found_error_handler(request: Request, exc: NotFoundError):
        logger.info(f"NotFoundError on {request.url}: {exc}")
        return JSONResponse(
            status_code=404,
            content={"detail": str(exc)},
        )

    logger.info("All custom exception handlers registered.")
