import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import api from '../services/api';

// ═══════════════════════════════════════════════════════════════════════════
// AI INSIGHT ENGINE (NEW SYSTEM)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch rule-based insights from AI Insight Engine
 */
export const fetchAIInsights = createAsyncThunk(
    'insights/fetchAIInsights',
    async ({ uid, status = 'active', limit = 20 }, { rejectWithValue }) => {
        try {
            const response = await api.get(`/insights/${uid}?status=${status}&limit=${limit}`);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || { error: 'Failed to fetch insights' });
        }
    }
);

/**
 * Dismiss an insight
 */
export const dismissInsight = createAsyncThunk(
    'insights/dismiss',
    async ({ user_id, insight_id }, { rejectWithValue }) => {
        try {
            const response = await api.post('/insights/dismiss', { user_id, insight_id });
            return { ...response.data, insight_id };
        } catch (error) {
            return rejectWithValue(error.response?.data || { error: 'Failed to dismiss insight' });
        }
    }
);

/**
 * Mark insight as completed
 */
export const completeInsight = createAsyncThunk(
    'insights/complete',
    async ({ user_id, insight_id }, { rejectWithValue }) => {
        try {
            const response = await api.post('/insights/complete', { user_id, insight_id });
            return { ...response.data, insight_id };
        } catch (error) {
            return rejectWithValue(error.response?.data || { error: 'Failed to complete insight' });
        }
    }
);

/**
 * Manually trigger insight generation
 */
export const generateInsights = createAsyncThunk(
    'insights/generate',
    async (user_id, { rejectWithValue }) => {
        try {
            const response = await api.post('/insights/generate', { user_id });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || { error: 'Failed to generate insights' });
        }
    }
);

// ═══════════════════════════════════════════════════════════════════════════
// LEGACY AI INSIGHTS (OLD SYSTEM - FOR BACKWARD COMPATIBILITY)
// ═══════════════════════════════════════════════════════════════════════════

// ── Async thunk: fetch AI insights from backend ────────────────────────────
export const fetchInsights = createAsyncThunk(
    'insights/fetch',
    async (uid, { rejectWithValue }) => {
        try {
            const response = await api.get(`/insights/${uid}`);
            return response.data;
        } catch (error) {
            if (error.response?.status === 404 || error.response?.status === 503) {
                // Engine not set up yet — return graceful fallback
                return {
                    summary: 'Keep learning and earning XP!',
                    weak_area: null,
                    recommendation: 'Complete your homework to earn bonus XP.',
                    motivation: 'Every step counts! 🌟',
                    score: 50,
                    trend: 'stable',
                    badge_hint: null,
                    xp_summary: '',
                    homework_status: '',
                    game_feedback: '',
                    streak_status: '',
                    generated_at: new Date().toISOString(),
                };
            }
            return rejectWithValue(error.message);
        }
    }
);

// ── Async thunk: fetch performance analytics ───────────────────────────────
export const fetchAnalytics = createAsyncThunk(
    'insights/fetchAnalytics',
    async (uid, { rejectWithValue }) => {
        try {
            const response = await api.get(`/analytics/performance/${uid}`);
            return response.data;
        } catch (error) {
            if (error.response?.status === 404) {
                return {
                    xp_timeline: [],
                    source_breakdown: [],
                    weekly_progress: [],
                    subject_scores: {},
                    current_stats: {},
                };
            }
            return rejectWithValue(error.message);
        }
    }
);

// ── Async thunk: trigger gamification event ────────────────────────────────
export const triggerGamificationEvent = createAsyncThunk(
    'insights/triggerEvent',
    async ({ uid, event_type, payload }, { rejectWithValue }) => {
        try {
            const response = await api.post('/gamification/process', {
                uid,
                event_type,
                payload: payload || {},
            });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

// ── Slice ──────────────────────────────────────────────────────────────────
const insightsSlice = createSlice({
    name: 'insights',
    initialState: {
        // AI insight card data (Legacy system)
        data: null,
        loading: false,
        error: null,
        lastFetchedUid: null,

        // AI Insight Engine (New system)
        aiInsights: [],
        aiInsightsLoading: false,
        aiInsightsError: null,
        generatingInsights: false,

        // Analytics charts data
        analytics: {
            xp_timeline: [],
            source_breakdown: [],
            weekly_progress: [],
            subject_scores: {},
            current_stats: {},
        },
        analyticsLoading: false,
        analyticsError: null,

        // Gamification event processing
        lastEventResult: null,
        eventProcessing: false,
    },
    reducers: {
        clearInsights: (state) => {
            state.data = null;
            state.error = null;
        },
        clearAnalytics: (state) => {
            state.analytics = {
                xp_timeline: [],
                source_breakdown: [],
                weekly_progress: [],
                subject_scores: {},
                current_stats: {},
            };
        },
        clearAIInsights: (state) => {
            state.aiInsights = [];
            state.aiInsightsError = null;
        },
        // Optimistic update for dismissing insight
        dismissInsightOptimistic: (state, action) => {
            const insightId = action.payload;
            const insight = state.aiInsights.find((i) => i.id === insightId);
            if (insight) {
                insight.status = 'dismissed';
            }
        },
        // Optimistic update for completing insight
        completeInsightOptimistic: (state, action) => {
            const insightId = action.payload;
            const insight = state.aiInsights.find((i) => i.id === insightId);
            if (insight) {
                insight.status = 'completed';
            }
        },
    },
    extraReducers: (builder) => {
        builder
            // ── fetchInsights (Legacy) ─────────────────────────────────────
            .addCase(fetchInsights.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchInsights.fulfilled, (state, action) => {
                state.loading = false;
                state.data = action.payload;
                state.lastFetchedUid = action.meta.arg;
            })
            .addCase(fetchInsights.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload || 'Failed to fetch insights';
            })

            // ── fetchAIInsights (New System) ───────────────────────────────
            .addCase(fetchAIInsights.pending, (state) => {
                state.aiInsightsLoading = true;
                state.aiInsightsError = null;
            })
            .addCase(fetchAIInsights.fulfilled, (state, action) => {
                state.aiInsightsLoading = false;
                state.aiInsights = action.payload.data || [];
            })
            .addCase(fetchAIInsights.rejected, (state, action) => {
                state.aiInsightsLoading = false;
                state.aiInsightsError = action.payload?.error || 'Failed to fetch insights';
            })

            // ── dismissInsight ─────────────────────────────────────────────
            .addCase(dismissInsight.fulfilled, (state, action) => {
                const insightId = action.payload.insight_id;
                const insight = state.aiInsights.find((i) => i.id === insightId);
                if (insight) {
                    insight.status = 'dismissed';
                    insight.updated_at = new Date().toISOString();
                }
            })

            // ── completeInsight ────────────────────────────────────────────
            .addCase(completeInsight.fulfilled, (state, action) => {
                const insightId = action.payload.insight_id;
                const insight = state.aiInsights.find((i) => i.id === insightId);
                if (insight) {
                    insight.status = 'completed';
                    insight.updated_at = new Date().toISOString();
                }
            })

            // ── generateInsights ───────────────────────────────────────────
            .addCase(generateInsights.pending, (state) => {
                state.generatingInsights = true;
            })
            .addCase(generateInsights.fulfilled, (state, action) => {
                state.generatingInsights = false;
                // New insights will be fetched via fetchAIInsights
                if (action.payload.data) {
                    state.aiInsights = action.payload.data;
                }
            })
            .addCase(generateInsights.rejected, (state) => {
                state.generatingInsights = false;
            })

            // ── fetchAnalytics ─────────────────────────────────────────────
            .addCase(fetchAnalytics.pending, (state) => {
                state.analyticsLoading = true;
                state.analyticsError = null;
            })
            .addCase(fetchAnalytics.fulfilled, (state, action) => {
                state.analyticsLoading = false;
                state.analytics = action.payload;
            })
            .addCase(fetchAnalytics.rejected, (state, action) => {
                state.analyticsLoading = false;
                state.analyticsError = action.payload || 'Failed to fetch analytics';
            })

            // ── triggerGamificationEvent ───────────────────────────────────
            .addCase(triggerGamificationEvent.pending, (state) => {
                state.eventProcessing = true;
            })
            .addCase(triggerGamificationEvent.fulfilled, (state, action) => {
                state.eventProcessing = false;
                state.lastEventResult = action.payload;
            })
            .addCase(triggerGamificationEvent.rejected, (state) => {
                state.eventProcessing = false;
            });
    },
});

export const { 
    clearInsights, 
    clearAnalytics, 
    clearAIInsights,
    dismissInsightOptimistic,
    completeInsightOptimistic 
} = insightsSlice.actions;
export default insightsSlice.reducer;

// ── Selectors ──────────────────────────────────────────────────────────────

// Legacy system selectors
export const selectInsights = (state) => state.insights.data;
export const selectInsightsLoading = (state) => state.insights.loading;
export const selectAnalytics = (state) => state.insights.analytics;
export const selectAnalyticsLoading = (state) => state.insights.analyticsLoading;
export const selectLastEventResult = (state) => state.insights.lastEventResult;

// AI Insight Engine selectors (base selectors)
export const selectAIInsights = (state) => state.insights.aiInsights;
export const selectAIInsightsLoading = (state) => state.insights.aiInsightsLoading;
export const selectAIInsightsError = (state) => state.insights.aiInsightsError;
export const selectGeneratingInsights = (state) => state.insights.generatingInsights;

// Memoized selectors to prevent unnecessary re-renders

// Get active insights only
export const selectActiveInsights = createSelector(
    [selectAIInsights],
    (aiInsights) => aiInsights.filter(insight => insight.status === 'active')
);

// Get insights by severity
export const selectHighSeverityInsights = createSelector(
    [selectAIInsights],
    (aiInsights) => aiInsights.filter(insight => insight.severity === 'HIGH' && insight.status === 'active')
);

export const selectMediumSeverityInsights = createSelector(
    [selectAIInsights],
    (aiInsights) => aiInsights.filter(insight => insight.severity === 'MEDIUM' && insight.status === 'active')
);

// Get insights by type (memoized factory function)
export const selectInsightsByType = (type) => createSelector(
    [selectAIInsights],
    (aiInsights) => aiInsights.filter(insight => insight.type === type && insight.status === 'active')
);

// Get active insight count
export const selectActiveInsightCount = createSelector(
    [selectActiveInsights],
    (activeInsights) => activeInsights.length
);

// Get high severity count
export const selectHighSeverityCount = createSelector(
    [selectHighSeverityInsights],
    (highSeverityInsights) => highSeverityInsights.length
);
