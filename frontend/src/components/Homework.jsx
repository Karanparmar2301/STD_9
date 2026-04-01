import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
    fetchHomework,
    submitHomework,
    setSubjectFilter,
    clearHomeworkError,
    clearWrongAnswer,
    selectFilteredPending,
    selectFilteredCompleted,
    selectHomeworkStats,
    selectHomeworkFilter,
    selectHomeworkLoading,
    selectCompletingId,
    selectWrongAnswerId
} from '../store/homeworkSlice';
import {
    selectGamificationProgress,
    closeBadgeModal
} from '../store/gamificationSlice';
import { selectUser } from '../store/authSlice';
import HomeworkCard from './HomeworkCard';
import './Homework.css';

// ── Badge Modal (inline, lightweight) ────────────────────────────────────────

const HomeworkBadgeModal = ({ badge, onClose }) => (
    <AnimatePresence>
        {badge && (
            <motion.div
                className="hw-badge-overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={onClose}
            >
                <motion.div
                    className="hw-badge-modal"
                    initial={{ scale: 0.5, opacity: 0, y: 40 }}
                    animate={{ scale: 1, opacity: 1, y: 0 }}
                    exit={{ scale: 0.5, opacity: 0, y: 40 }}
                    transition={{ type: 'spring', stiffness: 340, damping: 22 }}
                    onClick={(e) => e.stopPropagation()}
                >
                    <div className="hw-badge-icon">{badge.icon}</div>
                    <h2 className="hw-badge-title">Badge Unlocked! 🎉</h2>
                    <h3 className="hw-badge-name">{badge.name}</h3>
                    <p className="hw-badge-desc">{badge.description}</p>
                    <motion.button
                        className="hw-badge-btn"
                        onClick={onClose}
                        whileTap={{ scale: 0.95 }}
                    >
                        Awesome! 🚀
                    </motion.button>
                </motion.div>
            </motion.div>
        )}
    </AnimatePresence>
);

// ── Subject filters (key must match hw.subject exactly — case-insensitive compare in slice) ──
const SUBJECT_FILTERS = [
    { key: 'all',             label: '📌 All',        color: '#667eea' },
    { key: 'Mathematics',    label: '📐 Maths',       color: '#3F37C9' },
    { key: 'English',        label: '📖 English',     color: '#2BA84A' },
    { key: 'Hindi',          label: 'अ Hindi',        color: '#E63946' },
    { key: 'Science',        label: '🔬 Science',     color: '#0081A7' },
    { key: 'Fine Art',       label: '🎨 Fine Art',    color: '#9D4EDD' },
    { key: 'Social Science', label: '🌍 Social Sci',  color: '#F77F00' },
    { key: 'Sanskrit',       label: 'स Sanskrit',     color: '#C1121F' },
    { key: 'PT',             label: '🏃 PT',          color: '#2EC4B6' },
    { key: 'Voc. Education', label: '🛠️ Voc. Ed',    color: '#6A4C93' },
];

// ── Main Component ─────────────────────────────────────────────────────────────

const Homework = ({ data }) => {
    const dispatch = useDispatch();
    const [activeTab, setActiveTab] = useState('pending');
    const hasFetched = useRef(false);

    const user = useSelector(selectUser);
    const pendingTasks = useSelector(selectFilteredPending);
    const completedTasks = useSelector(selectFilteredCompleted);
    const stats = useSelector(selectHomeworkStats);
    const loading = useSelector(selectHomeworkLoading);
    const currentFilter = useSelector(selectHomeworkFilter);
    const completingId = useSelector(selectCompletingId);
    const wrongAnswerId = useSelector(selectWrongAnswerId);
    const gamification = useSelector(selectGamificationProgress);

    // Fetch once per mount
    useEffect(() => {
        const uid = data?.uid || user?.uid;
        if (uid && !hasFetched.current) {
            hasFetched.current = true;
            dispatch(fetchHomework(uid));
        }
    }, [dispatch, data, user]);

    const handleSubmit = async (homework, answer) => {
        const uid = data?.uid || user?.uid;
        if (!uid || !answer.trim()) return;

        dispatch(clearHomeworkError());

        try {
            const result = await dispatch(submitHomework({
                homework_id: homework.id,
                uid,
                student_answer: answer
            })).unwrap();

            if (result.correct) {
                // Switch to pending tab automatically if all done
                if (result.stats?.pending === 0) {
                    setTimeout(() => setActiveTab('completed'), 600);
                }
            }
        } catch (err) {
            console.error('Submit error:', err);
        }
    };

    const containerVariants = {
        hidden: { opacity: 0 },
        show: { opacity: 1, transition: { staggerChildren: 0.08 } }
    };
    const itemVariants = {
        hidden: { opacity: 0, y: 18 },
        show: { opacity: 1, y: 0, transition: { duration: 0.3 } }
    };

    return (
        <div className="homework-page">
            {/* Page Header */}
            <div className="hw-header">
                <div>
                    <h1 className="hw-title">
                        <span>📚</span> Homework
                    </h1>
                    <p className="hw-subtitle">Answer questions to complete your assignments</p>
                </div>
            </div>

            {/* Stats Grid */}
            <motion.div
                className="homework-stats-grid"
                variants={containerVariants}
                initial="hidden"
                animate="show"
            >
                <motion.div className="stat-card total" variants={itemVariants}>
                    <span className="stat-icon">📚</span>
                    <div className="stat-value">{stats.total}</div>
                    <h3>Total</h3>
                </motion.div>
                <motion.div className="stat-card pending" variants={itemVariants}>
                    <span className="stat-icon">⏳</span>
                    <div className="stat-value">{stats.pending}</div>
                    <h3>Pending</h3>
                </motion.div>
                <motion.div className="stat-card completed" variants={itemVariants}>
                    <span className="stat-icon">✅</span>
                    <div className="stat-value">{stats.completed}</div>
                    <h3>Completed</h3>
                </motion.div>
                <motion.div className="stat-card rate" variants={itemVariants}>
                    <span className="stat-icon">📈</span>
                    <div className="stat-value">{stats.completion_rate}%</div>
                    <h3>Done</h3>
                    <div className="progress-bar-sm">
                        <motion.div
                            className="progress-fill"
                            initial={{ width: 0 }}
                            animate={{ width: `${stats.completion_rate}%` }}
                            transition={{ duration: 0.8, ease: 'easeOut' }}
                        />
                    </div>
                </motion.div>
            </motion.div>

            {/* Tabs + Subject Filter — single row */}
            <div className="homework-controls">
                {/* Left: status tabs */}
                <div className="hw-tabs">
                    <motion.button
                        className={`hw-tab-btn${activeTab === 'pending' ? ' active' : ''}`}
                        onClick={() => setActiveTab('pending')}
                        whileTap={{ scale: 0.95 }}
                    >
                        Pending
                        <span className="hw-tab-count">{stats.pending}</span>
                    </motion.button>
                    <motion.button
                        className={`hw-tab-btn${activeTab === 'completed' ? ' active' : ''}`}
                        onClick={() => setActiveTab('completed')}
                        whileTap={{ scale: 0.95 }}
                    >
                        Completed
                        <span className="hw-tab-count">{stats.completed}</span>
                    </motion.button>
                </div>

                {/* Divider */}
                <div className="hw-divider" />

                {/* Right: subject chips */}
                <div className="subject-filter">
                    {SUBJECT_FILTERS.map((subj) => {
                        const isActive = currentFilter === subj.key;
                        return (
                            <motion.button
                                key={subj.key}
                                className={`filter-btn${isActive ? ' active' : ''}`}
                                style={isActive ? {
                                    background: subj.color,
                                    borderColor: subj.color,
                                    color: '#fff',
                                    boxShadow: `0 3px 12px ${subj.color}55`
                                } : {}}
                                onClick={() => dispatch(setSubjectFilter(subj.key))}
                                whileTap={{ scale: 0.93 }}
                            >
                                {subj.label}
                            </motion.button>
                        );
                    })}
                </div>
            </div>

            {/* Content */}
            {loading ? (
                <div className="loading-state">
                    <div className="spinner" />
                    <p>Loading homework...</p>
                </div>
            ) : (
                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, x: activeTab === 'pending' ? -20 : 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: activeTab === 'pending' ? 20 : -20 }}
                        transition={{ duration: 0.28 }}
                    >
                        {activeTab === 'pending' ? (
                            pendingTasks.length > 0 ? (
                                <motion.div
                                    variants={containerVariants}
                                    initial="hidden"
                                    animate="show"
                                    className="homework-list pending"
                                >
                                    {pendingTasks.map((task) => (
                                        <motion.div key={task.id} variants={itemVariants} layout>
                                            <HomeworkCard
                                                task={task}
                                                status="pending"
                                                onSubmit={(answer) => handleSubmit(task, answer)}
                                                isSubmitting={completingId === task.id}
                                                hasWrongAnswer={wrongAnswerId === task.id}
                                            />
                                        </motion.div>
                                    ))}
                                </motion.div>
                            ) : (
                                <motion.div
                                    className="empty-state"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                >
                                    <span className="emoji">🎉</span>
                                    <h3>All done! No pending homework!</h3>
                                    <p>Awesome work, champion! 🏆</p>
                                </motion.div>
                            )
                        ) : (
                            completedTasks.length > 0 ? (
                                <motion.div
                                    variants={containerVariants}
                                    initial="hidden"
                                    animate="show"
                                    className="homework-list completed"
                                >
                                    {completedTasks.map((task) => (
                                        <motion.div key={task.id} variants={itemVariants} layout>
                                            <HomeworkCard
                                                task={task}
                                                status="completed"
                                            />
                                        </motion.div>
                                    ))}
                                </motion.div>
                            ) : (
                                <motion.div
                                    className="empty-state"
                                    initial={{ opacity: 0, scale: 0.9 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                >
                                    <span className="emoji">📂</span>
                                    <h3>No completed homework yet</h3>
                                    <p>Answer questions correctly to see them here.</p>
                                </motion.div>
                            )
                        )}
                    </motion.div>
                </AnimatePresence>
            )}
        </div>
    );
};

export default Homework;
