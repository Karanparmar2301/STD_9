import React, { useEffect, useRef } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
    fetchAnnouncements,
    markAnnouncementRead,
    setFilter,
    setSearchQuery,
    setExpandedId,
    selectFilteredAnnouncements,
    selectUnreadCount,
    selectAnnouncementFilter,
    selectSearchQuery,
    selectExpandedId,
    selectAnnouncementsLoading,
    selectMarkingReadId
} from '../store/announcementsSlice';
import { selectUser } from '../store/authSlice';
import './Announcements.css';

// ─── Constants ──────────────────────────────────────────────────────────────

const CATEGORY_META = {
    student:   { icon: '🎒', label: 'Student',   accent: '#3B82F6', gradient: 'linear-gradient(135deg, #60A5FA, #3B82F6)' },
    meeting:   { icon: '👩‍🏫', label: 'Meeting',   accent: '#8B5CF6', gradient: 'linear-gradient(135deg, #A78BFA, #8B5CF6)' },
    event:     { icon: '🎉', label: 'Event',     accent: '#EC4899', gradient: 'linear-gradient(135deg, #F472B6, #EC4899)' },
    sports:    { icon: '⚽', label: 'Sports',    accent: '#10B981', gradient: 'linear-gradient(135deg, #34D399, #10B981)' },
    holiday:   { icon: '🏖️', label: 'Holiday',   accent: '#F59E0B', gradient: 'linear-gradient(135deg, #FBBF24, #F59E0B)' },
    important: { icon: '🚨', label: 'Important', accent: '#EF4444', gradient: 'linear-gradient(135deg, #F87171, #EF4444)' }
};

const FILTER_TABS = [
    { id: 'all',       label: 'All',       icon: '📋' },
    { id: 'student',   label: 'Student',   icon: '📚' },
    { id: 'meeting',   label: 'Meeting',   icon: '📅' },
    { id: 'event',     label: 'Event',     icon: '🎉' },
    { id: 'sports',    label: 'Sports',    icon: '⚽' },
    { id: 'holiday',   label: 'Holiday',   icon: '🏖️' },
    { id: 'important', label: 'Important', icon: '🚨' }
];

// ─── AnnouncementCard Component ───────────────────────────────────────────────

const AnnouncementCard = ({ announcement, isExpanded, onToggle, onMarkRead, isMarking }) => {
    const meta = CATEGORY_META[announcement.category] || CATEGORY_META.event;
    const isRead = announcement.is_read;

    const handleMarkRead = (e) => {
        e.stopPropagation();
        if (!isRead && !isMarking) {
            onMarkRead(announcement.id);
        }
    };

    const formattedDate = announcement.created_at
        ? new Date(announcement.created_at).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric'
          })
        : '';

    return (
        <motion.div
            layout
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}
            whileHover={{ 
                y: -4, 
                scale: 1.02,
                boxShadow: '0 20px 40px rgba(0,0,0,0.12)',
                transition: { duration: 0.2 }
            }}
            className={`ann-card ${isRead ? 'ann-card--read' : 'ann-card--unread'}`}
            style={{ 
                '--accent': meta.accent,
                '--gradient': meta.gradient
            }}
        >
            {/* Top gradient border strip */}
            <div className="ann-card__top-strip" />

            {/* Sticker icon */}
            <motion.div 
                className="ann-card__sticker"
                animate={{ 
                    rotate: [0, -5, 5, -5, 0],
                    scale: [1, 1.1, 1]
                }}
                transition={{ 
                    duration: 2,
                    repeat: Infinity,
                    repeatDelay: 3
                }}
            >
                {meta.icon}
            </motion.div>

            {/* Header */}
            <div className="ann-card__header" onClick={onToggle}>
                <div className="ann-card__icon-wrap" style={{ background: `${meta.accent}15` }}>
                    <span className="ann-card__icon">{meta.icon}</span>
                </div>

                <div className="ann-card__info">
                    <div className="ann-card__title-row">
                        <h3 className="ann-card__title">{announcement.title}</h3>
                        <div className="ann-card__badges">
                            {announcement.priority === 'high' && (
                                <motion.span 
                                    className="ann-badge ann-badge--high"
                                    animate={{ scale: [1, 1.05, 1] }}
                                    transition={{ duration: 1.5, repeat: Infinity }}
                                >
                                    High Priority
                                </motion.span>
                            )}
                            <span
                                className="ann-badge ann-badge--category"
                                style={{ background: `${meta.accent}20`, color: meta.accent }}
                            >
                                {meta.label}
                            </span>
                        </div>
                    </div>
                    <div className="ann-card__meta">
                        <span className="ann-card__date">📅 {formattedDate}</span>
                        {!isRead && (
                            <motion.span 
                                className="ann-dot"
                                animate={{ 
                                    scale: [1, 1.2, 1],
                                    boxShadow: [
                                        `0 0 0 0px ${meta.accent}40`,
                                        `0 0 0 4px ${meta.accent}20`,
                                        `0 0 0 0px ${meta.accent}40`
                                    ]
                                }}
                                transition={{ duration: 2, repeat: Infinity }}
                            />
                        )}
                    </div>
                    {!isExpanded && (
                        <p className="ann-card__preview">
                            {announcement.description?.slice(0, 100)}
                            {announcement.description?.length > 100 ? '...' : ''}
                        </p>
                    )}
                </div>

                <motion.span
                    className="ann-card__chevron"
                    animate={{ rotate: isExpanded ? 180 : 0 }}
                    transition={{ duration: 0.3 }}
                >
                    ▼
                </motion.span>
            </div>

            {/* Expandable body */}
            <AnimatePresence initial={false}>
                {isExpanded && (
                    <motion.div
                        key="body"
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.35, ease: 'easeInOut' }}
                        className="ann-card__body"
                    >
                        <p className="ann-card__description">{announcement.description}</p>
                        <div className="ann-card__footer">
                            {!isRead ? (
                                <motion.button
                                    whileTap={{ scale: 0.95 }}
                                    whileHover={{ scale: 1.05 }}
                                    className="ann-btn ann-btn--read"
                                    onClick={handleMarkRead}
                                    disabled={isMarking}
                                >
                                    {isMarking ? (
                                        <><span className="ann-spinner" /> Marking...</>
                                    ) : (
                                        <>✓ Mark as Read</>
                                    )}
                                </motion.button>
                            ) : (
                                <span className="ann-read-badge">✓ Read</span>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
};

// ─── Skeleton Card ─────────────────────────────────────────────────────────────

const SkeletonCard = () => (
    <div className="ann-skeleton">
        <div className="ann-skeleton__strip" />
        <div className="ann-skeleton__icon" />
        <div className="ann-skeleton__lines">
            <div className="ann-skeleton__line ann-skeleton__line--wide" />
            <div className="ann-skeleton__line ann-skeleton__line--medium" />
            <div className="ann-skeleton__line ann-skeleton__line--narrow" />
        </div>
    </div>
);

// ─── Main Component ─────────────────────────────────────────────────────────────

function Announcements() {
    const dispatch = useDispatch();
    const user = useSelector(selectUser);
    const announcements = useSelector(selectFilteredAnnouncements);
    const unreadCount = useSelector(selectUnreadCount);
    const activeFilter = useSelector(selectAnnouncementFilter);
    const searchQuery = useSelector(selectSearchQuery);
    const expandedId = useSelector(selectExpandedId);
    const loading = useSelector(selectAnnouncementsLoading);
    const markingReadId = useSelector(selectMarkingReadId);
    const hasFetched = useRef(false);

    // Fetch on mount — once per user session
    useEffect(() => {
        if (user?.uid && !hasFetched.current) {
            hasFetched.current = true;
            dispatch(fetchAnnouncements(user.uid));
        }
    }, [dispatch, user?.uid]);

    const handleFilterChange = (filterId) => {
        dispatch(setFilter(filterId));
    };

    const handleSearch = (e) => {
        dispatch(setSearchQuery(e.target.value));
    };

    const handleToggleExpand = (id) => {
        dispatch(setExpandedId(id));
    };

    const handleMarkRead = (announcementId) => {
        if (user?.uid) {
            dispatch(markAnnouncementRead({ uid: user.uid, announcement_id: announcementId }));
        }
    };

    return (
        <div className="ann-page">
            {/* Floating Background Elements */}
            <div className="ann-bg-elements">
                <div className="ann-float ann-float--cloud" style={{ top: '5%', left: '10%' }}>☁️</div>
                <div className="ann-float ann-float--star" style={{ top: '15%', right: '15%' }}>⭐</div>
                <div className="ann-float ann-float--balloon" style={{ top: '8%', right: '8%' }}>🎈</div>
                <div className="ann-float ann-float--book" style={{ top: '25%', left: '5%' }}>📚</div>
                <div className="ann-float ann-float--cloud" style={{ bottom: '20%', right: '10%' }}>☁️</div>
                <div className="ann-float ann-float--star" style={{ bottom: '10%', left: '20%' }}>✨</div>
            </div>

            {/* ── Page Header with Animated Megaphone ── */}
            <div className="ann-header">
                <div className="ann-header__left">
                    <div className="ann-header__title-wrap">
                        <motion.span 
                            className="ann-header__icon"
                            animate={{ 
                                rotate: [0, -10, 10, -10, 0],
                                y: [0, -3, 0]
                            }}
                            transition={{ 
                                duration: 2,
                                repeat: Infinity,
                                repeatDelay: 1
                            }}
                        >
                            📢
                        </motion.span>
                        <h1 className="ann-header__title">School Announcements</h1>
                    </div>
                    <p className="ann-header__sub">Stay updated with exciting school news!</p>
                </div>
                {unreadCount > 0 && (
                    <motion.div
                        key={unreadCount}
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ 
                            type: 'spring', 
                            stiffness: 500, 
                            damping: 15 
                        }}
                        className="ann-unread-badge"
                    >
                        {unreadCount} unread
                    </motion.div>
                )}
            </div>

            {/* ── Search Bar with Glow ── */}
            <div className="ann-search-wrap">
                <span className="ann-search-icon">🔍</span>
                <input
                    type="text"
                    className="ann-search"
                    placeholder="Search announcements..."
                    value={searchQuery}
                    onChange={handleSearch}
                />
                {searchQuery && (
                    <motion.button
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="ann-search-clear"
                        onClick={() => dispatch(setSearchQuery(''))}
                    >
                        ×
                    </motion.button>
                )}
            </div>

            {/* ── Filter Tabs with Emoji ── */}
            <div className="ann-filters">
                {FILTER_TABS.map((tab) => (
                    <motion.button
                        key={tab.id}
                        whileTap={{ scale: 0.90 }}
                        whileHover={{ scale: 1.05 }}
                        className={`ann-filter-btn ${activeFilter === tab.id ? 'active' : ''}`}
                        onClick={() => handleFilterChange(tab.id)}
                    >
                        <span>{tab.icon}</span>
                        <span>{tab.label}</span>
                    </motion.button>
                ))}
            </div>

            {/* ── Cards with Stagger Animation ── */}
            <div className="ann-list">
                {loading ? (
                    [1, 2, 3].map((i) => <SkeletonCard key={i} />)
                ) : announcements.length === 0 ? (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="ann-empty"
                    >
                        <motion.span 
                            className="ann-empty__icon"
                            animate={{ 
                                y: [0, -10, 0],
                                rotate: [0, 5, -5, 0]
                            }}
                            transition={{ 
                                duration: 3,
                                repeat: Infinity 
                            }}
                        >
                            📭
                        </motion.span>
                        <h3 className="ann-empty__title">Oops! No announcements today!</h3>
                        <p className="ann-empty__text">Check back later for exciting updates!</p>
                        {(activeFilter !== 'all' || searchQuery) && (
                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.95 }}
                                className="ann-btn ann-btn--outline"
                                onClick={() => {
                                    dispatch(setFilter('all'));
                                    dispatch(setSearchQuery(''));
                                }}
                            >
                                Clear filters
                            </motion.button>
                        )}
                    </motion.div>
                ) : (
                    <AnimatePresence mode="popLayout">
                        {announcements.map((ann, index) => (
                            <motion.div
                                key={ann.id}
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ 
                                    delay: index * 0.08,
                                    duration: 0.4
                                }}
                            >
                                <AnnouncementCard
                                    announcement={ann}
                                    isExpanded={expandedId === ann.id}
                                    onToggle={() => handleToggleExpand(ann.id)}
                                    onMarkRead={handleMarkRead}
                                    isMarking={markingReadId === ann.id}
                                />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                )}
            </div>
        </div>
    );
}

export default Announcements;
