import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import api from '../services/api';

// ── Async thunk ────────────────────────────────────────────────────────────
export const fetchHolidays = createAsyncThunk(
    'holidays/fetch',
    async (_, { rejectWithValue }) => {
        try {
            const response = await api.get('/holidays/2026');
            // Backend returns { holidays: [...], year, total }
            return response.data.holidays || response.data || [];
        } catch (error) {
            // Graceful fallback — don't crash the app if endpoint is down
            return rejectWithValue(error.message);
        }
    }
);

// ── Slice ──────────────────────────────────────────────────────────────────
const holidaysSlice = createSlice({
    name: 'holidays',
    initialState: {
        list: [],
        loading: false,
        error: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchHolidays.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchHolidays.fulfilled, (state, action) => {
                state.loading = false;
                state.list = action.payload;
            })
            .addCase(fetchHolidays.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
                // Keep list empty — attendance logic degrades gracefully
            });
    },
});

// ── Selectors ──────────────────────────────────────────────────────────────

/** Raw list: [{date, name, type}, ...] */
export const selectHolidayList = (state) => state.holidays?.list ?? [];

/**
 * O(1) lookup map: { "2026-01-26": { date, name, type }, ... }
 */
export const selectHolidayMap = createSelector(
    [selectHolidayList],
    (list) => {
        const map = {};
        list.forEach((h) => { map[h.date] = h; });
        return map;
    }
);

/**
 * Plain Set of date strings for fast `has()` checks.
 */
export const selectHolidayDates = createSelector(
    [selectHolidayList],
    (list) => new Set(list.map((h) => h.date))
);

/**
 * The next upcoming holiday from today's date.
 */
export const selectNextHoliday = createSelector(
    [selectHolidayList],
    (list) => {
        const today = new Date().toISOString().split('T')[0];
        return list.find((h) => h.date >= today) || null;
    }
);

/**
 * Holidays that have already passed (for stats).
 */
export const selectPastHolidays = createSelector(
    [selectHolidayList],
    (list) => {
        const today = new Date().toISOString().split('T')[0];
        return list.filter((h) => h.date < today);
    }
);

export default holidaysSlice.reducer;
