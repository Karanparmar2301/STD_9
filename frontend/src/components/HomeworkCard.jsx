import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import './HomeworkCard.css';

const HomeworkCard = ({ task, status, onSubmit, isSubmitting, hasWrongAnswer }) => {
    const [answer, setAnswer] = useState('');
    const [shakeKey, setShakeKey] = useState(0);

    // Trigger shake animation when wrong answer is detected
    useEffect(() => {
        if (hasWrongAnswer) {
            setShakeKey(k => k + 1);
        }
    }, [hasWrongAnswer]);

    const handleSubmit = (e) => {
        e.preventDefault();
        if (!answer.trim() || isSubmitting) return;
        onSubmit(answer);
    };

    const formattedDate = task.completed_at
        ? new Date(task.completed_at).toLocaleDateString('en-IN', {
              month: 'short', day: 'numeric',
              hour: '2-digit', minute: '2-digit'
          })
        : '';

    return (
        <motion.div
            key={shakeKey}
            className={`homework-card ${status} ${hasWrongAnswer ? 'wrong' : ''}`}
            layout
            initial={{ opacity: 0, scale: 0.95 }}
            animate={hasWrongAnswer
                ? { opacity: 1, scale: 1, x: [0, -8, 8, -6, 6, -3, 3, 0] }
                : { opacity: 1, scale: 1, x: 0 }
            }
            whileHover={status === 'pending' ? { y: -3, boxShadow: '0 10px 28px rgba(0,0,0,0.1)' } : {}}
            transition={{ duration: 0.35 }}
        >
            {/* Subject Badge */}
            <div className={`subject-badge ${task.subject}`}>
                {task.subject === 'math' ? '🔢' : '📝'}
                {task.subject?.toUpperCase()}
            </div>

            {/* Title */}
            <h3 className="homework-title">{task.title}</h3>

            {/* Question */}
            <div className="homework-question">
                <p>{task.question}</p>
            </div>

            {/* XP Reward Badge */}
            <div className="xp-reward-badge">
                <span>⭐</span> +{task.xp_reward} XP
            </div>

            {status === 'pending' ? (
                <form onSubmit={handleSubmit} className="answer-form">
                    <div className={`input-group ${hasWrongAnswer ? 'input-error' : ''}`}>
                        <input
                            type="text"
                            value={answer}
                            onChange={(e) => setAnswer(e.target.value)}
                            placeholder="Type your answer here..."
                            className="answer-input"
                            disabled={isSubmitting}
                            autoComplete="off"
                        />
                    </div>

                    {/* Inline wrong-answer error */}
                    <AnimatePresence>
                        {hasWrongAnswer && (
                            <motion.div
                                className="wrong-answer-msg"
                                initial={{ opacity: 0, y: -6 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -6 }}
                                transition={{ duration: 0.25 }}
                            >
                                ❌ Incorrect answer. Try again!
                            </motion.div>
                        )}
                    </AnimatePresence>

                    <motion.button
                        type="submit"
                        className="btn-submit"
                        disabled={!answer.trim() || isSubmitting}
                        whileHover={{ scale: 1.04 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                    >
                        {isSubmitting ? (
                            <><span className="spinner-small" /> Checking...</>
                        ) : (
                            'Submit Answer →'
                        )}
                    </motion.button>
                </form>
            ) : (
                <div className="completed-section">
                    <motion.div
                        className="checkmark-animation"
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        transition={{ type: 'spring', stiffness: 500, damping: 20, delay: 0.2 }}
                    >
                        ✓
                    </motion.div>
                    <div className="student-answer">
                        <strong>Your Answer:</strong> {task.student_answer}
                    </div>
                    {formattedDate && (
                        <div className="completed-time">
                            Completed: {formattedDate}
                        </div>
                    )}
                </div>
            )}
        </motion.div>
    );
};

export default HomeworkCard;
