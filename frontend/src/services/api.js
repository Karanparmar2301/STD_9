import axios from 'axios';

// All requests go through the Vite proxy (both dev and prod)
const API_BASE_URL = '/api';

// Auth endpoints also go through the Vite proxy
const AUTH_BASE_URL = '';

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

// Subscribe failed request to retry after token refresh
function subscribeTokenRefresh(cb) {
    refreshSubscribers.push(cb);
}

// Notify all subscribers when token is refreshed
function onTokenRefreshed(newToken) {
    refreshSubscribers.forEach(cb => cb(newToken));
    refreshSubscribers = [];
}

// Add request interceptor to include auth token
api.interceptors.request.use(
    (config) => {
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
        const originalRequest = error.config;

        // Check if error is 401 (Unauthorized)
        if (error.response?.status === 401 && !originalRequest._retry) {

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
                        const { token: newToken } = response.data;

                        // Save new token
                        localStorage.setItem('authToken', newToken);

                        // Update original request with new token
                        originalRequest.headers.Authorization = `Bearer ${newToken}`;

                        // Notify all waiting requests
                        onTokenRefreshed(newToken);
                        isRefreshing = false;

                        // Retry original request
                        return api(originalRequest);

                    } catch (refreshError) {
                        // Refresh failed - logout user
                        console.error('[Auth] Token refresh failed, logging out');
                        isRefreshing = false;
                        localStorage.removeItem('authToken');
                        localStorage.removeItem('refreshToken');

                        // Redirect to login
                        window.location.href = '/login';

                        return Promise.reject(refreshError);
                    }
                } else if (isRefreshing) {
                    // Queue this request to retry after refresh completes
                    return new Promise((resolve) => {
                        subscribeTokenRefresh((newToken) => {
                            originalRequest.headers.Authorization = `Bearer ${newToken}`;
                            resolve(api(originalRequest));
                        });
                    });
                }
            }

            // Token expired and no refresh token, or other 401 error
            console.error('[Auth] Authentication failed, redirecting to login');
            localStorage.removeItem('authToken');
            localStorage.removeItem('refreshToken');

            // Redirect to login (avoid infinite loop by checking current path)
            if (window.location.pathname !== '/' && window.location.pathname !== '/login' && window.location.pathname !== '/signup') {
                window.location.href = '/';
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
    sendRagMessage: (data) => {
        const formData = new FormData();
        formData.append('message', data.message || '');
        formData.append('student_name', data.student_name || 'Student');
        formData.append('subject_filter', data.subject_filter || '');
        if (data.image) {
            formData.append('image', data.image);
        }
        return api.post('/assistant/rag-chat', formData, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
    },
    rebuildRagIndex: () => api.post('/assistant/rebuild-index'),

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
    baseURL: '',
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

// ─── Standalone RAG helper (Phase 8) ─────────────────────────────────────────
export async function askAI(message, image) {
  const formData = new FormData();
  formData.append('message', message || '');
  if (image) {
    formData.append('image', image);
  }
  const response = await fetch('/chat', {
    method: 'POST',
    body: formData,
  });
  const data = await response.json();
  return data.answer;
}

export default api;
