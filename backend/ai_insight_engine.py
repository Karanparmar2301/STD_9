"""
AI Insight Engine - Intelligent rule-based insight generator

Analyzes student behavior patterns and generates personalized insights:
- Performance trends (improvement/decline)
- Attendance patterns
- Homework consistency
- Streak milestones
- Engagement levels

Zero hallucination - pure deterministic logic
"""

from enum import Enum
from typing import List, Dict, Optional
from datetime import datetime, timedelta
import json

try:
    from insight_store import InsightStore
except ImportError:
    import sys
    import os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..', 'backend'))
    from insight_store import InsightStore


class InsightType(str, Enum):
    """Standard insight categories"""
    PERFORMANCE_IMPROVEMENT = "performance_improvement"
    PERFORMANCE_DECLINE = "performance_decline"
    ATTENDANCE_WARNING = "attendance_warning"
    ATTENDANCE_PRAISE = "attendance_praise"
    HOMEWORK_CONSISTENCY = "homework_consistency"
    HOMEWORK_WARNING = "homework_warning"
    STREAK_MILESTONE = "streak_milestone"
    EXAM_ALERT = "exam_alert"
    ENGAGEMENT_DROP = "engagement_drop"
    ENGAGEMENT_HIGH = "engagement_high"
    READING_HABIT = "reading_habit"
    AI_RECOMMENDATION = "ai_recommendation"


class Severity(str, Enum):
    """Insight severity levels"""
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class AIInsightEngine:
    """Intelligent insight generation engine"""
    
    def __init__(self):
        self.store = InsightStore()
    
    def analyze_user_activity(
        self, 
        user_id: str,
        activities: List[Dict] = None,
        performance_data: Dict = None,
        attendance_data: Dict = None,
        gamification_data: Dict = None
    ) -> List[Dict]:
        """
        Main analysis entry point
        
        Args:
            user_id: User ID to analyze
            activities: Recent activity events
            performance_data: Performance/exam scores
            attendance_data: Attendance records
            gamification_data: Streak, XP, level data
        
        Returns:
            List of generated insights
        """
        insights = []
        
        # Run all analysis functions
        if performance_data:
            insights.extend(self._check_performance_trends(user_id, performance_data))
        
        if attendance_data:
            insights.extend(self._check_attendance_patterns(user_id, attendance_data))
        
        if activities:
            insights.extend(self._check_homework_patterns(user_id, activities))
            insights.extend(self._check_engagement_level(user_id, activities))
            insights.extend(self._check_reading_patterns(user_id, activities))
        
        if gamification_data:
            insights.extend(self._check_streak_milestones(user_id, gamification_data))
        
        # Save generated insights
        for insight in insights:
            self.store.add_insight(user_id, insight)
        
        return insights
    
    # ═══════════════════════════════════════════════════════════════════════════
    # PERFORMANCE ANALYSIS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _check_performance_trends(self, user_id: str, performance_data: Dict) -> List[Dict]:
        """
        Detect performance improvement or decline
        
        Triggers:
        - Improvement: Score increased > 3% OR 3 consecutive good exams
        - Decline: Score dropped > 5% OR 2 exams below average OR missing homework
        """
        insights = []
        subjects = performance_data.get('subjects', [])
        
        for subject in subjects:
            subject_name = subject.get('name', '')
            current_avg = subject.get('average', 0)
            prev_avg = subject.get('previous_average', current_avg)
            recent_scores = subject.get('recent_scores', [])
            homework_completion = subject.get('homework_completion_rate', 100)
            
            # Calculate change
            change_percent = ((current_avg - prev_avg) / prev_avg * 100) if prev_avg > 0 else 0
            
            # ─── PERFORMANCE IMPROVEMENT ───
            if change_percent > 3 or self._has_consecutive_good_scores(recent_scores, 3):
                insights.append({
                    'type': InsightType.PERFORMANCE_IMPROVEMENT,
                    'title': f'{subject_name} performance is improving!',
                    'description': f'Your {subject_name} average increased by {abs(change_percent):.1f}%. Keep up the great work!',
                    'severity': Severity.LOW,
                    'subject': subject_name,
                    'recommended_action': f'Continue practicing {subject_name} to maintain momentum',
                    'confidence_score': 0.85 if change_percent > 5 else 0.75,
                    'metadata': {
                        'current_avg': current_avg,
                        'previous_avg': prev_avg,
                        'change_percent': change_percent
                    }
                })
            
            # ─── PERFORMANCE DECLINE ───
            elif change_percent < -5 or self._has_consecutive_poor_scores(recent_scores, 2):
                severity = Severity.HIGH if change_percent < -10 else Severity.MEDIUM
                
                # Add homework context if relevant
                description = f'Your {subject_name} average dropped by {abs(change_percent):.1f}%.'
                if homework_completion < 70:
                    description += f' Homework completion is also low ({homework_completion:.0f}%).'
                
                insights.append({
                    'type': InsightType.PERFORMANCE_DECLINE,
                    'title': f'{subject_name} performance needs attention',
                    'description': description,
                    'severity': severity,
                    'subject': subject_name,
                    'recommended_action': f'Practice {subject_name} fundamentals and complete pending homework',
                    'confidence_score': 0.90 if change_percent < -10 else 0.80,
                    'metadata': {
                        'current_avg': current_avg,
                        'previous_avg': prev_avg,
                        'change_percent': change_percent,
                        'homework_completion': homework_completion
                    }
                })
        
        return insights
    
    def _has_consecutive_good_scores(self, scores: List[float], count: int) -> bool:
        """Check if last N scores are above 80%"""
        if len(scores) < count:
            return False
        return all(score >= 80 for score in scores[-count:])
    
    def _has_consecutive_poor_scores(self, scores: List[float], count: int) -> bool:
        """Check if last N scores are below 60%"""
        if len(scores) < count:
            return False
        return all(score < 60 for score in scores[-count:])
    
    # ═══════════════════════════════════════════════════════════════════════════
    # ATTENDANCE ANALYSIS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _check_attendance_patterns(self, user_id: str, attendance_data: Dict) -> List[Dict]:
        """
        Detect attendance issues or praise
        
        Triggers:
        - Warning: Attendance < 75% OR 2 consecutive absences
        - Praise: Perfect attendance OR attendance > 95%
        """
        insights = []
        
        attendance_percent = attendance_data.get('percentage', 100)
        consecutive_absences = attendance_data.get('consecutive_absences', 0)
        present_days = attendance_data.get('present_days', 0)
        total_days = attendance_data.get('total_days', 0)
        
        # ─── ATTENDANCE WARNING ───
        if attendance_percent < 75 or consecutive_absences >= 2:
            severity = Severity.HIGH if attendance_percent < 70 else Severity.MEDIUM
            
            insights.append({
                'type': InsightType.ATTENDANCE_WARNING,
                'title': 'Attendance needs improvement',
                'description': f'Your attendance is {attendance_percent:.0f}%. Regular attendance helps improve performance.',
                'severity': severity,
                'subject': None,
                'recommended_action': 'Maintain regular attendance to stay on track',
                'confidence_score': 0.95,
                'metadata': {
                    'attendance_percent': attendance_percent,
                    'consecutive_absences': consecutive_absences,
                    'present_days': present_days,
                    'total_days': total_days
                }
            })
        
        # ─── ATTENDANCE PRAISE ───
        elif attendance_percent >= 95 and total_days >= 10:
            insights.append({
                'type': InsightType.ATTENDANCE_PRAISE,
                'title': 'Excellent attendance record!',
                'description': f'You maintained {attendance_percent:.0f}% attendance. Your consistency is paying off!',
                'severity': Severity.LOW,
                'subject': None,
                'recommended_action': 'Keep up the perfect attendance streak',
                'confidence_score': 1.0,
                'metadata': {
                    'attendance_percent': attendance_percent,
                    'present_days': present_days,
                    'total_days': total_days
                }
            })
        
        return insights
    
    # ═══════════════════════════════════════════════════════════════════════════
    # HOMEWORK ANALYSIS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _check_homework_patterns(self, user_id: str, activities: List[Dict]) -> List[Dict]:
        """
        Detect homework issues or consistency
        
        Triggers:
        - Warning: 2+ pending homework OR 3+ late submissions
        - Consistency: High homework completion streak
        """
        insights = []
        
        # Count homework-related activities
        homework_completed = [a for a in activities if a.get('event_type') == 'HOMEWORK_COMPLETED']
        homework_submitted = [a for a in activities if a.get('event_type') == 'HOMEWORK_SUBMITTED']
        
        # Calculate patterns (last 7 days)
        recent_cutoff = datetime.utcnow() - timedelta(days=7)
        recent_homework = [
            a for a in homework_completed 
            if self._parse_timestamp(a.get('timestamp', '')) > recent_cutoff
        ]
        
        # ─── HOMEWORK WARNING ───
        # This would ideally check pending homework count from homework system
        # For now, check if very few homework activities recently
        if len(recent_homework) == 0 and len(activities) > 5:
            insights.append({
                'type': InsightType.HOMEWORK_WARNING,
                'title': 'No homework completed recently',
                'description': 'You haven\'t completed any homework in the past week. Stay on top of your assignments!',
                'severity': Severity.MEDIUM,
                'subject': None,
                'recommended_action': 'Check pending homework and complete them soon',
                'confidence_score': 0.70,
                'metadata': {
                    'recent_homework_count': len(recent_homework),
                    'days_checked': 7
                }
            })
        
        # ─── HOMEWORK CONSISTENCY ───
        elif len(recent_homework) >= 5:
            insights.append({
                'type': InsightType.HOMEWORK_CONSISTENCY,
                'title': 'Great homework consistency!',
                'description': f'You completed {len(recent_homework)} assignments this week. Excellent dedication!',
                'severity': Severity.LOW,
                'subject': None,
                'recommended_action': 'Maintain this consistent study routine',
                'confidence_score': 0.80,
                'metadata': {
                    'homework_completed': len(recent_homework),
                    'period': '7 days'
                }
            })
        
        return insights
    
    # ═══════════════════════════════════════════════════════════════════════════
    # STREAK & GAMIFICATION ANALYSIS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _check_streak_milestones(self, user_id: str, gamification_data: Dict) -> List[Dict]:
        """
        Celebrate streak milestones
        
        Triggers:
        - Streak hits 3, 5, 7, 10, 15, 20, 30 days
        """
        insights = []
        
        streak = gamification_data.get('streak', 0)
        milestones = [3, 5, 7, 10, 15, 20, 30]
        
        # Check if current streak just hit a milestone
        # (would need to compare with previous streak value in real implementation)
        if streak in milestones:
            # Don't duplicate if insight already exists
            existing = self.store.get_insights_by_type(user_id, InsightType.STREAK_MILESTONE)
            
            # Check if we already have this milestone
            has_this_milestone = any(
                i.get('metadata', {}).get('streak_value') == streak 
                for i in existing
            )
            
            if not has_this_milestone:
                emoji_map = {3: '🎯', 5: '🔥', 7: '⭐', 10: '🏆', 15: '💎', 20: '👑', 30: '🚀'}
                emoji = emoji_map.get(streak, '🎉')
                
                insights.append({
                    'type': InsightType.STREAK_MILESTONE,
                    'title': f'{emoji} {streak}-day learning streak!',
                    'description': f'Amazing! You maintained a {streak}-day streak. Your consistency is impressive!',
                    'severity': Severity.LOW,
                    'subject': None,
                    'recommended_action': 'Keep the momentum going!',
                    'confidence_score': 1.0,
                    'metadata': {
                        'streak_value': streak,
                        'milestone': True
                    }
                })
        
        return insights
    
    # ═══════════════════════════════════════════════════════════════════════════
    # ENGAGEMENT ANALYSIS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _check_engagement_level(self, user_id: str, activities: List[Dict]) -> List[Dict]:
        """
        Detect engagement drop or high engagement
        
        Triggers:
        - Drop: No activity for 2+ days OR no subject opened recently
        - High: High activity frequency, diverse subjects
        """
        insights = []
        
        if not activities:
            # No activity at all - major engagement drop
            insights.append({
                'type': InsightType.ENGAGEMENT_DROP,
                'title': 'Let\'s get back to learning!',
                'description': 'We haven\'t seen you in a while. Continue your learning journey today!',
                'severity': Severity.MEDIUM,
                'subject': None,
                'recommended_action': 'Open a subject and explore new content',
                'confidence_score': 0.90,
                'metadata': {
                    'days_inactive': 'unknown',
                    'last_activity': None
                }
            })
            return insights
        
        # Check recency
        last_activity_time = max(
            self._parse_timestamp(a.get('timestamp', '')) 
            for a in activities
        )
        days_since_activity = (datetime.utcnow() - last_activity_time).days
        
        # ─── ENGAGEMENT DROP ───
        if days_since_activity >= 2:
            insights.append({
                'type': InsightType.ENGAGEMENT_DROP,
                'title': 'We miss you!',
                'description': f'It\'s been {days_since_activity} days since your last activity. Let\'s continue learning!',
                'severity': Severity.MEDIUM,
                'subject': None,
                'recommended_action': 'Resume your studies and check what\'s new',
                'confidence_score': 0.85,
                'metadata': {
                    'days_inactive': days_since_activity,
                    'last_activity': last_activity_time.isoformat()
                }
            })
        
        # ─── HIGH ENGAGEMENT ───
        elif len(activities) > 20:
            unique_subjects = len(set(a.get('subject') for a in activities if a.get('subject')))
            
            insights.append({
                'type': InsightType.ENGAGEMENT_HIGH,
                'title': 'You\'re on fire! 🔥',
                'description': f'You logged {len(activities)} activities across {unique_subjects} subjects. Your dedication is outstanding!',
                'severity': Severity.LOW,
                'subject': None,
                'recommended_action': 'Keep up this amazing learning momentum',
                'confidence_score': 0.95,
                'metadata': {
                    'activity_count': len(activities),
                    'unique_subjects': unique_subjects
                }
            })
        
        return insights
    
    def _check_reading_patterns(self, user_id: str, activities: List[Dict]) -> List[Dict]:
        """
        Detect book reading patterns and habits
        
        Triggers:
        - Reading streak: 3+ consecutive days with book activity
        - Frequent reader: 5+ books/PDFs opened in recent activities
        - Subject diversity: Reading across multiple subjects
        - No reading: No book activity detected
        """
        insights = []
        
        # Filter book reading activities
        reading_activities = [
            a for a in activities 
            if a.get('event_type') in ['BOOK_OPENED', 'PDF_VIEWED', 'book_opened', 'pdf_viewed']
        ]
        
        if not reading_activities:
            # No reading detected - gentle nudge
            # Only suggest if there's general activity (not completely inactive)
            if len(activities) > 5:
                insights.append({
                    'type': InsightType.READING_HABIT,
                    'title': 'Explore your digital library 📚',
                    'description': 'You haven\'t opened any books recently. Reading helps reinforce your learning!',
                    'severity': Severity.LOW,
                    'subject': None,
                    'recommended_action': 'Visit the Books section and explore available subjects',
                    'confidence_score': 0.75,
                    'metadata': {
                        'reading_count': 0,
                        'suggestion_type': 'start_reading'
                    }
                })
            return insights
        
        # Analyze reading frequency
        reading_count = len(reading_activities)
        
        # Get unique subjects read
        subjects_read = list(set(
            a.get('subject', 'Unknown') 
            for a in reading_activities 
            if a.get('subject')
        ))
        
        # Check reading streak (consecutive days)
        reading_dates = set()
        for activity in reading_activities:
            timestamp = activity.get('timestamp', '')
            if timestamp:
                try:
                    date = self._parse_timestamp(timestamp).date()
                    reading_dates.add(date)
                except:
                    pass
        
        consecutive_days = self._count_consecutive_days(sorted(reading_dates, reverse=True))
        
        # ─── READING STREAK DETECTED ───
        if consecutive_days >= 3:
            emoji = '🔥' if consecutive_days >= 5 else '📚'
            insights.append({
                'type': InsightType.READING_HABIT,
                'title': f'{consecutive_days}-day reading streak! {emoji}',
                'description': f'You\'ve been reading consistently for {consecutive_days} days. Reading strengthens understanding and retention!',
                'severity': Severity.LOW,
                'subject': None,
                'recommended_action': f'Keep your streak alive! Try exploring {subjects_read[0] if subjects_read else "new subjects"}',
                'confidence_score': 0.90,
                'metadata': {
                    'streak_days': consecutive_days,
                    'reading_count': reading_count,
                    'subjects': subjects_read
                }
            })
        
        # ─── FREQUENT READER ───
        elif reading_count >= 5:
            insights.append({
                'type': InsightType.READING_HABIT,
                'title': 'Great reading habit! 📖',
                'description': f'You\'ve opened {reading_count} books across {len(subjects_read)} subject{"s" if len(subjects_read) != 1 else ""}. Keep exploring!',
                'severity': Severity.LOW,
                'subject': None,
                'recommended_action': 'Try reading subjects you haven\'t explored yet',
                'confidence_score': 0.85,
                'metadata': {
                    'reading_count': reading_count,
                    'subjects': subjects_read,
                    'diversity_score': len(subjects_read)
                }
            })
        
        # ─── SUBJECT DIVERSITY PRAISE ───
        elif len(subjects_read) >= 4:
            insights.append({
                'type': InsightType.READING_HABIT,
                'title': 'Well-rounded learner! 🌟',
                'description': f'You\'re reading across {len(subjects_read)} different subjects: {", ".join(subjects_read[:3])}{" and more" if len(subjects_read) > 3 else ""}!',
                'severity': Severity.LOW,
                'subject': None,
                'recommended_action': 'Continue exploring diverse topics to build comprehensive knowledge',
                'confidence_score': 0.88,
                'metadata': {
                    'subjects': subjects_read,
                    'diversity_score': len(subjects_read)
                }
            })
        
        # ─── RECENT READING ACTIVITY ───
        elif reading_count >= 2:
            most_read_subject = subjects_read[0] if subjects_read else None
            insights.append({
                'type': InsightType.READING_HABIT,
                'title': f'Good reading progress! 📚',
                'description': f'You\'ve been reading {most_read_subject if most_read_subject else "recent books"}. Regular reading helps retain knowledge!',
                'severity': Severity.LOW,
                'subject': most_read_subject,
                'recommended_action': 'Try to read a little every day for best results',
                'confidence_score': 0.80,
                'metadata': {
                    'reading_count': reading_count,
                    'primary_subject': most_read_subject
                }
            })
        
        return insights
    
    def _count_consecutive_days(self, sorted_dates: List) -> int:
        """Count consecutive days in a sorted list of dates (most recent first)"""
        if not sorted_dates:
            return 0
        
        consecutive = 1
        for i in range(len(sorted_dates) - 1):
            # Check if dates are consecutive (1 day apart)
            delta = (sorted_dates[i] - sorted_dates[i + 1]).days
            if delta == 1:
                consecutive += 1
            else:
                break
        
        return consecutive
    
    # ═══════════════════════════════════════════════════════════════════════════
    # HELPER METHODS
    # ═══════════════════════════════════════════════════════════════════════════
    
    def _parse_timestamp(self, timestamp: str) -> datetime:
        """Parse ISO timestamp string"""
        try:
            return datetime.fromisoformat(timestamp.replace('Z', '+00:00'))
        except:
            return datetime.utcnow()
    
    def generate_ai_recommendation(
        self, 
        user_id: str, 
        context: str,
        subject: Optional[str] = None
    ) -> Dict:
        """
        Generate a contextual AI recommendation insight
        
        Args:
            user_id: User ID
            context: Reason for recommendation
            subject: Related subject (optional)
        
        Returns:
            Generated insight
        """
        insight = {
            'type': InsightType.AI_RECOMMENDATION,
            'title': 'AI Recommendation',
            'description': context,
            'severity': Severity.LOW,
            'subject': subject,
            'recommended_action': 'Ask AI Assistant for personalized guidance',
            'confidence_score': 0.75,
            'metadata': {
                'ai_generated': True,
                'context': context
            }
        }
        
        self.store.add_insight(user_id, insight)
        return insight
