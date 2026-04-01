/**
 * PDFViewer.jsx — Interactive Flipbook PDF Reader
 * ─────────────────────────────────────────────────
 * Premium EdTech-level flipbook reader for NCERT books.
 * Uses react-pageflip + pdfjs for a realistic page-flipping experience.
 */
import React, { useState, useRef, useEffect, useCallback, useMemo, forwardRef, memo } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import * as pdfjsLib from 'pdfjs-dist';
import HTMLFlipBook from 'react-pageflip';
import { apiService } from '../services/api';
import { logActivity } from '../store/activitySlice';
import './PDFViewer.css';

/* ── PDF.js worker setup — use bundled worker via URL import ── */
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

/* ── Subject metadata ── */
const META = {
    Std_8_math:     { label: 'Mathematics',          color: '#2563EB', bg: '#EFF6FF', icon: '📐' },
    Std_8_eng:      { label: 'English Literature',   color: '#16A34A', bg: '#F0FDF4', icon: '📖' },
    Std_8_hindi:    { label: 'Hindi',                color: '#BE123C', bg: '#FFF1F2', icon: 'अ' },
    Std_8_science:  { label: 'Science',              color: '#0F766E', bg: '#F0FDFA', icon: '🔬' },
    Std_8_arts:     { label: 'Fine Arts',            color: '#7E22CE', bg: '#FAF5FF', icon: '🎨' },
    Std_8_social:   { label: 'Social Science',       color: '#C2410C', bg: '#FFF7ED', icon: '🌍' },
    Std_8_sanskrit: { label: 'Sanskrit',             color: '#9D174D', bg: '#FDF2F8', icon: 'स' },
    Std_8_physed:   { label: 'Physical Education',   color: '#4D7C0F', bg: '#F7FEE7', icon: '🏃' },
    Std_8_voced:    { label: 'Vocational Education', color: '#3730A3', bg: '#EEF2FF', icon: '🛠️' },
};

/* ── Constants ── */
const TOOLBAR_H = 56;
const PRELOAD_BUFFER = 3;
const MAX_CACHED = 20;


/* ─────────────────────────────────────────────────
   Mobile Detection Hook
   ───────────────────────────────────────────────── */
function useIsMobile() {
    const [m, setM] = useState(window.innerWidth < 768);
    useEffect(() => {
        const h = () => setM(window.innerWidth < 768);
        window.addEventListener('resize', h);
        return () => window.removeEventListener('resize', h);
    }, []);
    return m;
}

/* ─────────────────────────────────────────────────
   PDF Page Renderer (canvas → dataURL)
   ───────────────────────────────────────────────── */
async function renderPdfPage(pdfDoc, pageNum, scale = 1.5) {
    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    await page.render({ canvasContext: ctx, viewport }).promise;
    const image = canvas.toDataURL('image/jpeg', 0.82);
    page.cleanup();
    return image;
}

/* ─────────────────────────────────────────────────
   FlipPage Component (forwardRef for react-pageflip)
   ───────────────────────────────────────────────── */
const FlipPage = memo(forwardRef(({ pageNum, imageUrl, isLoading, accentColor }, ref) => (
    <div
        ref={ref}
        style={{
            width: '100%',
            height: '100%',
            background: '#FFFEF7',
            display: 'flex',
            flexDirection: 'column',
            overflow: 'hidden',
            position: 'relative',
            boxShadow: 'inset 0 0 60px rgba(0,0,0,0.03), inset -3px 0 10px rgba(0,0,0,0.02)',
            backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 28px, rgba(0,0,0,0.008) 28px, rgba(0,0,0,0.008) 29px)',
        }}
    >
        <div style={{ flex: 1, display: 'flex', alignItems: 'stretch', justifyContent: 'stretch', overflow: 'hidden' }}>
            {imageUrl ? (
                <img
                    src={imageUrl}
                    alt={`Page ${pageNum}`}
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                    style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'fill',
                        borderRadius: 2,
                    }}
                />
            ) : isLoading ? (
                <div style={{ width: '100%', height: '100%', padding: 20, display: 'flex', flexDirection: 'column', gap: 10, justifyContent: 'center' }}>
                    {[0.7, 1, 0.85, 0.6, 0.9, 0.5, 0.75].map((w, i) => (
                        <div
                            key={i}
                            style={{
                                height: i === 0 ? 100 : 14,
                                width: `${w * 100}%`,
                                borderRadius: i === 0 ? 12 : 8,
                                background: 'linear-gradient(90deg, #f0f3ff 25%, #e6e9ff 37%, #f0f3ff 63%)',
                                backgroundSize: '400% 100%',
                                animation: 'flipShimmer 1.4s infinite',
                            }}
                        />
                    ))}
                    <style>{`@keyframes flipShimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }`}</style>
                    <p style={{ fontSize: 11, color: '#A5B4FC', marginTop: 8, fontWeight: 600, textAlign: 'center' }}>
                        Loading page {pageNum}…
                    </p>
                </div>
            ) : (
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%' }}>
                    <span style={{ fontSize: 36, opacity: 0.15 }}>📄</span>
                </div>
            )}
        </div>

        {/* Page number footer */}
        <div style={{
            padding: '5px 14px',
            display: 'flex',
            justifyContent: pageNum % 2 === 0 ? 'flex-start' : 'flex-end',
            alignItems: 'center',
            borderTop: '1px solid rgba(0,0,0,0.04)',
            flexShrink: 0,
        }}>
            <span style={{
                fontSize: 10, fontWeight: 700, color: accentColor || '#A5B4FC',
                fontVariantNumeric: 'tabular-nums', opacity: 0.7,
            }}>
                {pageNum}
            </span>
        </div>

        {/* Paper edge shadow */}
        <div style={{
            position: 'absolute', top: 0,
            [pageNum % 2 === 1 ? 'right' : 'left']: 0,
            bottom: 0, width: 3, pointerEvents: 'none',
            background: pageNum % 2 === 1
                ? 'linear-gradient(to left, rgba(0,0,0,0.05), transparent)'
                : 'linear-gradient(to right, rgba(0,0,0,0.05), transparent)',
        }} />
    </div>
)));
FlipPage.displayName = 'FlipPage';

/* ─────────────────────────────────────────────────
   MAIN: PDFViewer with Flipbook
   ───────────────────────────────────────────────── */
export default function PDFViewer() {
    const { subject, chapterId } = useParams();
    const navigate   = useNavigate();
    const dispatch   = useDispatch();
    const location   = useLocation();
    const meta       = META[subject] || { label: subject, color: '#6366f1', bg: '#EEF2FF', icon: '📚' };
    const user       = useSelector((state) => state.auth.user);
    const isMobile   = useIsMobile();

    /* ── State ── */
    const [pdfUrl,   setPdfUrl]   = useState(null);
    const [pdfTitle, setPdfTitle] = useState('');
    const [chapters, setChapters] = useState([]);
    const [loading,  setLoading]  = useState(true);
    const [error,    setError]    = useState(null);

    /* ── PDF / Flipbook state ── */
    const [pdfDoc, setPdfDoc]     = useState(null);
    const [numPages, setNumPages] = useState(0);
    const [currentPage, setCurrentPage] = useState(0); // flip index (0-based)
    const [pageCache, setPageCache] = useState({});
    const [pdfPageRatio, setPdfPageRatio] = useState(1.414);
    const [pdfLoading, setPdfLoading] = useState(true);
    const [pdfError, setPdfError] = useState(false);
    const loadingRef = useRef(new Set());

    /* ── UI state ── */
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [zoom, setZoom] = useState(1.0);
    const [completed, setCompleted] = useState(false);
    const [showSidebar, setShowSidebar] = useState(false);

    /* ── Refs ── */
    const bookRef  = useRef(null);
    const shellRef = useRef(null);
    const startTimeRef = useRef(Date.now());
    const progressSent = useRef(false);

    /* ── Display page (1-based) ── */
    const displayPage = useMemo(() => {
        const p = currentPage + 1;
        return p < 1 ? 1 : p > numPages ? numPages : p;
    }, [currentPage, numPages]);

    const progressPercent = numPages > 1 ? Math.round((displayPage / numPages) * 100) : 0;

    /* ── Flipbook dimensions ── */
    const dimensions = useMemo(() => {
        const maxW = window.innerWidth;
        const maxH = window.innerHeight - TOOLBAR_H - 50;
        if (isMobile) {
            const w = Math.min(maxW - 16, 560);
            let h = w * pdfPageRatio;
            if (h > maxH) {
                h = maxH;
                return { width: Math.floor(h / pdfPageRatio), height: Math.floor(h) };
            }
            return { width: w, height: Math.floor(h) };
        }
        const pageW = Math.min((maxW - 60) / 2, 680);
        let pageH = pageW * pdfPageRatio;
        if (pageH > maxH - 10) {
            pageH = maxH - 10;
            return { width: Math.floor(pageH / pdfPageRatio), height: Math.floor(pageH) };
        }
        return { width: Math.floor(pageW), height: Math.floor(pageH) };
    }, [isMobile, isFullscreen, pdfPageRatio]);

    /* ─── Resolve PDF URL ─── */
    const resolve = useCallback(async () => {
        setLoading(true);
        setError(null);
        startTimeRef.current = Date.now();
        progressSent.current = false;
        try {
            const { data } = await apiService.getSubjectChapters(subject);
            setChapters(data);
            if (location.state?.file) {
                setPdfUrl(location.state.file);
                setPdfTitle(location.state.title || `Chapter ${chapterId}`);
                setLoading(false);
                return;
            }
            const chapter = data.find(c => String(c.id) === String(chapterId));
            if (chapter) {
                setPdfUrl(chapter.file);
                setPdfTitle(chapter.title);
            } else {
                setError('Chapter not found in this subject.');
            }
        } catch (e) {
            setError(e.response?.data?.detail || 'Could not load chapter data.');
        } finally {
            setLoading(false);
        }
    }, [subject, chapterId, location.state]);

    useEffect(() => { resolve(); }, [resolve]);

    /* ─── Load PDF document ─── */
    useEffect(() => {
        if (!pdfUrl) return;
        let cancelled = false;
        setPdfLoading(true);
        setPdfError(false);
        setPageCache({});
        setCurrentPage(0);
        loadingRef.current.clear();

        const load = async () => {
            try {
                // Fetch PDF binary through Vite proxy (relative URL) with auth headers
                const token = localStorage.getItem('authToken');
                const fetchHeaders = {};
                if (token) fetchHeaders['Authorization'] = `Bearer ${token}`;
                const resp = await fetch(pdfUrl, { headers: fetchHeaders });
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                const arrayBuffer = await resp.arrayBuffer();
                if (cancelled) return;

                // Pass as Uint8Array to pdfjs-dist
                const data = new Uint8Array(arrayBuffer);
                const doc = await pdfjsLib.getDocument({ data, useWorkerFetch: false, isEvalSupported: false, useSystemFonts: true }).promise;
                if (cancelled) return;
                try {
                    const p1 = await doc.getPage(1);
                    const vp = p1.getViewport({ scale: 1 });
                    setPdfPageRatio(vp.height / vp.width);
                    p1.cleanup();
                } catch {}
                setPdfDoc(doc);
                setNumPages(doc.numPages);
                setPdfLoading(false);
            } catch (err) {
                console.error('[FlipbookReader] PDF load error:', err?.message || err);
                if (!cancelled) { setPdfError(true); setPdfLoading(false); }
            }
        };
        load();
        return () => { cancelled = true; };
    }, [pdfUrl]);

    /* ─── Render pages ─── */
    const renderPage = useCallback(async (pageNum) => {
        if (!pdfDoc || pageNum < 1 || pageNum > numPages) return;
        if (pageCache[pageNum] || loadingRef.current.has(pageNum)) return;
        loadingRef.current.add(pageNum);
        try {
            const image = await renderPdfPage(pdfDoc, pageNum, isMobile ? 1.0 : 1.3);
            setPageCache(p => ({ ...p, [pageNum]: image }));
        } catch (err) {
            console.warn(`Failed to render page ${pageNum}:`, err);
        } finally {
            loadingRef.current.delete(pageNum);
        }
    }, [pdfDoc, numPages, pageCache, isMobile]);

    /* ── Cache eviction ── */
    useEffect(() => {
        const keys = Object.keys(pageCache).map(Number);
        if (keys.length <= MAX_CACHED) return;
        const center = currentPage + 1;
        const sorted = keys.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
        const toEvict = sorted.slice(MAX_CACHED);
        if (toEvict.length > 0) {
            setPageCache(prev => {
                const next = { ...prev };
                toEvict.forEach(k => delete next[k]);
                return next;
            });
        }
    }, [currentPage, pageCache]);

    /* ── Preload pages ── */
    useEffect(() => {
        if (!pdfDoc || numPages === 0) return;
        const pages = [];
        for (let i = 0; i <= PRELOAD_BUFFER + 2; i++) {
            const p = displayPage + i;
            if (p >= 1 && p <= numPages && !pages.includes(p)) pages.push(p);
        }
        for (let i = 1; i <= PRELOAD_BUFFER; i++) {
            const p = displayPage - i;
            if (p >= 1 && !pages.includes(p)) pages.push(p);
        }
        for (let i = 1; i <= Math.min(2, numPages); i++) {
            if (!pages.includes(i)) pages.push(i);
        }
        const [first, ...rest] = pages;
        if (first) renderPage(first);
        rest.forEach((p, idx) => setTimeout(() => renderPage(p), (idx + 1) * 60));
    }, [pdfDoc, numPages, displayPage, renderPage]);

    /* ── Cleanup ── */
    useEffect(() => {
        return () => {
            if (pdfDoc) try { pdfDoc.destroy(); } catch {}
            setPageCache({});
            loadingRef.current.clear();
        };
    }, [pdfDoc]);

    /* ── Flip callbacks ── */
    const onFlip = useCallback((e) => { setCurrentPage(e.data); }, []);
    const flipNext = useCallback(() => { bookRef.current?.pageFlip()?.flipNext(); }, []);
    const flipPrev = useCallback(() => { bookRef.current?.pageFlip()?.flipPrev(); }, []);

    /* ── Jump to page ── */
    const [jumpEditing, setJumpEditing] = useState(false);
    const [jumpValue, setJumpValue] = useState('');
    const jumpToPage = useCallback((page) => {
        if (!bookRef.current || page < 1 || page > numPages) return;
        bookRef.current.pageFlip().flip(page - 1);
        setCurrentPage(page - 1);
    }, [numPages]);

    /* ── Fullscreen ── */
    const toggleFullscreen = useCallback(() => {
        if (!document.fullscreenElement) {
            shellRef.current?.requestFullscreen?.();
            setIsFullscreen(true);
        } else {
            document.exitFullscreen?.();
            setIsFullscreen(false);
        }
    }, []);

    useEffect(() => {
        const h = () => setIsFullscreen(!!document.fullscreenElement);
        document.addEventListener('fullscreenchange', h);
        return () => document.removeEventListener('fullscreenchange', h);
    }, []);

    /* ── Keyboard shortcuts ── */
    useEffect(() => {
        const handler = (e) => {
            if (e.key === 'Escape') {
                if (document.fullscreenElement) { document.exitFullscreen(); return; }
                navigate(`/books/${subject}`);
                return;
            }
            if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); flipNext(); }
            if (e.key === 'ArrowLeft') { e.preventDefault(); flipPrev(); }
        };
        window.addEventListener('keydown', handler);
        return () => window.removeEventListener('keydown', handler);
    }, [navigate, subject, flipNext, flipPrev]);

    /* ── Log activity ── */
    useEffect(() => {
        if (pdfUrl && pdfTitle && user?.uid && !loading) {
            dispatch(logActivity({
                user_id: user.uid,
                event_type: 'PDF_VIEWED',
                title: `Reading: ${pdfTitle}`,
                description: `Opened ${pdfTitle} from ${meta.label}`,
                subject: meta.label,
                metadata: { chapter_id: chapterId, subject_slug: subject, pdf_url: pdfUrl }
            }));
        }
    }, [pdfUrl, pdfTitle, user, dispatch, chapterId, subject, meta.label, loading]);

    /* ── Reading progress ── */
    const sendProgress = useCallback(async (action = 'read', scrollPct = 0) => {
        if (!user?.uid || progressSent.current) return;
        const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
        const shouldComplete = action === 'complete' || elapsed >= 120 || scrollPct >= 70;
        if (shouldComplete) progressSent.current = true;
        try {
            const { data } = await apiService.updateBookProgress(user.uid, subject, {
                chapter_id: parseInt(chapterId),
                action: shouldComplete ? 'complete' : 'read',
                time_spent: elapsed,
                scroll_pct: scrollPct,
            });
            if (data.newlyCompleted) setCompleted(true);
        } catch {}
    }, [user, subject, chapterId]);

    useEffect(() => {
        if (!pdfUrl || !user?.uid) return;
        const timer = setInterval(() => {
            const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
            if (elapsed >= 120 && !progressSent.current) sendProgress('read', 100);
        }, 30000);
        return () => clearInterval(timer);
    }, [pdfUrl, user, sendProgress]);

    useEffect(() => {
        return () => {
            if (user?.uid && !progressSent.current) {
                const elapsed = Math.round((Date.now() - startTimeRef.current) / 1000);
                if (elapsed >= 10) {
                    apiService.updateBookProgress(user.uid, subject, {
                        chapter_id: parseInt(chapterId), action: 'read',
                        time_spent: elapsed, scroll_pct: 0,
                    }).catch(() => {});
                }
            }
        };
    }, [user, subject, chapterId]);

    /* ── Chapter navigation ── */
    const goChapter = (delta) => {
        const nextId = parseInt(chapterId) + delta;
        if (nextId < 0 || nextId >= chapters.length) return;
        sendProgress('read', 0);
        navigate(`/books/${subject}/chapter/${nextId}`, { replace: true });
    };

    /* ── Build flip pages ── */
    const flipPages = useMemo(() => {
        if (numPages === 0) return [];
        const pages = [];
        for (let i = 1; i <= numPages; i++) {
            pages.push(
                <FlipPage
                    key={`p-${i}`}
                    pageNum={i}
                    imageUrl={pageCache[i] || null}
                    isLoading={loadingRef.current.has(i)}
                    accentColor={meta.color}
                />
            );
        }
        return pages;
    }, [numPages, pageCache, meta.color]);

    /* ─────────────────────────────────────────────
       LOADING STATE
       ───────────────────────────────────────────── */
    if (loading) {
        return (
            <div className="pv-page">
                <div className="pv-topbar" style={{ borderBottomColor: meta.color + '33' }}>
                    <button className="pv-back-btn" onClick={() => navigate(`/books/${subject}`)}>← Back</button>
                    <span className="pv-topbar__title" style={{ color: meta.color }}>{meta.label}</span>
                </div>
                <div className="pv-state">
                    <div className="pv-spinner" style={{ borderTopColor: meta.color }} />
                    <p>Loading chapter…</p>
                </div>
            </div>
        );
    }

    /* ─────────────────────────────────────────────
       ERROR STATE
       ───────────────────────────────────────────── */
    if (error || !pdfUrl) {
        return (
            <div className="pv-page">
                <div className="pv-topbar" style={{ borderBottomColor: meta.color + '33' }}>
                    <button className="pv-back-btn" onClick={() => navigate(`/books/${subject}`)}>← Back</button>
                    <span className="pv-topbar__title" style={{ color: meta.color }}>PDF not found</span>
                </div>
                <div className="pv-state">
                    <span className="pv-state__icon">📭</span>
                    <p>{error || 'PDF file path not set.'}</p>
                    <button className="pv-back-btn" style={{ marginTop: 16 }} onClick={() => navigate(`/books/${subject}`)}>
                        ← Back to {meta.label}
                    </button>
                </div>
            </div>
        );
    }

    /* ─────────────────────────────────────────────
       FLIPBOOK READER
       ───────────────────────────────────────────── */
    return (
        <div
            ref={shellRef}
            style={{
                position: 'fixed', inset: 0, zIndex: 100,
                display: 'flex', flexDirection: 'column',
                width: '100vw', height: '100vh', overflow: 'hidden',
                background: `
                    radial-gradient(ellipse at center, rgba(255,255,255,0.06) 0%, rgba(0,0,0,0.02) 50%, rgba(0,0,0,0.08) 100%),
                    linear-gradient(180deg, #F8F9FC 0%, #EFF1F5 30%, #E8EAF0 70%, #DFE2E9 100%)
                `,
                fontFamily: "'Inter', 'Poppins', system-ui, -apple-system, sans-serif",
            }}
        >
            {/* ═══════ TOP BAR ═══════ */}
            <header style={{
                height: TOOLBAR_H,
                background: 'rgba(255,255,255,0.96)',
                backdropFilter: 'blur(20px)',
                borderBottom: `2px solid ${meta.color}22`,
                boxShadow: '0 1px 8px rgba(0,0,0,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '0 12px', flexShrink: 0, zIndex: 30, userSelect: 'none',
            }}>
                {/* LEFT — Back + Title */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: '0 1 auto' }}>
                    <motion.button
                        onClick={() => navigate(`/books/${subject}`)}
                        style={{
                            display: 'flex', alignItems: 'center', gap: 4,
                            padding: '6px 12px', borderRadius: 12, cursor: 'pointer',
                            background: 'rgba(243,244,246,0.85)', border: '1px solid rgba(0,0,0,0.06)',
                            fontSize: 12, fontWeight: 600, color: '#6B7280', flexShrink: 0,
                        }}
                        whileHover={{ scale: 1.05, x: -2 }}
                        whileTap={{ scale: 0.94 }}
                    >
                        ← Back
                    </motion.button>

                    {/* Chapter nav */}
                    <motion.button
                        onClick={() => goChapter(-1)}
                        disabled={parseInt(chapterId) <= 0}
                        style={{
                            width: 28, height: 28, borderRadius: 8,
                            border: '1px solid #e2e8f0', background: '#f8fafc',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 14, color: '#475569', opacity: parseInt(chapterId) <= 0 ? 0.3 : 1,
                        }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                    >‹</motion.button>

                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                        <span style={{ fontSize: 16 }}>{meta.icon}</span>
                        <div style={{ minWidth: 0 }}>
                            <h1 style={{
                                fontSize: 13, fontWeight: 800, color: '#1e293b', margin: 0,
                                whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: isMobile ? 120 : 300,
                            }}>
                                {pdfTitle}
                            </h1>
                            <p style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, margin: 0 }}>
                                {meta.label}
                                {completed && <span style={{ color: '#16a34a', marginLeft: 6 }}>✅ Completed</span>}
                            </p>
                        </div>
                    </div>

                    <motion.button
                        onClick={() => goChapter(1)}
                        disabled={parseInt(chapterId) >= chapters.length - 1}
                        style={{
                            width: 28, height: 28, borderRadius: 8,
                            border: '1px solid #e2e8f0', background: '#f8fafc',
                            cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: 14, color: '#475569', opacity: parseInt(chapterId) >= chapters.length - 1 ? 0.3 : 1,
                        }}
                        whileHover={{ scale: 1.1 }}
                        whileTap={{ scale: 0.9 }}
                    >›</motion.button>
                </div>

                {/* CENTER — Page Info */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
                    <div style={{
                        display: 'flex', alignItems: 'center', gap: 6,
                        padding: '4px 12px', borderRadius: 20,
                        background: `${meta.color}0A`, border: `1px solid ${meta.color}18`,
                    }}>
                        <span style={{ fontSize: 10, fontWeight: 700, color: meta.color, opacity: 0.7 }}>Page</span>
                        {jumpEditing ? (
                            <input
                                type="number" autoFocus min={1} max={numPages}
                                value={jumpValue}
                                onChange={e => setJumpValue(e.target.value)}
                                onKeyDown={e => {
                                    if (e.key === 'Enter') {
                                        const p = Number(jumpValue);
                                        if (!isNaN(p) && p >= 1 && p <= numPages) jumpToPage(p);
                                        setJumpEditing(false);
                                    }
                                    if (e.key === 'Escape') setJumpEditing(false);
                                }}
                                onBlur={() => {
                                    const p = Number(jumpValue);
                                    if (!isNaN(p) && p >= 1 && p <= numPages) jumpToPage(p);
                                    setJumpEditing(false);
                                }}
                                style={{
                                    width: 42, padding: '2px 4px', borderRadius: 8,
                                    border: `2px solid ${meta.color}`, background: '#fff',
                                    fontSize: 13, fontWeight: 900, color: meta.color,
                                    textAlign: 'center', outline: 'none',
                                }}
                            />
                        ) : (
                            <motion.span
                                key={displayPage}
                                onClick={() => { setJumpValue(String(displayPage)); setJumpEditing(true); }}
                                title="Click to jump"
                                initial={{ opacity: 0, y: -3 }}
                                animate={{ opacity: 1, y: 0 }}
                                style={{
                                    fontSize: 13, fontWeight: 900, color: meta.color,
                                    cursor: 'pointer', padding: '1px 6px', borderRadius: 6,
                                    background: `${meta.color}0F`,
                                }}
                            >
                                {displayPage}
                            </motion.span>
                        )}
                        <span style={{ fontSize: 11, color: '#cbd5e1', fontWeight: 700 }}>/</span>
                        <span style={{ fontSize: 12, fontWeight: 700, color: `${meta.color}88` }}>{numPages}</span>
                    </div>
                </div>

                {/* RIGHT — Controls */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 4, flex: '0 1 auto' }}>
                    {/* Sidebar toggle (chapters) */}
                    {chapters.length > 1 && (
                        <ToolBtn emoji="📑" onClick={() => setShowSidebar(s => !s)} active={showSidebar} tip="Chapters" />
                    )}
                    <ToolBtn
                        emoji={isFullscreen ? '⊠' : '⛶'}
                        onClick={toggleFullscreen}
                        tip={isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                    />
                    {!completed && user?.uid && (
                        <motion.button
                            onClick={() => sendProgress('complete', 100)}
                            style={{
                                padding: '5px 10px', borderRadius: 10,
                                background: meta.color, color: '#fff',
                                fontSize: 11, fontWeight: 700, border: 'none', cursor: 'pointer',
                            }}
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                        >✓ Done</motion.button>
                    )}
                    <motion.a
                        href={pdfUrl}
                        download
                        style={{
                            display: 'flex', alignItems: 'center', gap: 6,
                            padding: '6px 14px', borderRadius: 10,
                            background: `${meta.color}15`, 
                            color: meta.color,
                            fontSize: 12, fontWeight: 700, textDecoration: 'none',
                            border: `1px solid ${meta.color}25`,
                        }}
                        whileHover={{ scale: 1.05, background: meta.color, color: '#fff' }}
                        whileTap={{ scale: 0.95 }}
                    >
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                            <polyline points="7 10 12 15 17 10"></polyline>
                            <line x1="12" y1="15" x2="12" y2="3"></line>
                        </svg>
                        Download
                    </motion.a>
                </div>
            </header>

            {/* ═══════ PROGRESS BAR ═══════ */}
            <div style={{ height: 5, background: `${meta.color}0A`, position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
                <motion.div
                    style={{
                        height: '100%',
                        background: `linear-gradient(90deg, ${meta.color}, ${meta.color}AA)`,
                        borderRadius: '0 2px 2px 0',
                    }}
                    initial={{ width: '0%' }}
                    animate={{ width: `${progressPercent}%` }}
                    transition={{ duration: 0.4, ease: 'easeOut' }}
                />
            </div>

            {/* ═══════ MAIN CONTENT ═══════ */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden', minHeight: 0 }}>

                {/* ── Sidebar: Chapters ── */}
                <AnimatePresence>
                    {showSidebar && chapters.length > 1 && (
                        <motion.div
                            initial={{ width: 0, opacity: 0 }}
                            animate={{ width: 220, opacity: 1 }}
                            exit={{ width: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            style={{
                                flexShrink: 0, overflow: 'hidden',
                                background: 'rgba(255,255,255,0.96)',
                                borderRight: '1px solid rgba(0,0,0,0.06)',
                                backdropFilter: 'blur(16px)',
                            }}
                        >
                            <div style={{
                                padding: '12px 14px', fontSize: 11, fontWeight: 800,
                                color: meta.color, borderBottom: '1px solid rgba(0,0,0,0.06)',
                                textTransform: 'uppercase', letterSpacing: 0.5,
                            }}>📚 Chapters</div>
                            <div style={{ overflowY: 'auto', maxHeight: 'calc(100% - 40px)' }}>
                                {chapters.map(ch => (
                                    <button
                                        key={ch.id}
                                        onClick={() => {
                                            sendProgress('read', 0);
                                            navigate(`/books/${subject}/chapter/${ch.id}`, {
                                                state: { file: ch.file, title: ch.title },
                                                replace: true,
                                            });
                                        }}
                                        style={{
                                            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                                            padding: '10px 14px', border: 'none', cursor: 'pointer',
                                            background: String(ch.id) === String(chapterId) ? `${meta.color}12` : 'transparent',
                                            borderLeft: String(ch.id) === String(chapterId) ? `3px solid ${meta.color}` : '3px solid transparent',
                                            fontSize: 11, fontWeight: 600,
                                            color: String(ch.id) === String(chapterId) ? meta.color : '#475569',
                                            textAlign: 'left', transition: 'all 0.15s',
                                        }}
                                    >
                                        <span>{ch.completed ? '✅' : '📄'}</span>
                                        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ch.title}</span>
                                    </button>
                                ))}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* ── Book Viewer ── */}
                <div style={{
                    flex: 1, display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    overflow: 'hidden', position: 'relative',
                    background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.3) 0%, transparent 65%)',
                }}>
                    {/* PDF Loading */}
                    {pdfLoading && !pdfError && (
                        <motion.div style={{ textAlign: 'center' }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                            <motion.div
                                style={{
                                    width: 52, height: 52, margin: '0 auto',
                                    borderRadius: '50%', border: `3px solid ${meta.color}20`, borderTopColor: meta.color,
                                }}
                                animate={{ rotate: 360 }}
                                transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                            />
                            <p style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', marginTop: 16 }}>Preparing your flipbook…</p>
                            <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4 }}>{pdfTitle}</p>
                        </motion.div>
                    )}

                    {/* PDF Error */}
                    {pdfError && (
                        <motion.div style={{ textAlign: 'center', maxWidth: 320, padding: '0 24px' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                            <span style={{ fontSize: 60, display: 'inline-block', marginBottom: 20 }}>📚</span>
                            <h2 style={{ fontSize: 18, fontWeight: 900, color: '#374151', marginBottom: 8 }}>Unable to load book</h2>
                            <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 24, lineHeight: 1.6 }}>
                                Couldn't open <strong>{pdfTitle}</strong>. Check your connection.
                            </p>
                            <motion.button onClick={() => navigate(`/books/${subject}`)} style={{
                                padding: '10px 24px', borderRadius: 12,
                                background: meta.color, color: '#fff', fontSize: 13, fontWeight: 700,
                                border: 'none', cursor: 'pointer', boxShadow: `0 4px 12px ${meta.color}44`,
                            }} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                                Go Back
                            </motion.button>
                        </motion.div>
                    )}

                    {/* ═══ THE FLIPBOOK ═══ */}
                    {!pdfLoading && !pdfError && numPages > 0 && (
                        <>
                            {/* Left arrow */}
                            {!isMobile && (
                                <motion.button
                                    onClick={flipPrev}
                                    disabled={displayPage <= 1}
                                    style={{
                                        position: 'absolute', left: 12, zIndex: 20,
                                        width: 48, height: 48, borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer',
                                        background: 'rgba(255,255,255,0.97)', border: `2px solid ${meta.color}20`,
                                        boxShadow: `0 6px 16px ${meta.color}18`,
                                        opacity: displayPage <= 1 ? 0.15 : 1,
                                        fontSize: 20, color: meta.color,
                                    }}
                                    whileHover={displayPage > 1 ? { scale: 1.12, x: -3 } : {}}
                                    whileTap={displayPage > 1 ? { scale: 0.88 } : {}}
                                >‹</motion.button>
                            )}

                            {/* Flipbook container */}
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: zoom }}
                                transition={{ duration: 0.3, ease: 'easeOut' }}
                                style={{
                                    borderRadius: 16,
                                    boxShadow: `0 20px 60px rgba(0,0,0,0.12), 0 8px 24px rgba(0,0,0,0.06)`,
                                    background: 'linear-gradient(180deg, #ffffff, #f8f9fb)',
                                    padding: isMobile ? 0 : 4,
                                    position: 'relative',
                                    perspective: 2000,
                                    transformOrigin: 'center center',
                                }}
                            >
                                {/* Spine shadow */}
                                {!isMobile && (
                                    <div style={{
                                        position: 'absolute', top: 0, bottom: 0, left: '50%',
                                        width: 10, transform: 'translateX(-50%)',
                                        background: 'linear-gradient(90deg, rgba(0,0,0,0.06), rgba(0,0,0,0.01), rgba(0,0,0,0.06))',
                                        zIndex: 10, pointerEvents: 'none',
                                    }} />
                                )}

                                {/* @ts-ignore */}
                                <HTMLFlipBook
                                    ref={bookRef}
                                    width={dimensions.width}
                                    height={dimensions.height}
                                    size="fixed"
                                    minWidth={200}
                                    maxWidth={1400}
                                    minHeight={280}
                                    maxHeight={1400}
                                    maxShadowOpacity={0.12}
                                    showCover={false}
                                    mobileScrollSupport={true}
                                    onFlip={onFlip}
                                    className="flipbook"
                                    style={{}}
                                    startPage={0}
                                    drawShadow={false}
                                    flippingTime={600}
                                    usePortrait={isMobile}
                                    startZIndex={0}
                                    autoSize={false}
                                    clickEventForward={true}
                                    useMouseEvents={true}
                                    swipeDistance={30}
                                    showPageCorners={true}
                                    disableFlipByClick={false}
                                >
                                    {flipPages}
                                </HTMLFlipBook>
                            </motion.div>

                            {/* Right arrow */}
                            {!isMobile && (
                                <motion.button
                                    onClick={flipNext}
                                    disabled={displayPage >= numPages}
                                    style={{
                                        position: 'absolute', right: 12, zIndex: 20,
                                        width: 48, height: 48, borderRadius: '50%',
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        cursor: 'pointer',
                                        background: 'rgba(255,255,255,0.97)', border: `2px solid ${meta.color}20`,
                                        boxShadow: `0 6px 16px ${meta.color}18`,
                                        opacity: displayPage >= numPages ? 0.15 : 1,
                                        fontSize: 20, color: meta.color,
                                    }}
                                    whileHover={displayPage < numPages ? { scale: 1.12, x: 3 } : {}}
                                    whileTap={displayPage < numPages ? { scale: 0.88 } : {}}
                                >›</motion.button>
                            )}
                        </>
                    )}
                </div>
            </div>

            {/* ═══════ BOTTOM BAR ═══════ */}
            {numPages > 0 && !pdfLoading && (
                <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
                    padding: '8px 0', flexShrink: 0,
                    background: 'rgba(255,255,255,0.85)', borderTop: '1px solid rgba(0,0,0,0.04)',
                    backdropFilter: 'blur(16px)', fontSize: 11, fontWeight: 600,
                }}>
                    {/* Mobile prev/next */}
                    {isMobile && (
                        <motion.button onClick={flipPrev} disabled={displayPage <= 1} style={{
                            padding: '5px 14px', borderRadius: 10,
                            background: '#f3f4f6', color: '#4b5563', fontSize: 11, fontWeight: 700,
                            border: 'none', cursor: 'pointer', opacity: displayPage <= 1 ? 0.3 : 1,
                        }} whileTap={{ scale: 0.95 }}>← Prev</motion.button>
                    )}

                    <span style={{ fontWeight: 700, color: meta.color, fontSize: 12 }}>
                        Page {displayPage} of {numPages}
                    </span>
                    <span style={{ color: '#D1D5DB' }}>·</span>
                    <span style={{ color: `${meta.color}AA`, fontWeight: 700 }}>{progressPercent}% read</span>
                    {!isMobile && (
                        <>
                            <span style={{ color: '#D1D5DB' }}>·</span>
                            <span style={{ color: '#9CA3AF', fontSize: 10 }}>
                                ← → turn pages · Click page corners to flip
                            </span>
                        </>
                    )}

                    {isMobile && (
                        <motion.button onClick={flipNext} disabled={displayPage >= numPages} style={{
                            padding: '5px 14px', borderRadius: 10,
                            background: '#f3f4f6', color: '#4b5563', fontSize: 11, fontWeight: 700,
                            border: 'none', cursor: 'pointer', opacity: displayPage >= numPages ? 0.3 : 1,
                        }} whileTap={{ scale: 0.95 }}>Next →</motion.button>
                    )}
                </div>
            )}
        </div>
    );
}

/* ── Small Toolbar Button ── */
function ToolBtn({ emoji, onClick, active, tip, disabled }) {
    return (
        <motion.button
            onClick={onClick}
            disabled={disabled}
            title={tip}
            style={{
                width: 32, height: 32, borderRadius: 10,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: disabled ? 'not-allowed' : 'pointer',
                background: active ? 'rgba(99,102,241,0.08)' : 'transparent',
                border: active ? '1px solid rgba(99,102,241,0.15)' : '1px solid transparent',
                fontSize: 14, opacity: disabled ? 0.3 : 1,
            }}
            whileHover={!disabled ? { scale: 1.08, background: 'rgba(99,102,241,0.06)' } : {}}
            whileTap={!disabled ? { scale: 0.92 } : {}}
        >
            {emoji}
        </motion.button>
    );
}
