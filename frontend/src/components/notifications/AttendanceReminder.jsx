import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { selectAttendanceAlerts, selectAttendancePercentage } from '../../store/attendanceSlice';
import './AttendanceReminder.css';

const AttendanceReminder = () => {
    const alerts = useSelector(selectAttendanceAlerts);
    const percentage = useSelector(selectAttendancePercentage);
    const [showReminder, setShowReminder] = useState(false);
    const [dismissed, setDismissed] = useState(false);

    // Auto-show reminder after 2 seconds if there are alerts
    useEffect(() => {
        if (alerts.hasAlerts && !dismissed) {
            const timer = setTimeout(() => {
                setShowReminder(true);
            }, 2000);
            
            return () => clearTimeout(timer);
        }
    }, [alerts.hasAlerts, dismissed]);

    const handleDismiss = () => {
        setDismissed(true);
        setShowReminder(false);
    };

    if (!alerts.hasAlerts || dismissed) {
        return null;
    }

    const getAlertConfig = () => {
        if (alerts.missingToday) {
            return {
                type: 'warning',
                icon: '⚠️',
                title: 'Attendance Not Marked',
                message: 'Don\'t forget to mark your attendance today!',
                action: 'Mark Now'
            };
        } else if (alerts.lowAttendance) {
            return {
                type: 'danger',
                icon: '🚨',
                title: 'Low Attendance Alert',
                message: `Your attendance is ${percentage}%. Aim for at least 80%!`,
                action: 'Improve Now'
            };
        } else if (alerts.frequentAbsence) {
            return {
                type: 'concern',
                icon: '😟',
                title: 'Frequent Absences',
                message: 'You\'ve been absent 3+ times this week. Let\'s get back on track!',
                action: 'View Details'
            };
        }
        return null;
    };

    const alertConfig = getAlertConfig();
    
    if (!alertConfig) return null;

    return (
        <AnimatePresence>
            {showReminder && (
                <motion.div 
                    className={`attendance-reminder ${alertConfig.type}`}
                    initial={{ y: -20, opacity: 0, scale: 0.9 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    exit={{ y: -20, opacity: 0, scale: 0.9 }}
                    transition={{ 
                        type: 'spring', 
                        stiffness: 300,
                        damping: 20
                    }}
                >
                    <motion.div 
                        className="reminder-icon"
                        animate={{ 
                            rotate: [0, -10, 10, -10, 0],
                            scale: [1, 1.1, 1]
                        }}
                        transition={{ 
                            duration: 0.8,
                            repeat: Infinity,
                            repeatDelay: 2
                        }}
                    >
                        {alertConfig.icon}
                    </motion.div>

                    <div className="reminder-content">
                        <h4>{alertConfig.title}</h4>
                        <p>{alertConfig.message}</p>
                    </div>

                    <div className="reminder-actions">
                        <motion.button 
                            className="reminder-action-btn"
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >
                            {alertConfig.action}
                        </motion.button>
                        <motion.button 
                            className="reminder-dismiss-btn"
                            onClick={handleDismiss}
                            whileHover={{ scale: 1.1 }}
                            whileTap={{ scale: 0.9 }}
                        >
                            ✕
                        </motion.button>
                    </div>

                    {/* Animated border pulse */}
                    <motion.div 
                        className="reminder-pulse"
                        animate={{ 
                            opacity: [0.5, 1, 0.5],
                            scale: [1, 1.02, 1]
                        }}
                        transition={{ 
                            duration: 2,
                            repeat: Infinity
                        }}
                    />
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default AttendanceReminder;
