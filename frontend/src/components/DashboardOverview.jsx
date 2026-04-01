import React, { useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { selectGamificationProgress } from '../store/gamificationSlice';
import { fetchActivities, selectRecentActivities } from '../store/activitySlice';
import { 
    fetchAIInsights, 
    dismissInsight, 
    completeInsight,
    selectActiveInsights,
    selectAIInsightsLoading 
} from '../store/insightsSlice';
import { fetchPerformance, selectPerfKPIs } from '../store/performanceSlice';
import { setActiveSection } from '../store/uiSlice';
import { apiService } from '../services/api';
import './DashboardOverview.css';

// ── Activity icon/label helpers ───────────────────────────────────────────────
const ACTION_META = {
    // Legacy gamification events
    HOMEWORK_COMPLETE: { icon: '✔', iconClass: 'homework-icon', label: 'Homework Completed' },
    GAME_COMPLETE:     { icon: '🎮', iconClass: 'game-icon',     label: 'Game Completed'    },
    ATTENDANCE_MARK:   { icon: '📊', iconClass: 'attendance-icon', label: 'Attendance Marked' },
    BADGE_UNLOCK:      { icon: '🏆', iconClass: 'badge-icon',    label: 'Badge Unlocked'    },
    LEVEL_UP:          { icon: '⭐', iconClass: 'levelup-icon',  label: 'Level Up!'         },
    
    // Activity Engine event types
    LOGIN:                { icon: '🔐', iconClass: 'default-icon',     label: 'Logged In'          },
    HOMEWORK_COMPLETED:   { icon: '✔',  iconClass: 'homework-icon',    label: 'Homework Completed' },
    HOMEWORK_SUBMITTED:   { icon: '📝', iconClass: 'homework-icon',    label: 'Homework Submitted' },
    HOMEWORK_VIEWED:      { icon: '👀', iconClass: 'homework-icon',    label: 'Homework Viewed'    },
    ATTENDANCE_MARKED:    { icon: '📅', iconClass: 'attendance-icon',  label: 'Attendance Marked'  },
    BOOK_OPENED:          { icon: '📚', iconClass: 'game-icon',        label: 'Book Opened'        },
    PDF_VIEWED:           { icon: '📖', iconClass: 'game-icon',        label: 'PDF Viewed'         },
    PERFORMANCE_VIEWED:   { icon: '📈', iconClass: 'default-icon',     label: 'Performance Viewed' },
    TIMETABLE_VIEWED:     { icon: '🗓', iconClass: 'default-icon',     label: 'Timetable Viewed'   },
    AI_QUESTION_ASKED:    { icon: '💡', iconClass: 'default-icon',     label: 'AI Question Asked'  },
    PROFILE_UPDATED:      { icon: '👤', iconClass: 'default-icon',     label: 'Profile Updated'    },
    GAME_PLAYED:          { icon: '🎮', iconClass: 'game-icon',        label: 'Game Played'        },
    GAME_COMPLETED:       { icon: '🏆', iconClass: 'game-icon',        label: 'Game Completed'     },
    ACHIEVEMENT_UNLOCKED: { icon: '🏅', iconClass: 'badge-icon',       label: 'Achievement'        },
    STREAK_MILESTONE:     { icon: '🔥', iconClass: 'badge-icon',       label: 'Streak Milestone'   },
    LEVEL_UP_EVENT:       { icon: '⭐', iconClass: 'levelup-icon',     label: 'Level Up!'          },
    ANNOUNCEMENT_READ:    { icon: '📢', iconClass: 'default-icon',     label: 'Announcement Read'  },
};

function relativeTime(ts) {
    if (!ts) return '';
    const diff = Date.now() - new Date(ts).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1)  return 'Just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
}

const ActivityItem = React.forwardRef(({ entry, delay }, ref) => {
    // Support both old action_type (gamification) and new event_type (activity engine)
    const eventType = entry.event_type || entry.action_type;
    const meta = ACTION_META[eventType] || { icon: '⚡', iconClass: 'default-icon', label: eventType };
    
    // Format description (from activity engine or legacy)
    let displayText = entry.description || meta.label;
    if (entry.subject) {
        displayText += ` • ${entry.subject}`;
    }
    
    return (
        <motion.div
            ref={ref}
            className="timeline-item live"
            layout
            initial={{ opacity: 0, x: -24, scale: 0.95 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 24, scale: 0.9 }}
            transition={{ duration: 0.3, delay }}
        >
            <div className={`timeline-icon ${meta.iconClass}`}>{meta.icon}</div>
            <div className="timeline-content">
                <h4>{displayText}</h4>
                {entry.xp_earned > 0 && (
                    <span className="timeline-xp">+{entry.xp_earned} XP</span>
                )}
                <span className="timeline-time">{relativeTime(entry.timestamp)}</span>
            </div>
        </motion.div>
    );
});

// ── InsightCard Component ──────────────────────────────────────────────────
function InsightCard({ insight, onDismiss, onComplete, delay }) {
    const dispatch = useDispatch();
    
    // Severity-based styling
    const severityConfig = {
        HIGH: {
            icon: '🚨',
            color: '#ef4444',
            bgColor: 'rgba(239, 68, 68, 0.08)',
            borderColor: 'rgba(239, 68, 68, 0.3)',
            label: 'High Priority'
        },
        MEDIUM: {
            icon: '⚠️',
            color: '#f59e0b',
            bgColor: 'rgba(245, 158, 11, 0.08)',
            borderColor: 'rgba(245, 158, 11, 0.3)',
            label: 'Needs Attention'
        },
        LOW: {
            icon: '💡',
            color: '#3b82f6',
            bgColor: 'rgba(59, 130, 246, 0.08)',
            borderColor: 'rgba(59, 130, 246, 0.3)',
            label: 'Tip'
        }
    };
    
    const config = severityConfig[insight.severity] || severityConfig.LOW;
    
    // Confidence percentage
    const confidencePercent = Math.round(insight.confidence * 100);
    
    return (
        <motion.div
            className="insight-card"
            style={{
                background: config.bgColor,
                borderLeft: `4px solid ${config.color}`,
                borderColor: config.borderColor
            }}
            layout
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, height: 0 }}
            transition={{ duration: 0.3, delay }}
        >
            <div className="insight-header">
                <span className="insight-icon" style={{ color: config.color }}>
                    {config.icon}
                </span>
                <div className="insight-header-content">
                    <h4 className="insight-title" style={{ color: config.color }}>
                        {insight.title}
                    </h4>
                    <span className="insight-severity-label" style={{ color: config.color }}>
                        {config.label}
                    </span>
                </div>
                <div className="insight-confidence">
                    <span className="insight-confidence-value">{confidencePercent}%</span>
                    <span className="insight-confidence-label">confident</span>
                </div>
            </div>
            
            <p className="insight-description">{insight.description}</p>
            
            {insight.recommendation && (
                <div className="insight-recommendation">
                    <span className="recommendation-icon">💡</span>
                    <span className="recommendation-text">{insight.recommendation}</span>
                </div>
            )}
            
            {insight.subject && (
                <span className="insight-subject-tag">📚 {insight.subject}</span>
            )}
            
            <div className="insight-actions">
                <motion.button
                    className="insight-btn insight-btn-complete"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onComplete(insight.id)}
                >
                    ✓ Got it
                </motion.button>
                <motion.button
                    className="insight-btn insight-btn-dismiss"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => onDismiss(insight.id)}
                >
                    × Dismiss
                </motion.button>
            </div>
        </motion.div>
    );
}

// Placeholder shown before any real activity is recorded this session
const PLACEHOLDER_ACTIVITY = [
    { id: 'p1', icon: '✔', iconClass: 'homework-icon', title: 'Complete homework',    description: 'Earn XP for each correct answer', time: 'Pending' },
    { id: 'p2', icon: '📚', iconClass: 'game-icon',     title: 'Explore my books', description: 'Read books from the digital library',    time: 'Pending' },
    { id: 'p3', icon: '📊', iconClass: 'attendance-icon', title: 'Mark attendance',   description: 'Show up every day to earn badges',  time: 'Pending' },
];

/**
 * DashboardOverview - Professional Interactive Dashboard
 * 
 * Features:
 * - Clickable cards with auto-navigation
 * - Real-time status badges
 * - Progress overview bar
 * - Activity timeline (live Redux feed)
 * - Smart motivation messages
 */
function DashboardOverview() {
    const dispatch = useDispatch();
    const studentData = useSelector((state) => state.student.profile);
    const { level, totalXP, currentLevelXP, xpToNextLevel } = useSelector(selectGamificationProgress);
    const { overallAverage } = useSelector(selectPerfKPIs);
    
    const recentActivity = useSelector(selectRecentActivities);
    const uid = useSelector((state) => state.auth.user?.uid);

    // Book overall progress + chapters
    const [bookAvgProgress, setBookAvgProgress] = useState(0);
    const [chaptersRead, setChaptersRead]       = useState(0);
    const [totalChapters, setTotalChapters]     = useState(0);
    useEffect(() => {
        apiService.getAllSubjects().then(({ data }) => {
            const withChapters = data.filter(s => (s.count || 0) > 0);
            const avg = withChapters.length > 0
                ? Math.round(withChapters.reduce((sum, s) => sum + Math.round(((s.completedCount || 0) / s.count) * 100), 0) / withChapters.length)
                : 0;
            setBookAvgProgress(avg);
            setChaptersRead(data.reduce((s, b) => s + (b.completedCount || 0), 0));
            setTotalChapters(data.reduce((s, b) => s + (b.count || 0), 0));
        }).catch(() => {});
    }, []);

    // AI Insights from the new system
    const aiInsights = useSelector(selectActiveInsights);
    const aiInsightsLoading = useSelector(selectAIInsightsLoading);

    // Get homework and announcements data
    const homeworkPending = useSelector((state) => state.homework.pending || []);
    const homeworkStats = useSelector((state) => state.homework.stats);
    const unreadAnnouncements = useSelector((state) => state.announcements.unreadCount || 0);

    // Fetch activities, insights, and performance on mount
    useEffect(() => {
        if (uid) {
            dispatch(fetchActivities({ uid, limit: 20 }));
            dispatch(fetchAIInsights({ uid, status: 'active', limit: 10 }));
            dispatch(fetchPerformance(uid));
        }
    }, [uid, dispatch]);

    // Handlers for insight actions
    const handleDismissInsight = (insightId) => {
        if (uid) {
            dispatch(dismissInsight({ user_id: uid, insight_id: insightId }));
        }
    };

    const handleCompleteInsight = (insightId) => {
        if (uid) {
            dispatch(completeInsight({ user_id: uid, insight_id: insightId }));
        }
    };

    // Calculate stats
    const attendancePercentage = Math.round(studentData?.attendance_percentage || 95);
    const homeworkCompleted = homeworkStats?.completed || studentData?.homework_completed || 12;
    const homeworkTotal = homeworkStats?.total || studentData?.homework_total || 15;
    const homeworkPercentage = homeworkTotal > 0 
        ? Math.round((homeworkCompleted / homeworkTotal) * 100) 
        : 0;
    const pendingHomeworkCount = homeworkPending.length || (homeworkTotal - homeworkCompleted);
    
    // Calculate XP progress for the current level (100 XP per level)
    const XP_PER_LEVEL = 100;
    const xpProgress = Math.round((currentLevelXP / XP_PER_LEVEL) * 100);
    
    // Handler for card navigation
    const handleNavigate = (section) => {
        dispatch(setActiveSection(section));
    };

    // Quick stats with navigation - Now clickable!
    const quickStats = [
        {
            icon: '📖',
            label: 'Chapters Read',
            value: chaptersRead,
            color: '#6366f1',
            description: `of ${totalChapters}`,
            section: 'books',
            badge: null
        },
        {
            icon: '📈',
            label: 'Overall Average',
            value: `${overallAverage}%`,
            color: '#6366F1',
            description: overallAverage >= 80 ? 'Excellent!' : 'Good progress',
            section: 'performance',
            badge: null
        },
        {
            icon: '📊',
            label: 'Attendance',
            value: `${attendancePercentage}%`,
            color: attendancePercentage >= 80 ? '#10b981' : '#f59e0b',
            description: attendancePercentage >= 80 ? 'On track' : 'Needs attention',
            section: 'attendance',
            badge: attendancePercentage < 80 ? { type: 'warning', text: '!' } : null
        },
        {
            icon: '📝',
            label: 'Homework',
            value: `${homeworkCompleted}/${homeworkTotal}`,
            color: '#6366f1',
            description: `${homeworkPercentage}% complete`,
            section: 'homework',
            badge: pendingHomeworkCount > 0 ? { type: 'pending', text: pendingHomeworkCount } : null
        }
    ];

    // Smart Action Cards - 6 primary actions
    const actionCards = [
        {
            icon: '📊',
            title: 'View Attendance',
            description: 'Track your presence',
            gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            section: 'attendance'
        },
        {
            icon: '📚',
            title: 'Check Homework',
            description: 'Pending assignments',
            gradient: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            section: 'homework',
            badge: pendingHomeworkCount
        },
        {
            icon: '📢',
            title: 'View Announcements',
            description: 'School updates',
            gradient: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            section: 'announcements',
            badge: unreadAnnouncements
        },
        {
            icon: '📈',
            title: 'Performance',
            description: 'View your progress',
            gradient: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
            section: 'performance'
        },
        {
            icon: '📚',
            title: 'My Books',
            description: 'Digital library',
            gradient: 'linear-gradient(135deg, #fa709a 0%, #fee140 100%)',
            section: 'books'
        },
        {
            icon: '🗓️',
            title: 'Timetable',
            description: 'Weekly class schedule',
            gradient: 'linear-gradient(135deg, #4361ee 0%, #3a0ca3 100%)',
            section: 'timetable'
        },
        {
            icon: '🤖',
            title: 'Ask AI',
            description: 'Get study help',
            gradient: 'linear-gradient(135deg, #30cfd0 0%, #330867 100%)',
            section: 'ai-assistant'
        }
    ];

    // Smart Motivation Message - Dynamic based on performance
    const getMotivation = () => {
        if (attendancePercentage >= 95 && overallAverage >= 85) {
            return {
                icon: '🌟',
                message: "Outstanding! You're crushing it with perfect attendance and excellent grades!",
                type: 'excellent'
            };
        } else if (pendingHomeworkCount > 3) {
            return {
                icon: '📚',
                message: `You have ${pendingHomeworkCount} pending assignments. Let's tackle them together!`,
                type: 'reminder'
            };
        } else if (attendancePercentage < 80) {
            return {
                icon: '⏰',
                message: "Your attendance needs a boost. Every day counts!",
                type: 'warning'
            };
        } else if (overallAverage < 70) {
            return {
                icon: '💪',
                message: "Focus on your studies! Let's improve those grades together.",
                type: 'encourage'
            };
        } else {
            return {
                icon: '💡',
                message: "Every day is a chance to learn something new. Keep up the great work!",
                type: 'default'
            };
        }
    };

    const motivation = getMotivation();

    // Animation variants
    const container = {
        hidden: { opacity: 0 },
        show: {
            opacity: 1,
            transition: {
                staggerChildren: 0.08
            }
        }
    };

    const item = {
        hidden: { opacity: 0, y: 20 },
        show: { opacity: 1, y: 0 }
    };

    const cardHover = {
        scale: 1.03,
        y: -6,
        boxShadow: '0 12px 32px rgba(0, 0, 0, 0.15)',
        transition: { duration: 0.3 }
    };

    return (
        <div className="dashboard-overview">
            {/* Welcome Section */}
            <motion.div 
                className="welcome-section"
                initial={{ opacity: 0, y: -20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
            >
                <h1 className="welcome-title">
                    Welcome Back, {studentData?.student_name || 'Student'}! <span className="welcome-emoji" role="img" aria-label="target">🎯</span>
                </h1>
                <p className="welcome-subtitle">
                    Here's your personalized learning dashboard
                </p>
            </motion.div>

            {/* Progress Overview Bar */}
            <motion.div 
                className="progress-overview"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.4, delay: 0.1 }}
            >
                <div className="progress-item">
                    <div className="progress-header">
                        <span className="progress-icon">📚</span>
                        <span className="progress-label">Overall Progress</span>
                        <span className="progress-value">{bookAvgProgress}%</span>
                    </div>
                    <div className="progress-bar">
                        <motion.div
                            className="progress-fill books"
                            initial={{ width: 0 }}
                            animate={{ width: `${bookAvgProgress}%` }}
                            transition={{ duration: 1, ease: 'easeInOut' }}
                        />
                    </div>
                    <span className="progress-subtitle">Books overall reading progress</span>
                </div>

                <div className="progress-item">
                    <div className="progress-header">
                        <span className="progress-icon">📚</span>
                        <span className="progress-label">Homework</span>
                        <span className="progress-value">{homeworkPercentage}%</span>
                    </div>
                    <div className="progress-bar">
                        <motion.div 
                            className="progress-fill homework"
                            initial={{ width: 0 }}
                            animate={{ width: `${homeworkPercentage}%` }}
                            transition={{ duration: 1, delay: 0.4 }}
                        />
                    </div>
                    <span className="progress-subtitle">{homeworkCompleted} of {homeworkTotal} completed</span>
                </div>

                <div className="progress-item">
                    <div className="progress-header">
                        <span className="progress-icon">📊</span>
                        <span className="progress-label">Attendance</span>
                        <span className="progress-value">{attendancePercentage}%</span>
                    </div>
                    <div className="progress-bar">
                        <motion.div 
                            className={`progress-fill attendance ${attendancePercentage < 80 ? 'warning' : ''}`}
                            initial={{ width: 0 }}
                            animate={{ width: `${attendancePercentage}%` }}
                            transition={{ duration: 1, delay: 0.5 }}
                        />
                    </div>
                    <span className="progress-subtitle">
                        {attendancePercentage >= 80 ? 'Great attendance!' : 'Needs improvement'}
                    </span>
                </div>

                <div className="progress-item">
                    <div className="progress-header">
                        <span className="progress-icon">📈</span>
                        <span className="progress-label">Overall Average</span>
                        <span className="progress-value">{overallAverage}%</span>
                    </div>
                    <div className="progress-bar">
                        <motion.div 
                            className="progress-fill overall"
                            initial={{ width: 0 }}
                            animate={{ width: `${overallAverage}%` }}
                            transition={{ duration: 1, delay: 0.6 }}
                        />
                    </div>
                    <span className="progress-subtitle">
                        {overallAverage >= 80 ? 'Outstanding performance!' : 'Keep improving!'}
                    </span>
                </div>
            </motion.div>

            {/* Quick Stats Grid - Now Clickable! */}
            <motion.div 
                className="stats-grid"
                variants={container}
                initial="hidden"
                animate="show"
            >
                {quickStats.map((stat, index) => (
                    <motion.div
                        key={stat.label}
                        className="stat-card clickable"
                        variants={item}
                        whileHover={cardHover}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => handleNavigate(stat.section)}
                        transition={{ duration: 0.3 }}
                    >
                        <div 
                            className="stat-icon"
                            style={{ 
                                background: `linear-gradient(135deg, ${stat.color}20, ${stat.color}40)`,
                                color: stat.color
                            }}
                        >
                            {stat.icon}
                        </div>
                        <div className="stat-content">
                            <span className="stat-label">{stat.label}</span>
                            <span className="stat-value">{stat.value}</span>
                            <span className="stat-description">{stat.description}</span>
                        </div>
                        {stat.badge && (
                            <span className={`stat-badge ${stat.badge.type}`}>
                                {stat.badge.text}
                            </span>
                        )}
                        <div className="click-hint">Click to view →</div>
                    </motion.div>
                ))}
            </motion.div>

            {/* Quick Actions Grid - Enhanced with 6 cards */}
            <motion.div 
                className="quick-actions-section"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.5 }}
            >
                <h2 className="section-title">Quick Actions</h2>
                <div className="action-cards-grid">
                    {actionCards.map((action, index) => (
                        <motion.div
                            key={action.title}
                            className="action-card"
                            style={{ background: action.gradient }}
                            whileHover={{ scale: 1.05, y: -8 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={() => handleNavigate(action.section)}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.3, delay: 0.6 + index * 0.05 }}
                        >
                            <span className="action-icon">{action.icon}</span>
                            <div className="action-content">
                                <h3>{action.title}</h3>
                                <p>{action.description}</p>
                            </div>
                            {action.badge && action.badge > 0 && (
                                <span className="action-badge">{action.badge}</span>
                            )}
                            <div className="action-arrow">→</div>
                        </motion.div>
                    ))}
                </div>
            </motion.div>

            {/* AI Insights Section - Smart Suggestions */}
            {aiInsights.length > 0 && (
                <motion.div 
                    className="ai-insights-section"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.4, delay: 0.65 }}
                >
                    <div className="section-title-row">
                        <h2 className="section-title">Smart Insights</h2>
                        <span className="ai-badge">🧠 AI</span>
                    </div>
                    <div className="insights-container">
                        <AnimatePresence mode="popLayout">
                            {aiInsights.slice(0, 3).map((insight, index) => (
                                <InsightCard
                                    key={insight.id}
                                    insight={insight}
                                    onDismiss={handleDismissInsight}
                                    onComplete={handleCompleteInsight}
                                    delay={index * 0.08}
                                />
                            ))}
                        </AnimatePresence>
                    </div>
                </motion.div>
            )}

            {/* Live Activity Timeline */}
            <motion.div 
                className="activity-timeline"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.7 }}
            >
                <div className="section-title-row">
                    <h2 className="section-title">Recent Activity</h2>
                    {recentActivity.length > 0 && (
                        <span className="live-badge">● LIVE</span>
                    )}
                </div>
                <div className="timeline-container">
                    <AnimatePresence mode="popLayout">
                        {recentActivity.length > 0 ? (
                            // Live entries from Redux (newest first, max 5)
                            [...recentActivity].reverse().slice(0, 5).map((entry, index) => (
                                <ActivityItem key={entry.id || index} entry={entry} delay={index * 0.08} />
                            ))
                        ) : (
                            // Placeholder skeleton while no activity logged yet
                            PLACEHOLDER_ACTIVITY.map((entry, index) => (
                                <motion.div
                                    key={entry.id}
                                    className="timeline-item placeholder"
                                    initial={{ opacity: 0, x: -20 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    transition={{ delay: 0.8 + index * 0.1 }}
                                >
                                    <div className={`timeline-icon ${entry.iconClass}`}>{entry.icon}</div>
                                    <div className="timeline-content">
                                        <h4>{entry.title}</h4>
                                        <p>{entry.description}</p>
                                        <span className="timeline-time">{entry.time}</span>
                                    </div>
                                </motion.div>
                            ))
                        )}
                    </AnimatePresence>
                </div>
            </motion.div>
        </div>
    );
}

export default DashboardOverview;
