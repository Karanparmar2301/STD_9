import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { apiService } from '../services/api';

// ── Grade calculator ────────────────────────────────────────────────────────
export const calcGrade = (avg) => {
    if (avg >= 90) return { label: 'A+', color: '#2f855a' };
    if (avg >= 80) return { label: 'A',  color: '#4f6df5' };
    if (avg >= 70) return { label: 'B',  color: '#7c3aed' };
    if (avg >= 60) return { label: 'C',  color: '#d97706' };
    return            { label: 'D',  color: '#c24141' };
};

// ── Async thunk ─────────────────────────────────────────────────────────────
export const fetchPerformance = createAsyncThunk(
    'performance/fetch',
    async (uid, { rejectWithValue }) => {
        try {
            const res = await apiService.getPerformance(uid);
            return res.data;
        } catch (err) {
            return rejectWithValue(err.response?.data?.detail || 'Failed to load performance');
        }
    }
);

// ── Fetch detailed subject intelligence for flip card back ──────────────────
export const fetchSubjectDetails = createAsyncThunk(
    'performance/fetchSubjectDetails',
    async ({ uid, subject }, { rejectWithValue }) => {
        try {
            const res = await apiService.getSubjectDetails(uid, subject);
            return { subject, data: res.data };
        } catch (err) {
            return rejectWithValue(err.response?.data?.detail || 'Failed to load subject details');
        }
    }
);

// ── Slice ───────────────────────────────────────────────────────────────────
const initialState = {
    loading:        false,
    error:          null,
    overallAverage: 0,
    growth:         0,
    topSubject:     '',
    examsCompleted: 0,
    subjects:       [],       // [{ name, avg, trend, grade }]
    monthly:        [],       // [{ month, avg }]
    filterTerm:     '',
    lastFetchedUid: null,
    // Subject details cache: { "Mathematics": { teacher, weekly_periods, ... }, ... }
    subjectDetailsCache: {},
    subjectDetailsLoading: {},  // { "Mathematics": true, ... }
};

const performanceSlice = createSlice({
    name: 'performance',
    initialState,
    reducers: {
        setFilterTerm: (state, { payload }) => {
            state.filterTerm = payload;
        },
        resetPerformance: () => initialState,
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchPerformance.pending, (state) => {
                state.loading = true;
                state.error   = null;
            })
            .addCase(fetchPerformance.fulfilled, (state, { payload, meta }) => {
                state.loading        = false;
                state.overallAverage = payload.overallAverage ? Math.round(payload.overallAverage) : 0;
                state.growth         = payload.growth         ?? 0;
                state.topSubject     = payload.topSubject     ?? '';
                state.examsCompleted = payload.examsCompleted ?? 0;
                state.subjects       = payload.subjects       ?? [];
                state.monthly        = payload.monthly        ?? [];
                state.lastFetchedUid = meta.arg;
            })
            .addCase(fetchPerformance.rejected, (state, { payload }) => {
                state.loading = false;
                state.error   = payload;
            })
            // Subject details
            .addCase(fetchSubjectDetails.pending, (state, { meta }) => {
                const subject = meta.arg.subject;
                state.subjectDetailsLoading[subject] = true;
            })
            .addCase(fetchSubjectDetails.fulfilled, (state, { payload }) => {
                const { subject, data } = payload;
                state.subjectDetailsCache[subject] = data;
                state.subjectDetailsLoading[subject] = false;
            })
            .addCase(fetchSubjectDetails.rejected, (state, { meta }) => {
                const subject = meta.arg.subject;
                state.subjectDetailsLoading[subject] = false;
            });
    },
});

export const { setFilterTerm, resetPerformance } = performanceSlice.actions;

// ── Selectors ───────────────────────────────────────────────────────────────
export const selectPerformance     = (s) => s.performance;
export const selectPerfLoading     = (s) => s.performance.loading;
export const selectPerfError       = (s) => s.performance.error;
export const selectPerfSubjects    = (s) => s.performance.subjects;
export const selectPerfMonthly     = (s) => s.performance.monthly;
export const selectPerfFilterTerm  = (s) => s.performance.filterTerm;

/**
 * Get KPIs - MEMOIZED to prevent unnecessary re-renders
 */
export const selectPerfKPIs = createSelector(
    [
        (s) => s.performance.overallAverage,
        (s) => s.performance.growth,
        (s) => s.performance.topSubject,
        (s) => s.performance.examsCompleted
    ],
    (overallAverage, growth, topSubject, examsCompleted) => ({
        overallAverage,
        growth,
        topSubject,
        examsCompleted
    })
);

/**
 * Get filtered subjects - MEMOIZED
 */
export const selectFilteredSubjects = createSelector(
    [selectPerfSubjects, selectPerfFilterTerm],
    (subjects, term) => {
        if (!term) return subjects;
        const lowerTerm = term.toLowerCase();
        return subjects.filter((sub) => sub.name.toLowerCase().includes(lowerTerm));
    }
);
export const selectSubjectDetails = (subject) => (s) => 
    s.performance.subjectDetailsCache[subject] || null;
export const selectSubjectDetailsLoading = (subject) => (s) => 
    s.performance.subjectDetailsLoading[subject] || false;

export default performanceSlice.reducer;
