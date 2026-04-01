import { configureStore, createListenerMiddleware } from '@reduxjs/toolkit';
import authReducer from './authSlice';
import studentReducer from './studentSlice';
import uiReducer from './uiSlice';
import gamificationReducer from './gamificationSlice';
import attendanceReducer from './attendanceSlice';
import homeworkReducer from './homeworkSlice';
import announcementsReducer from './announcementsSlice';
import aiReducer from './aiSlice';
import gamesReducer from './gamesSlice';
import insightsReducer from './insightsSlice';
import holidaysReducer from './holidaysSlice';
import timetableReducer from './timetableSlice';
import performanceReducer from './performanceSlice';
import activityReducer from './activitySlice';

// ── Action type strings (avoids importing from the actual slices to prevent circular deps) ──
const SUBMIT_HOMEWORK_FULFILLED  = 'homework/submit/fulfilled';
const COMPLETE_GAME_FULFILLED    = 'games/complete/fulfilled';
const MARK_ATTENDANCE_FULFILLED  = 'attendance/mark/fulfilled';

// ── Listener Middleware ────────────────────────────────────────────────────
// Automatically fires completeAction after any scoreable event.
// Using string-based action types means ZERO circular dependency risk.
const listenerMiddleware = createListenerMiddleware();

listenerMiddleware.startListening({
    type: SUBMIT_HOMEWORK_FULFILLED,
    effect: async (action, listenerApi) => {
        // Only fire when the answer was correct
        if (!action.payload?.correct) return;
        const uid = listenerApi.getState().auth.user?.uid;
        if (!uid) return;

        const hw = action.payload;
        const { completeAction } = await import('./gamificationSlice');
        listenerApi.dispatch(completeAction({
            uid,
            action_type: 'HOMEWORK_COMPLETE',
            metadata: {
                homework_id: hw.homework_id || action.meta?.arg?.homework_id,
                label: 'Homework Completed',
                icon: '📚',
                xp_hint: hw.xp_earned || 5,
            },
        }));
    },
});

// Note: games/complete/fulfilled is handled directly in gamificationSlice.js
// extraReducers (server returns full state), so no listener needed here.

listenerMiddleware.startListening({
    type: MARK_ATTENDANCE_FULFILLED,
    effect: async (action, listenerApi) => {
        const payload = action.payload;
        if (payload?.status !== 'present' && payload?.status !== true) return;
        const uid = listenerApi.getState().auth.user?.uid;
        if (!uid) return;

        const { completeAction } = await import('./gamificationSlice');
        listenerApi.dispatch(completeAction({
            uid,
            action_type: 'ATTENDANCE_MARK',
            metadata: {
                date: payload.date || new Date().toISOString().slice(0, 10),
                label: 'Attendance Marked',
                icon: '📅',
                xp_hint: 3,
            },
        }));
    },
});

// ── Also re-fetch insights + analytics after any XP update ────────────────
listenerMiddleware.startListening({
    type: 'gamification/completeAction/fulfilled',
    effect: async (action, listenerApi) => {
        const payload = action.payload;
        if (!payload?.success) return;
        const uid = listenerApi.getState().auth.user?.uid;
        if (!uid) return;

        // Wait 1.5 s for DB writes to settle before re-fetching
        await new Promise(r => setTimeout(r, 1500));

        const { fetchInsights, fetchAnalytics } = await import('./insightsSlice');
        const { fetchActivities } = await import('./activitySlice');
        listenerApi.dispatch(fetchInsights(uid));
        listenerApi.dispatch(fetchAnalytics(uid));
        listenerApi.dispatch(fetchActivities({ uid, limit: 20 }));
    },
});

export const store = configureStore({
    reducer: {
        auth: authReducer,
        student: studentReducer,
        ui: uiReducer,
        gamification: gamificationReducer,
        attendance: attendanceReducer,
        homework: homeworkReducer,
        announcements: announcementsReducer,
        ai: aiReducer,
        games: gamesReducer,
        insights: insightsReducer,
        holidays: holidaysReducer,
        timetable: timetableReducer,
        performance: performanceReducer,
        activities: activityReducer,
    },
    middleware: (getDefaultMiddleware) =>
        getDefaultMiddleware({
            serializableCheck: false
        }).prepend(listenerMiddleware.middleware),
});

export default store;
