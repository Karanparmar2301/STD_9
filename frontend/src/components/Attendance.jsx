import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import AttendanceCalendar from './attendance/AttendanceCalendar';
import AttendanceProgress from './attendance/AttendanceProgress';
import AttendanceStatsCard from './attendance/AttendanceStatsCard';
import WeeklyGoalTracker from './attendance/WeeklyGoalTracker';
import HolidayKPI from './HolidayKPI';
import {
    fetchAttendance,
    initializeAttendance,
    selectAttendanceLoading,
    selectAttendanceError
} from '../store/attendanceSlice';
import { fetchHolidays } from '../store/holidaysSlice';
import './Attendance.css';

/**
 * Attendance - Advanced Attendance Intelligence System
 * Features: Heatmap, Calendar, Progress, Weekly Goals, Smart Reminders
 */
function Attendance({ profile }) {
    const dispatch = useDispatch();
    const loading = useSelector(selectAttendanceLoading);
    const error = useSelector(selectAttendanceError);

    useEffect(() => {
        if (profile) {
            // Initialize attendance from profile data
            dispatch(initializeAttendance({
                percentage: Math.round(profile.attendance_percentage || 0),
                presentDays: profile.present_days || 0,
                absentDays: profile.absent_days || 0,
                totalDays: profile.total_days || 0,
                streak: profile.attendance_streak || 0
            }));

            // Fetch detailed attendance records
            if (profile.uid) {
                dispatch(fetchAttendance(profile.uid));
            }

            // Fetch 2026 holiday calendar
            dispatch(fetchHolidays());
        }
    }, [profile, dispatch]);

    if (!profile) {
        return (
            <div className="attendance-loading">
                <div className="spinner"></div>
                <p>Loading attendance...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="attendance-error">
                <h3>⚠️ Unable to load attendance</h3>
                <p>{error}</p>
            </div>
        );
    }

    const containerVariants = {
        hidden: { opacity: 0 },
        visible: {
            opacity: 1,
            transition: {
                staggerChildren: 0.1
            }
        }
    };

    const itemVariants = {
        hidden: { opacity: 0, y: 20 },
        visible: { opacity: 1, y: 0 }
    };

    return (
        <motion.div
            className="attendance-section"
            variants={containerVariants}
            initial="hidden"
            animate="visible"
        >
            {/* Header with Decorative Elements */}
            <motion.div
                className="attendance-header"
                variants={itemVariants}
            >
                <div className="attendance-header-left">
                    <motion.h1
                        className="section-title"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.5 }}
                    >
                        <span className="title-icon">📊</span>
                        Attendance Tracker
                    </motion.h1>
                </div>
                
                <motion.div
                    className="header-decoration"
                    animate={{
                        y: [0, -10, 0],
                        rotate: [0, 10, -10, 0]
                    }}
                    transition={{
                        duration: 4,
                        repeat: Infinity,
                        ease: 'easeInOut'
                    }}
                >
                    📚
                </motion.div>
            </motion.div>

            {/* Smart Attendance Calendar */}
            <motion.div
                className="smart-calendar-section"
                variants={itemVariants}
                whileHover={{ y: -3 }}
                transition={{ type: 'spring', stiffness: 300 }}
            >
                <AttendanceCalendar />
            </motion.div>

            {/* Main Content Grid */}
            <div className="attendance-grid">
                {/* Top Row - Progress & Weekly Goal */}
                <div className="attendance-top-row">
                    <motion.div
                        className="progress-card"
                        variants={itemVariants}
                        whileHover={{ y: -4 }}
                        transition={{ type: 'spring', stiffness: 300 }}
                    >
                        <AttendanceProgress />
                    </motion.div>

                    <WeeklyGoalTracker />
                </div>

                {/* Holiday KPI Row */}
                <motion.div
                    className="holiday-kpi-row"
                    variants={itemVariants}
                    whileHover={{ y: -3 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                >
                    <HolidayKPI />
                </motion.div>

                {/* Stats */}
                <motion.div
                    className="stats-card"
                    variants={itemVariants}
                    whileHover={{ y: -4 }}
                    transition={{ type: 'spring', stiffness: 300 }}
                >
                    <AttendanceStatsCard />
                </motion.div>
            </div>

            {/* Floating Cloud Decoration */}
            <motion.div
                className="floating-cloud"
                animate={{
                    x: [0, 20, 0],
                    y: [0, -15, 0]
                }}
                transition={{
                    duration: 8,
                    repeat: Infinity,
                    ease: 'easeInOut'
                }}
            >
                ☁️
            </motion.div>
        </motion.div>
    );
}

export default Attendance;
