import React, { useEffect, useRef, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid,
    Tooltip, ResponsiveContainer, Area, AreaChart,
} from 'recharts';
import {
    fetchPerformance,
    fetchSubjectDetails,
    calcGrade,
    setFilterTerm,
    selectPerformance,
    selectPerfLoading,
    selectPerfError,
    selectPerfKPIs,
    selectFilteredSubjects,
    selectPerfMonthly,
    selectPerfFilterTerm,
    selectSubjectDetails,
    selectSubjectDetailsLoading,
} from '../store/performanceSlice';
import { selectUser } from '../store/authSlice';
import './Performance.css';

// ── Subject accent colours ──────────────────────────────────────────────────
const SUBJECT_COLORS = {
    'Mathematics':          '#4f6df5',   /* muted royal blue */
    'English':              '#2f855a',   /* sage green */
    'Hindi':                '#c24141',   /* soft crimson */
    'Science':              '#2f855a',
    'Fine Arts':            '#7c3aed',   /* soft violet */
    'Social Science':       '#d97706',   /* tempered amber */
    'Sanskrit':             '#c24141',
    'Physical Education':   '#2fb3a6',   /* teal-sage */
    'Vocational Education': '#7c3aed',
};

const SUBJECT_ICONS = {
    'Mathematics':          '📐',
    'English':              '📖',
    'Hindi':                'अ',
    'Science':              '🔬',
    'Fine Arts':            '🎨',
    'Social Science':       '🌍',
    'Sanskrit':             'स',
    'Physical Education':   '🏃',
    'Vocational Education': '🛠️',
};

// ── Color helpers ──────────────────────────────────────────────────────────
function hexToRgba(hex, alpha = 1) {
    if (!hex) return `rgba(15,23,42,${alpha})`;
    let h = hex.replace('#', '');
    if (h.length === 3) h = h.split('').map((c) => c + c).join('');
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}


// ── Animated counter ────────────────────────────────────────────────────────
function AnimatedNumber({ value, suffix = '' }) {
    const [display, setDisplay] = useState(0);
    useEffect(() => {
        let start = 0;
        const end = Number(value);
        if (start === end) { setDisplay(end); return; }
        const duration = 900;
        const step = (end - start) / (duration / 16);
        const timer = setInterval(() => {
            start += step;
            if (start >= end) { clearInterval(timer); setDisplay(end); }
            else setDisplay(Math.floor(start));
        }, 16);
        return () => clearInterval(timer);
    }, [value]);
    return <>{display}{suffix}</>;
}

// ── KPI Card ────────────────────────────────────────────────────────────────
function KpiCard({ icon, label, value, suffix = '', color, progress, delay = 0, text }) {
    return (
        <motion.div
            className="perf-kpi-card"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, delay }}
            whileHover={{ y: -3, boxShadow: '0 12px 32px rgba(0,0,0,0.10)' }}
        >
            <div className="perf-kpi-icon" style={{ background: `${color}18`, color }}>
                {icon}
            </div>
            <div className="perf-kpi-body">
                <p className="perf-kpi-label">{label}</p>
                <p className="perf-kpi-value" style={{ color: hexToRgba(color, 0.82) }}>
                    {text
                        ? <span className="perf-kpi-text">{text}</span>
                        : <AnimatedNumber value={value} suffix={suffix} />
                    }
                </p>
            </div>
            {progress !== undefined && (
                <div className="perf-kpi-bar-track">
                    <motion.div
                        className="perf-kpi-bar-fill"
                        style={{ background: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(progress, 100)}%` }}
                        transition={{ duration: 0.9, delay: delay + 0.2, ease: 'easeOut' }}
                    />
                </div>
            )}
        </motion.div>
    );
}

// ── Subject Card ─────────────────────────────────────────────────────────────
function SubjectCard({ subject, index, onCardClick }) {
    const color  = SUBJECT_COLORS[subject.name] || '#667eea';
    const icon   = SUBJECT_ICONS[subject.name]  || '📚';
    const grade  = calcGrade(subject.avg);
    const isPos  = subject.trend > 0;
    const isNeg  = subject.trend < 0;

    return (
        <motion.div
            className="perf-subj-card"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.35, delay: index * 0.05 }}
            whileHover={{ y: -2, boxShadow: '0 8px 20px rgba(16,24,40,0.06)' }}
            onClick={() => onCardClick(subject)}
        >
            {/* Header row */}
            <div className="perf-subj-header">
                <div className="perf-subj-icon" style={{ background: `${color}18`, color }}>
                    {icon}
                </div>
                <div className="perf-subj-name">{subject.name}</div>
                <span
                    className={`perf-trend-badge ${isPos ? 'pos' : isNeg ? 'neg' : 'neutral'}`}
                >
                    {isPos ? '▲' : isNeg ? '▼' : '●'}&nbsp;
                    {isPos ? '+' : ''}{subject.trend}%
                </span>
            </div>

            {/* Score */}
            <div className="perf-subj-score" style={{ color: hexToRgba(color, 0.82) }}>
                <AnimatedNumber value={subject.avg} suffix="%" />
            </div>

            {/* Progress bar + grade */}
            <div className="perf-subj-bottom">
                <div className="perf-bar-track">
                    <motion.div
                        className="perf-bar-fill"
                        style={{ background: color }}
                        initial={{ width: 0 }}
                        animate={{ width: `${subject.avg}%` }}
                        transition={{ duration: 0.8, delay: index * 0.05 + 0.2, ease: 'easeOut' }}
                    />
                </div>
                <span className="perf-grade-badge" style={{ color: grade.color, borderColor: `${grade.color}40`, background: `${grade.color}12` }}>
                    {grade.label}
                </span>
            </div>
        </motion.div>
    );
}

// ── Subject Detail Modal ─────────────────────────────────────────────────────
function SubjectDetailModal({ subject, isOpen, onClose }) {
    const dispatch = useDispatch();
    const user = useSelector(selectUser);
    
    const color  = SUBJECT_COLORS[subject?.name] || '#667eea';
    const icon   = SUBJECT_ICONS[subject?.name]  || '📚';
    const grade  = subject ? calcGrade(subject.avg) : { label: 'N/A', color: '#666' };
    const isPos  = subject?.trend > 0;
    const isNeg  = subject?.trend < 0;

    // Get detailed subject data from Redux cache
    const details = useSelector(selectSubjectDetails(subject?.name || ''));
    const detailsLoading = useSelector(selectSubjectDetailsLoading(subject?.name || ''));

    // Fetch details when modal opens
    useEffect(() => {
        if (isOpen && subject && !details && !detailsLoading && user?.uid) {
            dispatch(fetchSubjectDetails({ uid: user.uid, subject: subject.name }));
        }
    }, [isOpen, subject, details, detailsLoading, user?.uid, dispatch]);

    if (!isOpen || !subject) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="perf-modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        onClick={onClose}
                    />
                    
                    {/* Modal Content */}
                    <motion.div
                        className="perf-modal-container"
                        initial={{ y: '100%', x: '-50%', opacity: 0 }}
                        animate={{ y: 0, x: '-50%', opacity: 1 }}
                        exit={{ y: '100%', x: '-50%', opacity: 0 }}
                        transition={{ 
                            type: 'spring', 
                            damping: 30, 
                            stiffness: 300,
                            duration: 0.4 
                        }}
                    >
                        <div className="perf-modal-header" style={{ borderTopColor: color }}>
                            <div className="perf-modal-header-left">
                                <div className="perf-modal-icon" style={{ background: `${color}18`, color }}>
                                    {icon}
                                </div>
                                <div>
                                    <h2 className="perf-modal-title" style={{ color }}>
                                        {subject.name}
                                    </h2>
                                    <div className="perf-modal-subtitle">
                                        Comprehensive Subject Intelligence
                                    </div>
                                </div>
                            </div>
                            <button className="perf-modal-close" onClick={onClose}>
                                ✕
                            </button>
                        </div>

                        <div className="perf-modal-body">
                            {detailsLoading ? (
                                <div className="perf-modal-loading">
                                    <div className="perf-modal-spinner">🔄 Loading details...</div>
                                </div>
                            ) : details ? (
                                <div className="perf-modal-content">
                                    {/* ── 1. SUBJECT HEADER ── */}
                                    <div className="perf-modal-meta">
                                        <div className="perf-modal-meta-item">
                                            <span className="perf-modal-meta-icon">👨‍🏫</span>
                                            <div>
                                                <div className="perf-modal-meta-label">Teacher</div>
                                                <div className="perf-modal-meta-value">{details.teacher}</div>
                                            </div>
                                        </div>
                                        <div className="perf-modal-meta-item">
                                            <span className="perf-modal-meta-icon">📅</span>
                                            <div>
                                                <div className="perf-modal-meta-label">Weekly Periods</div>
                                                <div className="perf-modal-meta-value">{details.weekly_periods}</div>
                                            </div>
                                        </div>
                                        <div className="perf-modal-meta-item">
                                            <span className="perf-modal-meta-icon">🏫</span>
                                            <div>
                                                <div className="perf-modal-meta-label">Section</div>
                                                <div className="perf-modal-meta-value">{details.section}</div>
                                            </div>
                                        </div>
                                        <div className="perf-modal-meta-item">
                                            <span className="perf-modal-meta-icon">📚</span>
                                            <div>
                                                <div className="perf-modal-meta-label">Academic Year</div>
                                                <div className="perf-modal-meta-value">{details.academic_year}</div>
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── 2. PERFORMANCE SUMMARY (4 mini stats) ── */}
                                    <div className="perf-modal-stats">
                                        <div className="perf-modal-stat" style={{ borderTopColor: color }}>
                                            <div className="perf-modal-stat-label">Average</div>
                                            <div className="perf-modal-stat-value" style={{ color }}>{details.average_score}%</div>
                                        </div>
                                        <div className="perf-modal-stat" style={{ borderTopColor: color }}>
                                            <div className="perf-modal-stat-label">Rank</div>
                                            <div className="perf-modal-stat-value" style={{ color }}>
                                                {details.rank}{details.rank === 1 ? 'st' : details.rank === 2 ? 'nd' : details.rank === 3 ? 'rd' : 'th'}
                                            </div>
                                        </div>
                                        <div className="perf-modal-stat" style={{ borderTopColor: color }}>
                                            <div className="perf-modal-stat-label">Exams</div>
                                            <div className="perf-modal-stat-value" style={{ color }}>{details.total_exams}</div>
                                        </div>
                                        <div className="perf-modal-stat" style={{ borderTopColor: color }}>
                                            <div className="perf-modal-stat-label">Attendance</div>
                                            <div className="perf-modal-stat-value" style={{ color }}>{details.attendance_pct}%</div>
                                        </div>
                                    </div>

                                    <div className="perf-modal-grid">
                                        {/* ── 3. TIMETABLE INTELLIGENCE ── */}
                                        <div className="perf-modal-section">
                                            <h4 className="perf-modal-section-title">📅 Schedule</h4>
                                            <div className="perf-modal-section-content">
                                                <div className="perf-modal-info-row">
                                                    <span className="perf-modal-info-label">Days</span>
                                                    <span className="perf-modal-info-value">{details.days_scheduled}</span>
                                                </div>
                                                <div className="perf-modal-info-row">
                                                    <span className="perf-modal-info-label">Next Class</span>
                                                    <span className="perf-modal-info-value">
                                                        {details.next_class?.relative} {details.next_class?.time}
                                                    </span>
                                                </div>
                                                <div className="perf-modal-info-row">
                                                    <span className="perf-modal-info-label">Last Class</span>
                                                    <span className="perf-modal-info-value">{details.last_class?.relative}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* ── 4. PERFORMANCE TREND (last 4 scores) ── */}
                                        <div className="perf-modal-section">
                                            <h4 className="perf-modal-section-title">📈 Recent Scores</h4>
                                            <div className="perf-modal-section-content">
                                                {details.last_scores?.map((exam, i) => (
                                                    <div key={i} className="perf-modal-trend-item">
                                                        <span className="perf-modal-trend-label">{exam.label}</span>
                                                        <div className="perf-modal-trend-bar-wrapper">
                                                            <motion.div 
                                                                className="perf-modal-trend-bar" 
                                                                style={{ background: color }}
                                                                initial={{ width: 0 }}
                                                                animate={{ width: `${exam.score}%` }}
                                                                transition={{ duration: 0.6, delay: i * 0.1 }}
                                                            />
                                                            <span className="perf-modal-trend-score">{exam.score}%</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>

                                    {/* ── 5. AI SUBJECT INSIGHT ── */}
                                    <div className="perf-modal-section perf-modal-insight">
                                        <h4 className="perf-modal-section-title">🧠 AI Insight</h4>
                                        <p className="perf-modal-insight-text">{details.insight}</p>
                                    </div>

                                    {/* ── 6. SKILL BREAKDOWN ── */}
                                    <div className="perf-modal-section">
                                        <h4 className="perf-modal-section-title">🏆 Skill Breakdown</h4>
                                        <div className="perf-modal-section-content">
                                            {details.skill_breakdown?.map((skill, i) => (
                                                <div key={i} className="perf-modal-skill-item">
                                                    <div className="perf-modal-skill-header">
                                                        <span className="perf-modal-skill-name">{skill.name}</span>
                                                        <span className="perf-modal-skill-score">{skill.score}%</span>
                                                    </div>
                                                    <div className="perf-modal-skill-bar-track">
                                                        <motion.div 
                                                            className="perf-modal-skill-bar" 
                                                            style={{ background: color }}
                                                            initial={{ width: 0 }}
                                                            animate={{ width: `${skill.score}%` }}
                                                            transition={{ duration: 0.6, delay: i * 0.08 }}
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* ── 7. TEACHER FEEDBACK ── */}
                                    <div className="perf-modal-section perf-modal-feedback">
                                        <h4 className="perf-modal-section-title">👨‍🏫 Teacher Feedback</h4>
                                        <p className="perf-modal-feedback-text">"{details.teacher_feedback}"</p>
                                    </div>
                                </div>
                            ) : (
                                <div className="perf-modal-error">
                                    Failed to load details. Please try again.
                                </div>
                            )}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

// ── Custom tooltip for chart ─────────────────────────────────────────────────
function ChartTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="perf-tooltip">
            <p className="perf-tooltip-label">{label}</p>
            <p className="perf-tooltip-value">{payload[0].value}%</p>
        </div>
    );
}

// ── Skeleton shimmer card ────────────────────────────────────────────────────
function SkeletonCard({ height = 110 }) {
    return (
        <div className="perf-skeleton" style={{ height }}>
            <div className="perf-skeleton-inner" />
        </div>
    );
}

// ── Main Component ───────────────────────────────────────────────────────────
const Performance = () => {
    const dispatch = useDispatch();
    const user       = useSelector(selectUser);
    const kpis       = useSelector(selectPerfKPIs);
    const subjects   = useSelector(selectFilteredSubjects);
    const monthly    = useSelector(selectPerfMonthly);
    const loading    = useSelector(selectPerfLoading);
    const error      = useSelector(selectPerfError);
    const filterTerm = useSelector(selectPerfFilterTerm);
    const { lastFetchedUid } = useSelector(selectPerformance);
    const fetched = useRef(false);
    
    // Modal state for subject detail popup
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [isModalOpen, setIsModalOpen] = useState(false);

    useEffect(() => {
        const uid = user?.uid;
        if (uid && !fetched.current && lastFetchedUid !== uid) {
            fetched.current = true;
            dispatch(fetchPerformance(uid));
        }
    }, [dispatch, user, lastFetchedUid]);

    const yDomain = monthly.length
        ? [Math.max(0, Math.min(...monthly.map(m => m.avg)) - 10), 100]
        : [0, 100];
    
    const handleCardClick = (subject) => {
        setSelectedSubject(subject);
        setIsModalOpen(true);
    };
    
    const handleCloseModal = () => {
        setIsModalOpen(false);
        // Delay clearing selected subject for exit animation
        setTimeout(() => setSelectedSubject(null), 300);
    };

    return (
        <div className="performance-page">

            {/* ── Page header ── */}
            <div className="perf-page-header">
                <div>
                    <h1 className="perf-page-title">📊 Performance</h1>
                    <p className="perf-page-sub">Academic progress · Class 8 · 2025–26</p>
                </div>
            </div>

            {error && (
                <div className="perf-error-banner">
                    ⚠️ {error} — showing sample data
                </div>
            )}

            {/* ── KPI cards ── */}
            <div className="perf-kpi-grid">
                {loading ? (
                    [1,2,3,4].map(i => <SkeletonCard key={i} height={110} />)
                ) : (
                    <>
                        <KpiCard
                            icon="📈" label="Overall Average"
                            value={kpis.overallAverage} suffix="%"
                            color="#4f6df5" progress={kpis.overallAverage} delay={0}
                        />
                        <KpiCard
                            icon="🚀" label="Growth This Term"
                            text={`${kpis.growth >= 0 ? '+' : ''}${kpis.growth}%`}
                            color={kpis.growth >= 0 ? '#2f855a' : '#c24141'}
                            delay={0.07}
                        />
                        <KpiCard
                            icon="🏆" label="Top Subject"
                            text={kpis.topSubject || '—'}
                            color="#f59e0b" delay={0.14}
                        />
                        <KpiCard
                            icon="📝" label="Exams Completed"
                            value={kpis.examsCompleted} suffix=""
                            color="#8b5cf6" delay={0.21}
                        />
                    </>
                )}
            </div>

            {/* ── Subject grid ── */}
            <div className="perf-section-header">
                <h2 className="perf-section-title">Subject Breakdown</h2>
                <input
                    className="perf-search"
                    placeholder="🔍 Filter subjects…"
                    value={filterTerm}
                    onChange={(e) => dispatch(setFilterTerm(e.target.value))}
                />
            </div>

            {loading ? (
                <div className="perf-subj-grid">
                    {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} height={148} />)}
                </div>
            ) : subjects.length === 0 ? (
                <div className="perf-empty">No subjects match "{filterTerm}"</div>
            ) : (
                <div className="perf-subj-grid">
                    {subjects.map((s, i) => (
                        <SubjectCard key={s.name} subject={s} index={i} onCardClick={handleCardClick} />
                    ))}
                </div>
            )}

            {/* ── Subject Detail Modal ── */}
            <SubjectDetailModal 
                subject={selectedSubject}
                isOpen={isModalOpen}
                onClose={handleCloseModal}
            />

            {/* ── Monthly trend chart ── */}
            {!loading && monthly.length > 0 && (
                <motion.div
                    className="perf-chart-card"
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2, duration: 0.45 }}
                >
                    <h2 className="perf-chart-title">Monthly Performance Trend</h2>
                    <ResponsiveContainer width="100%" height={260}>
                        <AreaChart data={monthly} margin={{ top: 8, right: 20, left: -6, bottom: 0 }}>
                            <defs>
                                <linearGradient id="perfGrad" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%"  stopColor="#4f6df5" stopOpacity={0.14} />
                                        <stop offset="95%" stopColor="#4f6df5" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#eef3fb" vertical={false} />
                            <XAxis dataKey="month" tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                            <YAxis domain={yDomain} tick={{ fontSize: 12, fill: '#94a3b8' }} axisLine={false} tickLine={false} unit="%" />
                            <Tooltip content={<ChartTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="avg"
                                stroke="#4f6df5"
                                strokeWidth={2.25}
                                fill="url(#perfGrad)"
                                dot={{ fill: '#4f6df5', r: 3.5, strokeWidth: 0 }}
                                activeDot={{ r: 6, strokeWidth: 0 }}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </motion.div>
            )}

        </div>
    );
};

export default Performance;
