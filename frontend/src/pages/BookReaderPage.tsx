/**
 * parent/pages/BookReaderPage.tsx
 * ─────────────────────────────────────────────────────
 * UPGRADED AI INTERACTIVE STORYBOOK READER
 *
 * Premium EdTech-level flipbook reader for Class 3 NCERT books.
 *
 * Upgrades:
 *  ① Fixed layout — no more bottom panel cutting
 *  ② Professional top bar with full controls
 *  ③ Fullscreen reader mode
 *  ④ Minimize/maximize AI panel with floating bubble
 *  ⑤ AI reads BOTH visible pages (left + right)
 *  ⑥ AI page understanding uses both-page context
 *  ⑦ Groq AI integration for real answers
 *  ⑧ Improved AI chat panel UI with quick buttons
 *  ⑨ Reading analytics floating panel
 *  ⑩ Enhanced page turn interactions
 *  ⑪ Upgraded quick activities panel
 *  ⑫ Story mode with framer-motion animations
 *  ⑬ Better page visuals with shadows and texture
 */

import React, {
  useState,
  useRef,
  useCallback,
  useEffect,
  useMemo,
  forwardRef,
  memo,
} from 'react';
import { pdfjs } from 'react-pdf';
import HTMLFlipBook from 'react-pageflip';
import { motion, AnimatePresence } from 'framer-motion';
import { type BookEntry } from '../../data/bookConfig';
import { detectLanguage } from '../../services/voiceService';

// Reader sub-modules
import { detectPageAnimations, generateAnimationCSS, type PageAnimation } from './reader/storyAnimations';
import { useNarration } from './reader/useNarration';
import { WordPopover } from './reader/WordPopover';
import { AskAIPanel } from './reader/AskAIPanel';
import { PageActivities } from './reader/PageActivities';
import { useReadingTracker } from './reader/useReadingTracker';

/* ─── PDF.js worker ───────────────────────────── */
import pdfjsWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorkerUrl;

/* ═══════════════════════════════════════════════════
   DESIGN TOKENS
   ═══════════════════════════════════════════════════ */
const TOOLBAR_H = 64;
const PROGRESS_H = 6;
const BOTTOM_BAR_H = 40;
const ACTIVITIES_H = 60;
const PRELOAD_BUFFER = 4;
const MAX_CACHED_PAGES = 16;
const BOOKMARK_KEY = 'ncert_bookmarks_';

/* ─── Helpers ─────────────────────────────────── */
function getBookmarks(bookId: string): number[] {
  try {
    const raw = localStorage.getItem(BOOKMARK_KEY + bookId);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}
function saveBookmarks(bookId: string, pages: number[]): void {
  localStorage.setItem(BOOKMARK_KEY + bookId, JSON.stringify(pages));
}

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(window.innerWidth < 768);
  useEffect(() => {
    const h = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', h);
    return () => window.removeEventListener('resize', h);
  }, []);
  return isMobile;
}

/* ═══════════════════════════════════════════════════
   PDF PAGE RENDERER
   ═══════════════════════════════════════════════════ */
interface PageCache { [n: number]: string }
interface TextCache { [n: number]: string }

async function renderPdfPage(pdfDoc: any, pageNum: number, scale = 1.5): Promise<{ image: string; text: string }> {
  const page = await pdfDoc.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  const ctx = canvas.getContext('2d')!;
  await page.render({ canvasContext: ctx, viewport }).promise;
  const image = canvas.toDataURL('image/jpeg', 0.72);

  let text = '';
  try {
    const tc = await page.getTextContent();
    text = tc.items.map((i: any) => i.str).join(' ');
  } catch { /* ignore */ }

  // Release page resources
  page.cleanup();

  return { image, text };
}

/* ═══════════════════════════════════════════════════
   FLIPBOOK PAGE (forwardRef for react-pageflip)
   ═══════════════════════════════════════════════════ */
interface FlipPageProps {
  pageNum: number;
  imageUrl: string | null;
  isLoading: boolean;
  bookTitle: string;
  storyMode: boolean;
  animations: PageAnimation[];
  animCSS: string;
  focusMode: boolean;
  pageText: string;
  highlightedWord: string;
  highlightedWordIndex: number;
  onWordClick?: (word: string, x: number, y: number) => void;
}

const FlipPage = memo(forwardRef<HTMLDivElement, FlipPageProps>(({
  pageNum, imageUrl, isLoading, bookTitle,
  storyMode, animations, animCSS,
  focusMode,
  pageText, highlightedWord, highlightedWordIndex,
  onWordClick,
}, ref) => {

  return (
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
        /* Enhanced paper texture */
        boxShadow: 'inset 0 0 60px rgba(99,102,241,0.04), inset -3px 0 10px rgba(99,102,241,0.03)',
        backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 28px, rgba(99,102,241,0.015) 28px, rgba(99,102,241,0.015) 29px)',
      }}
    >
      {storyMode && animCSS && (
        <style dangerouslySetInnerHTML={{ __html: animCSS }} />
      )}

      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'stretch',
          justifyContent: 'stretch',
          padding: 0,
          overflow: 'hidden',
          position: 'relative',
          filter: focusMode ? 'contrast(0.7) brightness(1.1)' : 'none',
        }}
      >
        {imageUrl ? (
          <div style={{ position: 'relative', width: '100%', height: '100%' }}>
            <img
              src={imageUrl}
              alt={`${bookTitle} — Page ${pageNum}`}
              loading="lazy"
              decoding="async"
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'fill',
                borderRadius: 3,
                transition: 'transform 0.6s cubic-bezier(.25,.8,.25,1)',
                willChange: 'transform',
                animation: storyMode && animations.length > 0 ? animations[0].cssAnimation : 'none',
              }}
              draggable={false}
            />
            {storyMode && animations.length > 0 && (
              <div style={{ position: 'absolute', bottom: 4, left: 4, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                {animations.map((a) => (
                  <span
                    key={a.id}
                    title={a.description}
                    style={{
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 8,
                      background: 'rgba(255,255,255,0.85)',
                      backdropFilter: 'blur(4px)',
                      fontWeight: 700,
                      color: '#6366F1',
                    }}
                  >
                    {a.emoji} {a.label}
                  </span>
                ))}
              </div>
            )}
          </div>
        ) : isLoading ? (
          <div style={{ width: '100%', height: '100%', padding: 16, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {/* Skeleton loader */}
            {[0.7, 1, 0.85, 0.6, 0.9, 0.5].map((w, i) => (
              <div
                key={i}
                style={{
                  height: i === 0 ? 100 : 14,
                  width: `${w * 100}%`,
                  borderRadius: i === 0 ? 12 : 8,
                  background: 'linear-gradient(90deg, #f0f3ff 25%, #e6e9ff 37%, #f0f3ff 63%)',
                  backgroundSize: '400% 100%',
                  animation: 'shimmer 1.4s infinite',
                }}
              />
            ))}
            <style>{`@keyframes shimmer { 0% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }`}</style>
            <p style={{ fontSize: 11, color: '#A5B4FC', marginTop: 6, fontWeight: 600, textAlign: 'center' }}>
              Loading page {pageNum}…
            </p>
          </div>
        ) : (
          <div style={{ textAlign: 'center' }}>
            <span style={{ fontSize: 36, opacity: 0.2 }}>📄</span>
            <p style={{ fontSize: 11, color: '#D1D5DB', marginTop: 8, fontWeight: 600 }}>
              Page {pageNum}
            </p>
          </div>
        )}
      </div>

      {/* Text overlay for Focus Mode */}
      {focusMode && pageText && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'rgba(255,255,250,0.88)',
            padding: '20px 16px',
            overflowY: 'auto',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center',
          }}
        >
          <p
            style={{
              fontSize: 15,
              lineHeight: 2,
              color: '#2C3A63',
              fontWeight: 500,
              textAlign: 'justify',
              wordSpacing: 2,
            }}
          >
            {pageText.split(/(\s+)/).map((part, idx) => {
              const isWord = /\S/.test(part);
              if (!isWord) return <span key={idx}>{part}</span>;
              const isHighlighted =
                highlightedWord &&
                part.toLowerCase().includes(highlightedWord.toLowerCase());
              return (
                <span
                  key={idx}
                  onClick={(e) => {
                    if (onWordClick && isWord) {
                      onWordClick(part.replace(/[^a-zA-Z\u0900-\u097F\u0A80-\u0AFF]/g, ''), e.clientX, e.clientY);
                    }
                  }}
                  style={{
                    cursor: isWord ? 'pointer' : 'default',
                    background: isHighlighted ? 'rgba(250,204,21,0.45)' : 'transparent',
                    borderRadius: isHighlighted ? 3 : 0,
                    padding: isHighlighted ? '1px 2px' : 0,
                    transition: 'background 0.2s',
                  }}
                >
                  {part}
                </span>
              );
            })}
          </p>
        </div>
      )}

      {/* Page number footer */}
      <div
        style={{
          padding: '5px 14px',
          display: 'flex',
          justifyContent: pageNum % 2 === 0 ? 'flex-start' : 'flex-end',
          alignItems: 'center',
          borderTop: '1px solid rgba(99,102,241,0.06)',
          flexShrink: 0,
        }}
      >
        <span style={{ fontSize: 10, fontWeight: 700, color: '#A5B4FC', fontVariantNumeric: 'tabular-nums' }}>
          {pageNum}
        </span>
      </div>

      {/* Paper edge effect */}
      <div
        style={{
          position: 'absolute', top: 0,
          [pageNum % 2 === 1 ? 'right' : 'left']: 0,
          bottom: 0, width: 3, pointerEvents: 'none',
          background: pageNum % 2 === 1
            ? 'linear-gradient(to left, rgba(99,102,241,0.06), transparent)'
            : 'linear-gradient(to right, rgba(99,102,241,0.06), transparent)',
        }}
      />
    </div>
  );
}));
FlipPage.displayName = 'FlipPage';

/* ═══════════════════════════════════════════════════
   SVG ICONS
   ═══════════════════════════════════════════════════ */
const Icon: React.FC<{ name: string; size?: number; className?: string }> = ({ name, size = 16, className = '' }) => {
  const s = { width: size, height: size };
  const common = `${className} shrink-0`;
  const stroke = 'currentColor';
  switch (name) {
    case 'back':
      return <svg {...s} className={common} fill="none" viewBox="0 0 24 24" stroke={stroke} strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>;
    case 'chevron-left':
      return <svg {...s} className={common} fill="none" viewBox="0 0 24 24" stroke={stroke} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>;
    case 'chevron-right':
      return <svg {...s} className={common} fill="none" viewBox="0 0 24 24" stroke={stroke} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>;
    case 'download':
      return <svg {...s} className={common} fill="none" viewBox="0 0 24 24" stroke={stroke} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" /></svg>;
    case 'fullscreen':
      return <svg {...s} className={common} fill="none" viewBox="0 0 24 24" stroke={stroke} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4h4M20 8V4h-4M4 16v4h4M20 16v4h-4" /></svg>;
    case 'fullscreen-exit':
      return <svg {...s} className={common} fill="none" viewBox="0 0 24 24" stroke={stroke} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M8 4v4H4M16 4v4h4M8 20v-4H4M16 20v-4h4" /></svg>;
    case 'bookmark':
      return <svg {...s} className={common} fill="none" viewBox="0 0 24 24" stroke={stroke} strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>;
    case 'bookmark-fill':
      return <svg {...s} className={common} fill="currentColor" viewBox="0 0 24 24"><path d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" /></svg>;
    default:
      return null;
  }
};

/* ═══════════════════════════════════════════════════
   TOOLBAR BUTTON
   ═══════════════════════════════════════════════════ */
const TBtn: React.FC<{
  icon?: string; emoji?: string; label?: string;
  onClick: () => void; active?: boolean; disabled?: boolean;
  children?: React.ReactNode;
  tooltip?: string;
}> = ({ icon, emoji, label, onClick, active, disabled, children, tooltip }) => (
  <motion.button
    onClick={onClick}
    disabled={disabled}
    title={tooltip || label}
    className={`flex items-center justify-center cursor-pointer disabled:opacity-25 disabled:cursor-not-allowed rounded-xl transition-colors ${
      active
        ? 'bg-indigo-50 text-indigo-600 border border-indigo-200'
        : 'text-gray-500 hover:bg-indigo-50 hover:text-indigo-500 border border-transparent'
    }`}
    style={{ minWidth: 36, height: 36, padding: children ? '0 10px' : 0, gap: 4, fontSize: 13 }}
    whileHover={!disabled ? { scale: 1.06 } : {}}
    whileTap={!disabled ? { scale: 0.92 } : {}}
  >
    {icon && <Icon name={icon} size={16} />}
    {emoji && <span style={{ fontSize: 14 }}>{emoji}</span>}
    {children}
  </motion.button>
);

/* ═══════════════════════════════════════════════════
   MODE TOGGLE PILL (Professional)
   ═══════════════════════════════════════════════════ */
const ModeToggle: React.FC<{
  mode: 'reading' | 'story' | 'focus';
  onChange: (m: 'reading' | 'story' | 'focus') => void;
}> = ({ mode, onChange }) => {
  const modes = [
    { key: 'reading' as const, emoji: '📖', label: 'Read', tip: 'Reading Mode' },
    { key: 'story' as const, emoji: '🎬', label: 'Story', tip: 'Story Mode — Animated' },
    { key: 'focus' as const, emoji: '🎯', label: 'Focus', tip: 'Focus Reading' },
  ];
  return (
    <div
      style={{
        display: 'inline-flex', borderRadius: 20, padding: 3, gap: 2,
        background: 'rgba(99,102,241,0.04)', border: '1px solid rgba(99,102,241,0.08)',
      }}
    >
      {modes.map((m) => (
        <motion.button
          key={m.key}
          onClick={() => onChange(m.key)}
          title={m.tip}
          style={{
            padding: '5px 12px', borderRadius: 16, border: 'none',
            fontSize: 11, fontWeight: 700, cursor: 'pointer',
            background: mode === m.key ? '#6366F1' : 'transparent',
            color: mode === m.key ? '#fff' : '#6B7280',
            display: 'flex', alignItems: 'center', gap: 4,
          }}
          whileTap={{ scale: 0.95 }}
        >
          <span style={{ fontSize: 12 }}>{m.emoji}</span>
          <span className="hidden sm:inline">{m.label}</span>
        </motion.button>
      ))}
    </div>
  );
};

/* ═══════════════════════════════════════════════════
   READING ANALYTICS FLOATING PANEL
   ═══════════════════════════════════════════════════ */
const ReadingAnalyticsPanel: React.FC<{
  stats: any;
  elapsedTime: number;
  onClose: () => void;
}> = ({ stats, elapsedTime, onClose }) => {
  const items = [
    { emoji: '📄', label: 'Pages Read', value: `${stats.pagesRead}` },
    { emoji: '⏱️', label: 'Reading Time', value: formatMs(elapsedTime) },
    { emoji: '💬', label: 'Words Explored', value: `${stats.wordsClicked}` },
    { emoji: '❓', label: 'AI Questions', value: `${stats.questionsAsked}` },
    { emoji: '📝', label: 'Quiz Score', value: `${stats.quizzesCorrect} / ${stats.quizzesTaken}` },
    { emoji: '🔊', label: 'Narrations Played', value: `${stats.narrationUsed}` },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, y: -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.9, y: -10 }}
      style={{
        position: 'fixed',
        top: TOOLBAR_H + PROGRESS_H + 12,
        right: 16,
        zIndex: 170,
        width: 280,
        background: 'rgba(255,255,255,0.98)',
        backdropFilter: 'blur(20px)',
        borderRadius: 16,
        border: '1px solid rgba(99,102,241,0.1)',
        boxShadow: '0 12px 40px rgba(99,102,241,0.12)',
        overflow: 'hidden',
      }}
    >
      <div style={{
        padding: '14px 16px 10px',
        background: 'linear-gradient(135deg, #EDE9FE, #DBEAFE)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <h4 style={{ fontSize: 13, fontWeight: 800, color: '#2C3A63', margin: 0 }}>📊 Reading Stats</h4>
        <motion.button
          onClick={onClose}
          style={{
            width: 24, height: 24, borderRadius: '50%', border: 'none',
            background: 'rgba(99,102,241,0.08)', cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 11, color: '#6B7280',
          }}
          whileTap={{ scale: 0.9 }}
        >✕</motion.button>
      </div>
      <div style={{ padding: '12px 16px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        {items.map((item) => (
          <div key={item.label} style={{
            padding: '10px 12px', borderRadius: 12,
            background: 'rgba(249,250,251,0.8)', border: '1px solid rgba(99,102,241,0.06)',
            textAlign: 'center',
          }}>
            <span style={{ fontSize: 18 }}>{item.emoji}</span>
            <p style={{ fontSize: 14, fontWeight: 900, color: '#2C3A63', margin: '2px 0 0' }}>{item.value}</p>
            <p style={{ fontSize: 9, color: '#9CA3AF', fontWeight: 600, margin: 0 }}>{item.label}</p>
          </div>
        ))}
      </div>
    </motion.div>
  );
};

/* ═══════════════════════════════════════════════════
   STORY MODE AMBIENT OVERLAY (framer-motion)
   ═══════════════════════════════════════════════════ */
const StoryModeOverlay: React.FC<{ animations: PageAnimation[] }> = ({ animations }) => {
  if (animations.length === 0) return null;

  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden', zIndex: 5 }}>
      {/* Floating clouds */}
      {animations.some(a => a.id === 'clouds') && (
        <>
          <motion.div
            style={{ position: 'absolute', top: '8%', left: '-5%', fontSize: 28, opacity: 0.3 }}
            animate={{ x: [0, 60, 0], y: [0, -8, 0] }}
            transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
          >☁️</motion.div>
          <motion.div
            style={{ position: 'absolute', top: '15%', right: '10%', fontSize: 22, opacity: 0.2 }}
            animate={{ x: [0, -40, 0], y: [0, 6, 0] }}
            transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
          >☁️</motion.div>
        </>
      )}
      {/* Sun glow */}
      {animations.some(a => a.id === 'sun') && (
        <motion.div
          style={{ position: 'absolute', top: '5%', right: '5%', fontSize: 32, opacity: 0.35 }}
          animate={{ scale: [1, 1.15, 1], opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
        >☀️</motion.div>
      )}
      {/* Birds */}
      {animations.some(a => a.id === 'birds') && (
        <motion.div
          style={{ position: 'absolute', top: '12%', left: '20%', fontSize: 16, opacity: 0.3 }}
          animate={{ x: [0, 80, 160, 80, 0], y: [0, -15, -5, -20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        >🐦</motion.div>
      )}
    </div>
  );
};

/* ═══════════════════════════════════════════════════
   MAIN: BookReaderPage
   ═══════════════════════════════════════════════════ */
export interface BookReaderPageProps {
  book: BookEntry;
  onBack: () => void;
}

const BookReaderPage: React.FC<BookReaderPageProps> = ({ book, onBack }) => {
  /* ── Core PDF state ─────────────────────────── */
  const [numPages, setNumPages] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pdfDoc, setPdfDoc] = useState<any>(null);
  const [pdfError, setPdfError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  /* ── PDF page aspect ratio (height / width) ── */
  const [pdfPageRatio, setPdfPageRatio] = useState(1.414);

  /* ── Page caches ────────────────────────────── */
  const [pageCache, setPageCache] = useState<PageCache>({});
  const [textCache, setTextCache] = useState<TextCache>({});
  const loadingRef = useRef<Set<number>>(new Set());

  /* ── Modes ──────────────────────────────────── */
  const [mode, setMode] = useState<'reading' | 'story' | 'focus'>('reading');

  /* ── Narration ──────────────────────────────── */
  const narration = useNarration();

  /* ── Word interaction ───────────────────────── */
  const [selectedWord, setSelectedWord] = useState<{ word: string; x: number; y: number } | null>(null);

  /* ── Ask AI panel ───────────────────────────── */
  const [askAIOpen, setAskAIOpen] = useState(false);
  const [askAIMinimized, setAskAIMinimized] = useState(false);

  /* ── Bookmarks ──────────────────────────────── */
  const [bookmarksState, setBookmarksState] = useState<number[]>(() => getBookmarks(book.id));

  /* ── Fullscreen ─────────────────────────────── */
  const [isFullscreen, setIsFullscreen] = useState(false);

  /* ── Stats panel ────────────────────────────── */
  const [showStats, setShowStats] = useState(false);

  /* ── Activities expansion ───────────────────── */
  const [activitiesExpanded, setActivitiesExpanded] = useState(false);

  /* ── Page jump input ────────────────────────── */
  const [pageJumpEditing, setPageJumpEditing] = useState(false);
  const [pageJumpValue, setPageJumpValue] = useState('');

  /* ── Refs ────────────────────────────────────── */
  const bookRef = useRef<any>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  /* ── Reading Tracker ────────────────────────── */
  const tracker = useReadingTracker(book.id, book.title);

  /* ── Zoom state (incremental 0.8–2.0) ─────── */
  const [zoomLevel, setZoomLevel] = useState(1.0);
  const zoomIn = () => setZoomLevel(z => Math.min(z + 0.2, 2.0));
  const zoomOut = () => setZoomLevel(z => Math.max(z - 0.2, 0.8));
  const zoomReset = () => setZoomLevel(1.0);

  /* ── Flipbook dimensions (use actual PDF aspect ratio) ── */
  const dimensions = useMemo(() => {
    const maxW = window.innerWidth;
    const aiPanelW = askAIOpen && !askAIMinimized && !isMobile ? 400 : 0;
    const availW = maxW - aiPanelW;
    const activitiesHeight = activitiesExpanded ? 400 : 40;
    const bottomExtra = isFullscreen ? 5 : (BOTTOM_BAR_H + activitiesHeight + 16);
    const maxH = window.innerHeight - TOOLBAR_H - PROGRESS_H - bottomExtra;
    if (isMobile) {
      const w = Math.min(availW - 8, 580);
      // height driven by PDF ratio, then clamp to available height and re-derive width
      let h = w * pdfPageRatio;
      if (h > maxH) {
        h = maxH;
        return { width: Math.floor(h / pdfPageRatio), height: Math.floor(h) };
      }
      return { width: w, height: Math.floor(h) };
    }
    // Desktop: fit within available area while preserving exact PDF ratio
    const pageW = Math.min((availW - 40) / 2, 720);
    let pageH = pageW * pdfPageRatio;
    if (pageH > maxH - 10) {
      pageH = maxH - 10;
      return { width: Math.floor(pageH / pdfPageRatio), height: Math.floor(pageH) };
    }
    return { width: Math.floor(pageW), height: Math.floor(pageH) };
  }, [isMobile, askAIOpen, askAIMinimized, isFullscreen, pdfPageRatio, activitiesExpanded]);

  /* ── Load PDF ───────────────────────────────── */
  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    setPdfError(false);
    const load = async () => {
      try {
        const doc = await pdfjs.getDocument(book.pdfUrl).promise;
        if (cancelled) return;
        // Get actual page aspect ratio from first page
        try {
          const p1 = await doc.getPage(1);
          const vp = p1.getViewport({ scale: 1 });
          setPdfPageRatio(vp.height / vp.width);
          p1.cleanup();
        } catch { /* fallback ratio already set */ }
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        setIsLoading(false);
      } catch (err) {
        console.error('[BookReader] PDF load error:', err);
        if (!cancelled) { setPdfError(true); setIsLoading(false); }
      }
    };
    load();
    return () => { cancelled = true; };
  }, [book.pdfUrl]);

  /* ── Pre-render pages (with cache eviction) ───── */
  const renderPage = useCallback(async (pageNum: number) => {
    if (!pdfDoc || pageNum < 1 || pageNum > numPages) return;
    if (pageCache[pageNum] || loadingRef.current.has(pageNum)) return;
    loadingRef.current.add(pageNum);
    try {
      const { image, text } = await renderPdfPage(pdfDoc, pageNum, isMobile ? 1.0 : 1.2);
      setPageCache((p) => ({ ...p, [pageNum]: image }));
      if (text) setTextCache((t) => ({ ...t, [pageNum]: text }));
    } catch (err) {
      console.warn(`Failed to render page ${pageNum}:`, err);
    } finally {
      loadingRef.current.delete(pageNum);
    }
  }, [pdfDoc, numPages, pageCache, isMobile]);

  /* ── Cache eviction: keep only MAX_CACHED_PAGES near current page ── */
  useEffect(() => {
    const cachedKeys = Object.keys(pageCache).map(Number);
    if (cachedKeys.length <= MAX_CACHED_PAGES) return;
    const center = currentPage + 1; // flip index → display page
    const sorted = cachedKeys.sort((a, b) => Math.abs(a - center) - Math.abs(b - center));
    const toEvict = sorted.slice(MAX_CACHED_PAGES);
    if (toEvict.length > 0) {
      setPageCache((prev) => {
        const next = { ...prev };
        toEvict.forEach((k) => delete next[k]);
        return next;
      });
    }
  }, [currentPage, pageCache]);

  /* ── Preload nearby pages (prioritize forward + first 3) ── */
  useEffect(() => {
    if (!pdfDoc || numPages === 0) return;
    const pages: number[] = [];
    // Prioritize: current page first, then forward pages, then backward
    for (let i = 0; i <= PRELOAD_BUFFER + 2; i++) {
      const p = currentPage + i;
      if (p >= 1 && p <= numPages && !pages.includes(p)) pages.push(p);
    }
    for (let i = 1; i <= PRELOAD_BUFFER; i++) {
      const p = currentPage - i;
      if (p >= 1 && !pages.includes(p)) pages.push(p);
    }
    for (let i = 1; i <= Math.min(3, numPages); i++) {
      if (!pages.includes(i)) pages.push(i);
    }
    // Render current page immediately, rest staggered
    const [first, ...rest] = pages;
    if (first) renderPage(first);
    rest.forEach((p, idx) => {
      setTimeout(() => renderPage(p), (idx + 1) * 50);
    });
  }, [pdfDoc, numPages, currentPage, renderPage]);

  /* ── Track page views ───────────────────────── */
  useEffect(() => {
    if (currentPage > 0 && currentPage <= numPages) {
      tracker.trackPageView(currentPage);
    }
  }, [currentPage, numPages]);

  /* ── Cleanup on unmount: release PDF memory ─── */
  useEffect(() => {
    return () => {
      if (pdfDoc) {
        try { pdfDoc.destroy(); } catch {}
      }
      // Clear data-URL caches to free memory
      setPageCache({});
      setTextCache({});
      loadingRef.current.clear();
    };
  }, [pdfDoc]);

  /* ── Flip callbacks ─────────────────────────── */
  const onFlip = useCallback((e: any) => {
    setCurrentPage(e.data);
    narration.stopNarration();
    setSelectedWord(null);
  }, [narration]);

  const flipNext = useCallback(() => { bookRef.current?.pageFlip()?.flipNext(); }, []);
  const flipPrev = useCallback(() => { bookRef.current?.pageFlip()?.flipPrev(); }, []);

  const jumpToPage = useCallback((page: number) => {
    if (!bookRef.current || page < 1 || page > numPages) return;
    // In no-cover mode pages are 0-indexed: pdf page 1 = flip index 0
    const flipIndex = page - 1;
    bookRef.current.pageFlip().flip(flipIndex);
    setCurrentPage(flipIndex);
  }, [numPages]);

  /* ── Display page number (no cover, so flip index 0 = pdf page 1) ── */
  const displayPage = useMemo(() => {
    const p = currentPage + 1; // flip index 0 → page 1
    if (p < 1) return 1;
    if (p > numPages) return numPages;
    return p;
  }, [currentPage, numPages]);

  /* ── Get both visible pages (left + right) ──── */
  const visiblePages = useMemo(() => {
    if (displayPage < 1) return { left: 1, right: 2 };
    if (isMobile) return { left: displayPage, right: 0 };
    // Desktop 2-page spread
    const leftPage = displayPage % 2 === 1 ? displayPage : displayPage;
    const rightPage = leftPage + 1 <= numPages ? leftPage + 1 : 0;
    return { left: leftPage, right: rightPage };
  }, [displayPage, numPages, isMobile]);

  /* ── Combined text from BOTH visible pages ──── */
  const bothPagesText = useMemo(() => {
    const leftText = textCache[visiblePages.left] || '';
    const rightText = visiblePages.right > 0 ? (textCache[visiblePages.right] || '') : '';
    return (leftText + ' ' + rightText).trim();
  }, [textCache, visiblePages]);

  /* ── Bookmark ───────────────────────────────── */
  const toggleBookmark = useCallback(() => {
    if (displayPage < 1) return;
    setBookmarksState((prev) => {
      const next = prev.includes(displayPage)
        ? prev.filter((p) => p !== displayPage)
        : [...prev, displayPage].sort((a, b) => a - b);
      saveBookmarks(book.id, next);
      return next;
    });
  }, [displayPage, book.id]);
  const isBookmarked = bookmarksState.includes(displayPage);

  /* ── Download ───────────────────────────────── */
  const handleDownload = useCallback(() => {
    const a = document.createElement('a');
    a.href = book.pdfUrl;
    a.download = book.title.replace(/[^a-zA-Z0-9 ]/g, '') + '.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }, [book.pdfUrl, book.title]);

  /* ── Fullscreen ─────────────────────────────── */
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
    const h = () => {
      const fs = !!document.fullscreenElement;
      setIsFullscreen(fs);
      // In fullscreen, collapse AI panel
      if (fs && askAIOpen) {
        setAskAIMinimized(true);
      }
    };
    document.addEventListener('fullscreenchange', h);
    return () => document.removeEventListener('fullscreenchange', h);
  }, [askAIOpen]);

  /* ── Narration handler — reads BOTH pages ───── */
  const handleReadAloud = useCallback(() => {
    if (!bothPagesText) return;
    if (narration.state === 'playing') {
      narration.pause();
    } else if (narration.state === 'paused') {
      narration.resume();
    } else {
      const lang = detectLanguage(bothPagesText);
      narration.play(bothPagesText, lang);
      tracker.trackNarrationUse();
    }
  }, [bothPagesText, narration, tracker]);

  /* ── Word click handler ─────────────────────── */
  const handleWordClick = useCallback((word: string, x: number, y: number) => {
    setSelectedWord({ word, x, y });
    tracker.trackWordClick();
  }, [tracker]);

  /* ── AI Panel controls ──────────────────────── */
  const handleOpenAI = useCallback(() => {
    setAskAIOpen(true);
    setAskAIMinimized(false);
  }, []);

  const handleMinimizeAI = useCallback(() => {
    setAskAIMinimized(true);
  }, []);

  const handleCloseAI = useCallback(() => {
    setAskAIOpen(false);
    setAskAIMinimized(false);
  }, []);

  const handleExpandAI = useCallback(() => {
    setAskAIMinimized(false);
  }, []);

  /* ── Keyboard shortcuts ─────────────────────── */
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (askAIOpen && !askAIMinimized) return;
      if (e.key === 'Escape') {
        if (selectedWord) { setSelectedWord(null); return; }
        if (showStats) { setShowStats(false); return; }
        if (document.fullscreenElement) { document.exitFullscreen(); return; }
        onBack();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === ' ') { e.preventDefault(); flipNext(); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); flipPrev(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onBack, selectedWord, askAIOpen, askAIMinimized, showStats, flipNext, flipPrev]);

  /* ── Progress (no cover/back pages, just PDF pages) ── */
  const progressPercent = numPages > 1 ? Math.round((displayPage / numPages) * 100) : 0;

  /* ── Story-mode animations for current page ──  */
  const currentAnimations = useMemo(() => {
    if (mode !== 'story') return [];
    const text = bothPagesText;
    return detectPageAnimations(text);
  }, [mode, bothPagesText]);

  const currentAnimCSS = useMemo(() => generateAnimationCSS(currentAnimations), [currentAnimations]);

  /* ── Current page text & language ───────────── */
  const currentPageText = textCache[displayPage] || '';
  const currentLang = bothPagesText ? detectLanguage(bothPagesText) : 'en-IN';

  /* ── Build flip pages ───────────────────────── */
  const flipPages = useMemo(() => {
    if (numPages === 0) return [];
    const pages: React.ReactNode[] = [];
    // No cover page — start directly from page 1
    for (let i = 1; i <= numPages; i++) {
      pages.push(
        <FlipPage
          key={`p-${i}`}
          pageNum={i}
          imageUrl={pageCache[i] || null}
          isLoading={loadingRef.current.has(i)}
          bookTitle={book.title}
          storyMode={mode === 'story'}
          animations={i === displayPage ? currentAnimations : []}
          animCSS={i === displayPage ? currentAnimCSS : ''}
          focusMode={mode === 'focus'}
          pageText={textCache[i] || ''}
          highlightedWord={narration.highlightedWord}
          highlightedWordIndex={narration.highlightedWordIndex}
          onWordClick={mode === 'focus' ? handleWordClick : undefined}
        />,
      );
    }
    return pages;
  }, [numPages, book, pageCache, textCache, mode, displayPage, currentAnimations, currentAnimCSS, narration.highlightedWord, narration.highlightedWordIndex, handleWordClick, tracker.stats]);

  /* ═════════════════════════════════════════════
     RENDER
     ═════════════════════════════════════════════ */
  return (
    <div
      ref={shellRef}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 100,
        display: 'flex',
        flexDirection: 'column',
        width: '100vw',
        height: '100vh',
        overflow: 'hidden',
        /* Immersive reading background — dark vignette for focus */
        background: `
          radial-gradient(ellipse at center, rgba(255,255,255,0.06) 0%, rgba(99,102,241,0.04) 50%, rgba(30,27,75,0.10) 100%),
          linear-gradient(180deg, #F5F3FF 0%, #EDE9FE 30%, #E0DAFB 70%, #D5CFF5 100%)
        `,
      }}
    >
      {/* ═══════ PROFESSIONAL TOP BAR ═══════ */}
      <header
        style={{
          height: TOOLBAR_H,
          background: 'rgba(255,255,255,0.95)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid rgba(99,102,241,0.08)',
          boxShadow: '0 1px 8px rgba(99,102,241,0.06)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          flexShrink: 0,
          zIndex: 30,
          userSelect: 'none',
        }}
      >
        {/* LEFT — Back + Book Info */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: '0 1 auto' }}>
          <motion.button
            onClick={onBack}
            style={{
              display: 'flex', alignItems: 'center', gap: 4,
              padding: '6px 10px', borderRadius: 12, cursor: 'pointer',
              background: 'rgba(243,244,246,0.85)', border: '1px solid rgba(99,102,241,0.08)',
              flexShrink: 0,
            }}
            whileHover={{ scale: 1.05, x: -2 }}
            whileTap={{ scale: 0.94 }}
          >
            <Icon name="back" size={14} className="text-gray-500" />
            <span style={{ fontSize: 11, fontWeight: 600, color: '#6B7280' }} className="hidden sm:inline">Back</span>
          </motion.button>

          {/* Book title & info */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <div style={{
              width: 30, height: 30, borderRadius: 8,
              background: `linear-gradient(135deg, ${book.accentColor}30, ${book.accentColor}15)`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: 14 }}>{book.coverEmoji}</span>
            </div>
            <div style={{ minWidth: 0 }} className="hidden sm:block">
              <h1 style={{ fontSize: 13, fontWeight: 800, color: '#2C3A63', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {book.title}
              </h1>
              <p style={{ fontSize: 10, color: '#9CA3AF', fontWeight: 600, margin: 0 }}>
                {book.board === 'ncert' ? 'NCERT' : 'GSEB'} · Class 3
              </p>
            </div>
          </div>

          {/* Separator */}
          <div style={{ width: 1, height: 28, background: 'rgba(99,102,241,0.08)', flexShrink: 0 }} className="hidden md:block" />

          {/* Mode Switch */}
          <div className="hidden md:block">
            <ModeToggle mode={mode} onChange={setMode} />
          </div>
        </div>

        {/* CENTER — Page Info with Jump */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '0 0 auto' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            padding: '5px 12px', borderRadius: 20,
            background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.12)',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#A5B4FC' }}>Page</span>
            {pageJumpEditing ? (
              <input
                type="number"
                autoFocus
                min={1}
                max={numPages}
                value={pageJumpValue}
                onChange={(e) => setPageJumpValue(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    const p = Number(pageJumpValue);
                    if (!isNaN(p) && p >= 1 && p <= numPages) {
                      jumpToPage(p);
                    }
                    setPageJumpEditing(false);
                  }
                  if (e.key === 'Escape') setPageJumpEditing(false);
                }}
                onBlur={() => {
                  const p = Number(pageJumpValue);
                  if (!isNaN(p) && p >= 1 && p <= numPages) {
                    jumpToPage(p);
                  }
                  setPageJumpEditing(false);
                }}
                style={{
                  width: 46, padding: '3px 4px', borderRadius: 10,
                  border: '2px solid #6366F1', background: '#fff',
                  fontSize: 13, fontWeight: 900, color: '#6366F1',
                  textAlign: 'center', outline: 'none',
                  fontVariantNumeric: 'tabular-nums',
                  boxShadow: '0 0 0 3px rgba(99,102,241,0.15)',
                }}
              />
            ) : (
              <motion.span
                key={displayPage}
                onClick={() => { setPageJumpValue(String(displayPage)); setPageJumpEditing(true); }}
                title="Click to jump to a page"
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                style={{
                  fontSize: 13, fontWeight: 900, color: '#6366F1',
                  fontVariantNumeric: 'tabular-nums', cursor: 'pointer',
                  padding: '2px 8px', borderRadius: 8,
                  background: 'rgba(99,102,241,0.08)',
                  transition: 'background 0.15s',
                  display: 'inline-block',
                }}
              >
                {displayPage}
              </motion.span>
            )}
            <span style={{ fontSize: 11, color: '#C7D2FE', fontWeight: 700 }}>/</span>
            <span style={{ fontSize: 12, fontWeight: 700, color: '#A5B4FC', fontVariantNumeric: 'tabular-nums' }}>{numPages}</span>
          </div>

          {/* Mobile mode toggle */}
          <div className="md:hidden">
            <ModeToggle mode={mode} onChange={setMode} />
          </div>
        </div>

        {/* RIGHT — Reader Tools */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 2, flex: '0 1 auto' }}>
          <TBtn
            emoji={narration.state === 'playing' ? '⏸️' : '🔊'}
            onClick={handleReadAloud}
            active={narration.state !== 'idle'}
            tooltip="Read Aloud (both pages)"
            disabled={!bothPagesText}
          />
          <TBtn
            emoji="📊"
            onClick={() => setShowStats((s) => !s)}
            active={showStats}
            tooltip="Reading Stats"
          />
          <TBtn
            icon={isBookmarked ? 'bookmark-fill' : 'bookmark'}
            onClick={toggleBookmark}
            active={isBookmarked}
            tooltip={isBookmarked ? 'Remove bookmark' : 'Bookmark this page'}
            disabled={displayPage < 1}
          />
          <TBtn
            icon={isFullscreen ? 'fullscreen-exit' : 'fullscreen'}
            onClick={toggleFullscreen}
            tooltip={isFullscreen ? 'Exit Fullscreen (Esc)' : 'Fullscreen'}
          />

          {/* Separator */}
          <div style={{ width: 1, height: 24, background: 'rgba(99,102,241,0.08)', margin: '0 2px' }} className="hidden lg:block" />

          {/* Zoom controls */}
          <TBtn emoji="➖" onClick={zoomOut} tooltip={`Zoom Out (${Math.round(zoomLevel * 100)}%)`} disabled={zoomLevel <= 0.8} />
          <span style={{ fontSize: 10, fontWeight: 700, color: '#6366F1', minWidth: 34, textAlign: 'center', userSelect: 'none' }}>{Math.round(zoomLevel * 100)}%</span>
          <TBtn emoji="➕" onClick={zoomIn} tooltip={`Zoom In (${Math.round(zoomLevel * 100)}%)`} disabled={zoomLevel >= 2.0} />

          <div style={{ width: 1, height: 24, background: 'rgba(99,102,241,0.08)', margin: '0 2px' }} className="hidden lg:block" />

          <TBtn icon="download" onClick={handleDownload} tooltip="Download PDF" />
        </div>
      </header>

      {/* ═══════ PROGRESS BAR WITH LABEL ═══════ */}
      <div style={{ height: PROGRESS_H, background: 'rgba(99,102,241,0.06)', position: 'relative', overflow: 'hidden', flexShrink: 0 }}>
        <motion.div
          style={{ height: '100%', background: 'linear-gradient(90deg, #6366F1, #8B5CF6, #A78BFA)', borderRadius: '0 2px 2px 0' }}
          initial={{ width: '0%' }}
          animate={{ width: `${progressPercent}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
        />
        {progressPercent > 5 && (
          <span style={{
            position: 'absolute', top: '50%', left: `${Math.min(progressPercent, 95)}%`,
            transform: 'translate(-100%, -50%)', fontSize: 8, fontWeight: 800,
            color: '#fff', lineHeight: 1, paddingRight: 4,
          }}>
            {progressPercent}%
          </span>
        )}
      </div>

      {/* ═══════ MAIN CONTENT ═══════ */}
      <div style={{
        flex: 1,
        display: 'flex',
        overflow: 'hidden',
        minHeight: 0,
      }}>
        {/* ─── BOOK VIEWER AREA ─── */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          minHeight: 0,
          position: 'relative',
        }}>
          {/* FLIPBOOK CONTAINER — Upgraded for immersive reading */}
          <div
            style={{
              flex: 1,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: 0,
              overflow: 'hidden',
              position: 'relative',
              padding: isMobile ? '2px 2px' : '2px 10px',
              /* Subtle radial spotlight on the book */
              background: 'radial-gradient(ellipse at center, rgba(255,255,255,0.35) 0%, transparent 65%)',
            }}
          >
            {/* Story mode ambient overlay */}
            {mode === 'story' && <StoryModeOverlay animations={currentAnimations} />}

            {/* Error state */}
            {pdfError && (
              <motion.div style={{ textAlign: 'center', maxWidth: 320, padding: '0 24px' }} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
                <span style={{ fontSize: 60, display: 'inline-block', marginBottom: 20 }}>📚</span>
                <h2 style={{ fontSize: 18, fontWeight: 900, color: '#374151', marginBottom: 8 }}>Unable to load book</h2>
                <p style={{ fontSize: 13, color: '#9CA3AF', marginBottom: 24, lineHeight: 1.6 }}>
                  We couldn't open <strong>{book.title}</strong>. Check your connection and try again.
                </p>
                <motion.button onClick={onBack} style={{
                  padding: '10px 24px', borderRadius: 12,
                  background: '#6366F1', color: '#fff', fontSize: 13, fontWeight: 700,
                  border: 'none', cursor: 'pointer', boxShadow: '0 4px 12px rgba(99,102,241,0.3)',
                }} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}>
                  Go Back
                </motion.button>
              </motion.div>
            )}

            {/* Loading spinner */}
            {isLoading && !pdfError && (
              <motion.div style={{ textAlign: 'center' }} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}>
                <motion.div
                  style={{
                    width: 56, height: 56, margin: '0 auto',
                    borderRadius: '50%', border: '3px solid #E0E7FF', borderTopColor: '#6366F1',
                  }}
                  animate={{ rotate: 360 }}
                  transition={{ duration: 0.9, repeat: Infinity, ease: 'linear' }}
                />
                <p style={{ fontSize: 13, fontWeight: 600, color: '#6B7280', marginTop: 20 }}>Preparing your animated storybook…</p>
                <p style={{ fontSize: 11, color: '#9CA3AF', marginTop: 6 }}>{book.title}</p>
              </motion.div>
            )}

            {/* THE FLIPBOOK */}
            {!isLoading && !pdfError && numPages > 0 && (
              <>
                {/* Left arrow (desktop) — UPGRADED larger, more visible */}
                {!isMobile && (
                  <motion.button
                    onClick={flipPrev}
                    disabled={displayPage <= 1}
                    style={{
                      position: 'absolute', left: 12, zIndex: 20,
                      width: 52, height: 52, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer',
                      background: 'rgba(255,255,255,0.97)', border: '2px solid rgba(99,102,241,0.15)',
                      boxShadow: '0 8px 20px rgba(99,102,241,0.15), 0 2px 6px rgba(0,0,0,0.06)',
                      opacity: displayPage <= 1 ? 0.15 : 1,
                      transition: 'transform 0.2s, box-shadow 0.2s, opacity 0.3s',
                    }}
                    whileHover={displayPage > 1 ? { scale: 1.12, x: -4, boxShadow: '0 12px 30px rgba(99,102,241,0.25)' } : {}}
                    whileTap={displayPage > 1 ? { scale: 0.88 } : {}}
                  >
                    <Icon name="chevron-left" size={26} className="text-indigo-500" />
                  </motion.button>
                )}

                {/* Flipbook with enhanced book realism + zoom */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: zoomLevel }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                  onDoubleClick={zoomReset}
                  style={{
                    borderRadius: 20,
                    boxShadow: zoomLevel > 1
                      ? '0 30px 80px rgba(99,102,241,0.22), 0 12px 30px rgba(99,102,241,0.10)'
                      : '0 20px 60px rgba(99,102,241,0.14), 0 8px 24px rgba(99,102,241,0.08)',
                    background: 'linear-gradient(180deg, #ffffff, #f8f6ff)',
                    padding: isMobile ? 0 : 6,
                    /* Spine depth effect */
                    position: 'relative',
                    perspective: 2000,
                    transformOrigin: 'center center',
                    cursor: zoomLevel > 1 ? 'zoom-out' : 'default',
                    transition: 'box-shadow 0.3s ease',
                  }}
                >
                  {/* Spine shadow */}
                  {!isMobile && (
                    <div style={{
                      position: 'absolute',
                      top: 0, bottom: 0,
                      left: '50%',
                      width: 12,
                      transform: 'translateX(-50%)',
                      background: 'linear-gradient(90deg, rgba(99,102,241,0.08), rgba(99,102,241,0.02), rgba(99,102,241,0.08))',
                      zIndex: 10,
                      pointerEvents: 'none',
                    }} />
                  )}

                  {/* @ts-ignore - react-pageflip types */}
                  <HTMLFlipBook
                    ref={bookRef}
                    width={dimensions.width}
                    height={dimensions.height}
                    size="fixed"
                    minWidth={200}
                    maxWidth={1500}
                    minHeight={280}
                    maxHeight={1500}
                    maxShadowOpacity={0.15}
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

                {/* Right arrow (desktop) — UPGRADED larger, more visible */}
                {!isMobile && (
                  <motion.button
                    onClick={flipNext}
                    disabled={displayPage >= numPages}
                    style={{
                      position: 'absolute', right: 12, zIndex: 20,
                      width: 52, height: 52, borderRadius: '50%',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer',
                      background: 'rgba(255,255,255,0.97)', border: '2px solid rgba(99,102,241,0.15)',
                      boxShadow: '0 8px 20px rgba(99,102,241,0.15), 0 2px 6px rgba(0,0,0,0.06)',
                      opacity: displayPage >= numPages ? 0.15 : 1,
                      transition: 'transform 0.2s, box-shadow 0.2s, opacity 0.3s',
                    }}
                    whileHover={displayPage < numPages ? { scale: 1.12, x: 4, boxShadow: '0 12px 30px rgba(99,102,241,0.25)' } : {}}
                    whileTap={displayPage < numPages ? { scale: 0.88 } : {}}
                  >
                    <Icon name="chevron-right" size={26} className="text-indigo-500" />
                  </motion.button>
                )}
              </>
            )}
          </div>

          {/* ─── FULL-WIDTH ACTIVITIES SECTION BELOW BOOK ─── */}
          {!isLoading && !pdfError && displayPage >= 1 && displayPage <= numPages && (
            <motion.div
              style={{
                flexShrink: 0,
                overflow: 'hidden',
                background: 'rgba(255,255,255,0.92)',
                borderTop: '1px solid rgba(99,102,241,0.08)',
                borderBottom: activitiesExpanded ? '1px solid rgba(99,102,241,0.08)' : 'none',
              }}
              initial={false}
              animate={{ maxHeight: activitiesExpanded ? 400 : 40 }}
              transition={{ duration: 0.3, ease: 'easeInOut' }}
            >
              {/* Toggle button */}
              <motion.button
                onClick={() => setActivitiesExpanded(!activitiesExpanded)}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: isMobile ? '6px 12px' : '8px 24px',
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 11,
                  fontWeight: 700,
                  color: '#6366F1',
                }}
                whileHover={{ background: 'rgba(99,102,241,0.04)' }}
                whileTap={{ scale: 0.98 }}
              >
                <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>  
                  🎯 Quick Activities
                </span>
                <motion.span
                  animate={{ rotate: activitiesExpanded ? 180 : 0 }}
                  transition={{ duration: 0.3 }}
                  style={{ fontSize: 14 }}
                >
                  ▼
                </motion.span>
              </motion.button>
              
              {/* Activities content */}
              {activitiesExpanded && (
                <motion.div 
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ duration: 0.25 }}
                  style={{ 
                    padding: isMobile ? '0 8px 8px' : '0 24px 12px',
                    overflow: 'auto',
                    maxHeight: 360,
                  }}
                >
                  <PageActivities
                    pageNum={displayPage}
                    pageText={bothPagesText}
                    bookTitle={book.title}
                    onQuizComplete={(correct) => tracker.trackQuizResult(correct)}
                    onVocabInteraction={() => tracker.trackWordClick()}
                  />
                </motion.div>
              )}
            </motion.div>
          )}

          {/* ─── MOBILE BOTTOM BAR ─── */}
          {numPages > 0 && !isLoading && isMobile && !isFullscreen && (
            <div
              style={{
                flexShrink: 0,
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '8px 12px',
                background: 'rgba(255,255,255,0.94)', borderTop: '1px solid rgba(99,102,241,0.06)',
                backdropFilter: 'blur(16px)',
              }}
            >
              <motion.button onClick={flipPrev} disabled={displayPage <= 1}
                style={{
                  padding: '6px 16px', borderRadius: 12,
                  background: '#F3F4F6', color: '#4B5563', fontSize: 11, fontWeight: 700,
                  border: 'none', cursor: 'pointer', opacity: displayPage <= 1 ? 0.3 : 1,
                }}
                whileTap={{ scale: 0.95 }}>
                ← Prev
              </motion.button>
              <span style={{ fontSize: 11, fontWeight: 700, color: '#4B5563', fontVariantNumeric: 'tabular-nums' }}>
                {`${displayPage} / ${numPages}`}
              </span>
              <motion.button onClick={flipNext} disabled={displayPage >= numPages}
                style={{
                  padding: '6px 16px', borderRadius: 12,
                  background: '#F3F4F6', color: '#4B5563', fontSize: 11, fontWeight: 700,
                  border: 'none', cursor: 'pointer', opacity: displayPage >= numPages ? 0.3 : 1,
                }}
                whileTap={{ scale: 0.95 }}>
                Next →
              </motion.button>
            </div>
          )}

          {/* ─── DESKTOP BOTTOM INFO BAR — UPGRADED page indicator ─── */}
          {numPages > 0 && !isLoading && !isMobile && !isFullscreen && (
            <div
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16,
                padding: '8px 0', flexShrink: 0,
                background: 'rgba(255,255,255,0.75)', borderTop: '1px solid rgba(99,102,241,0.06)',
                backdropFilter: 'blur(16px)', fontSize: 11, fontWeight: 600,
              }}
            >
              <span style={{ fontWeight: 700, color: '#6b5cff', fontSize: 12, letterSpacing: 0.2 }}>
                Page {displayPage} of {numPages}
              </span>
              <span style={{ color: '#D1D5DB' }}>·</span>
              <span style={{ color: '#8B5CF6', fontWeight: 700 }}>{progressPercent}% read</span>
              <span style={{ color: '#D1D5DB' }}>·</span>
              <span style={{ color: '#9CA3AF' }}>
                {mode === 'reading' ? '📖 Reading' : mode === 'story' ? '🎬 Story Mode' : '🎯 Focus Mode'}
              </span>
              <span style={{ color: '#D1D5DB' }}>·</span>
              <span style={{ color: '#A5B4FC', fontSize: 10 }}>
                {zoomLevel !== 1 ? `🔍 ${Math.round(zoomLevel * 100)}% · Double-click to reset` : '← → turn pages · Use ➕➖ to zoom'}
              </span>
            </div>
          )}
        </div>

        {/* ═══════ AI PANEL (expanded) ═══════ */}
        <AnimatePresence>
          {askAIOpen && !askAIMinimized && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: isMobile ? '100%' : 400, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{
                flexShrink: 0,
                overflow: 'hidden',
                borderLeft: isMobile ? 'none' : '1px solid rgba(99,102,241,0.08)',
                position: isMobile ? 'fixed' : 'relative',
                top: isMobile ? 0 : 'auto',
                right: isMobile ? 0 : 'auto',
                bottom: isMobile ? 0 : 'auto',
                zIndex: isMobile ? 190 : 'auto',
                height: isMobile ? '100%' : 'auto',
              }}
            >
              <AskAIPanel
                open={true}
                onClose={handleCloseAI}
                onMinimize={handleMinimizeAI}
                pageText={bothPagesText}
                pageNum={displayPage}
                bookTitle={book.title}
                bookBoard={book.board === 'ncert' ? 'NCERT' : 'GSEB'}
                onQuestionAsked={(q) => tracker.trackAIQuestion(q)}
                inline={!isMobile}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ═══════ MINIMIZED AI BUBBLE ═══════ */}
      <AnimatePresence>
        {askAIOpen && askAIMinimized && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={handleExpandAI}
            style={{
              position: 'fixed',
              bottom: isMobile ? 70 : 24,
              right: 24,
              zIndex: 160,
              width: 56, height: 56,
              borderRadius: '50%',
              background: 'linear-gradient(135deg, #6366F1, #8B5CF6)',
              color: '#fff',
              border: 'none', cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 6px 24px rgba(99,102,241,0.4)',
              fontSize: 22,
            }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            title="Expand AI Panel"
          >
            🤖
          </motion.button>
        )}
      </AnimatePresence>

      {/* ═══════ READING ANALYTICS PANEL ═══════ */}
      <AnimatePresence>
        {showStats && (
          <ReadingAnalyticsPanel
            stats={tracker.stats}
            elapsedTime={tracker.getElapsedTime()}
            onClose={() => setShowStats(false)}
          />
        )}
      </AnimatePresence>

      {/* ═══════ WORD POPOVER ═══════ */}
      <AnimatePresence>
        {selectedWord && (
          <WordPopover
            word={selectedWord.word}
            x={selectedWord.x}
            y={selectedWord.y}
            lang={currentLang}
            onClose={() => setSelectedWord(null)}
            onAskAI={(q) => {
              tracker.trackAIQuestion(q);
              handleOpenAI();
              setSelectedWord(null);
            }}
          />
        )}
      </AnimatePresence>

      {/* ═══════ NARRATION INDICATOR ═══════ */}
      <AnimatePresence>
        {narration.state !== 'idle' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{
              position: 'fixed',
              bottom: isMobile ? 60 : 50,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 150,
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '8px 16px',
              borderRadius: 20,
              background: 'rgba(99,102,241,0.95)',
              backdropFilter: 'blur(10px)',
              boxShadow: '0 4px 20px rgba(99,102,241,0.3)',
            }}
          >
            <motion.span
              animate={{ scale: [1, 1.2, 1] }}
              transition={{ duration: 1, repeat: Infinity }}
              style={{ fontSize: 14 }}
            >🔊</motion.span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#fff' }}>
              {narration.state === 'playing' ? 'Reading aloud…' : 'Paused'}
            </span>
            {narration.highlightedWord && (
              <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.7)' }}>
                — "{narration.highlightedWord}"
              </span>
            )}
            <motion.button
              onClick={() => narration.stopNarration()}
              style={{
                width: 22, height: 22, borderRadius: '50%',
                border: 'none', background: 'rgba(255,255,255,0.2)',
                color: '#fff', cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: 10, fontWeight: 900,
              }}
              whileTap={{ scale: 0.9 }}
            >✕</motion.button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ── Helpers ───────────────────────────────────── */
function formatMs(ms: number): string {
  if (ms < 60000) return `${Math.round(ms / 1000)}s`;
  if (ms < 3600000) return `${Math.round(ms / 60000)}m`;
  return `${Math.floor(ms / 3600000)}h ${Math.round((ms % 3600000) / 60000)}m`;
}

export default BookReaderPage;
