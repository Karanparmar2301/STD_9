"""
Activity Middleware - Auto-logging Decorator
Automatically logs activities when API endpoints are called
"""

from functools import wraps
from typing import Optional, Dict, Callable
from fastapi import Request

from backend.activity_engine import activity_engine, EventType


def track_activity(
    event_type: str,
    title: Optional[str] = None,
    subject_from_param: Optional[str] = None,
    metadata_from_params: Optional[list] = None,
    auto_xp: bool = True
):
    """
    Decorator to automatically track activity when an endpoint is called
    
    Usage:
        @track_activity(EventType.HOMEWORK_COMPLETED, subject_from_param='subject')
        async def submit_homework(uid: str, homework_id: str, subject: str):
            # Your endpoint logic
            return {"status": "success"}
    
    Args:
        event_type: Type of event to log
        title: Custom title (optional)
        subject_from_param: Parameter name containing subject
        metadata_from_params: List of param names to include in metadata
        auto_xp: Whether to automatically award XP
    """
    def decorator(func: Callable):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            # Execute the original function first
            result = await func(*args, **kwargs)
            
            try:
                # Extract user_id from kwargs (assuming it's passed as 'uid' or 'user_id')
                user_id = kwargs.get('uid') or kwargs.get('user_id')
                
                if not user_id:
                    # Try to get from request path params
                    for arg in args:
                        if isinstance(arg, str) and len(arg) == 28:  # Firebase UID length
                            user_id = arg
                            break
                
                if user_id:
                    # Extract subject if specified
                    subject = None
                    if subject_from_param and subject_from_param in kwargs:
                        subject = kwargs[subject_from_param]
                    
                    # Build metadata from specified params
                    metadata = {}
                    if metadata_from_params:
                        for param in metadata_from_params:
                            if param in kwargs:
                                metadata[param] = kwargs[param]
                    
                    # Log the activity
                    activity_engine.log_activity(
                        user_id=user_id,
                        event_type=event_type,
                        title=title,
                        subject=subject,
                        metadata=metadata if metadata else None,
                        auto_xp=auto_xp
                    )
            except Exception as e:
                # Don't fail the main request if activity logging fails
                print(f"Activity logging error: {e}")
            
            return result
        return wrapper
    return decorator


def log_activity_manual(
    user_id: str,
    event_type: str,
    title: Optional[str] = None,
    description: Optional[str] = None,
    subject: Optional[str] = None,
    metadata: Optional[Dict] = None,
    auto_xp: bool = True
) -> Dict:
    """
    Manual activity logging function for cases where decorator can't be used
    
    Usage:
        log_activity_manual(
            user_id="user123",
            event_type=EventType.HOMEWORK_COMPLETED,
            subject="Mathematics",
            metadata={"homework_id": "hw_01"}
        )
    """
    try:
        return activity_engine.log_activity(
            user_id=user_id,
            event_type=event_type,
            title=title,
            description=description,
            subject=subject,
            metadata=metadata,
            auto_xp=auto_xp
        )
    except Exception as e:
        print(f"Manual activity logging error: {e}")
        return {}


# Quick access functions for common activities

def log_homework_completed(user_id: str, subject: str, homework_id: str) -> Dict:
    """Quick function to log homework completion"""
    return log_activity_manual(
        user_id=user_id,
        event_type=EventType.HOMEWORK_COMPLETED,
        subject=subject,
        metadata={'homework_id': homework_id}
    )


def log_attendance_marked(user_id: str, date: str, status: str) -> Dict:
    """Quick function to log attendance"""
    return log_activity_manual(
        user_id=user_id,
        event_type=EventType.ATTENDANCE_MARKED,
        metadata={'date': date, 'status': status}
    )


def log_book_opened(user_id: str, subject: str, book_title: str) -> Dict:
    """Quick function to log book opening"""
    return log_activity_manual(
        user_id=user_id,
        event_type=EventType.BOOK_OPENED,
        subject=subject,
        title=f"Opened {book_title}",
        metadata={'book_title': book_title}
    )


def log_pdf_viewed(user_id: str, subject: str, pdf_name: str) -> Dict:
    """Quick function to log PDF viewing"""
    return log_activity_manual(
        user_id=user_id,
        event_type=EventType.PDF_VIEWED,
        subject=subject,
        title=f"Viewed {pdf_name}",
        metadata={'pdf_name': pdf_name}
    )


def log_ai_question(user_id: str, question: str) -> Dict:
    """Quick function to log AI assistant usage"""
    return log_activity_manual(
        user_id=user_id,
        event_type=EventType.AI_QUESTION_ASKED,
        description=f"Asked: {question[:50]}...",
        metadata={'question': question}
    )


def log_login(user_id: str) -> Dict:
    """Quick function to log user login"""
    return log_activity_manual(
        user_id=user_id,
        event_type=EventType.LOGIN,
        auto_xp=True
    )


def log_subject_viewed(user_id: str, subject: str) -> Dict:
    """Quick function to log subject page view"""
    return log_activity_manual(
        user_id=user_id,
        event_type=EventType.SUBJECT_VIEWED,
        subject=subject,
        auto_xp=True
    )
