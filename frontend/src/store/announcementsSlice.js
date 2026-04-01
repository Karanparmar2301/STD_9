import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import { apiService } from '../services/api';

// ─── Async Thunks ─────────────────────────────────────────────────────────────

export const fetchAnnouncements = createAsyncThunk(
    'announcements/fetch',
    async (uid, { rejectWithValue }) => {
        try {
            const response = await apiService.getAnnouncements(uid);
            return response.data; // { announcements, unread_count }
        } catch (error) {
            if (error.response?.status === 404) {
                return { announcements: [], unread_count: 0 };
            }
            return rejectWithValue(error.response?.data?.detail || error.message);
        }
    }
);

export const markAnnouncementRead = createAsyncThunk(
    'announcements/markRead',
    async ({ uid, announcement_id }, { rejectWithValue }) => {
        try {
            const response = await apiService.markAnnouncementRead({ uid, announcement_id });
            return response.data; // { success, announcement_id, unread_count }
        } catch (error) {
            return rejectWithValue(error.response?.data?.detail || error.message);
        }
    }
);

// ─── Slice ───────────────────────────────────────────────────────────────────

const announcementsSlice = createSlice({
    name: 'announcements',
    initialState: {
        items: [],
        unreadCount: 0,
        filter: 'all',       // all | student | meeting | sports | holiday | event | important
        searchQuery: '',
        expandedId: null,    // currently expanded card ID
        loading: false,
        markingReadId: null, // ID being marked right now
        error: null
    },
    reducers: {
        setFilter: (state, action) => {
            state.filter = action.payload;
        },
        setSearchQuery: (state, action) => {
            state.searchQuery = action.payload;
        },
        setExpandedId: (state, action) => {
            state.expandedId = state.expandedId === action.payload ? null : action.payload;
        },
        clearAnnouncementsError: (state) => {
            state.error = null;
        }
    },
    extraReducers: (builder) => {
        builder
            // fetchAnnouncements
            .addCase(fetchAnnouncements.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchAnnouncements.fulfilled, (state, action) => {
                state.loading = false;
                state.items = action.payload.announcements || [];
                state.unreadCount = action.payload.unread_count ?? 0;
            })
            .addCase(fetchAnnouncements.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
                state.items = [];
            })
            // markAnnouncementRead
            .addCase(markAnnouncementRead.pending, (state, action) => {
                state.markingReadId = action.meta.arg.announcement_id;
            })
            .addCase(markAnnouncementRead.fulfilled, (state, action) => {
                state.markingReadId = null;
                const { announcement_id, unread_count } = action.payload;
                const item = state.items.find(a => a.id === announcement_id);
                if (item) item.is_read = true;
                state.unreadCount = unread_count ?? Math.max(0, state.unreadCount - 1);
            })
            .addCase(markAnnouncementRead.rejected, (state) => {
                state.markingReadId = null;
            });
    }
});

export const {
    setFilter,
    setSearchQuery,
    setExpandedId,
    clearAnnouncementsError
} = announcementsSlice.actions;

// ─── Selectors ───────────────────────────────────────────────────────────────

export const selectUnreadCount = (state) => state.announcements.unreadCount;
export const selectAnnouncementItems = (state) => state.announcements.items;
export const selectAnnouncementFilter = (state) => state.announcements.filter;
export const selectSearchQuery = (state) => state.announcements.searchQuery;
export const selectExpandedId = (state) => state.announcements.expandedId;
export const selectAnnouncementsLoading = (state) => state.announcements.loading;
export const selectMarkingReadId = (state) => state.announcements.markingReadId;
export const selectAnnouncementsError = (state) => state.announcements.error;

export const selectFilteredAnnouncements = createSelector(
    [selectAnnouncementItems, selectAnnouncementFilter, selectSearchQuery],
    (items, filter, query) => {
        let result = filter === 'all' ? items : items.filter(a => a.category === filter);
        if (query.trim()) {
            const q = query.toLowerCase();
            result = result.filter(a =>
                a.title?.toLowerCase().includes(q) ||
                a.description?.toLowerCase().includes(q) ||
                a.category?.toLowerCase().includes(q)
            );
        }
        return result;
    }
);

export default announcementsSlice.reducer;
