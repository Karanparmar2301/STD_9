import React from 'react';
import { motion } from 'framer-motion';
import './SubjectCard.css';

export const SUBJECT_COLORS = {
    'Mathematics':          { bg: '#eef0ff', border: '#3F37C9', text: '#3F37C9' },
    'English':              { bg: '#e8f8ed', border: '#2BA84A', text: '#1a7a35' },
    'Hindi':                { bg: '#fdecea', border: '#E63946', text: '#b02a33' },
    'Science':              { bg: '#e0f5f8', border: '#0081A7', text: '#005e7a' },
    'Fine Art':             { bg: '#f3e8ff', border: '#9D4EDD', text: '#7a2db8' },
    'Fine Arts':            { bg: '#f3e8ff', border: '#9D4EDD', text: '#7a2db8' },
    'Drawing':              { bg: '#f3e8ff', border: '#9D4EDD', text: '#7a2db8' },
    'Social Science':       { bg: '#fff3e0', border: '#F77F00', text: '#b85e00' },
    'Sanskrit':             { bg: '#ffe8ec', border: '#C1121F', text: '#8c0d15' },
    'PT':                   { bg: '#e0faf7', border: '#2EC4B6', text: '#1a8a80' },
    'Physical Education':   { bg: '#e0faf7', border: '#2EC4B6', text: '#1a8a80' },
    'Vocational Education': { bg: '#ede8f9', border: '#6A4C93', text: '#4a2e6e' },
    'Voc. Education':        { bg: '#ede8f9', border: '#6A4C93', text: '#4a2e6e' },
    'Break':                { bg: '#f0f0f0', border: '#9e9e9e', text: '#616161' },
};

const getColors = (subject) =>
    SUBJECT_COLORS[subject] || { bg: '#f5f5f5', border: '#9e9e9e', text: '#444' };

function SubjectCard({ subject, teacher, isNow = false, isNext = false, isMobile = false }) {
    const colors = getColors(subject);

    return (
        <motion.div
            className={`subject-card${isNow ? ' subject-card--now' : ''}${isNext ? ' subject-card--next' : ''}`}
            style={{
                '--card-bg': colors.bg,
                '--card-border': colors.border,
                '--card-text': colors.text,
            }}
            whileHover={{ y: -2, boxShadow: `0 6px 20px ${colors.border}28` }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
        >
            {isNow && (
                <span className="now-badge">
                    <span className="now-dot" />
                    Now
                </span>
            )}
            <span className="sc-subject">{subject}</span>
            {teacher && <span className="sc-teacher">{teacher}</span>}
        </motion.div>
    );
}

export default SubjectCard;
