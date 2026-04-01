import React, { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
    LineChart, Line,
    BarChart, Bar,
    PieChart, Pie, Cell,
    AreaChart, Area,
    XAxis, YAxis, CartesianGrid, Tooltip,
    ResponsiveContainer, Legend,
} from 'recharts';
import { motion } from 'framer-motion';
import { fetchAnalytics, selectAnalytics, selectAnalyticsLoading } from '../store/insightsSlice';
import './AnalyticsDashboard.css';

/* ─── Colour palette ──────────────────────────────────────────────────────── */
const COLORS = {
    primary:    '#6366f1',
    secondary:  '#8b5cf6',
    pink:       '#ec4899',
    green:      '#10b981',
    amber:      '#f59e0b',
    blue:       '#60a5fa',
    red:        '#f87171',
};

const PIE_COLORS = [COLORS.primary, COLORS.pink, COLORS.green, COLORS.amber, COLORS.blue];

/* ─── Custom tooltip ──────────────────────────────────────────────────────── */
function CustomTooltip({ active, payload, label }) {
    if (!active || !payload?.length) return null;
    return (
        <div className="an-tooltip">
            {label && <p className="an-tooltip-label">{label}</p>}
            {payload.map((entry, i) => (
                <p key={i} className="an-tooltip-row" style={{ color: entry.color }}>
                    <strong>{entry.name ?? entry.dataKey}:</strong> {entry.value}
                </p>
            ))}
        </div>
    );
}

/* ─── Demo data fallback ──────────────────────────────────────────────────── */
function buildDemoTimeline() {
    const today = new Date();
    const result = [];
    let cum = 0;
    for (let i = 13; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(d.getDate() - i);
        const daily = i % 3 === 0 ? 0 : 5 + Math.floor(Math.random() * 15);
        cum += daily;
        result.push({
            date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
            xp: cum,
            daily_xp: daily,
        });
    }
    return result;
}

const DEMO_TIMELINE = buildDemoTimeline();
const DEMO_SOURCES = [
    { source: 'Homework', xp: 45 },
    { source: 'Games',    xp: 70 },
    { source: 'Attendance', xp: 30 },
];
const DEMO_WEEKLY = [
    { week: 'Week 1', xp: 20 },
    { week: 'Week 2', xp: 45 },
    { week: 'Week 3', xp: 38 },
    { week: 'Week 4', xp: 62 },
];
const DEMO_PIE = [
    { name: 'Math',        value: 82 },
    { name: 'English',     value: 65 },
    { name: 'Science',     value: 74 },
    { name: 'Arts',        value: 88 },
];

/* ─── Chart card wrapper ──────────────────────────────────────────────────── */
function ChartCard({ title, icon, children }) {
    return (
        <motion.div
            className="an-chart-card"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0  }}
            transition={{ duration: 0.45 }}
        >
            <div className="an-chart-header">
                <span className="an-chart-icon">{icon}</span>
                <h3 className="an-chart-title">{title}</h3>
            </div>
            <div className="an-chart-body">
                {children}
            </div>
        </motion.div>
    );
}

/* ─── Main Component ───────────────────────────────────────────────────────── */
export default function AnalyticsDashboard({ uid }) {
    const dispatch = useDispatch();
    const analytics = useSelector(selectAnalytics);
    const loading   = useSelector(selectAnalyticsLoading);

    useEffect(() => {
        if (uid) dispatch(fetchAnalytics(uid));
    }, [uid, dispatch]);

    // Use real data if available, else demo data
    const xpTimeline = useMemo(() => {
        const raw = analytics?.xp_timeline ?? [];
        if (!raw.length) return DEMO_TIMELINE;
        return raw.map(r => ({
            date: r.date?.slice(5) ?? r.date,
            xp: r.xp,
            daily_xp: r.daily_xp,
        }));
    }, [analytics]);

    const sourceData = useMemo(() => {
        const raw = analytics?.source_breakdown ?? [];
        if (!raw.length) return DEMO_SOURCES;
        return raw.map(r => ({
            source: r.source.charAt(0).toUpperCase() + r.source.slice(1),
            xp: r.xp,
        }));
    }, [analytics]);

    const weeklyData = useMemo(() => {
        const raw = analytics?.weekly_progress ?? [];
        if (!raw.length) return DEMO_WEEKLY;
        return raw.map(r => ({ week: r.week.replace(/^\d{4}-/, ''), xp: r.xp }));
    }, [analytics]);

    const pieData = useMemo(() => {
        const scores = analytics?.subject_scores ?? {};
        const keys = Object.keys(scores);
        if (!keys.length) return DEMO_PIE;
        return keys.map(k => ({ name: k, value: Math.round(scores[k]) }));
    }, [analytics]);

    const stats = analytics?.current_stats ?? {};

    return (
        <div className="an-root">
            <h2 className="an-section-title">
                Performance Analytics
                {loading && <span className="an-loading-dot" />}
            </h2>

            {/* ── KPI summary row ── */}
            <div className="an-kpi-row">
                {[
                    { icon: '⚡', label: 'Total XP',    value: stats.total_xp ?? '—' },
                    { icon: '🏆', label: 'Level',        value: stats.level ?? '—'    },
                    { icon: '🔥', label: 'Streak',       value: stats.streak != null ? `${stats.streak}d` : '—' },
                    { icon: '📚', label: 'Homework Rate', value: stats.homework_rate != null ? `${stats.homework_rate}%` : '—' },
                    { icon: '🎮', label: 'Games Played', value: stats.games_played ?? '—' },
                    { icon: '🏅', label: 'Badges',       value: stats.badges_count ?? '—' },
                ].map((kpi) => (
                    <div key={kpi.label} className="an-kpi">
                        <span className="an-kpi-icon">{kpi.icon}</span>
                        <p className="an-kpi-val">{kpi.value}</p>
                        <p className="an-kpi-lbl">{kpi.label}</p>
                    </div>
                ))}
            </div>

            {/* ── Charts grid ── */}
            <div className="an-grid">

                {/* 1. XP Growth Line Chart */}
                <ChartCard title="XP Growth Over Time" icon="📈">
                    <ResponsiveContainer width="100%" height={220}>
                        <LineChart data={xpTimeline}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Line
                                type="monotone"
                                dataKey="xp"
                                name="Total XP"
                                stroke={COLORS.primary}
                                strokeWidth={2.5}
                                dot={false}
                                activeDot={{ r: 5 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </ChartCard>

                {/* 2. Source Breakdown Bar Chart */}
                <ChartCard title="XP by Activity" icon="📊">
                    <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={sourceData} barSize={36}>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="source" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Bar dataKey="xp" name="XP Earned" radius={[6, 6, 0, 0]}>
                                {sourceData.map((_, i) => (
                                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                ))}
                            </Bar>
                        </BarChart>
                    </ResponsiveContainer>
                </ChartCard>

                {/* 3. Subject Performance Pie Chart */}
                <ChartCard title="Subject Performance" icon="🎯">
                    <ResponsiveContainer width="100%" height={220}>
                        <PieChart>
                            <Pie
                                data={pieData}
                                cx="50%"
                                cy="50%"
                                innerRadius={50}
                                outerRadius={85}
                                paddingAngle={3}
                                dataKey="value"
                            >
                                {pieData.map((_, i) => (
                                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                                ))}
                            </Pie>
                            <Tooltip
                                formatter={(value, name) => [`${value}%`, name]}
                            />
                            <Legend
                                formatter={(value) => (
                                    <span style={{ fontSize: 12, color: '#374151' }}>{value}</span>
                                )}
                            />
                        </PieChart>
                    </ResponsiveContainer>
                </ChartCard>

                {/* 4. Weekly Progress Area Chart */}
                <ChartCard title="Weekly Progress" icon="🗓️">
                    <ResponsiveContainer width="100%" height={220}>
                        <AreaChart data={weeklyData}>
                            <defs>
                                <linearGradient id="an-grad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%"  stopColor={COLORS.secondary} stopOpacity={0.3} />
                                    <stop offset="95%" stopColor={COLORS.secondary} stopOpacity={0}   />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                            <XAxis dataKey="week" tick={{ fontSize: 11 }} />
                            <YAxis tick={{ fontSize: 11 }} />
                            <Tooltip content={<CustomTooltip />} />
                            <Area
                                type="monotone"
                                dataKey="xp"
                                name="Weekly XP"
                                stroke={COLORS.secondary}
                                strokeWidth={2.5}
                                fill="url(#an-grad)"
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                </ChartCard>

            </div>

            <p className="an-demo-note">
                {analytics?.xp_timeline?.length
                    ? '✅ Showing real activity data'
                    : '💡 Charts show sample data. Real data appears as you complete activities.'}
            </p>
        </div>
    );
}
