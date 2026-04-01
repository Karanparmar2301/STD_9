import { createSlice } from '@reduxjs/toolkit';

const initialState = {
    activeSection: 'dashboard',
    sidebarOpen: false,
    loading: {
        profile: false,
        attendance: false,
        homework: false,
        announcements: false,
        games: false,
        aiAssistant: false
    },
    notifications: {
        unreadCount: 3,
        items: []
    },
    theme: 'light'
};

const uiSlice = createSlice({
    name: 'ui',
    initialState,
    reducers: {
        setActiveSection: (state, action) => {
            state.activeSection = action.payload;
        },
        toggleSidebar: (state) => {
            state.sidebarOpen = !state.sidebarOpen;
        },
        setSidebarOpen: (state, action) => {
            state.sidebarOpen = action.payload;
        },
        setLoading: (state, action) => {
            const { section, isLoading } = action.payload;
            state.loading[section] = isLoading;
        },
        setNotifications: (state, action) => {
            state.notifications = action.payload;
        },
        incrementUnreadCount: (state) => {
            state.notifications.unreadCount += 1;
        },
        clearUnreadCount: (state) => {
            state.notifications.unreadCount = 0;
        },
        toggleTheme: (state) => {
            state.theme = state.theme === 'light' ? 'dark' : 'light';
        }
    }
});

export const {
    setActiveSection,
    toggleSidebar,
    setSidebarOpen,
    setLoading,
    setNotifications,
    incrementUnreadCount,
    clearUnreadCount,
    toggleTheme
} = uiSlice.actions;

export default uiSlice.reducer;
