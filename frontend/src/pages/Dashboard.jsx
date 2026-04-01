import React, { useEffect, useState, lazy, Suspense } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { logoutUser } from '../store/authSlice';
import { checkProfile } from '../store/studentSlice';
import { setActiveSection } from '../store/uiSlice';
import { initializeGamification } from '../store/gamificationSlice';
import { initializeAttendance } from '../store/attendanceSlice';
import { fetchInsights, fetchAnalytics } from '../store/insightsSlice';

// Components
import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import SkeletonLoader from '../components/SkeletonLoader';
import ProfileCompletionModal from '../components/ProfileCompletionModal';
import ProfileEditDrawer from '../components/ProfileEditDrawer';

// Eager-loaded sections
import DashboardOverview from '../components/DashboardOverview';
import Attendance from '../components/Attendance';
import Homework from '../components/Homework';
import Announcements from '../components/Announcements';

import Timetable from '../components/Timetable';
import Performance from '../components/Performance';

// Lazy-loaded sections
const Books = lazy(() => import('../components/Books'));
const AIAssistant = lazy(() => import('../components/AIAssistant'));

import './Dashboard.css';

function Dashboard() {
    const navigate = useNavigate();
    const dispatch = useDispatch();

    const user = useSelector((state) => state.auth.user);
    const { loading, error, profileExists } = useSelector((state) => state.student);
    const activeSection = useSelector((state) => state.ui.activeSection);

    const [showCompletionModal, setShowCompletionModal] = useState(false);
    const [showEditDrawer, setShowEditDrawer] = useState(false);

    useEffect(() => {
        // Check profile existence on mount (database-driven)
        if (user?.uid && typeof user.uid === 'string' && user.uid.length > 0) {
            if (profileExists === null && !loading) {
                dispatch(checkProfile(user.uid));
            }
        }
    }, [user, dispatch, profileExists, loading]);

    useEffect(() => {
        // Show completion modal if database confirms profile doesn't exist
        if (profileExists === false) {
            setShowCompletionModal(true);
        }
    }, [profileExists]);

    useEffect(() => {
        // Initialize all KPIs when user data loads
        if (user && user.uid) {
            // Calculate streak from attendance data (default to 5 if not present)
            const calculatedStreak = user.attendance_streak || user.streak || 5;
            
            // Initialize gamification
            dispatch(initializeGamification({
                totalXP: user.reward_points || 0,
                streak: calculatedStreak,
                badges: user.badges || [],
                achievements: user.achievements || []
            }));

            // Initialize attendance stats
            dispatch(initializeAttendance({
                percentage: Math.round(user.attendance_percentage || 95),
                presentDays: user.present_days || 0,
                absentDays: user.absent_days || 0,
                totalDays: user.total_days || 0,
                streak: calculatedStreak
            }));

            // Homework is now database-driven and fetched in Homework component
        }
    }, [user, dispatch]);

    useEffect(() => {
        // Listen for custom event to open edit profile drawer
        const handleOpenEditProfile = () => {
            setShowEditDrawer(true);
        };

        window.addEventListener('openEditProfile', handleOpenEditProfile);

        return () => {
            window.removeEventListener('openEditProfile', handleOpenEditProfile);
        };
    }, []);

    const handleLogout = () => {
        dispatch(logoutUser());
        navigate('/');
    };

    const handleSectionChange = (section) => {
        dispatch(setActiveSection(section));
    };

    const handleProfileComplete = () => {
        setShowCompletionModal(false);
        // Profile complete - auth.user will be updated automatically
    };

    const handleEditProfile = () => {
        setShowEditDrawer(true);
    };

    const handleEditDrawerClose = () => {
        setShowEditDrawer(false);
        // Profile updates auto-sync to auth.user via setUser dispatch
    };

    const renderSection = () => {
        if (loading && !user) {
            return <SkeletonLoader type="profile" count={1} />;
        }

        if (error) {
            return (
                <div className="error-container">
                    <h3>Unable to load dashboard</h3>
                    <p>{typeof error === 'string' ? error : 'Server connection failed'}</p>
                    <button
                        className="retry-btn"
                        onClick={() => user?.uid && dispatch(checkProfile(user.uid))}
                    >
                        Retry
                    </button>
                </div>
            );
        }

        if (!user) return <SkeletonLoader type="profile" count={1} />;

        // Animation variants for section transitions
        const pageVariants = {
            initial: { opacity: 0, x: 20 },
            animate: { opacity: 1, x: 0 },
            exit: { opacity: 0, x: -20 }
        };

        const pageTransition = {
            duration: 0.3,
            ease: 'easeInOut'
        };

        switch (activeSection) {
            case 'dashboard':
                return (
                    <motion.div
                        key="dashboard"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={pageTransition}
                    >
                        <DashboardOverview />
                    </motion.div>
                );
            case 'attendance':
                return (
                    <motion.div
                        key="attendance"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={pageTransition}
                    >
                        <Attendance profile={user} />
                    </motion.div>
                );
            case 'homework':
                return (
                    <motion.div
                        key="homework"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={pageTransition}
                    >
                        <Homework data={user} />
                    </motion.div>
                );
            case 'announcements':
                return (
                    <motion.div
                        key="announcements"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={pageTransition}
                    >
                        <Announcements data={user} />
                    </motion.div>
                );
            case 'books':
                return (
                    <motion.div
                        key="books"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={pageTransition}
                    >
                        <Suspense fallback={<SkeletonLoader type="card" count={3} />}>
                            <Books data={user} />
                        </Suspense>
                    </motion.div>
                );
            case 'performance':
                return (
                    <motion.div
                        key="performance"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={pageTransition}
                    >
                        <Performance />
                    </motion.div>
                );
            case 'timetable':
                return (
                    <motion.div
                        key="timetable"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={pageTransition}
                    >
                        <Timetable />
                    </motion.div>
                );
            case 'ai-assistant':
                return (
                    <motion.div
                        key="ai-assistant"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={pageTransition}
                    >
                        <Suspense fallback={<SkeletonLoader type="card" count={1} />}>
                            <AIAssistant data={user} />
                        </Suspense>
                    </motion.div>
                );
            default:
                return (
                    <motion.div
                        key="default"
                        variants={pageVariants}
                        initial="initial"
                        animate="animate"
                        exit="exit"
                        transition={pageTransition}
                    >
                        <DashboardOverview />
                    </motion.div>
                );
        }
    };

    if (loading && !user) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p>Loading your dashboard...</p>
            </div>
        );
    }

    if (error && !user) {
        return (
            <div className="dashboard-layout error-layout">
                <div className="error-container full-page">
                    <h2>Oops! Something went wrong</h2>
                    <p>{typeof error === 'string' ? error : 'Could not connect to server'}</p>
                    <button
                        className="retry-btn"
                        onClick={() => user?.uid && dispatch(checkProfile(user.uid))}
                    >
                        Try Again
                    </button>
                    <button
                        className="logout-btn"
                        onClick={handleLogout}
                    >
                        Log Out
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="dashboard-layout">
            <Sidebar onLogout={handleLogout} />

            <div className="main-content">
                <Topbar onEditProfile={handleEditProfile} />

                <div className={`content${activeSection === 'ai-assistant' ? ' content--ai' : ''}`}>
                    <AnimatePresence mode="wait">
                        {renderSection()}
                    </AnimatePresence>
                </div>
            </div>



            {/* Profile Completion Modal (First Login) */}
            <ProfileCompletionModal
                isOpen={showCompletionModal}
                onComplete={handleProfileComplete}
            />

            {/* Profile Edit Drawer */}
            <ProfileEditDrawer
                isOpen={showEditDrawer}
                onClose={handleEditDrawerClose}
            />
        </div>
    );
}

export default Dashboard;
