"""
Activity Engine - Core Event Tracking System
Handles all student activity logging and event processing.
Gamification (XP, badges, levels) has been removed.
"""

import uuid
from datetime import datetime
from typing import Dict, Optional, Any
from enum import Enum

from backend.activity_store import activity_store


class EventType(str, Enum):
    """Standardized event types"""
    # Homework Events
    HOMEWORK_OPENED = "homework_opened"
    HOMEWORK_COMPLETED = "homework_completed"
    HOMEWORK_SUBMITTED = "homework_submitted"

    # Attendance Events
    ATTENDANCE_MARKED = "attendance_marked"
    ATTENDANCE_MISSED = "attendance_missed"

    # Book & Learning Events
    BOOK_OPENED = "book_opened"
    PDF_VIEWED = "pdf_viewed"
    SUBJECT_VIEWED = "subject_viewed"

    # Performance Events
    EXAM_SUBMITTED = "exam_submitted"
    SCORE_IMPROVED = "score_improved"
    PERFORMANCE_VIEWED = "performance_viewed"

    # AI Events
    AI_QUESTION_ASKED = "ai_question_asked"
    AI_SUGGESTION_FOLLOWED = "ai_suggestion_followed"

    # General Events
    LOGIN = "login"
    PROFILE_UPDATED = "profile_updated"
    ANNOUNCEMENT_READ = "announcement_read"


class ActivityEngine:
    """Core activity tracking and event processing engine"""

    def __init__(self):
        self.store = activity_store

    def log_activity(
        self,
        user_id: str,
        event_type: str,
        title: Optional[str] = None,
        description: Optional[str] = None,
        subject: Optional[str] = None,
        metadata: Optional[Dict] = None,
        auto_xp: bool = False,   # kept for API compatibility — XP is disabled
    ) -> Dict:
        """Log a new activity event."""
        event = {
            'event_id': str(uuid.uuid4()),
            'user_id': user_id,
            'event_type': event_type,
            'title': title or self._generate_title(event_type, subject),
            'description': description or "Activity completed",
            'subject': subject,
            'xp_earned': 0,
            'impact_score': 1,
            'metadata': metadata or {},
            'timestamp': datetime.utcnow().isoformat() + 'Z',
        }

        self.store.add_activity(user_id, event)
        return event

    def _generate_title(self, event_type: str, subject: Optional[str] = None) -> str:
        """Generate a default title for the event"""
        titles = {
            EventType.HOMEWORK_COMPLETED: f"{subject or 'Homework'} Completed",
            EventType.HOMEWORK_OPENED: f"Started {subject or 'Homework'}",
            EventType.ATTENDANCE_MARKED: "Attendance Marked",
            EventType.BOOK_OPENED: f"Opened {subject or 'Book'}",
            EventType.PDF_VIEWED: "Viewed Study Material",
            EventType.EXAM_SUBMITTED: f"{subject or 'Exam'} Submitted",
            EventType.SCORE_IMPROVED: "Score Improved!",
            EventType.AI_QUESTION_ASKED: "Asked AI Assistant",
            EventType.LOGIN: "Logged In",
        }
        return titles.get(event_type, "Activity Logged")

    def get_user_activities(self, user_id: str, limit: int = 20) -> list:
        """Get recent activities for a user"""
        return self.store.get_recent_activities(user_id, limit)

    def get_activity_stats(self, user_id: str) -> Dict:
        """Get activity statistics for a user"""
        return self.store.get_activity_stats(user_id)

    def get_subject_engagement(self, user_id: str) -> Dict[str, int]:
        """Get engagement count per subject"""
        activities = self.store.get_user_activities(user_id)
        engagement: Dict[str, int] = {}
        for activity in activities:
            sub = activity.get('subject')
            if sub:
                engagement[sub] = engagement.get(sub, 0) + 1
        return engagement


# Singleton instance
activity_engine = ActivityEngine()
