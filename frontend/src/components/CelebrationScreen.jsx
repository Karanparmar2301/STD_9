import React, { useEffect, useRef, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { closeLevelUpModal } from '../store/gamificationSlice';
import './CelebrationScreen.css';

/* ─── Firecracker Blast Effect ───────────────────────────────────────────── */
function launchFirecrackers() {
    const duration = 3000;
    const end = Date.now() + duration;

    const firecracker = () => {
        confetti({
            particleCount: 150,
            spread: 120,
            startVelocity: 60,
            origin: { y: 0.6 },
            colors: ['#6366f1', '#8b5cf6', '#ec4899', '#fbbf24', '#34d399', '#60a5fa', '#f87171'],
        });
    };

    // First blast
    firecracker();

    // Repeated blasts every 400ms
    const interval = setInterval(() => {
        if (Date.now() > end) {
            clearInterval(interval);
        } else {
            firecracker();
        }
    }, 400);

    return () => clearInterval(interval);
}

/* ─── Badge label helper ─────────────────────────────────────────────────── */
function getLevelBadge(level) {
    if (level >= 10) return { label: 'Diamond Scholar', icon: '💎', color: '#a855f7' };
    if (level >= 7)  return { label: 'Gold Master',     icon: '🥇', color: '#f59e0b' };
    if (level >= 4)  return { label: 'Silver Explorer', icon: '🥈', color: '#94a3b8' };
    return               { label: 'Bronze Beginner',  icon: '🥉', color: '#cd7f32' };
}

/* ─── Component ─────────────────────────────────────────────────────────── */
export default function CelebrationScreen() {
    const dispatch = useDispatch();
    const { showLevelUpModal, level, totalXP } = useSelector((s) => s.gamification);
    const stopFirecrackersRef = useRef(null);

    const badge = getLevelBadge(level);

    const handleClose = useCallback(() => {
        dispatch(closeLevelUpModal());
    }, [dispatch]);

    // Launch firecracker blast when modal opens
    useEffect(() => {
        if (showLevelUpModal) {
            stopFirecrackersRef.current = launchFirecrackers();
        }
        return () => {
            if (stopFirecrackersRef.current) stopFirecrackersRef.current();
        };
    }, [showLevelUpModal]);

    // Auto-close after 4 seconds
    useEffect(() => {
        if (!showLevelUpModal) return;
        const t = setTimeout(handleClose, 4000);
        return () => clearTimeout(t);
    }, [showLevelUpModal, handleClose]);

    return (
        <AnimatePresence>
            {showLevelUpModal && (
                <motion.div
                    className="cel-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3 }}
                    onClick={handleClose}
                >
                    {/* Modal card */}
                    <motion.div
                        className="cel-modal"
                        initial={{ scale: 0.4, opacity: 0, y: 60 }}
                        animate={{ scale: 1,   opacity: 1, y: 0  }}
                        exit={{   scale: 0.4, opacity: 0, y: 60  }}
                        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Glow ring */}
                        <motion.div
                            className="cel-glow"
                            animate={{ scale: [1, 1.18, 1], opacity: [0.5, 0.9, 0.5] }}
                            transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                        />

                        {/* Trophy */}
                        <motion.div
                            className="cel-trophy"
                            initial={{ scale: 0, rotate: -15 }}
                            animate={{ scale: 1,   rotate: 0   }}
                            transition={{ type: 'spring', stiffness: 300, delay: 0.2 }}
                        >🏆</motion.div>

                        {/* "Level Up!" text */}
                        <motion.h1
                            className="cel-title"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0  }}
                            transition={{ delay: 0.35, duration: 0.5 }}
                        >
                            Level Up!
                        </motion.h1>

                        {/* Level number */}
                        <motion.div
                            className="cel-level"
                            initial={{ scale: 0.3, opacity: 0 }}
                            animate={{ scale: 1,   opacity: 1  }}
                            transition={{ type: 'spring', stiffness: 250, delay: 0.5 }}
                        >
                            <span className="cel-level-num">Level {level}</span>
                        </motion.div>

                        {/* Badge earned */}
                        <motion.div
                            className="cel-badge"
                            style={{ borderColor: badge.color, background: `${badge.color}18` }}
                            initial={{ opacity: 0, scale: 0.6 }}
                            animate={{ opacity: 1, scale: 1   }}
                            transition={{ delay: 0.65, duration: 0.4 }}
                        >
                            <span className="cel-badge-icon">{badge.icon}</span>
                            <div>
                                <p className="cel-badge-name" style={{ color: badge.color }}>{badge.label}</p>
                                <p className="cel-badge-xp">{totalXP} Total XP</p>
                            </div>
                        </motion.div>

                        {/* Firework stars */}
                        {[...Array(6)].map((_, i) => (
                            <motion.span
                                key={i}
                                className="cel-star"
                                style={{
                                    top: `${15 + Math.sin((i / 6) * Math.PI * 2) * 38}%`,
                                    left: `${50 + Math.cos((i / 6) * Math.PI * 2) * 42}%`,
                                }}
                                animate={{
                                    opacity: [0, 1, 0],
                                    scale:   [0, 1.4, 0],
                                    rotate:  [0, 180],
                                }}
                                transition={{
                                    duration: 1.4,
                                    repeat: Infinity,
                                    delay: i * 0.25,
                                    ease: 'easeInOut',
                                }}
                            >✦</motion.span>
                        ))}

                        {/* Close button */}
                        <motion.button
                            className="cel-close-btn"
                            onClick={handleClose}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            transition={{ delay: 1.0 }}
                            whileHover={{ scale: 1.06 }}
                            whileTap={{ scale: 0.96 }}
                        >
                            🎯 Keep Going!
                        </motion.button>

                        <p className="cel-hint">Tap anywhere to continue</p>
                    </motion.div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
