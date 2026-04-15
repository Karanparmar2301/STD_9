import axios from 'axios';
import {
    DEMO_UID,
    getDemoBookStats,
    getDemoBookChapters,
    getDemoPerformanceSubjects,
} from '../constants/demoCatalog';

const DEMO_MODE_KEY = 'demoMode';
export const API_AUTH_EXPIRED_EVENT = 'app:auth-expired';
const DEFAULT_PROD_BACKEND_URL = 'https://student-dashboard-backend.onrender.com';

// Safely read the environment variable that Vite injects at build time
const rawApiUrl = import.meta.env.VITE_API_URL;
// Normalize API URL and allow either backend root URL or URL ending with /api.
const normalizedApiUrl = rawApiUrl ? rawApiUrl.replace(/\/+$/, '') : '';
const configuredBackendUrl = normalizedApiUrl.replace(/\/api$/i, '');
const BACKEND_URL = configuredBackendUrl || (import.meta.env.PROD ? DEFAULT_PROD_BACKEND_URL : '');

// All requests go through the Vite proxy (both dev and prod) -> In prod, appending /api to BACKEND_URL
const API_BASE_URL = BACKEND_URL ? `${BACKEND_URL}/api` : '/api';

// Auth endpoints also go through the Vite proxy -> In prod, absolute URL to backend
const AUTH_BASE_URL = BACKEND_URL;

if (import.meta.env.PROD && !configuredBackendUrl) {
    console.warn(`[API] Missing VITE_API_URL in production. Falling back to ${DEFAULT_PROD_BACKEND_URL}.`);
}

// Create axios instance
const api = axios.create({
    baseURL: API_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// Track if we're currently refreshing token to avoid multiple refresh requests
let isRefreshing = false;
let refreshSubscribers = [];
let authExpiredSignaled = false;

function emitAuthExpired(reason = 'unauthorized') {
    if (authExpiredSignaled || typeof window === 'undefined') {
        return;
    }
    authExpiredSignaled = true;
    window.dispatchEvent(new CustomEvent(API_AUTH_EXPIRED_EVENT, {
        detail: { reason }
    }));
}

function resetAuthExpiredSignal() {
    authExpiredSignaled = false;
}

function isDemoModeEnabled() {
    try {
        return localStorage.getItem(DEMO_MODE_KEY) === 'true';
    } catch {
        return false;
    }
}

function parseRequestBody(data) {
    if (!data) return {};
    if (typeof data === 'string') {
        try {
            return JSON.parse(data);
        } catch {
            return {};
        }
    }
    if (typeof FormData !== 'undefined' && data instanceof FormData) {
        return Object.fromEntries(data.entries());
    }
    return data;
}

function extractPath(url = '') {
    try {
        return new URL(url, 'https://demo.local').pathname;
    } catch {
        return String(url).split('?')[0] || '/';
    }
}

function normalizeApiPath(url = '') {
    const path = extractPath(url).replace(/\/+$/, '') || '/';
    return path.replace(/^\/api(?=\/|$)/i, '') || '/';
}

function isAssistantPath(path = '') {
    return path.startsWith('/assistant/') || path === '/chat';
}

function daysAgoIso(daysAgo) {
    const d = new Date();
    d.setDate(d.getDate() - daysAgo);
    return d.toISOString().split('T')[0];
}

function getDemoAttendance() {
    const records = [
        { date: daysAgoIso(0), status: 'present' },
        { date: daysAgoIso(1), status: 'present' },
        { date: daysAgoIso(2), status: 'present' },
        { date: daysAgoIso(3), status: 'absent' },
        { date: daysAgoIso(4), status: 'present' },
        { date: daysAgoIso(5), status: 'present' },
        { date: daysAgoIso(6), status: 'present' },
        { date: daysAgoIso(7), status: 'present' },
        { date: daysAgoIso(8), status: 'present' },
        { date: daysAgoIso(9), status: 'absent' },
    ];

    return {
        records: records.map((r) => ({
            ...r,
            attendance_date: r.date,
        })),
        monthlyData: [
            { month: 'Jan', present: 23, absent: 2 },
            { month: 'Feb', present: 21, absent: 3 },
            { month: 'Mar', present: 24, absent: 1 },
            { month: 'Apr', present: 22, absent: 2 },
        ],
    };
}

const DEMO_TIMETABLE_SLOTS = [
    { id: 'p1', label: 'Period 1', start: '08:00', end: '08:45', is_break: false },
    { id: 'p2', label: 'Period 2', start: '08:45', end: '09:30', is_break: false },
    { id: 'p3', label: 'Period 3', start: '09:30', end: '10:15', is_break: false },
    { id: 'b1', label: 'Break', start: '10:15', end: '10:35', is_break: true },
    { id: 'p4', label: 'Period 4', start: '10:35', end: '11:20', is_break: false },
    { id: 'p5', label: 'Period 5', start: '11:20', end: '12:05', is_break: false },
    { id: 'p6', label: 'Period 6', start: '12:05', end: '12:50', is_break: false },
];

const DEMO_TIMETABLE_SCHEDULE = {
    Monday: {
        p1: { subject: 'Mathematics', teacher: 'Ms. Patel' },
        p2: { subject: 'English', teacher: 'Mr. Sharma' },
        p3: { subject: 'Science', teacher: 'Ms. Rao' },
        b1: { subject: 'Break', teacher: '' },
        p4: { subject: 'Social Science', teacher: 'Mr. Joshi' },
        p5: { subject: 'Hindi', teacher: 'Ms. Verma' },
        p6: { subject: 'PT', teacher: 'Coach Mehta' },
    },
    Tuesday: {
        p1: { subject: 'English', teacher: 'Mr. Sharma' },
        p2: { subject: 'Mathematics', teacher: 'Ms. Patel' },
        p3: { subject: 'Sanskrit', teacher: 'Mr. Iyer' },
        b1: { subject: 'Break', teacher: '' },
        p4: { subject: 'Science', teacher: 'Ms. Rao' },
        p5: { subject: 'Fine Art', teacher: 'Ms. Shah' },
        p6: { subject: 'Voc. Education', teacher: 'Mr. Khan' },
    },
    Wednesday: {
        p1: { subject: 'Science', teacher: 'Ms. Rao' },
        p2: { subject: 'Mathematics', teacher: 'Ms. Patel' },
        p3: { subject: 'English', teacher: 'Mr. Sharma' },
        b1: { subject: 'Break', teacher: '' },
        p4: { subject: 'Hindi', teacher: 'Ms. Verma' },
        p5: { subject: 'Social Science', teacher: 'Mr. Joshi' },
        p6: { subject: 'PT', teacher: 'Coach Mehta' },
    },
    Thursday: {
        p1: { subject: 'Social Science', teacher: 'Mr. Joshi' },
        p2: { subject: 'English', teacher: 'Mr. Sharma' },
        p3: { subject: 'Mathematics', teacher: 'Ms. Patel' },
        b1: { subject: 'Break', teacher: '' },
        p4: { subject: 'Science', teacher: 'Ms. Rao' },
        p5: { subject: 'Sanskrit', teacher: 'Mr. Iyer' },
        p6: { subject: 'Fine Art', teacher: 'Ms. Shah' },
    },
    Friday: {
        p1: { subject: 'Hindi', teacher: 'Ms. Verma' },
        p2: { subject: 'Mathematics', teacher: 'Ms. Patel' },
        p3: { subject: 'Science', teacher: 'Ms. Rao' },
        b1: { subject: 'Break', teacher: '' },
        p4: { subject: 'English', teacher: 'Mr. Sharma' },
        p5: { subject: 'Voc. Education', teacher: 'Mr. Khan' },
        p6: { subject: 'PT', teacher: 'Coach Mehta' },
    },
    Saturday: {
        p1: { subject: 'Mathematics', teacher: 'Ms. Patel' },
        p2: { subject: 'English', teacher: 'Mr. Sharma' },
        p3: { subject: 'Science', teacher: 'Ms. Rao' },
        b1: { subject: 'Break', teacher: '' },
        p4: { subject: 'Social Science', teacher: 'Mr. Joshi' },
        p5: { subject: 'Fine Art', teacher: 'Ms. Shah' },
        p6: { subject: 'PT', teacher: 'Coach Mehta' },
    },
};

const DEMO_BOOKS = getDemoBookStats();

function getDemoBookStatsBySlug(subjectSlug) {
    return DEMO_BOOKS.find(
        (book) => book.slug.toLowerCase() === String(subjectSlug || '').toLowerCase()
    );
}

function getDemoBookProgressBySlug(subjectSlug) {
    const stats = getDemoBookStatsBySlug(subjectSlug);
    if (!stats) {
        return { completed: [], read: [] };
    }

    const chapterCount = Math.max(stats.count || 0, 0);
    const completedCount = Math.min(stats.completedCount || 0, chapterCount);
    const completed = Array.from({ length: completedCount }, (_, idx) => idx + 1);
    const readCount = Math.min(chapterCount, Math.max(completedCount + 1, completedCount));
    const read = Array.from({ length: readCount }, (_, idx) => idx + 1);

    return { completed, read };
}

function getDemoPerformancePayload() {
    const subjects = getDemoPerformanceSubjects();
    const topSubject = subjects.reduce(
        (best, current) => (current.avg > best.avg ? current : best),
        subjects[0] || { name: 'Mathematics', avg: 0 }
    );

    return {
        overallAverage: 83,
        growth: 7,
        topSubject: topSubject.name,
        examsCompleted: 8,
        subjects,
        monthly: [
            { month: 'Jan', avg: 74 },
            { month: 'Feb', avg: 78 },
            { month: 'Mar', avg: 81 },
            { month: 'Apr', avg: 83 },
        ],
    };
}

function getDemoInsights() {
    return [
        {
            id: 'ins-1',
            user_id: DEMO_UID,
            type: 'HOMEWORK',
            severity: 'MEDIUM',
            title: 'Homework Consistency Can Improve',
            description: 'You are doing well. Try finishing pending homework by evening to keep your momentum.',
            recommendation: 'Complete 1 pending task today and review 1 completed chapter.',
            confidence: 0.86,
            status: 'active',
            subject: 'Mathematics',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        },
        {
            id: 'ins-2',
            user_id: DEMO_UID,
            type: 'ATTENDANCE',
            severity: 'LOW',
            title: 'Attendance Looks Great',
            description: 'Your attendance trend is steady this month. Keep it above 90% to unlock rewards.',
            recommendation: 'Continue your daily streak and maintain punctuality.',
            confidence: 0.93,
            status: 'active',
            subject: 'General',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        },
    ];
}

function getDemoActivities() {
    return [
        {
            id: 'act-1',
            user_id: DEMO_UID,
            event_type: 'LOGIN',
            title: 'Logged In',
            description: 'Started a new learning session',
            subject: 'General',
            xp_earned: 2,
            timestamp: new Date(Date.now() - 3600000).toISOString(),
        },
        {
            id: 'act-2',
            user_id: DEMO_UID,
            event_type: 'HOMEWORK_COMPLETED',
            title: 'Homework Completed',
            description: 'Finished Algebra Worksheet',
            subject: 'Mathematics',
            xp_earned: 8,
            timestamp: new Date(Date.now() - 7200000).toISOString(),
        },
        {
            id: 'act-3',
            user_id: DEMO_UID,
            event_type: 'BOOK_OPENED',
            title: 'Book Opened',
            description: 'Read Science chapter',
            subject: 'Science',
            xp_earned: 4,
            timestamp: new Date(Date.now() - 10800000).toISOString(),
        },
    ];
}

function getDemoDataForRequest(config) {
    const method = (config?.method || 'get').toLowerCase();
    const rawPath = normalizeApiPath(config?.url || '/');
    const path = rawPath.toLowerCase();
    const body = parseRequestBody(config?.data);

    if (method === 'get' && /^\/dashboard\/[^/]+$/i.test(path)) {
        return {
            uid: DEMO_UID,
            student_name: 'Demo Student',
            student_id: 'DEMO_001',
            email: 'demo@school.com',
            class_section: '8-A',
            attendance_percentage: 95,
            present_days: 152,
            absent_days: 8,
            total_days: 160,
            attendance_streak: 5,
            homework_completed: 12,
            homework_total: 15,
            reward_points: 450,
            achievement_stars: 23,
            badges: [],
            games_played: 8,
            high_score: 92,
            current_level: 4,
            streak: 5,
        };
    }

    if (method === 'get' && /^\/profile\/check\/[^/]+$/i.test(path)) {
        return {
            exists: true,
            profile: {
                uid: DEMO_UID,
                student_name: 'Demo Student',
                student_id: 'DEMO_001',
                class_section: '8-A',
                father_name: 'Rakesh Kumar',
                mother_name: 'Sunita Kumar',
                mobile: '9876543210',
                email: 'demo@school.com',
                address: 'Ahmedabad, Gujarat',
            },
        };
    }

    if (method === 'get' && path === '/holidays/2026') {
        return {
            holidays: [
                { date: '2026-01-26', name: 'Republic Day', type: 'National Holiday' },
                { date: '2026-08-15', name: 'Independence Day', type: 'National Holiday' },
                { date: '2026-10-02', name: 'Gandhi Jayanti', type: 'National Holiday' },
            ],
            year: 2026,
            total: 3,
        };
    }

    if (method === 'get' && /^\/attendance\/[^/]+$/i.test(path)) {
        return getDemoAttendance();
    }

    if (method === 'get' && /^\/timetable\/[^/]+$/i.test(path)) {
        return {
            slots: DEMO_TIMETABLE_SLOTS,
            schedule: DEMO_TIMETABLE_SCHEDULE,
        };
    }

    if (method === 'get' && /^\/performance\/[^/]+$/i.test(path)) {
        return getDemoPerformancePayload();
    }

    if (method === 'get' && /^\/subject-details\/[^/]+\/[^/]+$/i.test(path)) {
        return {
            teacher: 'Ms. Patel',
            weekly_periods: 5,
            section: '8-A',
            academic_year: '2025-26',
            average_score: 88,
            rank: 5,
            total_exams: 8,
            attendance_pct: 95,
            days_scheduled: 'Mon-Sat',
            next_class: {
                relative: 'Tomorrow',
                time: '08:00 AM',
            },
            last_class: {
                relative: 'Today',
            },
            last_scores: [
                { label: 'Unit Test 1', score: 84 },
                { label: 'Unit Test 2', score: 88 },
                { label: 'Mid Term', score: 90 },
                { label: 'Quiz', score: 86 },
            ],
            insight: 'Consistent improvement trend. Focus a little more on application-based questions.',
            skill_breakdown: [
                { name: 'Concept Clarity', score: 90 },
                { name: 'Problem Solving', score: 84 },
                { name: 'Speed & Accuracy', score: 86 },
            ],
            teacher_feedback: 'Very good progress this term. Keep practicing regularly and ask doubts early.',
        };
    }

    if (method === 'get' && /^\/books\/[^/]+\/progress-all$/i.test(path)) {
        const progress = Object.fromEntries(
            DEMO_BOOKS.map((book) => [book.slug, getDemoBookProgressBySlug(book.slug)])
        );

        return {
            progress,
        };
    }

    if (method === 'post' && /^\/books\/[^/]+\/progress$/i.test(path)) {
        return {
            success: true,
            newlyCompleted: true,
        };
    }

    if (method === 'get' && path === '/books') {
        return DEMO_BOOKS;
    }

    if (method === 'get' && /^\/books\/std_8_[^/]+$/i.test(path)) {
        const subjectSlug = rawPath.split('/').filter(Boolean)[1] || 'Std_8_math';
        return getDemoBookChapters(subjectSlug);
    }

    if (method === 'get' && /^\/books\/std_8_[^/]+\/zip-info$/i.test(path)) {
        const subjectSlug = rawPath.split('/').filter(Boolean)[1] || 'Std_8_math';
        const stats = getDemoBookStatsBySlug(subjectSlug);
        const chapterCount = stats?.count || getDemoBookChapters(subjectSlug).filter((c) => !c.is_index).length;
        const approxSizeMb = Math.max(1, Math.round(chapterCount * 0.35));

        return {
            cached: true,
            size_bytes: approxSizeMb * 1048576,
            size_mb: approxSizeMb,
            chapter_count: chapterCount,
        };
    }

    if (method === 'get' && /^\/books\/std_8_[^/]+\/download-all$/i.test(path)) {
        const demoZipText = `Demo ZIP package for ${rawPath}`;
        if (typeof Blob !== 'undefined') {
            return new Blob([demoZipText], { type: 'application/zip' });
        }
        return demoZipText;
    }

    if (method === 'delete' && /^\/books\/std_8_[^/]+\/zip-cache$/i.test(path)) {
        return {
            success: true,
            message: 'Demo cache cleared',
        };
    }

    if (method === 'get' && /^\/homework\/[^/]+$/i.test(path)) {
        return {
            pending: [
                {
                    id: 'hw-1',
                    subject: 'Mathematics',
                    question: 'Solve: 24 + 17',
                    answer: '41',
                    due_date: 'Today',
                },
                {
                    id: 'hw-2',
                    subject: 'Science',
                    question: 'Name one non-renewable resource.',
                    answer: 'Coal',
                    due_date: 'Tomorrow',
                },
            ],
            completed: [
                {
                    id: 'hw-3',
                    subject: 'English',
                    question: 'Write 5 lines about your school.',
                    completed_at: new Date(Date.now() - 86400000).toISOString(),
                    student_answer: 'Completed',
                },
            ],
            stats: {
                total: 3,
                completed: 1,
                pending: 2,
                completion_rate: 33,
            },
        };
    }

    if (method === 'post' && path === '/homework/submit') {
        return {
            success: true,
            correct: true,
            message: 'Great job! Homework completed.',
            stats: {
                total: 3,
                completed: 2,
                pending: 1,
                completion_rate: 67,
            },
        };
    }

    if (method === 'get' && /^\/announcements\/[^/]+$/i.test(path)) {
        return {
            announcements: [
                {
                    id: 'ann-1',
                    title: 'Math Revision Test on Friday',
                    description: 'Prepare chapters 1 to 3. Bring your notebook.',
                    category: 'student',
                    is_read: false,
                    created_at: new Date().toISOString(),
                },
            ],
            unread_count: 1,
        };
    }

    if (method === 'post' && path === '/announcement/read') {
        return {
            success: true,
            announcement_id: body.announcement_id || null,
            unread_count: 0,
        };
    }

    if (method === 'get' && /^\/insights\/[^/]+$/i.test(path)) {
        return {
            data: getDemoInsights(),
            summary: 'You are progressing well this week.',
            recommendation: 'Keep revising Mathematics and Science daily.',
            trend: 'up',
            score: 83,
            generated_at: new Date().toISOString(),
        };
    }

    if (method === 'post' && (path === '/insights/dismiss' || path === '/insights/complete' || path === '/insights/generate')) {
        return {
            success: true,
            data: getDemoInsights(),
        };
    }

    if (method === 'get' && /^\/analytics\/performance\/[^/]+$/i.test(path)) {
        return {
            xp_timeline: [
                { week: 'W1', xp: 120 },
                { week: 'W2', xp: 150 },
                { week: 'W3', xp: 170 },
                { week: 'W4', xp: 190 },
            ],
            source_breakdown: [
                { source: 'Homework', value: 45 },
                { source: 'Reading', value: 30 },
                { source: 'Attendance', value: 25 },
            ],
            weekly_progress: [72, 76, 79, 83],
            subject_scores: {
                Mathematics: 90,
                Science: 86,
                English: 81,
            },
            current_stats: {
                average: 83,
                rank: 5,
            },
        };
    }

    if (method === 'get' && /^\/activities\/stats\/[^/]+$/i.test(path)) {
        return {
            success: true,
            stats: {
                total_activities: 24,
                total_xp_earned: 340,
                by_type: {
                    HOMEWORK_COMPLETED: 8,
                    BOOK_OPENED: 10,
                    ATTENDANCE_MARKED: 6,
                },
                by_subject: {
                    Mathematics: 10,
                    Science: 8,
                    English: 6,
                },
                last_activity: new Date().toISOString(),
            },
        };
    }

    if (method === 'get' && /^\/activities\/[^/]+$/i.test(path)) {
        return {
            success: true,
            activities: getDemoActivities(),
        };
    }

    if (method === 'post' && path === '/activities/log') {
        return {
            success: true,
            event: {
                id: `act-${Date.now()}`,
                ...body,
                timestamp: new Date().toISOString(),
                xp_earned: body.xp_earned || 2,
            },
        };
    }

    if (method === 'get' && /^\/assistant\/history\/[^/]+$/i.test(path)) {
        return { messages: [] };
    }

    if (method === 'post' && path === '/assistant/chat') {
        const prompt = body.message || 'your question';
        return {
            reply: `Great question about "${prompt}". In demo mode, live AI is unavailable, but you can still explore your books, timetable, and performance sections.` ,
            suggestions: ['Show my timetable', 'Open mathematics book', 'How can I improve attendance?'],
            timestamp: new Date().toISOString(),
            intent: 'chat',
            sources: [],
            chunks_found: 0,
        };
    }

    if (method === 'post' && path === '/profile/upload-photo') {
        return {
            success: true,
            profile_photo_url: '/api/uploads/profile_photos/demo.png',
        };
    }

    return null;
}

function getDemoFallbackResponse(error) {
    if (!isDemoModeEnabled()) return null;

    const path = normalizeApiPath(error?.config?.url || '/').toLowerCase();
    // Never fake AI assistant responses in demo fallback.
    // If assistant API fails, surface the real error instead of masking it.
    if (path.startsWith('/assistant/') || path === '/chat') {
        return null;
    }

    const status = error?.response?.status;
    const msg = String(error?.message || '').toLowerCase();
    const isNetworkError = !error?.response || error?.code === 'ERR_NETWORK' || msg.includes('network error');
    const isRecoverableStatus = [401, 403, 404, 408, 429, 500, 502, 503, 504].includes(status);

    if (!isNetworkError && !isRecoverableStatus) {
        return null;
    }

    const fallbackData = getDemoDataForRequest(error?.config || {});
    if (fallbackData === null) {
        return null;
    }

    return {
        data: fallbackData,
        status: 200,
        statusText: 'OK',
        headers: { 'x-demo-fallback': '1' },
        config: error?.config,
        request: error?.request,
    };
}

// Subscribe failed request to retry after token refresh
function subscribeTokenRefresh() {
    return new Promise((resolve, reject) => {
        refreshSubscribers.push({ resolve, reject });
    });
}

// Notify all subscribers when token is refreshed
function onTokenRefreshed(newToken) {
    refreshSubscribers.forEach((subscriber) => subscriber.resolve(newToken));
    refreshSubscribers = [];
}

function onTokenRefreshFailed(refreshError) {
    refreshSubscribers.forEach((subscriber) => subscriber.reject(refreshError));
    refreshSubscribers = [];
}

// Add request interceptor to include auth token
api.interceptors.request.use(
    (config) => {
        const skipAuth = config?.headers?.['X-Skip-Auth'] === '1' || config?.headers?.['x-skip-auth'] === '1';
        if (skipAuth) {
            if (config.headers) {
                delete config.headers['X-Skip-Auth'];
                delete config.headers['x-skip-auth'];
                delete config.headers.Authorization;
            }
            return config;
        }

        const token = localStorage.getItem('authToken');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Add response interceptor for token expiry handling
api.interceptors.response.use(
    (response) => {
        // Success response - pass through
        return response;
    },
    async (error) => {
        const demoFallback = getDemoFallbackResponse(error);
        if (demoFallback) {
            return Promise.resolve(demoFallback);
        }

        const originalRequest = error.config || {};
        const requestPath = normalizeApiPath(originalRequest?.url || '/').toLowerCase();
        const assistantRequest = isAssistantPath(requestPath);

        // Check if error is 401 (Unauthorized)
        if (error.response?.status === 401) {
            // Assistant endpoint supports optional auth. Retry once without auth token
            // so a stale JWT does not log the user out mid-chat.
            if (assistantRequest) {
                if (!originalRequest._retryWithoutAuth) {
                    originalRequest._retryWithoutAuth = true;
                    originalRequest.headers = originalRequest.headers || {};
                    originalRequest.headers['X-Skip-Auth'] = '1';
                    return api(originalRequest);
                }
                return Promise.reject(error);
            }

            if (!originalRequest._retry) {

                // Check error code - if TOKEN_EXPIRED, try to refresh
                const errorCode = error.response?.data?.error_code;

                if (errorCode === 'TOKEN_EXPIRED') {
                    // Try to refresh token
                    const refreshToken = localStorage.getItem('refreshToken');

                    if (refreshToken && !isRefreshing) {
                        isRefreshing = true;
                        originalRequest._retry = true;

                        try {
                            // Request new access token
                            const response = await authAxios.post('/auth/refresh', { refresh_token: refreshToken });
                            const newToken = response.data.token || response.data.access_token;

                            if (!newToken) {
                                throw new Error('Refresh response did not include an access token');
                            }

                            // Save new token
                            localStorage.setItem('authToken', newToken);
                            resetAuthExpiredSignal();

                            // Update original request with new token
                            originalRequest.headers.Authorization = `Bearer ${newToken}`;

                            // Notify all waiting requests
                            onTokenRefreshed(newToken);
                            isRefreshing = false;

                            // Retry original request
                            return api(originalRequest);

                        } catch (refreshError) {
                            // Refresh failed - logout user state without hard page reload
                            console.error('[Auth] Token refresh failed, clearing auth state');
                            isRefreshing = false;
                            localStorage.removeItem('authToken');
                            localStorage.removeItem('refreshToken');
                            onTokenRefreshFailed(refreshError);
                            emitAuthExpired('refresh_failed');

                            return Promise.reject(refreshError);
                        }
                    } else if (isRefreshing) {
                        // Queue this request to retry after refresh completes
                        try {
                            const newToken = await subscribeTokenRefresh();
                            originalRequest.headers = originalRequest.headers || {};
                            originalRequest.headers.Authorization = `Bearer ${newToken}`;
                            return api(originalRequest);
                        } catch (refreshError) {
                            return Promise.reject(refreshError);
                        }
                    }
                }

                // Token expired and no refresh token, or other 401 error
                console.error('[Auth] Authentication failed, clearing auth state');
                localStorage.removeItem('authToken');
                localStorage.removeItem('refreshToken');
                emitAuthExpired(errorCode || 'unauthorized');
            }
        }

        // Return error for other status codes
        return Promise.reject(error);
    }
);

// API methods
export const apiService = {
    // Holidays
    getHolidays: () => api.get('/holidays/2026'),

    // Student data
    getStudentData: (uid) => api.get(`/dashboard/${uid}`),

    // Profile management
    checkProfile: (uid) => api.get(`/profile/check/${uid}`),
    createProfile: (profileData) => api.post('/profile/create', profileData),
    updateProfile: (uid, profileData) => api.patch(`/profile/${uid}`, profileData),
    uploadProfilePhoto: (formData) => {
        return api.post('/profile/upload-photo', formData, {
            headers: {
                'Content-Type': 'multipart/form-data'
            }
        });
    },

    // Game completion
    completeGame: (gameData) => api.post('/game/complete', gameData),
    completeAlphabetGame: (gameData) => api.post('/game/alphabet/complete', gameData),
    getGamesStats: (uid) => api.get(`/games/stats/${uid}`),

    // Homework
    getHomework: (uid) => api.get(`/homework/${uid}`),
    submitHomework: (homeworkData) => api.post('/homework/submit', homeworkData),

    // Analytics
    getStudentAnalytics: (uid) => api.get(`/analytics/student/${uid}`),
    getAlphabetAnalytics: (uid) => api.get(`/analytics/alphabet/${uid}`),

    // Announcements
    getAnnouncements: (uid) => api.get(`/announcements/${uid}`),
    markAnnouncementRead: (data) => api.post('/announcement/read', data),

    // Gamification Engine
    processGamificationEvent: (data) => api.post('/gamification/process', data),
    getGamificationStatus: (uid) => api.get(`/gamification/status/${uid}`),

    // Unified action trigger (single source of truth)
    completeAction: (data) => api.post('/action/complete', data),

    // Performance Analytics
    getPerformanceAnalytics: (uid) => api.get(`/analytics/performance/${uid}`),

    // AI Insights
    getAIInsights: (uid) => api.get(`/insights/${uid}`),

    // AI Learning Assistant
    sendChatMessage: (data) => api.post('/assistant/chat', data),
    getChatHistory: (uid) => api.get(`/assistant/history/${uid}`),

    // ── Digital Book System ──
    getAllSubjects: () => api.get(`/books?t=${Date.now()}`),
    getSubjectChapters: (subject) => api.get(`/books/${subject}?t=${Date.now()}`),
    // Returns { cached, size_bytes, size_mb, chapter_count } — used for pre-download info
    getZipInfo: (subject) => api.get(`/books/${subject}/zip-info`),
    // Downloads the full subject ZIP (cached on backend after first build)
    downloadAllPdfs: (subject) => api.get(`/books/${subject}/download-all`, { responseType: 'blob' }),
    // Admin: invalidate cached ZIP after uploading new chapters
    clearZipCache: (subject) => api.delete(`/books/${subject}/zip-cache`),
    updateBookProgress: (uid, subject, data) =>
        api.post(`/books/${uid}/progress?subject=${encodeURIComponent(subject)}`, data),
    getAllBookProgress: (uid) => api.get(`/books/${uid}/progress-all`),

    // Timetable
    getTimetable: (uid) => api.get(`/timetable/${uid}`),

    // Performance Dashboard
    getPerformance: (uid) => api.get(`/performance/${uid}`),
    
    // Subject Details (for flip card back side)
    getSubjectDetails: (uid, subject) => api.get(`/subject-details/${uid}/${encodeURIComponent(subject)}`),
};

// Create a separate axios instance for auth without interceptors affecting auth
const authAxios = axios.create({
    baseURL: AUTH_BASE_URL,
    headers: {
        'Content-Type': 'application/json'
    }
});

// ─── Auth API (calls /auth/* — uses Vite proxy) ───────────────────────────────
export const authApi = {
    signup: (data) => authAxios.post('/auth/signup', data),
    login:  (data) => authAxios.post('/auth/login', data),
    getMe:  (token) => authAxios.get('/auth/me', {
        headers: { Authorization: `Bearer ${token}` }
    }),
    refresh: (refreshToken) => authAxios.post('/auth/refresh', { refresh_token: refreshToken }),
    changePassword: (oldPassword, newPassword, token) => authAxios.post('/auth/change-password',
        { old_password: oldPassword, new_password: newPassword },
        { headers: { Authorization: `Bearer ${token}` } }
    )
};

// ─── Standalone assistant helper (legacy) ───────────────────────────────────
export async function askAI(message, image) {
  const formData = new FormData();
  formData.append('message', message || '');
  if (image) {
    formData.append('image', image);
  }
    const chatUrl = BACKEND_URL ? `${BACKEND_URL}/chat` : '/chat';
    const response = await fetch(chatUrl, {
    method: 'POST',
    body: formData,
  });
  const data = await response.json();
  return data.answer;
}

export function buildBackendFileUrl(path = '') {
    if (!path) return '';
    if (/^https?:\/\//i.test(path)) {
        return path;
    }
    if (!path.startsWith('/')) {
        path = `/${path}`;
    }
    return BACKEND_URL ? `${BACKEND_URL}${path}` : path;
}

export default api;
