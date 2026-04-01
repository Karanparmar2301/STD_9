import React from 'react';
import { useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import {
    selectAttendancePercentage,
    selectAttendanceStats,
    selectMotivationalMessage
} from '../../store/attendanceSlice';
import './AttendanceProgress.css';

function AttendanceProgress() {
    const percentage = useSelector(selectAttendancePercentage);
    const stats      = useSelector(selectAttendanceStats);
    const motivation = useSelector(selectMotivationalMessage);

    // SVG circle calculations
    const size        = 200;
    const strokeWidth = 16;
    const radius      = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset      = circumference - (percentage / 100) * circumference;

    const getProgressColor = () => {
        if (percentage >= 95) return '#10b981';
        if (percentage >= 85) return '#3b82f6';
        if (percentage >= 75) return '#f59e0b';
        return '#ef4444';
    };
    const progressColor = getProgressColor();

    // Badge label and gradient
    const getBadgeLabel = () => {
        if (percentage >= 95) return 'Star Student ⭐';
        if (percentage >= 85) return 'Great Work 👍';
        if (percentage >= 75) return 'Keep Going 💪';
        return 'Need Improvement 🤍';
    };

    const getBadgeGradient = () => {
        if (percentage >= 95) return 'linear-gradient(135deg,#22c55e,#16a34a)';
        if (percentage >= 85) return 'linear-gradient(135deg,#3b82f6,#1d4ed8)';
        if (percentage >= 75) return 'linear-gradient(135deg,#f59e0b,#d97706)';
        return 'linear-gradient(135deg,#ef4444,#b91c1c)';
    };

    return (
        <motion.div
            className="attendance-card-v2"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
        >
            {/* ── LEFT: Circular progress ─────────────────── */}
            <div className="acv2-left">
                <div className="acv2-progress-wrapper">
                    <svg width={size} height={size} className="acv2-ring">
                        {/* Track */}
                        <circle
                            cx={size / 2} cy={size / 2} r={radius}
                            fill="none" stroke="#e5e7eb" strokeWidth={strokeWidth}
                        />
                        {/* Animated fill */}
                        <motion.circle
                            cx={size / 2} cy={size / 2} r={radius}
                            fill="none"
                            stroke={progressColor}
                            strokeWidth={strokeWidth}
                            strokeDasharray={circumference}
                            strokeDashoffset={circumference}
                            strokeLinecap="round"
                            transform={`rotate(-90 ${size / 2} ${size / 2})`}
                            initial={{ strokeDashoffset: circumference }}
                            animate={{ strokeDashoffset: offset }}
                            transition={{ duration: 1.5, ease: 'easeOut' }}
                            style={{ filter: `drop-shadow(0 0 10px ${progressColor}50)` }}
                        />
                    </svg>

                    {/* Center text */}
                    <div className="acv2-center-text">
                        <motion.h2
                            style={{ color: progressColor }}
                            initial={{ scale: 0 }}
                            animate={{ scale: 1 }}
                            transition={{ delay: 0.5, type: 'spring', stiffness: 200 }}
                        >
                            {percentage}%
                        </motion.h2>
                        <motion.p
                            initial={{ opacity: 0, y: 8 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.9 }}
                        >
                            {motivation.message}
                        </motion.p>
                        <motion.span
                            className="acv2-center-emoji"
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ delay: 0.8, type: 'spring', stiffness: 150 }}
                        >
                            {motivation.emoji}
                        </motion.span>
                    </div>

                    {percentage === 100 && (
                        <motion.div
                            className="acv2-confetti"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: [0, 1, 0] }}
                            transition={{ duration: 2, repeat: Infinity }}
                        >
                            🎊
                        </motion.div>
                    )}
                </div>
            </div>

            {/* ── RIGHT: Title + stat boxes ─────────────── */}
            <div className="acv2-right">

                <div className="acv2-title-section">
                    <div className="acv2-title-left">
                        <span className="acv2-icon">&#128202;</span>
                        <h3>Attendance Overview</h3>
                    </div>
                    <motion.span
                        className="acv2-badge"
                        style={{ background: getBadgeGradient() }}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ delay: 0.4, type: 'spring', stiffness: 220 }}
                    >
                        {getBadgeLabel()}
                    </motion.span>
                </div>

                <div className="acv2-stats-grid">
                    {[
                        { cls: 'present', label: 'Present',    value: stats.presentDays },
                        { cls: 'absent',  label: 'Absent',     value: stats.absentDays  },
                        { cls: 'total',   label: 'Total Days', value: stats.totalDays   },
                    ].map(({ cls, label, value }, i) => (
                        <motion.div
                            key={cls}
                            className={`acv2-stat-box ${cls}`}
                            initial={{ opacity: 0, y: 16 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.6 + i * 0.12, duration: 0.4 }}
                            whileHover={{ y: -4, transition: { duration: 0.2 } }}
                        >
                            <span className="acv2-stat-label">{label}</span>
                            <h4>{value}</h4>
                        </motion.div>
                    ))}
                </div>

            </div>
        </motion.div>
    );
}

export default AttendanceProgress;
