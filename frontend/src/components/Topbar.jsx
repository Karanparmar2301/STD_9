import React, { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import { setActiveSection } from '../store/uiSlice';
import ProfileMenu from './ProfileMenu';
import './Topbar.css';
import { selectGamificationProgress, selectStreak } from '../store/gamificationSlice';

const kpiContainerVariants = {
    hidden: { opacity: 0 },
    show: {
        opacity: 1,
        transition: {
            staggerChildren: 0.15,
            delayChildren: 0.2,
        },
    },
};

const kpiItemVariants = {
    hidden: { opacity: 0, y: 20, scale: 0.95 },
    show: {
        opacity: 1,
        y: 0,
        scale: 1,
        transition: {
            duration: 0.5,
            ease: [0.4, 0, 0.2, 1],
        },
    },
};

const Topbar = ({ onEditProfile }) => {
    const dispatch = useDispatch();
    const user = useSelector((state) => state.auth.user);

    // Pull live data for notifications — same source as Sidebar badges
    const announcements = useSelector((state) => state.announcements.items || []);
    const homeworkPending = useSelector((state) => state.homework.pending || []);

    const [dropdownOpen, setDropdownOpen] = useState(false);
    const dropdownRef = useRef(null);

    // Build notification list from real store data
    const unreadAnnouncements = announcements.filter((a) => !a.is_read);
    const notifications = [
        ...unreadAnnouncements
            .slice(0, 5)
            .map((a) => ({
                id: `ann-${a.id}`,
                icon: '📢',
                title: a.title || 'New Announcement',
                subtitle: a.description?.slice(0, 60) + (a.description?.length > 60 ? '…' : '') || '',
                section: 'announcements',
                time: a.created_at ? new Date(a.created_at).toLocaleDateString() : '',
                type: 'announcement',
            })),
        ...homeworkPending.slice(0, 3).map((h) => ({
            id: `hw-${h.id}`,
            icon: '📝',
            title: `Homework Due: ${h.subject || 'Assignment'}`,
            subtitle: h.question?.slice(0, 60) + (h.question?.length > 60 ? '…' : '') || 'Tap to view',
            section: 'homework',
            time: h.due_date || '',
            type: 'homework',
        })),
    ];

    // Total badge = unread announcements + pending homework  (mirrors sidebar badges)
    const totalBadgeCount = unreadAnnouncements.length + homeworkPending.length;

    // Fallback when no real data yet
    const displayNotifications = notifications.length > 0 ? notifications : [
        { id: 'demo-1', icon: '📢', title: 'Check Announcements', subtitle: 'Stay up to date with school news', section: 'announcements', time: 'Now', type: 'announcement' },
        { id: 'demo-2', icon: '📝', title: 'Homework Pending', subtitle: 'You have assignments to complete', section: 'homework', time: 'Today', type: 'homework' },
    ];

    const displayCount = totalBadgeCount > 0 ? totalBadgeCount : (announcements.length === 0 && homeworkPending.length === 0 ? 3 : 0);

    // Close dropdown on outside click
    useEffect(() => {
        const handleOutsideClick = (e) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
                setDropdownOpen(false);
            }
        };
        if (dropdownOpen) document.addEventListener('mousedown', handleOutsideClick);
        return () => document.removeEventListener('mousedown', handleOutsideClick);
    }, [dropdownOpen]);

    const handleNotificationClick = (section) => {
        dispatch(setActiveSection(section));
        setDropdownOpen(false);
    };

    const getGreeting = () => {
        const hour = new Date().getHours();
        if (hour < 12) return 'Good Morning';
        if (hour < 18) return 'Good Afternoon';
        return 'Good Evening';
    };

    const studentName = user?.student_name || user?.name || user?.email?.split('@')[0] || 'Student';
    const studentClass = user?.class_section || 'Class 8-A';

    const gamification = useSelector(selectGamificationProgress);
    const level = gamification?.level || 1;
    const currentXP = gamification?.currentLevelXP ?? 0;
    const nextLevelXP = 100;
    const streak = useSelector(selectStreak) || 0;
    const xpPercent = Math.min(Math.round((currentXP / nextLevelXP) * 100), 100);

    const [clickedKpi, setClickedKpi] = useState(null);
    const handleKpiClick = (name) => {
        setClickedKpi(name);
        setTimeout(() => setClickedKpi(null), 600);
    };

    return (
        <div className="topbar-modern">
            {/* ========== LEFT SECTION: Greeting ========== */}
            <div className="topbar-left-zone">
                <div className="greeting-container">
                    <h1 className="greeting-title">
                        {getGreeting()}, {studentName}!
                    </h1>
                    <p className="greeting-subtitle">
                        Ready to learn something new? 🚀
                    </p>
                </div>
            </div>

            {/* ========== RIGHT SECTION: Notifications & Profile ========== */}
            <div className="topbar-right-zone">
                {/* Notification Bell + Dropdown */}
                <div className="notification-container" ref={dropdownRef}>
                    <div
                        className={`notification-bell ${dropdownOpen ? 'active' : ''}`}
                        onClick={() => setDropdownOpen((prev) => !prev)}
                    >
                        <span className="bell-icon">🔔</span>
                        {displayCount > 0 && (
                            <span className="notification-badge">
                                {displayCount > 9 ? '9+' : displayCount}
                            </span>
                        )}
                    </div>

                    {/* Dropdown Panel */}
                    {dropdownOpen && (
                        <div className="notif-dropdown">
                            <div className="notif-dropdown-header">
                                <span className="notif-dropdown-title">Notifications</span>
                                {displayCount > 0 && (
                                    <span className="notif-dropdown-count">{displayCount} new</span>
                                )}
                            </div>

                            <div className="notif-dropdown-list">
                                {displayNotifications.map((notif) => (
                                    <div
                                        key={notif.id}
                                        className={`notif-item notif-item--${notif.type}`}
                                        onClick={() => handleNotificationClick(notif.section)}
                                    >
                                        <div className="notif-item-icon">{notif.icon}</div>
                                        <div className="notif-item-body">
                                            <p className="notif-item-title">{notif.title}</p>
                                            {notif.subtitle && (
                                                <p className="notif-item-subtitle">{notif.subtitle}</p>
                                            )}
                                        </div>
                                        <div className="notif-item-right">
                                            {notif.time && <span className="notif-item-time">{notif.time}</span>}
                                            <span className="notif-item-arrow">→</span>
                                        </div>
                                    </div>
                                ))}
                            </div>

                            <div
                                className="notif-dropdown-footer"
                                onClick={() => handleNotificationClick('announcements')}
                            >
                                View all announcements →
                            </div>
                        </div>
                    )}
                </div>

                {/* Profile Menu with Dropdown */}
                <ProfileMenu
                    studentName={studentName}
                    studentClass={studentClass}
                    profilePhotoUrl={user?.profile_photo_url}
                    onEditProfile={onEditProfile}
                />
            </div>
        </div>
    );
};

export default Topbar;
