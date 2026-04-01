import React, { useEffect, useCallback } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion } from 'framer-motion';
import { fetchTimetable } from '../store/timetableSlice';
import TimetableGrid from './timetable/TimetableGrid';
import NextClassWidget from './timetable/NextClassWidget';
import SkeletonLoader from './SkeletonLoader';
import './Timetable.css';

function Timetable() {
    const dispatch = useDispatch();
    const uid = useSelector((state) => state.auth.user?.uid);
    const { slots, schedule, loading, error } = useSelector((state) => state.timetable);

    useEffect(() => {
        if (uid && slots.length === 0) {
            dispatch(fetchTimetable(uid));
        }
    }, [uid, dispatch, slots.length]);

    const handlePrint = useCallback(() => {
        window.print();
    }, []);

    const handleExportPDF = useCallback(() => {
        // Use the browser's built-in print-to-PDF dialog
        window.print();
    }, []);

    return (
        <motion.div
            className="timetable-section"
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35, ease: 'easeOut' }}
        >
            {/* Page Header */}
            <div className="tt-page-header">
                <div className="tt-page-header-left">
                    <h2 className="tt-page-title">
                        <span className="tt-title-icon">🗓️</span>
                        Weekly Timetable
                    </h2>
                    <p className="tt-page-subtitle">Class 8 · Section A · Academic Year 2025–26</p>
                </div>
                <div className="tt-page-actions">
                    <button className="tt-action-btn tt-action-btn--secondary" onClick={handlePrint} title="Print Timetable">
                        🖨️ <span>Print</span>
                    </button>
                    <button className="tt-action-btn tt-action-btn--primary" onClick={handleExportPDF} title="Download as PDF">
                        ⬇️ <span>Export PDF</span>
                    </button>
                </div>
            </div>

            {/* Subject Legend */}
            <div className="tt-legend">
                {[
                    { label: 'Mathematics',         color: '#3F37C9' },
                    { label: 'English',              color: '#2BA84A' },
                    { label: 'Hindi',                color: '#E63946' },
                    { label: 'Science',              color: '#0081A7' },
                    { label: 'Fine Art',             color: '#9D4EDD' },
                    { label: 'Social Science',       color: '#F77F00' },
                    { label: 'Sanskrit',             color: '#C1121F' },
                    { label: 'PT',                   color: '#2EC4B6' },
                    { label: 'Voc. Education',       color: '#6A4C93' },
                ].map(({ label, color }) => (
                    <div key={label} className="tt-legend-item">
                        <span className="tt-legend-dot" style={{ background: color }} />
                        <span>{label}</span>
                    </div>
                ))}
            </div>

            {/* Content */}
            {loading && (
                <SkeletonLoader type="card" count={3} />
            )}

            {error && (
                <div className="tt-error">
                    <p>⚠️ {error}</p>
                    <button onClick={() => dispatch(fetchTimetable(uid))}>Retry</button>
                </div>
            )}

            {!loading && !error && slots.length > 0 && (
                <>
                    <NextClassWidget slots={slots} schedule={schedule} />
                    <TimetableGrid slots={slots} schedule={schedule} />
                </>
            )}
        </motion.div>
    );
}

export default Timetable;
