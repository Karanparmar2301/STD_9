import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import api, { authApi } from '../services/api';

const DEMO_MODE_KEY = 'demoMode';
const DEMO_USER = {
    uid: '46a04e54-aedf-4c38-bb23-571b7e0ba0e1',
    name: 'Demo Student',
    student_name: 'Demo Student',
    email: 'demo@school.com',
    class_section: '8-A',
    isDemoMode: true
};

// ─── Helpers ─────────────────────────────────────────────────────────────────
function decodeTokenPayload(token) {
    try {
        const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
        return JSON.parse(atob(base64));
    } catch {
        return null;
    }
}

// ─── Async Thunks ─────────────────────────────────────────────────────────────

export const signupUser = createAsyncThunk(
    'auth/signup',
    async ({ email, password, name, studentId, classLevel }, { rejectWithValue }) => {
        try {
            console.log('[Auth] Attempting signup for:', email);
            const res = await authApi.signup({ email, password, name, student_id: studentId, class_section: classLevel });
            console.log('[Auth] Signup successful');
            return res.data;
        } catch (err) {
            const errorMsg = err.response?.data?.detail || err.message || 'Signup failed';
            console.error('[Auth] Signup error:', errorMsg);
            return rejectWithValue(errorMsg);
        }
    }
);

export const loginUser = createAsyncThunk(
    'auth/login',
    async ({ email, password }, { rejectWithValue }) => {
        try {
            console.log('[Auth] Attempting login for:', email);
            const res = await authApi.login({ email, password });
            // Backend may return `token` OR `access_token` — handle both
            const token = res.data.token || res.data.access_token;
            const refresh_token = res.data.refresh_token;
            const uid = res.data.uid;

            if (!token || !uid) {
                throw new Error('Invalid auth response. Check VITE_API_URL and backend CORS settings.');
            }

            console.log('[Auth] Login successful, tokens received');

            // Store both access and refresh tokens
            localStorage.setItem('authToken', token);
            if (refresh_token) {
                localStorage.setItem('refreshToken', refresh_token);
            }

            // Fetch full profile data immediately after login
            try {
                const profileRes = await api.get(`/dashboard/${uid}`);
                console.log('[Auth] Profile data fetched successfully');
                return { ...profileRes.data, token, refresh_token };
            } catch (profileErr) {
                // If dashboard fetch fails, return basic login data with tokens
                console.warn('[Auth] Could not fetch full profile after login, using basic data:', profileErr.message);
                return { ...res.data, token, refresh_token };
            }
        } catch (err) {
            const errorMsg = err.response?.data?.detail || err.response?.data?.error || err.message || 'Invalid email or password';
            console.error('[Auth] Login error:', errorMsg);
            return rejectWithValue(errorMsg);
        }
    }
);

export const logoutUser = createAsyncThunk(
    'auth/logout',
    async () => {
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem(DEMO_MODE_KEY);
        return null;
    }
);

export const checkSession = createAsyncThunk(
    'auth/checkSession',
    async (_, { rejectWithValue }) => {
        try {
            const token = localStorage.getItem('authToken');
            const isDemoMode = localStorage.getItem(DEMO_MODE_KEY) === 'true';

            if (!token && isDemoMode) {
                console.log('[Auth] Demo mode session restored');
                return { ...DEMO_USER, token: null };
            }

            if (!token) {
                console.log('[Auth] No token found, user not logged in');
                return null;
            }

            // Verify token and fetch full profile data
            try {
                const res = await authApi.getMe(token);
                const uid = res.data.uid;

                // Fetch complete profile from dashboard endpoint
                try {
                    const profileRes = await api.get(`/dashboard/${uid}`);
                    console.log('[Auth] Session restored successfully');
                    return { ...profileRes.data, token };
                } catch (dashErr) {
                    console.warn('[Auth] Could not fetch full profile in session check:', dashErr.message);
                    return { ...res.data, token };
                }
            } catch (authErr) {
                // Token verification failed
                const errorCode = authErr.response?.data?.error_code;

                if (errorCode === 'TOKEN_EXPIRED') {
                    // Try to refresh token
                    const refreshToken = localStorage.getItem('refreshToken');

                    if (refreshToken) {
                        try {
                            console.log('[Auth] Token expired, attempting refresh');
                            const refreshRes = await authApi.refresh(refreshToken);
                            const newToken = refreshRes.data.token || refreshRes.data.access_token;

                            if (!newToken) {
                                throw new Error('Refresh response missing access token');
                            }

                            // Save new token
                            localStorage.setItem('authToken', newToken);

                            // Retry getting user data
                            const retryRes = await authApi.getMe(newToken);
                            const uid = retryRes.data.uid;

                            const profileRes = await api.get(`/dashboard/${uid}`);

                            console.log('[Auth] Session restored after token refresh');
                            return { ...profileRes.data, token: newToken };

                        } catch (refreshErr) {
                            console.error('[Auth] Token refresh failed:', refreshErr.message);
                            localStorage.removeItem('authToken');
                            localStorage.removeItem('refreshToken');
                            localStorage.removeItem(DEMO_MODE_KEY);
                            return null;
                        }
                    }
                }

                console.error('[Auth] Token verification failed:', authErr.message);
                localStorage.removeItem('authToken');
                localStorage.removeItem('refreshToken');
                localStorage.removeItem(DEMO_MODE_KEY);
                return null;
            }
        } catch (err) {
            console.error('[Auth] Session check failed:', err.message);
            localStorage.removeItem('authToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem(DEMO_MODE_KEY);
            return null;
        }
    }
);

const authSlice = createSlice({
    name: 'auth',
    initialState: {
        user: null,
        token: null,
        refreshToken: null,
        loading: false,
        error: null,
        isAuthenticated: false,
        isAuthChecked: false
    },
    reducers: {
        clearError: (state) => {
            state.error = null;
        },
        setUser: (state, action) => {
            state.user = action.payload;
            state.isAuthenticated = !!action.payload;
        },
        clearAuth: (state) => {
            state.user = null;
            state.token = null;
            state.refreshToken = null;
            state.isAuthenticated = false;
            localStorage.removeItem('authToken');
            localStorage.removeItem('refreshToken');
            localStorage.removeItem(DEMO_MODE_KEY);
        }
    },
    extraReducers: (builder) => {
        builder
            // Login
            .addCase(loginUser.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(loginUser.fulfilled, (state, action) => {
                state.loading = false;
                state.user = action.payload;
                state.token = action.payload.token;
                state.refreshToken = action.payload.refresh_token;
                state.isAuthenticated = true;
                // Store tokens in localStorage for API calls
                localStorage.setItem('authToken', action.payload.token);
                if (action.payload.refresh_token) {
                    localStorage.setItem('refreshToken', action.payload.refresh_token);
                }
            })
            .addCase(loginUser.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Signup
            .addCase(signupUser.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(signupUser.fulfilled, (state) => {
                state.loading = false;
            })
            .addCase(signupUser.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            // Logout
            .addCase(logoutUser.fulfilled, (state) => {
                state.user = null;
                state.token = null;
                state.refreshToken = null;
                state.isAuthenticated = false;
                // Remove tokens from localStorage
                localStorage.removeItem('authToken');
                localStorage.removeItem('refreshToken');
            })
            // Check Session
            .addCase(checkSession.fulfilled, (state, action) => {
                state.isAuthChecked = true;
                state.loading = false;
                if (action.payload) {
                    state.user = action.payload;
                    state.token = action.payload.token;
                    state.isAuthenticated = true;
                    if (action.payload.token) {
                        localStorage.setItem('authToken', action.payload.token);
                    } else {
                        localStorage.removeItem('authToken');
                    }
                } else {
                    // No existing session - clear auth state
                    state.user = null;
                    state.token = null;
                    state.refreshToken = null;
                    state.isAuthenticated = false;
                }
            })
            .addCase(checkSession.rejected, (state, action) => {
                state.isAuthChecked = true;
                state.loading = false;
                state.user = null;
                state.token = null;
                state.refreshToken = null;
                state.isAuthenticated = false;
                state.error = action.payload;
            });
    }
});

export const { clearError, setUser, clearAuth } = authSlice.actions;
export default authSlice.reducer;

// Selectors
export const selectUser = (state) => state.auth.user;
export const selectIsAuthenticated = (state) => state.auth.isAuthenticated;
export const selectAuthLoading = (state) => state.auth.loading;
export const selectAuthError = (state) => state.auth.error;
