import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { setActiveSection } from '../store/uiSlice';
import { logActivity } from '../store/activitySlice';
import { apiService, buildBackendFileUrl } from '../services/api';
import './SubjectPage.css';

async function downloadChapter(filePath, filename) {
    try {
        const token = localStorage.getItem('authToken');
        const url   = buildBackendFileUrl(filePath);
        const res   = await fetch(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (!res.ok) throw new Error('Download failed');
        const blob = await res.blob();
        const blobUrl = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href     = blobUrl;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(blobUrl);
    } catch {
        alert('Download failed. Please try again.');
    }
}

/* Subject metadata (color + label) by slug */
const META = {
    Std_8_math:     { label: 'Mathematics',          icon: '📐', color: '#2563EB', bg: '#EFF6FF' },
    Std_8_eng:      { label: 'English Literature',   icon: '📖', color: '#16A34A', bg: '#F0FDF4' },
    Std_8_hindi:    { label: 'Hindi',                icon: 'अ',  color: '#BE123C', bg: '#FFF1F2' },
    Std_8_science:  { label: 'Science',              icon: '🔬', color: '#0F766E', bg: '#F0FDFA' },
    Std_8_arts:     { label: 'Fine Arts',            icon: '🎨', color: '#7E22CE', bg: '#FAF5FF' },
    Std_8_social:   { label: 'Social Science',       icon: '🌍', color: '#C2410C', bg: '#FFF7ED' },
    Std_8_sanskrit: { label: 'Sanskrit',             icon: 'स',  color: '#9D174D', bg: '#FDF2F8' },
    Std_8_physed:   { label: 'Physical Education',   icon: '🏃', color: '#4D7C0F', bg: '#F7FEE7' },
    Std_8_voced:    { label: 'Vocational Education', icon: '🛠️', color: '#3730A3', bg: '#EEF2FF' },
};

/* ── Icons ── */
const SearchIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8"></circle>
        <line x1="21" y1="21" x2="16.65" y2="16.65"></line>
    </svg>
);

const BackIcon = () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 6}}>
        <line x1="19" y1="12" x2="5" y2="12"></line>
        <polyline points="12 19 5 12 12 5"></polyline>
    </svg>
);

const DownloadIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 4}}>
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
);

const ReadIcon = () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{marginRight: 4}}>
        <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"></path>
        <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"></path>
    </svg>
);

const DownloadFullIcon = () => (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
    </svg>
);

/* ── Chapter Card ── */
function ChapterCard({ item, subject, color, bg, index, isLastOpened }) {
    const navigate = useNavigate();
    const isIndex  = item.title.toLowerCase() === 'index';

    return (
        <motion.div
            className={`sp-chapter-card${item.completed ? ' sp-chapter-card--completed' : ''}${isLastOpened ? ' sp-chapter-card--last-opened' : ''}`}
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.92 }}
            transition={{ duration: 0.4, delay: index * 0.06, ease: [0.34, 1.56, 0.64, 1] }}
        >
            {/* Completion badge */}
            {item.completed && (
                <div className="sp-chapter-card__badge" title="Completed">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12"></polyline>
                    </svg>
                </div>
            )}

            {/* Continue reading indicator */}
            {isLastOpened && !item.completed && (
                <div className="sp-chapter-card__continue-badge" style={{ background: color }}>
                    Continue
                </div>
            )}

            <div className="sp-chapter-card__icon" style={{ background: bg }}>
                {isIndex ? (
                    <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
                        <rect x="4" y="2" width="20" height="26" rx="4" fill={color} opacity="0.15"/>
                        <rect x="4" y="2" width="20" height="26" rx="4" stroke={color} strokeWidth="2"/>
                        <line x1="9" y1="10" x2="19" y2="10" stroke={color} strokeWidth="2" strokeLinecap="round"/>
                        <line x1="9" y1="14" x2="19" y2="14" stroke={color} strokeWidth="2" strokeLinecap="round"/>
                        <line x1="9" y1="18" x2="15" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round"/>
                        <circle cx="24" cy="24" r="7" fill={color}/>
                        <line x1="21" y1="24" x2="27" y2="24" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                        <line x1="24" y1="21" x2="24" y2="27" stroke="white" strokeWidth="2" strokeLinecap="round"/>
                    </svg>
                ) : item.completed ? (
                    <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
                        <rect x="4" y="2" width="20" height="26" rx="4" fill="#16a34a" opacity="0.15"/>
                        <rect x="4" y="2" width="20" height="26" rx="4" stroke="#16a34a" strokeWidth="2"/>
                        <polyline points="8,16 12,20 20,11" stroke="#16a34a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
                    </svg>
                ) : (
                    <svg width="40" height="40" viewBox="0 0 32 32" fill="none">
                        <rect x="4" y="2" width="20" height="26" rx="4" fill={color} opacity="0.1"/>
                        <rect x="4" y="2" width="20" height="26" rx="4" stroke={color} strokeWidth="2" opacity="0.6"/>
                        <line x1="9" y1="10" x2="19" y2="10" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
                        <line x1="9" y1="14" x2="19" y2="14" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
                        <line x1="9" y1="18" x2="15" y2="18" stroke={color} strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
                    </svg>
                )}
            </div>
            <div className="sp-chapter-card__body">
                <h3 className="sp-chapter-card__title">{item.title}</h3>
                <p className="sp-chapter-card__sub">
                    {item.completed ? 'Completed' : 'PDF Document'}
                </p>
            </div>
            <div className="sp-chapter-card__actions">
                <motion.button
                    className="sp-btn sp-btn--read"
                    style={{ background: color }}
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                    onClick={() => navigate(`/books/${subject}/chapter/${item.id}`, {
                        state: { file: item.file, title: item.title }
                    })}
                >
                    <ReadIcon />
                    {item.completed ? 'Review' : isLastOpened ? 'Continue' : 'Read'}
                </motion.button>
                <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.95 }}
                    className="sp-btn sp-btn--dl"
                    onClick={() => downloadChapter(item.file, item.filename)}
                    aria-label={`Download ${item.title}`}
                >
                    <DownloadIcon />
                    Download
                </motion.button>
            </div>
        </motion.div>
    );
}

/* ── Progress Ring (small) ── */
function MiniProgressRing({ pct, color, size = 68 }) {
    const r = (size - 12) / 2;
    const circ = 2 * Math.PI * r;
    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
            <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(226, 232, 240, 0.6)" strokeWidth="6" />
            <motion.circle
                cx={size/2} cy={size/2} r={r}
                fill="none" stroke={color} strokeWidth="6"
                strokeLinecap="round"
                strokeDasharray={circ}
                initial={{ strokeDashoffset: circ }}
                animate={{ strokeDashoffset: circ - (circ * pct) / 100 }}
                transition={{ duration: 1.2, ease: [0.34, 1.56, 0.64, 1] }}
                transform={`rotate(-90 ${size/2} ${size/2})`}
            />
            <text x={size/2} y={size/2 + 5} textAnchor="middle" className="progress-ring-text">
                {pct}%
            </text>
        </svg>
    );
}

export default function SubjectPage() {
    const { subject } = useParams();
    const navigate    = useNavigate();
    const dispatch    = useDispatch();
    const meta        = META[subject] || { label: subject, icon: '📚', color: '#6366f1', bg: '#EEF2FF' };
    const user        = useSelector((state) => state.auth.user);

    const goToBooks = () => {
        dispatch(setActiveSection('books'));
        navigate(`/dashboard/${user?.uid}`);
    };

    const [chapters, setChapters] = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState(null);
    const [search,   setSearch]   = useState('');

    // ZIP download state
    const [dlState, setDlState] = useState({
        status: 'idle',   // 'idle' | 'building' | 'downloading'
        sizeMB: null,
        cached: null,
    });

    // Pre-fetch ZIP info so size shows on button before click.
    // Mounted guard prevents React StrictMode double-invocation from flooding requests.
    useEffect(() => {
        let mounted = true;
        apiService.getZipInfo(subject)
            .then(({ data }) => {
                if (mounted) setDlState(prev => ({ ...prev, sizeMB: data.size_mb, cached: data.cached }));
            })
            .catch(() => {});
        return () => { mounted = false; };
    }, [subject]);

    const fetchChapters = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const { data } = await apiService.getSubjectChapters(subject);
            setChapters(Array.isArray(data) ? data : []);
        } catch (e) {
            const status = e.response?.status;
            const detail = e.response?.data?.detail || '';
            // Treat 404 / "not found" as simply no PDFs uploaded yet
            if (status === 404 || detail.toLowerCase().includes('not found')) {
                setChapters([]);
            } else {
                setError(detail || 'Could not load chapters');
            }
        } finally {
            setLoading(false);
        }
    }, [subject]);

    useEffect(() => { fetchChapters(); }, [fetchChapters]);

    /* ── Log book opening activity ── */
    useEffect(() => {
        if (user?.uid && !loading && chapters.length > 0) {
            dispatch(logActivity({
                user_id: user.uid,
                event_type: 'BOOK_OPENED',
                title: `Opened ${meta.label}`,
                description: `Browsing ${meta.label} chapters`,
                subject: meta.label,
                metadata: {
                    subject_slug: subject,
                    chapter_count: chapters.length
                }
            }));
        }
    }, [user, dispatch, meta.label, subject, chapters.length, loading]);

    /* ── Computed ── */
    // Index/Intro/Annexure/Warm-up are reference material — excluded from chapter count and progress
    const chapterItems   = useMemo(() => chapters.filter(c => !c.is_index), [chapters]);
    const completedCount = useMemo(() => chapterItems.filter(c => c.completed).length, [chapterItems]);
    const totalCount     = chapterItems.length;
    const progressPct    = totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;

    const filtered = useMemo(() => {
        if (!search.trim()) return chapters;
        const q = search.toLowerCase();
        return chapters.filter(c => c.title.toLowerCase().includes(q));
    }, [chapters, search]);

    const handleDownloadAll = async () => {
        if (dlState.status !== 'idle') return;  // Prevent double-click
        try {
            // Use pre-fetched dlState — no extra getZipInfo call needed
            const isCached = dlState.cached;
            setDlState(prev => ({ ...prev, status: isCached ? 'downloading' : 'building' }));

            // Download — backend builds ZIP on first call, serves cache on subsequent calls
            const resp = await apiService.downloadAllPdfs(subject);

            // Refresh info once after download to show updated 'Cached' badge
            apiService.getZipInfo(subject)
                .then(({ data }) => setDlState({ status: 'idle', sizeMB: data.size_mb, cached: true }))
                .catch(() => setDlState(prev => ({ ...prev, status: 'idle' })));

            const url  = URL.createObjectURL(resp.data);
            const link = document.createElement('a');
            const niceName = (meta.label || subject).replace(/\s+/g, '_');
            link.href     = url;
            link.download = `${niceName}_Full.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch {
            setDlState(prev => ({ ...prev, status: 'idle' }));
            alert('Download failed. Please try again.');
        }
    };

    return (
        <div className="sp-page" style={{ '--accent': meta.color, '--accent-bg': meta.bg }}>

            {/* ── Top bar ── */}
            <div className="sp-topbar">
                <button className="sp-back-btn" onClick={goToBooks} aria-label="Go back to My Books">
                    <BackIcon />
                    Back
                </button>
            </div>

            {/* ── Header ── */}
            <motion.div
                className="sp-header"
                initial={{ opacity: 0, scale: 0.98, y: -10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}
            >
                <div className="sp-header__icon" style={{ color: meta.color }}>
                    {meta.icon}
                </div>
                <div className="sp-header__body">
                    <h1 className="sp-header__title">{meta.label}</h1>
                    <p className="sp-header__sub">
                        {loading ? 'Loading…' : `${totalCount} Chapter${totalCount !== 1 ? 's' : ''} · Digital Edition`}
                    </p>
                    {!loading && totalCount > 0 && (
                        <div className="sp-header__progress">
                            <div className="sp-header__progress-bar">
                                <motion.div
                                    className="sp-header__progress-fill"
                                    initial={{ width: 0 }}
                                    animate={{ width: `${progressPct}%` }}
                                    transition={{ duration: 1.2, ease: [0.34, 1.56, 0.64, 1], delay: 0.2 }}
                                />
                            </div>
                            <span className="sp-header__progress-text">
                                {completedCount}/{totalCount} chapter{totalCount !== 1 ? 's' : ''} completed
                            </span>
                        </div>
                    )}
                </div>

                {!loading && totalCount > 0 && (
                    <motion.div initial={{ opacity: 0, scale: 0.5 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.3, duration: 0.6, ease: [0.34, 1.56, 0.64, 1] }}>
                        <MiniProgressRing pct={progressPct} color={meta.color} />
                    </motion.div>
                )}

                <motion.button
                    className={`sp-dl-all-btn${dlState.status !== 'idle' ? ' sp-dl-all-btn--busy' : ''}`}
                    style={{ background: dlState.status !== 'idle' ? '#94a3b8' : meta.color }}
                    whileHover={dlState.status === 'idle' ? { scale: 1.02 } : {}}
                    whileTap={dlState.status === 'idle' ? { scale: 0.97 } : {}}
                    onClick={handleDownloadAll}
                    disabled={dlState.status !== 'idle'}
                    title={dlState.sizeMB ? `File size: ~${dlState.sizeMB} MB` : undefined}
                >
                    {dlState.status === 'idle' && (
                        <>
                            <DownloadFullIcon />
                            Download Full Book
                            {dlState.sizeMB != null && (
                                <span className="sp-dl-all-btn__size"> {dlState.sizeMB} MB</span>
                            )}
                            {dlState.cached === true && (
                                <span className="sp-dl-all-btn__badge sp-dl-all-btn__badge--cached">Cached</span>
                            )}
                        </>
                    )}
                    {dlState.status === 'building' && (
                        <><span className="sp-dl-spinner" /> Building ZIP…</>
                    )}
                    {dlState.status === 'downloading' && (
                        <><span className="sp-dl-spinner" /> Downloading…</>
                    )}
                </motion.button>
            </motion.div>

            {/* ── Search bar ── */}
            {!loading && totalCount > 3 && (
                <motion.div 
                    className="sp-search-bar"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.5, delay: 0.4 }}
                >
                    <span className="sp-search-icon"><SearchIcon /></span>
                    <input
                        className="sp-search-input"
                        placeholder="Search chapters..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                    />
                    <AnimatePresence>
                        {search && (
                            <motion.button 
                                initial={{ opacity: 0, scale: 0.5 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.5 }}
                                className="sp-search-clear" 
                                onClick={() => setSearch('')}
                            >
                                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                    <line x1="18" y1="6" x2="6" y2="18"></line>
                                    <line x1="6" y1="6" x2="18" y2="18"></line>
                                </svg>
                            </motion.button>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}

            {/* ── Body ── */}
            {loading && (
                <div className="sp-state">
                    <div className="sp-spinner"></div>
                    <p>Loading chapters…</p>
                </div>
            )}

            {!loading && error && (
                <motion.div className="sp-state sp-state--error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="10"></circle>
                        <line x1="12" y1="8" x2="12" y2="12"></line>
                        <line x1="12" y1="16" x2="12.01" y2="16"></line>
                    </svg>
                    <p>{error}</p>
                    <button className="sp-retry-btn" onClick={fetchChapters}>Try Again</button>
                </motion.div>
            )}

            {!loading && !error && chapters.length === 0 && (
                <motion.div className="sp-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <span style={{ fontSize: '3.5rem' }}>📭</span>
                    <p>No PDFs uploaded yet for <strong>{meta.label}</strong>.</p>
                    <p className="sp-state__hint">
                        Place PDF files inside:<br />
                        <code>backend/uploads/{subject}/</code>
                    </p>
                </motion.div>
            )}

            {!loading && !error && filtered.length === 0 && chapters.length > 0 && (
                <motion.div className="sp-state" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                    <SearchIcon style={{ width: 48, height: 48, strokeWidth: 1.5, opacity: 0.6 }} />
                    <p>No chapters found matching "<strong>{search}</strong>"</p>
                </motion.div>
            )}

            {!loading && !error && filtered.length > 0 && (
                <motion.div className="sp-grid" layout>
                    <AnimatePresence>
                        {filtered.map((ch, i) => (
                            <ChapterCard
                                key={ch.id}
                                item={ch}
                                subject={subject}
                                color={meta.color}
                                bg={meta.bg}
                                index={i}
                                isLastOpened={ch.isLastOpened}
                            />
                        ))}
                    </AnimatePresence>
                </motion.div>
            )}
        </div>
    );
}
