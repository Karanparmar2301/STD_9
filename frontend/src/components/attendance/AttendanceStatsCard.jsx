import React from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
    selectPerfectAttendanceBadge
} from '../../store/attendanceSlice';
import './AttendanceStatsCard.css';

/**
 * AttendanceStatsCard - Achievement Badges
 * Shows achievement badges
 */
function AttendanceStatsCard() {
    const hasPerfectBadge = useSelector(selectPerfectAttendanceBadge);

    return (
        <div className="attendance-stats-card">
            {/* Perfect Attendance Badge */}
            {hasPerfectBadge && (
                <motion.div
                    className="badge-section"
                    initial={{ opacity: 0, scale: 0.5, rotate: -180 }}
                    animate={{ opacity: 1, scale: 1, rotate: 0 }}
                    transition={{ delay: 1, type: 'spring', stiffness: 120 }}
                >
                    <div className="perfect-badge">
                        <motion.div
                            className="badge-icon"
                            animate={{
                                rotate: [0, 10, -10, 0],
                                scale: [1, 1.05, 1]
                            }}
                            transition={{
                                duration: 3,
                                repeat: Infinity,
                                ease: 'easeInOut'
                            }}
                        >
                            🏅
                        </motion.div>
                        <div className="badge-content">
                            <div className="badge-title">Perfect Month!</div>
                            <div className="badge-subtitle">30+ Days Streak</div>
                        </div>
                    </div>

                    {/* Star Explosion Animation */}
                    <motion.div
                        className="star-explosion"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: [0, 1, 0] }}
                        transition={{ duration: 2, repeat: Infinity }}
                    >
                        ✨
                    </motion.div>
                </motion.div>
            )}
        </div>
    );
}

export default AttendanceStatsCard;
