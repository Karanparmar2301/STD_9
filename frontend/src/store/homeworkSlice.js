import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { apiService } from '../services/api';

// Async thunks
export const fetchHomework = createAsyncThunk(
    'homework/fetch',
    async (uid, { rejectWithValue }) => {
        try {
            const response = await apiService.getHomework(uid);
            return response.data;
        } catch (error) {
            return rejectWithValue(error.response?.data?.detail || error.message);
        }
    }
);

export const submitHomework = createAsyncThunk(
    'homework/submit',
    async ({ homework_id, uid, student_answer }, { rejectWithValue }) => {
        try {
            const response = await apiService.submitHomework({
                homework_id,
                uid,
                student_answer
            });
            return {
                ...response.data,
                homework_id // Include for optimistic update
            };
        } catch (error) {
            return rejectWithValue(error.response?.data?.detail || error.message);
        }
    }
);

const initialState = {
    pending: [],
    completed: [],
    loading: false,
    error: null,
    wrongAnswerId: null,   // ID of homework where wrong answer was given
    completingId: null,    // Track which homework is being completed
    filters: {
        subject: 'all'     // all, math, english
    },
    stats: {
        total: 0,
        completed: 0,
        pending: 0,
        completion_rate: 0
    }
};

const homeworkSlice = createSlice({
    name: 'homework',
    initialState,
    reducers: {
        setSubjectFilter: (state, action) => {
            state.filters.subject = action.payload;
        },
        clearHomeworkError: (state) => {
            state.error = null;
            state.wrongAnswerId = null;
        },
        clearWrongAnswer: (state) => {
            state.wrongAnswerId = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // Fetch Homework
            .addCase(fetchHomework.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchHomework.fulfilled, (state, action) => {
                state.loading = false;
                state.pending = action.payload.pending || [];
                state.completed = action.payload.completed || [];
                state.stats = action.payload.stats || initialState.stats;
            })
            .addCase(fetchHomework.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })

            // Submit Homework
            .addCase(submitHomework.pending, (state, action) => {
                state.completingId = action.meta.arg.homework_id;
                state.wrongAnswerId = null;
                state.error = null;
            })
            .addCase(submitHomework.fulfilled, (state, action) => {
                state.completingId = null;

                if (!action.payload.correct) {
                    // Wrong answer — set the ID so the card can show inline error
                    state.wrongAnswerId = action.payload.homework_id;
                    state.error = action.payload.message || 'Incorrect answer. Try again!';
                    return;
                }

                // Correct — clear errors
                state.wrongAnswerId = null;
                state.error = null;

                // Move homework from pending to completed
                const homeworkId = action.payload.homework_id;
                const homeworkIndex = state.pending.findIndex(hw => hw.id === homeworkId);

                if (homeworkIndex !== -1) {
                    const completedHomework = {
                        ...state.pending[homeworkIndex],
                        completed_at: new Date().toISOString(),
                        student_answer: action.meta.arg.student_answer
                    };
                    state.pending.splice(homeworkIndex, 1);
                    state.completed.unshift(completedHomework);
                }

                // Update stats
                state.stats = action.payload.stats || state.stats;
            })
            .addCase(submitHomework.rejected, (state, action) => {
                state.completingId = null;
                state.error = action.payload;
            });
    }
});

export const { setSubjectFilter, clearHomeworkError, clearWrongAnswer } = homeworkSlice.actions;

// Base selectors
export const selectAllPending = (state) => state.homework.pending;
export const selectAllCompleted = (state) => state.homework.completed;
export const selectHomeworkLoading = (state) => state.homework.loading;
export const selectHomeworkStats = (state) => state.homework.stats;
export const selectHomeworkFilter = (state) => state.homework.filters.subject;
export const selectCompletingId = (state) => state.homework.completingId;
export const selectHomeworkError = (state) => state.homework.error;
export const selectWrongAnswerId = (state) => state.homework.wrongAnswerId;

// Memoized selectors for filtered homework
export const selectFilteredPending = createSelector(
    [selectAllPending, selectHomeworkFilter],
    (pending, subject) => {
        if (subject === 'all') return pending;
        return pending.filter(hw => hw.subject?.toLowerCase() === subject.toLowerCase());
    }
);

export const selectFilteredCompleted = createSelector(
    [selectAllCompleted, selectHomeworkFilter],
    (completed, subject) => {
        if (subject === 'all') return completed;
        return completed.filter(hw => hw.subject?.toLowerCase() === subject.toLowerCase());
    }
);

export default homeworkSlice.reducer;
