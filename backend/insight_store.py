"""
Insight Store - JSON-based persistence layer for AI-generated insights

Manages:
- CRUD operations for insights
- Max 20 active insights per user
- Auto-expiry after 7 days
- Status management (active, dismissed, completed)
"""

import json
import os
from datetime import datetime, timedelta
from typing import List, Dict, Optional

# Path to insights storage
INSIGHTS_FILE = os.path.join(os.path.dirname(os.path.dirname(__file__)), "insights.json")

# Maximum insights per user
MAX_INSIGHTS_PER_USER = 20

# Auto-expire insights after 7 days
EXPIRY_DAYS = 7


class InsightStore:
    """Handles all insight storage operations"""
    
    def __init__(self):
        self._ensure_file_exists()
    
    def _ensure_file_exists(self):
        """Create insights.json if it doesn't exist"""
        if not os.path.exists(INSIGHTS_FILE):
            with open(INSIGHTS_FILE, 'w') as f:
                json.dump({}, f, indent=2)
    
    def _load_insights(self) -> Dict:
        """Load all insights from JSON"""
        try:
            with open(INSIGHTS_FILE, 'r') as f:
                return json.load(f)
        except Exception as e:
            print(f"Error loading insights: {e}")
            return {}
    
    def _save_insights(self, data: Dict):
        """Save insights to JSON"""
        try:
            with open(INSIGHTS_FILE, 'w') as f:
                json.dump(data, f, indent=2)
        except Exception as e:
            print(f"Error saving insights: {e}")
    
    def _is_expired(self, timestamp: str) -> bool:
        """Check if insight is expired (>7 days old)"""
        try:
            insight_date = datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
            return datetime.utcnow() - insight_date > timedelta(days=EXPIRY_DAYS)
        except:
            return False
    
    def add_insight(self, user_id: str, insight: Dict) -> Dict:
        """
        Add a new insight for a user
        
        Returns the created insight with insight_id
        """
        data = self._load_insights()
        
        # Initialize user insights if not exists
        if user_id not in data:
            data[user_id] = []
        
        # Remove expired insights
        data[user_id] = [
            i for i in data[user_id] 
            if not self._is_expired(i.get('timestamp', ''))
        ]
        
        # Enforce max insights limit
        if len(data[user_id]) >= MAX_INSIGHTS_PER_USER:
            # Remove oldest insight
            data[user_id] = sorted(
                data[user_id], 
                key=lambda x: x.get('timestamp', ''), 
                reverse=True
            )[:MAX_INSIGHTS_PER_USER - 1]
        
        # Add timestamp if not present
        if 'timestamp' not in insight:
            insight['timestamp'] = datetime.utcnow().isoformat() + 'Z'
        
        # Generate insight_id if not present
        if 'insight_id' not in insight:
            import uuid
            insight['insight_id'] = str(uuid.uuid4())
        
        # Set default status
        if 'status' not in insight:
            insight['status'] = 'active'
        
        data[user_id].append(insight)
        self._save_insights(data)
        
        return insight
    
    def get_user_insights(
        self, 
        user_id: str, 
        status: Optional[str] = None,
        limit: int = 20
    ) -> List[Dict]:
        """
        Get insights for a user
        
        Args:
            user_id: User ID
            status: Filter by status (active, dismissed, completed)
            limit: Maximum number of insights to return
        
        Returns:
            List of insights (newest first)
        """
        data = self._load_insights()
        insights = data.get(user_id, [])
        
        # Remove expired
        insights = [
            i for i in insights 
            if not self._is_expired(i.get('timestamp', ''))
        ]
        
        # Filter by status if provided
        if status:
            insights = [i for i in insights if i.get('status') == status]
        
        # Sort by timestamp (newest first)
        insights = sorted(
            insights, 
            key=lambda x: x.get('timestamp', ''), 
            reverse=True
        )
        
        return insights[:limit]
    
    def get_insights_by_type(
        self, 
        user_id: str, 
        insight_type: str
    ) -> List[Dict]:
        """Get insights of a specific type for a user"""
        insights = self.get_user_insights(user_id)
        return [i for i in insights if i.get('type') == insight_type]
    
    def get_insights_by_subject(
        self, 
        user_id: str, 
        subject: str
    ) -> List[Dict]:
        """Get insights related to a specific subject"""
        insights = self.get_user_insights(user_id)
        return [i for i in insights if i.get('subject') == subject]
    
    def update_insight_status(
        self, 
        user_id: str, 
        insight_id: str, 
        status: str
    ) -> bool:
        """
        Update insight status (active, dismissed, completed)
        
        Returns:
            True if updated, False if not found
        """
        data = self._load_insights()
        
        if user_id not in data:
            return False
        
        for insight in data[user_id]:
            if insight.get('insight_id') == insight_id:
                insight['status'] = status
                insight['updated_at'] = datetime.utcnow().isoformat() + 'Z'
                self._save_insights(data)
                return True
        
        return False
    
    def dismiss_insight(self, user_id: str, insight_id: str) -> bool:
        """Mark insight as dismissed"""
        return self.update_insight_status(user_id, insight_id, 'dismissed')
    
    def complete_insight(self, user_id: str, insight_id: str) -> bool:
        """Mark insight as completed"""
        return self.update_insight_status(user_id, insight_id, 'completed')
    
    def delete_insight(self, user_id: str, insight_id: str) -> bool:
        """Permanently delete an insight"""
        data = self._load_insights()
        
        if user_id not in data:
            return False
        
        original_count = len(data[user_id])
        data[user_id] = [
            i for i in data[user_id] 
            if i.get('insight_id') != insight_id
        ]
        
        if len(data[user_id]) < original_count:
            self._save_insights(data)
            return True
        
        return False
    
    def get_active_count(self, user_id: str) -> int:
        """Get count of active insights for a user"""
        active = self.get_user_insights(user_id, status='active')
        return len(active)
    
    def get_high_severity_count(self, user_id: str) -> int:
        """Get count of high severity active insights"""
        insights = self.get_user_insights(user_id, status='active')
        return len([i for i in insights if i.get('severity') == 'high'])
    
    def clear_old_insights(self, user_id: str):
        """Remove all expired insights for a user"""
        data = self._load_insights()
        
        if user_id not in data:
            return
        
        data[user_id] = [
            i for i in data[user_id] 
            if not self._is_expired(i.get('timestamp', ''))
        ]
        
        self._save_insights(data)
    
    def get_insight_stats(self, user_id: str) -> Dict:
        """Get insight statistics for a user"""
        insights = self.get_user_insights(user_id)
        
        stats = {
            'total': len(insights),
            'active': len([i for i in insights if i.get('status') == 'active']),
            'dismissed': len([i for i in insights if i.get('status') == 'dismissed']),
            'completed': len([i for i in insights if i.get('status') == 'completed']),
            'by_severity': {
                'high': len([i for i in insights if i.get('severity') == 'high']),
                'medium': len([i for i in insights if i.get('severity') == 'medium']),
                'low': len([i for i in insights if i.get('severity') == 'low']),
            },
            'by_type': {}
        }
        
        # Count by type
        for insight in insights:
            insight_type = insight.get('type', 'unknown')
            stats['by_type'][insight_type] = stats['by_type'].get(insight_type, 0) + 1
        
        return stats
