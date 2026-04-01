import { createSlice, createAsyncThunk } from '@reduxjs/toolkit';
import { apiService } from '../services/api';

export const fetchTimetable = createAsyncThunk(
    'timetable/fetch',
    async (uid, { rejectWithValue }) => {
        try {
            const res = await apiService.getTimetable(uid);
            return res.data;
        } catch (err) {
            return rejectWithValue(err.response?.data?.detail || 'Failed to load timetable');
        }
    }
);

const timetableSlice = createSlice({
    name: 'timetable',
    initialState: {
        slots: [],
        schedule: {},
        loading: false,
        error: null,
    },
    reducers: {},
    extraReducers: (builder) => {
        builder
            .addCase(fetchTimetable.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchTimetable.fulfilled, (state, action) => {
                state.loading = false;
                state.slots = action.payload.slots || [];
                state.schedule = action.payload.schedule || {};
            })
            .addCase(fetchTimetable.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            });
    },
});

export default timetableSlice.reducer;
