"""
Activity Store - JSON-based Activity Storage Handler
Manages persistence and retrieval of student activities
"""

import json
import os
from typing import List, Dict, Optional
from datetime import datetime

ACTIVITIES_FILE = "backend/activities.json"
MAX_ACTIVITIES_PER_USER = 100


class ActivityStore:
    """Handles storage and retrieval of activity events"""

    def __init__(self, file_path: str = ACTIVITIES_FILE):
        self.file_path = file_path
        self._ensure_file_exists()

    def _ensure_file_exists(self):
        """Create activities.json if it doesn't exist"""
        if not os.path.exists(self.file_path):
            with open(self.file_path, 'w') as f:
                json.dump({}, f)

    def _read_activities(self) -> Dict:
        """Read all activities from JSON file"""
        try:
            with open(self.file_path, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {}

    def _write_activities(self, data: Dict):
        """Write activities to JSON file"""
        with open(self.file_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    def add_activity(self, user_id: str, activity: Dict) -> bool:
        """
        Add a new activity for a user
        
        Args:
            user_id: User identifier
            activity: Activity event dictionary
            
        Returns:
            bool: Success status
        """
        try:
            all_activities = self._read_activities()
            
            # Initialize user's activity list if not exists
            if user_id not in all_activities:
                all_activities[user_id] = []
            
            # Add new activity at the beginning (most recent first)
            all_activities[user_id].insert(0, activity)
            
            # Limit to MAX_ACTIVITIES_PER_USER
            if len(all_activities[user_id]) > MAX_ACTIVITIES_PER_USER:
                all_activities[user_id] = all_activities[user_id][:MAX_ACTIVITIES_PER_USER]
            
            self._write_activities(all_activities)
            return True
        except Exception as e:
            print(f"Error adding activity: {e}")
            return False

    def get_user_activities(self, user_id: str, limit: Optional[int] = None) -> List[Dict]:
        """
        Get activities for a specific user
        
        Args:
            user_id: User identifier
            limit: Maximum number of activities to return
            
        Returns:
            List of activity dictionaries
        """
        all_activities = self._read_activities()
        user_activities = all_activities.get(user_id, [])
        
        if limit:
            return user_activities[:limit]
        return user_activities

    def get_recent_activities(self, user_id: str, limit: int = 10) -> List[Dict]:
        """Get most recent activities for a user"""
        return self.get_user_activities(user_id, limit)

    def get_activities_by_type(self, user_id: str, event_type: str) -> List[Dict]:
        """Get activities filtered by event type"""
        activities = self.get_user_activities(user_id)
        return [a for a in activities if a.get('event_type') == event_type]

    def get_activities_by_subject(self, user_id: str, subject: str) -> List[Dict]:
        """Get activities filtered by subject"""
        activities = self.get_user_activities(user_id)
        return [a for a in activities if a.get('subject') == subject]

    def get_activities_by_date_range(self, user_id: str, start_date: str, end_date: str) -> List[Dict]:
        """Get activities within a date range"""
        activities = self.get_user_activities(user_id)
        return [
            a for a in activities 
            if start_date <= a.get('timestamp', '') <= end_date
        ]

    def count_activities(self, user_id: str, event_type: Optional[str] = None) -> int:
        """Count activities for a user, optionally filtered by type"""
        if event_type:
            return len(self.get_activities_by_type(user_id, event_type))
        return len(self.get_user_activities(user_id))

    def delete_user_activities(self, user_id: str) -> bool:
        """Delete all activities for a user"""
        try:
            all_activities = self._read_activities()
            if user_id in all_activities:
                del all_activities[user_id]
                self._write_activities(all_activities)
            return True
        except Exception as e:
            print(f"Error deleting activities: {e}")
            return False

    def get_activity_stats(self, user_id: str) -> Dict:
        """Get activity statistics for a user"""
        activities = self.get_user_activities(user_id)
        
        stats = {
            'total_activities': len(activities),
            'total_xp_earned': sum(a.get('xp_earned', 0) for a in activities),
            'by_type': {},
            'by_subject': {},
            'last_activity': activities[0].get('timestamp') if activities else None
        }
        
        # Count by type
        for activity in activities:
            event_type = activity.get('event_type', 'unknown')
            stats['by_type'][event_type] = stats['by_type'].get(event_type, 0) + 1
            
            # Count by subject
            subject = activity.get('subject')
            if subject:
                stats['by_subject'][subject] = stats['by_subject'].get(subject, 0) + 1
        
        return stats


# Singleton instance
activity_store = ActivityStore()
