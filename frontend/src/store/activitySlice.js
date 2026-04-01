/**
 * Activity Slice - Redux State Management for Activity Tracking
 * 
 * Manages:
 * - Recent activity feed
 * - Activity statistics
 * - Real-time activity updates
 */

import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import api from '../services/api';

// ═══════════════════════════════════════════════════════════════════════════
// ASYNC THUNKS
// ═══════════════════════════════════════════════════════════════════════════

/**
 * Fetch recent activities for a user
 */
export const fetchActivities = createAsyncThunk(
    'activities/fetchActivities',
    async ({ uid, limit = 20 }, { rejectWithValue }) => {
        try {
            const response = await api.get(`/activities/${uid}?limit=${limit}`);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || { error: 'Failed to fetch activities' });
        }
    }
);

/**
 * Fetch activity statistics
 */
export const fetchActivityStats = createAsyncThunk(
    'activities/fetchStats',
    async (uid, { rejectWithValue }) => {
        try {
            const response = await api.get(`/activities/stats/${uid}`);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || { error: 'Failed to fetch stats' });
        }
    }
);

/**
 * Log a new activity manually
 */
export const logActivity = createAsyncThunk(
    'activities/logActivity',
    async (activityData, { rejectWithValue }) => {
        try {
            const response = await api.post('/activities/log', activityData);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data || { error: 'Failed to log activity' });
        }
    }
);

// ═══════════════════════════════════════════════════════════════════════════
// INITIAL STATE
// ═══════════════════════════════════════════════════════════════════════════

const initialState = {
    // Activity list
    activities: [],
    
    // Statistics
    stats: {
        total_activities: 0,
        total_xp_earned: 0,
        by_type: {},
        by_subject: {},
        last_activity: null
    },
    
    // UI State
    loading: false,
    statsLoading: false,
    error: null,
    
    // Real-time updates
    lastFetched: null,
    autoRefresh: true
};

// ═══════════════════════════════════════════════════════════════════════════
// SLICE
// ═══════════════════════════════════════════════════════════════════════════

const activitySlice = createSlice({
    name: 'activities',
    initialState,
    reducers: {
        /**
         * Add a new activity to the feed (for real-time updates)
         */
        addActivity: (state, action) => {
            state.activities.unshift(action.payload);
            
            // Keep only latest 100 activities
            if (state.activities.length > 100) {
                state.activities = state.activities.slice(0, 100);
            }
            
            // Update stats
            if (action.payload.xp_earned) {
                state.stats.total_xp_earned += action.payload.xp_earned;
            }
            state.stats.total_activities += 1;
            
            const eventType = action.payload.event_type;
            if (eventType) {
                state.stats.by_type[eventType] = (state.stats.by_type[eventType] || 0) + 1;
            }
            
            const subject = action.payload.subject;
            if (subject) {
                state.stats.by_subject[subject] = (state.stats.by_subject[subject] || 0) + 1;
            }
        },
        
        /**
         * Clear all activities
         */
        clearActivities: (state) => {
            state.activities = [];
            state.stats = initialState.stats;
        },
        
        /**
         * Set auto-refresh flag
         */
        setAutoRefresh: (state, action) => {
            state.autoRefresh = action.payload;
        },
        
        /**
         * Clear error
         */
        clearError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        // ── Fetch Activities ────────────────────────────────────────
        builder
            .addCase(fetchActivities.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchActivities.fulfilled, (state, action) => {
                state.loading = false;
                
                if (action.payload.success) {
                    state.activities = action.payload.activities || [];
                    state.lastFetched = new Date().toISOString();
                } else {
                    state.error = action.payload.error || 'Failed to fetch activities';
                }
            })
            .addCase(fetchActivities.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload?.error || 'Network error';
            });
        
        // ── Fetch Stats ─────────────────────────────────────────────
        builder
            .addCase(fetchActivityStats.pending, (state) => {
                state.statsLoading = true;
            })
            .addCase(fetchActivityStats.fulfilled, (state, action) => {
                state.statsLoading = false;
                
                if (action.payload.success) {
                    state.stats = action.payload.stats || initialState.stats;
                }
            })
            .addCase(fetchActivityStats.rejected, (state, action) => {
                state.statsLoading = false;
            });
        
        // ── Log Activity ────────────────────────────────────────────
        builder
            .addCase(logActivity.pending, (state) => {
                state.error = null;
            })
            .addCase(logActivity.fulfilled, (state, action) => {
                if (action.payload.success && action.payload.event) {
                    // Add the logged activity to the feed
                    state.activities.unshift(action.payload.event);
                    
                    // Keep only latest 100
                    if (state.activities.length > 100) {
                        state.activities = state.activities.slice(0, 100);
                    }
                }
            })
            .addCase(logActivity.rejected, (state, action) => {
                state.error = action.payload?.error || 'Failed to log activity';
            });
    }
});

// ═══════════════════════════════════════════════════════════════════════════
// SELECTORS
// ═══════════════════════════════════════════════════════════════════════════

// Base selector
const selectActivitiesState = (state) => state.activities.activities;

/**
 * Get recent activities (newest first) - MEMOIZED
 */
export const selectRecentActivities = createSelector(
    [selectActivitiesState],
    (activities) => activities.slice(0, 20)
);

/**
 * Get activities by event type - MEMOIZED
 */
export const selectActivitiesByType = (eventType) => createSelector(
    [selectActivitiesState],
    (activities) => activities.filter(a => a.event_type === eventType)
);

/**
 * Get activities by subject - MEMOIZED
 */
export const selectActivitiesBySubject = (subject) => createSelector(
    [selectActivitiesState],
    (activities) => activities.filter(a => a.subject === subject)
);

/**
 * Get activity statistics
 */
export const selectActivityStats = (state) => state.activities.stats;

/**
 * Get loading state
 */
export const selectActivitiesLoading = (state) => state.activities.loading;

/**
 * Get error state
 */
export const selectActivitiesError = (state) => state.activities.error;

/**
 * Get last activity
 */
export const selectLastActivity = (state) => 
    state.activities.activities.length > 0 ? state.activities.activities[0] : null;

/**
 * Get activity count
 */
export const selectActivityCount = (state) => state.activities.activities.length;

/**
 * Get total XP earned from activities
 */
export const selectTotalXPEarned = (state) => state.activities.stats.total_xp_earned;

/**
 * Check if activities are stale (>5 minutes old)
 */
export const selectActivitiesStale = (state) => {
    if (!state.activities.lastFetched) return true;
    
    const lastFetch = new Date(state.activities.lastFetched);
    const now = new Date();
    const minutesSinceLastFetch = (now - lastFetch) / 1000 / 60;
    
    return minutesSinceLastFetch > 5;
};

// ═══════════════════════════════════════════════════════════════════════════
// EXPORTS
// ═══════════════════════════════════════════════════════════════════════════

export const {
    addActivity,
    clearActivities,
    setAutoRefresh,
    clearError
} = activitySlice.actions;

export default activitySlice.reducer;
