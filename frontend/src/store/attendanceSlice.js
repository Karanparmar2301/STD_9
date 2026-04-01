import { createSlice, createAsyncThunk, createSelector } from '@reduxjs/toolkit';
import api from '../services/api';

// Async thunks
export const fetchAttendance = createAsyncThunk(
    'attendance/fetch',
    async (studentId, { rejectWithValue }) => {
        try {
            const response = await api.get(`/attendance/${studentId}`);
            return response.data;
        } catch (error) {
            // Return mock data if endpoint doesn't exist
            if (error.response?.status === 404) {
                return {
                    records: [],
                    monthlyData: []
                };
            }
            return rejectWithValue(error.message);
        }
    }
);

export const markAttendance = createAsyncThunk(
    'attendance/mark',
    async ({ studentId, date, status }, { rejectWithValue }) => {
        try {
            const response = await api.post('/attendance', {
                student_id: studentId,
                date,
                status
            });
            return response.data;
        } catch (error) {
            return rejectWithValue(error.message);
        }
    }
);

const attendanceSlice = createSlice({
    name: 'attendance',
    initialState: {
        records: [],
        monthlyData: [],
        stats: {
            percentage: 0,
            presentDays: 0,
            absentDays: 0,
            totalDays: 0,
            streak: 0,
            monthlyTrend: 0,
            riskLevel: 'low' // low, medium, high
        },
        loading: false,
        error: null
    },
    reducers: {
        initializeAttendance: (state, action) => {
            const { percentage, presentDays, absentDays, totalDays, streak } = action.payload;
            state.stats.percentage = percentage || 0;
            state.stats.presentDays = presentDays || 0;
            state.stats.absentDays = absentDays || 0;
            state.stats.totalDays = totalDays || 0;
            state.stats.streak = streak || 0;
            state.stats.monthlyTrend = 0;

            // Risk level
            if (state.stats.percentage < 75) {
                state.stats.riskLevel = 'high';
            } else if (state.stats.percentage < 85) {
                state.stats.riskLevel = 'medium';
            } else {
                state.stats.riskLevel = 'low';
            }
        },

        calculateStats: (state) => {
            const allRecords = state.records;
            // Exclude Sundays — strict Mon–Sat school week
            const WORKING_DAYS = [1, 2, 3, 4, 5, 6];
            const records = allRecords
                .filter(r => {
                    const d = new Date(r.date || r.attendance_date);
                    return WORKING_DAYS.includes(d.getDay());
                })
                .sort((a, b) =>
                    new Date(a.date || a.attendance_date) -
                    new Date(b.date || b.attendance_date)
                );

            const totalDays = records.length;
            const presentDays = records.filter(r =>
                r.status?.toLowerCase() === 'present'
            ).length;
            const absentDays = totalDays - presentDays;

            state.stats.totalDays = totalDays;
            state.stats.presentDays = presentDays;
            state.stats.absentDays = absentDays;
            state.stats.percentage =
                totalDays > 0 ? Math.round((presentDays / totalDays) * 100) : 0;

            // Date-aware streak: Sat→Mon gap (2 days over Sunday) is valid
            let streak = 0;
            for (let i = records.length - 1; i >= 0; i--) {
                if (records[i].status?.toLowerCase() !== 'present') break;
                streak++;
                if (i > 0) {
                    const curr = new Date(records[i].date || records[i].attendance_date);
                    const prev = new Date(records[i - 1].date || records[i - 1].attendance_date);
                    const diffDays = Math.round((curr - prev) / 86400000);
                    if (diffDays === 1) continue;                      // consecutive school day
                    if (diffDays === 2 && prev.getDay() === 6) continue; // Sat→Sun gap→Mon
                    break; // any other gap ends streak
                }
            }
            state.stats.streak = streak;

            // Risk level
            if (state.stats.percentage < 75) {
                state.stats.riskLevel = 'high';
            } else if (state.stats.percentage < 85) {
                state.stats.riskLevel = 'medium';
            } else {
                state.stats.riskLevel = 'low';
            }
        }
    },
    extraReducers: (builder) => {
        builder
            .addCase(fetchAttendance.pending, (state) => {
                state.loading = true;
                state.error = null;
            })
            .addCase(fetchAttendance.fulfilled, (state, action) => {
                state.loading = false;
                state.records = action.payload.records || [];
                state.monthlyData = action.payload.monthlyData || [];
                attendanceSlice.caseReducers.calculateStats(state);
            })
            .addCase(fetchAttendance.rejected, (state, action) => {
                state.loading = false;
                state.error = action.payload;
            })
            .addCase(markAttendance.fulfilled, (state, action) => {
                state.records.push(action.payload);
                attendanceSlice.caseReducers.calculateStats(state);
            });
    }
});

export const { initializeAttendance, calculateStats } = attendanceSlice.actions;

// ============ ENHANCED SELECTORS ============

// Basic Selectors
export const selectAttendanceStats = (state) => state.attendance.stats;
export const selectAttendanceRecords = (state) => state.attendance.records;
export const selectMonthlyData = (state) => state.attendance.monthlyData;
export const selectAttendanceLoading = (state) => state.attendance.loading;
export const selectAttendanceError = (state) => state.attendance.error;

// Percentage Selector (Memoized)
export const selectAttendancePercentage = createSelector(
    [(state) => state.attendance.stats],
    (stats) => {
        const { presentDays, totalDays } = stats;
        return totalDays === 0 ? 0 : Math.round((presentDays / totalDays) * 100);
    }
);

// Streak Selector
export const selectAttendanceStreak = createSelector(
    [(state) => state.attendance.stats],
    (stats) => stats.streak || 0
);

// Risk Level Selector
export const selectRiskLevel = createSelector(
    [(state) => state.attendance.stats],
    (stats) => stats.riskLevel || 'low'
);

// Perfect Attendance Badge Selector (30+ consecutive presents)
export const selectPerfectAttendanceBadge = createSelector(
    [(state) => state.attendance.stats],
    (stats) => stats.streak >= 30
);

// Weekly Summary Selector (Last 6 school days — Mon–Sat, no Sundays, no holidays)
export const selectWeeklySummary = createSelector(
    [
        (state) => state.attendance.records,
        (state) => state.holidays?.list ?? [],
    ],
    (records, holidayList) => {
        const holidayDates = new Set(holidayList.map((h) => h.date));
        // Filter out Sundays AND holidays first
        const schoolRecords = records.filter((r) => {
            const d = new Date(r.date || r.attendance_date);
            const dateKey = r.date || r.attendance_date;
            return d.getDay() !== 0 && !holidayDates.has(dateKey);
        });
        const last6Days = schoolRecords.slice(-6);
        const presentCount = last6Days.filter(
            (r) => r.status === 'present' || r.status === 'Present'
        ).length;
        const absentCount = last6Days.length - presentCount;
        const weeklyPercentage =
            last6Days.length > 0
                ? Math.round((presentCount / last6Days.length) * 100)
                : 0;
        return {
            presentCount,
            absentCount,
            totalDays: last6Days.length,
            percentage: weeklyPercentage,
        };
    }
);

// Calendar Data Selector — includes holiday status
export const selectCalendarData = createSelector(
    [
        (state) => state.attendance.records,
        (state) => state.holidays?.list ?? [],
    ],
    (records, holidayList) => {
        const calendarMap = {};
        records.forEach((record) => {
            const dateKey = record.date || record.attendance_date;
            if (dateKey) {
                calendarMap[dateKey] = record.status?.toLowerCase() || 'present';
            }
        });
        // Overwrite with 'holiday' for any holiday date
        holidayList.forEach((h) => {
            calendarMap[h.date] = 'holiday';
        });
        return calendarMap;
    }
);

// Motivational Message Selector
export const selectMotivationalMessage = createSelector(
    [selectAttendancePercentage, selectAttendanceStreak],
    (percentage, streak) => {
        if (percentage >= 95 && streak >= 7) {
            return { emoji: '🎉', message: 'Outstanding! Star student!' };
        } else if (percentage >= 90) {
            return { emoji: '⭐', message: 'Excellent attendance!' };
        } else if (percentage >= 80) {
            return { emoji: '👍', message: 'Good job! Keep it up!' };
        } else if (percentage >= 75) {
            return { emoji: '💪', message: 'You can do better!' };
        } else {
            return { emoji: '🤗', message: 'Let\'s improve together!' };
        }
    }
);

// Heatmap Data Selector — Sundays excluded, holidays marked
export const selectHeatmapData = createSelector(
    [
        (state) => state.attendance.records,
        (state) => state.holidays?.list ?? [],
    ],
    (records, holidayList) => {
        const heatmapMap = {};
        const WORKING_DAYS = [1, 2, 3, 4, 5, 6];
        const holidayDates = new Set(holidayList.map((h) => h.date));
        records.forEach((record) => {
            const dateKey = record.date || record.attendance_date;
            if (dateKey) {
                const d = new Date(dateKey);
                if (WORKING_DAYS.includes(d.getDay())) {
                    // Holiday overrides present/absent
                    heatmapMap[dateKey] = holidayDates.has(dateKey)
                        ? 'holiday'
                        : (record.status?.toLowerCase() || 'present');
                }
            }
        });
        // Also mark holidays with no attendance record
        holidayList.forEach((h) => {
            const d = new Date(h.date);
            if (WORKING_DAYS.includes(d.getDay())) {
                heatmapMap[h.date] = 'holiday';
            }
        });
        return heatmapMap;
    }
);

// Weekly Attendance Selector (Mon–Sat 6-day school week, holidays excluded)
export const selectWeeklyAttendance = createSelector(
    [
        (state) => state.attendance.records,
        (state) => state.holidays?.list ?? [],
    ],
    (records, holidayList) => {
        const holidayDates = new Set(holidayList.map((h) => h.date));
        const today = new Date();
        today.setHours(23, 59, 59, 999);
        // Find start of current school week (Monday)
        const startOfWeek = new Date(today);
        const dayOfWeek = startOfWeek.getDay(); // 0=Sun, 1=Mon … 6=Sat
        const daysFromMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
        startOfWeek.setDate(startOfWeek.getDate() - daysFromMonday);
        startOfWeek.setHours(0, 0, 0, 0);

        const weekRecords = records.filter((record) => {
            const recordDate = new Date(record.date || record.attendance_date);
            const dateKey = record.date || record.attendance_date;
            return (
                recordDate >= startOfWeek &&
                recordDate <= today &&
                recordDate.getDay() !== 0 && // Skip Sundays
                !holidayDates.has(dateKey)   // Skip holidays
            );
        });

        // Count holidays in the current week (they reduce the "working" goal)
        let holidaysThisWeek = 0;
        for (let d = new Date(startOfWeek); d <= today; d.setDate(d.getDate() + 1)) {
            const dk = d.toISOString().split('T')[0];
            if (d.getDay() !== 0 && holidayDates.has(dk)) holidaysThisWeek++;
        }

        const present = weekRecords.filter(
            (r) => r.status?.toLowerCase() === 'present'
        ).length;
        const absent = weekRecords.filter(
            (r) => r.status?.toLowerCase() === 'absent'
        ).length;
        const goal = Math.max(1, 6 - holidaysThisWeek);
        const progress = goal > 0 ? Math.round((present / goal) * 100) : 0;

        return {
            present,
            absent,
            goal,
            progress: Math.min(progress, 100),
        };
    }
);

// Attendance Alerts Selector (for smart reminders)
export const selectAttendanceAlerts = createSelector(
    [
        (state) => state.attendance.records,
        selectAttendancePercentage,
        (state) => state.holidays?.list ?? [],
    ],
    (records, percentage, holidayList) => {
        const today = new Date();
        const todayKey = today.toISOString().split('T')[0];
        const isTodaySunday = today.getDay() === 0;
        const holidayDates = new Set(holidayList.map((h) => h.date));
        const isTodayHoliday = holidayDates.has(todayKey);

        // Last 6 school days (no Sundays, no holidays)
        const schoolRecords = records.filter((r) => {
            const d = new Date(r.date || r.attendance_date);
            const dateKey = r.date || r.attendance_date;
            return d.getDay() !== 0 && !holidayDates.has(dateKey);
        });
        const last6Days = schoolRecords.slice(-6);

        const markedToday =
            isTodaySunday ||
            isTodayHoliday ||
            records.some((r) => (r.date || r.attendance_date) === todayKey);

        const lowAttendance = percentage < 80;

        const recentAbsences = last6Days.filter(
            (r) => r.status?.toLowerCase() === 'absent'
        ).length;
        const frequentAbsence = recentAbsences >= 3;

        return {
            missingToday: !markedToday,
            lowAttendance,
            frequentAbsence,
            hasAlerts: !markedToday || lowAttendance || frequentAbsence,
        };
    }
);

export default attendanceSlice.reducer;
