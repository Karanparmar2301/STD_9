import React, { useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { selectWeeklyAttendance } from '../../store/attendanceSlice';
import './WeeklyGoalTracker.css';

// Animated count-up hook
const useCountUp = (target, duration = 1200, delay = 300) => {
    const [value, setValue] = useState(0);
    useEffect(() => {
        let start = null;
        let raf;
        const timeout = setTimeout(() => {
            const step = (timestamp) => {
                if (!start) start = timestamp;
                const elapsed = timestamp - start;
                const progress = Math.min(elapsed / duration, 1);
                setValue(Math.round(progress * target));
                if (progress < 1) raf = requestAnimationFrame(step);
            };
            raf = requestAnimationFrame(step);
        }, delay);
        return () => { clearTimeout(timeout); cancelAnimationFrame(raf); };
    }, [target, duration, delay]);
    return value;
};

const cardVariants = {
    hidden: { opacity: 0, y: 22, scale: 0.96 },
    show: (i) => ({
        opacity: 1, y: 0, scale: 1,
        transition: { duration: 0.55, delay: 0.85 + i * 0.13, ease: [0.4, 0, 0.2, 1] }
    })
};

const WeeklyGoalTracker = () => {
    const { present, absent, goal, progress } = useSelector(selectWeeklyAttendance);
    const [showConfetti, setShowConfetti] = useState(false);
    const [hasShownConfetti, setHasShownConfetti] = useState(false);

    const animatedPresent = useCountUp(present, 1000, 400);
    const animatedAbsent  = useCountUp(absent,  1000, 520);
    const animatedGoal    = useCountUp(goal,    1000, 640);

    useEffect(() => {
        if (progress >= 100 && !hasShownConfetti) {
            setShowConfetti(true);
            setHasShownConfetti(true);
            setTimeout(() => setShowConfetti(false), 3000);
        }
    }, [progress, hasShownConfetti]);

    const getProgressMessage = () => {
        if (progress >= 100) return { emoji: '🎉', text: 'Goal Complete! Amazing!' };
        if (progress > 80)   return { emoji: '🌟', text: 'Outstanding performance 🌟' };
        if (progress >= 40)  return { emoji: '🚀', text: "You're doing great 🚀" };
        return { emoji: '💪', text: "Let's push harder 💪" };
    };

    const message = getProgressMessage();

    const confettiColors = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#FFA07A', '#98D8C8', '#F7DC6F'];
    const confettiParticles = Array.from({ length: 30 }, (_, i) => ({
        id: i,
        color: confettiColors[i % confettiColors.length],
        x: Math.random() * 100,
        delay: Math.random() * 0.3
    }));

    const circumference = 534;
    const strokeOffset = circumference - (circumference * Math.min(progress, 100) / 100);

    return (
        <motion.div
            className="weekly-goal-card"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.4, 0, 0.2, 1] }}
            whileHover={{ y: -4 }}
        >
            {/* Header */}
            <div className="goal-header">
                <div className="header-left">
                    <span className="header-icon">🎯</span>
                    <h3>Weekly Goal Tracker</h3>
                </div>
                <div className="header-badges">
                    {progress >= 100 && (
                        <motion.div
                            className="star-badge"
                            initial={{ scale: 0, rotate: -180 }}
                            animate={{ scale: 1, rotate: 0 }}
                            transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                        >
                            Weekly Star 🌟
                        </motion.div>
                    )}
                    <div className="progress-pill">{progress}%</div>
                </div>
            </div>

            {/* Confetti */}
            <AnimatePresence>
                {showConfetti && (
                    <div className="confetti-container">
                        {confettiParticles.map(p => (
                            <motion.div
                                key={p.id}
                                className="confetti-piece"
                                style={{ backgroundColor: p.color, left: `${p.x}%` }}
                                initial={{ y: -20, opacity: 1, rotate: 0 }}
                                animate={{ y: 400, opacity: 0, rotate: 360 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 2.5, delay: p.delay, ease: 'easeIn' }}
                            />
                        ))}
                    </div>
                )}
            </AnimatePresence>

            {/* Circular Progress */}
            <div className="circular-progress-container">
                <svg className="circular-progress" viewBox="0 0 200 200">
                    <circle className="progress-bg" cx="100" cy="100" r="85" />
                    <motion.circle
                        className="progress-bar"
                        cx="100"
                        cy="100"
                        r="85"
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset: strokeOffset }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.35 }}
                    />
                </svg>

                <div className="goal-center">
                    <motion.h2
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.5, delay: 0.5 }}
                    >
                        {present}/{goal}
                    </motion.h2>
                    <p>Days Present</p>
                    <motion.span
                        className="goal-emoji"
                        animate={{ scale: [1, 1.2, 1], rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 2, repeat: Infinity, repeatDelay: 1.5 }}
                    >
                        {message.emoji}
                    </motion.span>
                </div>
            </div>

            {/* Divider */}
            <div className="divider" />

            {/* Linear Progress */}
            <div className="linear-progress-wrapper">
                <div className="progress-labels-top">
                    <span className="progress-message">{message.text}</span>
                    <span className="progress-percentage">{progress}%</span>
                </div>
                <div className="linear-progress-bg">
                    <motion.div
                        className="linear-progress-fill"
                        initial={{ width: 0 }}
                        animate={{ width: `${progress}%` }}
                        transition={{ duration: 1.2, ease: 'easeOut', delay: 0.5 }}
                    />
                </div>
            </div>

            {/* Metrics */}
            <div className="goal-metrics">
                {[{
                    cls: 'present', icon: '✅', label: 'Present',       value: animatedPresent, i: 0
                }, {
                    cls: 'absent',  icon: '❌', label: 'Absent',         value: animatedAbsent,  i: 1
                }, {
                    cls: 'goal',    icon: '🎯', label: 'Working Days',   value: animatedGoal,    i: 2
                }].map(({ cls, icon, label, value, i }) => (
                    <motion.div
                        key={cls}
                        className={`metric ${cls}`}
                        custom={i}
                        variants={cardVariants}
                        initial="hidden"
                        animate="show"
                        whileHover={{ y: -6, scale: 1.04, transition: { duration: 0.22 } }}
                        whileTap={{ scale: 0.97 }}
                    >
                        <motion.div
                            className="metric-icon"
                            whileHover={{ rotate: [0, -12, 12, 0], transition: { duration: 0.4 } }}
                        >
                            {icon}
                        </motion.div>
                        <div className="metric-body">
                            <p className="metric-label">{label}</p>
                            <h3 className="metric-value">{value}</h3>
                        </div>
                    </motion.div>
                ))}
            </div>
        </motion.div>
    );
};

export default WeeklyGoalTracker;
