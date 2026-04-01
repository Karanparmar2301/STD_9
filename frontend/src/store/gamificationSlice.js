import { createSlice, createSelector, createAsyncThunk } from '@reduxjs/toolkit';
import { submitHomework } from './homeworkSlice';
import { completeGame } from './gamesSlice';
import api from '../services/api';

// XP and Level System
const XP_PER_LEVEL = 100;
const MAX_LEVEL = 50;

const calculateLevel = (totalXP) => {
    return Math.min(Math.floor(totalXP / XP_PER_LEVEL) + 1, MAX_LEVEL);
};

const calculateCurrentLevelXP = (totalXP) => {
    return totalXP % XP_PER_LEVEL;
};

const calculateXPToNextLevel = (totalXP) => {
    const currentLevel = calculateLevel(totalXP);
    if (currentLevel >= MAX_LEVEL) return 0;
    return XP_PER_LEVEL - calculateCurrentLevelXP(totalXP);
};

// ── Unified Action Complete Thunk ──────────────────────────────────────────
// This is the SINGLE source of truth for all gamification updates.
// Called automatically by the listenerMiddleware after any game/homework/attendance event.
export const completeAction = createAsyncThunk(
    'gamification/completeAction',
    async ({ uid, action_type, metadata }, { rejectWithValue }) => {
        try {
            const response = await api.post('/action/complete', {
                uid,
                action_type,
                metadata: metadata || {},
            });
            return response.data;
        } catch (error) {
            // Non-fatal: fall back silently so existing optimistic updates still show
            if (error.response?.status === 404 || error.response?.status === 503) {
                return null;
            }
            return rejectWithValue(error.message);
        }
    }
);

const initialState = {
    totalXP: 0,
    level: 1,
    currentLevelXP: 0,
    xpToNextLevel: XP_PER_LEVEL,
    streak: 0,
    badges: [],
    achievements: [],
    recentXPGain: null,       // For XP animation
    showLevelUpModal: false,
    showBadgeModal: false,
    newBadge: null,
    recentActivity: [],       // Activity log: last 10 entries
    lastProcessedLevel: null, // Prevent duplicate level-up modals
};

const gamificationSlice = createSlice({
    name: 'gamification',
    initialState,
    reducers: {
        initializeGamification: (state, action) => {
            const { totalXP, streak, badges, achievements } = action.payload;
            state.totalXP = totalXP || 0;
            state.level = calculateLevel(state.totalXP);
            state.currentLevelXP = calculateCurrentLevelXP(state.totalXP);
            state.xpToNextLevel = calculateXPToNextLevel(state.totalXP);
            state.streak = streak || 0;
            state.badges = badges || [];
            state.achievements = achievements || [];
            state.lastProcessedLevel = calculateLevel(state.totalXP);
        },

        // Atomic update from /api/action/complete response
        updateGamification: (state, action) => {
            const payload = action.payload;
            if (!payload) return;

            const oldLevel = state.level;

            state.totalXP = payload.total_xp ?? state.totalXP;
            state.level = calculateLevel(state.totalXP);
            state.currentLevelXP = calculateCurrentLevelXP(state.totalXP);
            state.xpToNextLevel = calculateXPToNextLevel(state.totalXP);
            state.streak = payload.streak ?? state.streak;
            if (Array.isArray(payload.badges)) state.badges = payload.badges;
            state.recentXPGain = payload.xp_earned ?? null;

            // Level-up detection (only once per new level)
            if (state.level > oldLevel && state.lastProcessedLevel !== state.level) {
                // state.showLevelUpModal = true; // celebration disabled
                state.lastProcessedLevel = state.level;
            }

            // New badge
            if (payload.new_badge) {
                const alreadyHas = state.badges.find(b => b.id === payload.new_badge.id);
                if (!alreadyHas) {
                    state.newBadge = payload.new_badge;
                    state.showBadgeModal = true;
                }
            }

            // Append to activity log
            if (payload.activity_entry) {
                state.recentActivity = [
                    payload.activity_entry,
                    ...state.recentActivity,
                ].slice(0, 10); // keep last 10
            }
        },

        addXP: (state, action) => {
            const xpGained = action.payload;
            const oldLevel = state.level;
            state.totalXP += xpGained;
            state.level = calculateLevel(state.totalXP);
            state.currentLevelXP = calculateCurrentLevelXP(state.totalXP);
            state.xpToNextLevel = calculateXPToNextLevel(state.totalXP);
            state.recentXPGain = xpGained;
            if (state.level > oldLevel && state.lastProcessedLevel !== state.level) {
                // state.showLevelUpModal = true; // celebration disabled
                state.lastProcessedLevel = state.level;
            }
        },

        clearRecentXPGain: (state) => {
            state.recentXPGain = null;
        },

        incrementStreak: (state) => { state.streak += 1; },
        resetStreak: (state)    => { state.streak = 0;   },

        unlockBadge: (state, action) => {
            const badge = action.payload;
            if (!state.badges.find(b => b.id === badge.id)) {
                state.badges.push(badge);
                state.newBadge = badge;
                state.showBadgeModal = true;
            }
        },

        addAchievement: (state, action) => {
            state.achievements.push(action.payload);
        },

        closeLevelUpModal: (state) => {
            state.showLevelUpModal = false;
        },

        closeBadgeModal: (state) => {
            state.showBadgeModal = false;
            state.newBadge = null;
        },

        addRecentActivity: (state, action) => {
            state.recentActivity = [action.payload, ...state.recentActivity].slice(0, 10);
        },
    },
    extraReducers: (builder) => {
        builder
            // ── completeAction (server-authoritative, overrides optimistic) ──
            .addCase(completeAction.fulfilled, (state, action) => {
                const payload = action.payload;
                if (!payload) return; // 404/503 fallback returned null

                const oldLevel = state.level;
                state.totalXP = payload.total_xp ?? state.totalXP;
                state.level = calculateLevel(state.totalXP);
                state.currentLevelXP = calculateCurrentLevelXP(state.totalXP);
                state.xpToNextLevel = calculateXPToNextLevel(state.totalXP);
                state.streak = payload.streak ?? state.streak;
                if (Array.isArray(payload.badges)) state.badges = payload.badges;
                state.recentXPGain = payload.xp_earned ?? state.recentXPGain;

                if (state.level > oldLevel && state.lastProcessedLevel !== state.level) {
                    // state.showLevelUpModal = true; // celebration disabled
                    state.lastProcessedLevel = state.level;
                }

                if (payload.new_badge && !state.badges.find(b => b.id === payload.new_badge.id)) {
                    state.newBadge = payload.new_badge;
                    state.showBadgeModal = true;
                }

                if (payload.activity_entry) {
                    state.recentActivity = [
                        payload.activity_entry,
                        ...state.recentActivity,
                    ].slice(0, 10);
                }
            })

            // ── Optimistic: homework submission (keeps UI responsive before server round-trip) ──
            .addCase(submitHomework.fulfilled, (state, action) => {
                if (!action.payload.correct) return;
                const xpGained = action.payload.xp_earned || 5;
                const oldLevel = state.level;
                // Only apply as optimistic if server hasn't already synced
                if (!action.payload.total_xp) {
                    state.totalXP += xpGained;
                    state.level = calculateLevel(state.totalXP);
                    state.currentLevelXP = calculateCurrentLevelXP(state.totalXP);
                    state.xpToNextLevel = calculateXPToNextLevel(state.totalXP);
                    state.recentXPGain = xpGained;
                    if (state.level > oldLevel && state.lastProcessedLevel !== state.level) {
                        // state.showLevelUpModal = true; // celebration disabled
                        state.lastProcessedLevel = state.level;
                    }
                }
                const newBadge = action.payload.new_badge;
                if (newBadge && !state.badges.find(b => b.id === newBadge.id)) {
                    state.badges.push(newBadge);
                    state.newBadge = newBadge;
                    state.showBadgeModal = true;
                }
            })

            // ── Game completion — server-authoritative Redux sync ──
            .addCase(completeGame.fulfilled, (state, action) => {
                const payload = action.payload;
                if (!payload?.xp_earned) return;

                const oldLevel = state.level;

                // Apply server-authoritative totals immediately (no optimistic guard)
                state.totalXP        = payload.total_xp        ?? state.totalXP;
                state.level          = calculateLevel(state.totalXP);
                state.currentLevelXP = calculateCurrentLevelXP(state.totalXP);
                state.xpToNextLevel  = calculateXPToNextLevel(state.totalXP);
                state.streak         = payload.streak           ?? state.streak;
                if (Array.isArray(payload.badges)) state.badges = payload.badges;
                state.recentXPGain   = payload.xp_earned;

                // Level-up (deduped via lastProcessedLevel)
                if (state.level > oldLevel && state.lastProcessedLevel !== state.level) {
                    // state.showLevelUpModal = true; // celebration disabled
                    state.lastProcessedLevel = state.level;
                }

                // New badge
                if (payload.new_badge) {
                    const alreadyHas = state.badges.find(b => b.id === payload.new_badge.id);
                    if (!alreadyHas) {
                        state.newBadge      = payload.new_badge;
                        state.showBadgeModal = true;
                    }
                }

                // Append to live activity log
                if (payload.activity_entry) {
                    state.recentActivity = [
                        payload.activity_entry,
                        ...state.recentActivity,
                    ].slice(0, 10);
                }
            });
    }
});

export const {
    initializeGamification,
    updateGamification,
    addXP,
    clearRecentXPGain,
    incrementStreak,
    resetStreak,
    unlockBadge,
    addAchievement,
    closeLevelUpModal,
    closeBadgeModal,
    addRecentActivity,
} = gamificationSlice.actions;

export default gamificationSlice.reducer;

// ── Selectors (memoized) ──────────────────────────────────────────────────
export const selectGamificationProgress = createSelector(
    [
        (state) => state.gamification.level,
        (state) => state.gamification.currentLevelXP,
        (state) => state.gamification.xpToNextLevel,
        (state) => state.gamification.totalXP
    ],
    (level, currentLevelXP, xpToNextLevel, totalXP) => ({
        level,
        currentLevelXP,
        xpToNextLevel,
        totalXP,
        progressPercentage: (currentLevelXP / XP_PER_LEVEL) * 100
    })
);

export const selectBadges        = (state) => state.gamification.badges;
export const selectStreak        = (state) => state.gamification.streak;
export const selectRecentActivity = (state) => state.gamification.recentActivity;
