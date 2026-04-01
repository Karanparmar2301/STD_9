import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchInsights, selectInsights, selectInsightsLoading } from '../store/insightsSlice';
import './AIInsightCard.css';

/* ─── Trend indicator ──────────────────────────────────────────────────────── */
function TrendBadge({ trend }) {
    const map = {
        up:     { icon: '📈', label: 'Improving',  cls: 'ai-trend--up'     },
        stable: { icon: '📊', label: 'Steady',     cls: 'ai-trend--stable' },
        down:   { icon: '📉', label: 'Needs focus', cls: 'ai-trend--down'   },
    };
    const { icon, label, cls } = map[trend] || map.stable;
    return <span className={`ai-trend-badge ${cls}`}>{icon} {label}</span>;
}

/* ─── Skeleton loader ──────────────────────────────────────────────────────── */
function InsightSkeleton() {
    return (
        <div className="ai-card ai-card--loading">
            <div className="ai-skeleton ai-sk-header" />
            <div className="ai-skeleton ai-sk-line" />
            <div className="ai-skeleton ai-sk-line ai-sk-short" />
            <div className="ai-skeleton ai-sk-line" />
        </div>
    );
}

/* ─── Main Component ────────────────────────────────────────────────────────── */
export default function AIInsightCard({ uid }) {
    const dispatch = useDispatch();
    const insights = useSelector(selectInsights);
    const loading  = useSelector(selectInsightsLoading);

    useEffect(() => {
        if (uid) dispatch(fetchInsights(uid));
    }, [uid, dispatch]);

    if (loading && !insights) return <InsightSkeleton />;

    if (!insights) return null;

    const {
        summary,
        weak_area,
        recommendation,
        motivation,
        trend,
        badge_hint,
        score,
    } = insights;

    const scoreColor =
        score >= 70  ? '#10b981' :
        score >= 45  ? '#f59e0b' :
                       '#ef4444';

    return (
        <motion.div
            className="ai-card"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0  }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
        >
            {/* Header */}
            <div className="ai-header">
                <div className="ai-header-left">
                    <motion.span
                        className="ai-brain-icon"
                        animate={{ rotate: [0, -8, 8, 0] }}
                        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
                    >🧠</motion.span>
                    <div>
                        <h3 className="ai-title">AI Performance Coach</h3>
                        <p className="ai-subtitle">Personalised insights for you</p>
                    </div>
                </div>

                <div className="ai-header-right">
                    {trend && <TrendBadge trend={trend} />}
                    <div className="ai-score-ring" style={{ '--score-color': scoreColor }}>
                        <span className="ai-score-num" style={{ color: scoreColor }}>
                            {Math.round(score ?? 0)}
                        </span>
                        <span className="ai-score-label">Score</span>
                    </div>
                </div>
            </div>

            {/* Summary */}
            <AnimatePresence mode="wait">
                <motion.p
                    key={summary}
                    className="ai-summary"
                    initial={{ opacity: 0, x: -12 }}
                    animate={{ opacity: 1, x: 0   }}
                    exit={{   opacity: 0              }}
                    transition={{ duration: 0.4 }}
                >
                    {summary}
                </motion.p>
            </AnimatePresence>

            {/* Rows */}
            <div className="ai-rows">
                {weak_area && (
                    <div className="ai-row ai-row--warn">
                        <span className="ai-row-icon">⚠️</span>
                        <div>
                            <p className="ai-row-label">Area to Improve</p>
                            <p className="ai-row-value">{weak_area}</p>
                        </div>
                    </div>
                )}

                <div className="ai-row ai-row--blue">
                    <span className="ai-row-icon">💡</span>
                    <div>
                        <p className="ai-row-label">Recommendation</p>
                        <p className="ai-row-value">{recommendation}</p>
                    </div>
                </div>

                <div className="ai-row ai-row--purple">
                    <span className="ai-row-icon">🔥</span>
                    <div>
                        <p className="ai-row-label">Motivation</p>
                        <p className="ai-row-value">{motivation}</p>
                    </div>
                </div>

                {badge_hint && (
                    <div className="ai-row ai-row--gold">
                        <span className="ai-row-icon">🏅</span>
                        <div>
                            <p className="ai-row-label">Next Badge</p>
                            <p className="ai-row-value">{badge_hint}</p>
                        </div>
                    </div>
                )}
            </div>

            {/* Refresh hint */}
            <p className="ai-refresh-hint">
                ✨ Insights update automatically after each activity
            </p>
        </motion.div>
    );
}
