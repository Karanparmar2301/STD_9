import React, { useState } from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { selectCalendarData } from '../../store/attendanceSlice';
import { selectHolidayMap } from '../../store/holidaysSlice';
import './AttendanceCalendar.css';

/* ── Inline SVG Icons ─────────────────────────────────────── */
const CheckIcon = () => (
    <svg className="day-icon" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round">
        <polyline points="20 6 9 17 4 12" />
    </svg>
);

const CalendarIcon = () => (
    <svg className="day-icon" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
        <line x1="16" y1="2" x2="16" y2="6" />
        <line x1="8" y1="2" x2="8" y2="6" />
        <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
);


const AbsentIcon = () => (
    <svg className="day-icon" viewBox="0 0 24 24" fill="none"
        stroke="currentColor" strokeWidth="2.5"
        strokeLinecap="round" strokeLinejoin="round">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

const ChevronLeft = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ width: 18, height: 18 }}>
        <polyline points="15 18 9 12 15 6" />
    </svg>
);

const ChevronRight = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ width: 18, height: 18 }}>
        <polyline points="9 18 15 12 9 6" />
    </svg>
);

const YearGridIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        style={{ width: 18, height: 18 }}>
        <rect x="3" y="3" width="7" height="7" rx="1.5" />
        <rect x="14" y="3" width="7" height="7" rx="1.5" />
        <rect x="3" y="14" width="7" height="7" rx="1.5" />
        <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
);

const CloseIcon = () => (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
        strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
        style={{ width: 18, height: 18 }}>
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

/* ── Component ────────────────────────────────────────────── */
function AttendanceCalendar() {
    const calendarData = useSelector(selectCalendarData);
    const holidayMap   = useSelector(selectHolidayMap);
    const [currentDate, setCurrentDate] = useState(new Date());
    const [yearView, setYearView]         = useState(false);
    const [yearOffset, setYearOffset]     = useState(0);

    const getDaysInMonth = (date) =>
        new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();

    const getFirstDayOfMonth = (date) =>
        new Date(date.getFullYear(), date.getMonth(), 1).getDay();

    const formatDate = (year, month, day) => {
        const m = String(month + 1).padStart(2, '0');
        const d = String(day).padStart(2, '0');
        return `${year}-${m}-${d}`;
    };

    const isToday = (year, month, day) => {
        const t = new Date();
        return t.getFullYear() === year && t.getMonth() === month && t.getDate() === day;
    };

    const isFutureDate = (year, month, day) => {
        const d = new Date(year, month, day);
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        return d > today;
    };

    const previousMonth = () =>
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));

    const nextMonth = () =>
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));

    const currentMonth = currentDate.getMonth();
    const currentYear  = currentDate.getFullYear();
    const daysInMonth  = getDaysInMonth(currentDate);
    const firstDay     = getFirstDayOfMonth(currentDate);

    /* Build day cells */
    const calendarDays = [];

    // Leading empty cells
    for (let i = 0; i < firstDay; i++) {
        calendarDays.push(
            <div key={`empty-${i}`} className="sac-day sac-day--empty" />
        );
    }

    // Day cells
    for (let day = 1; day <= daysInMonth; day++) {
        const dateKey    = formatDate(currentYear, currentMonth, day);
        const status     = calendarData[dateKey];
        const todayFlag  = isToday(currentYear, currentMonth, day);
        const future     = isFutureDate(currentYear, currentMonth, day);
        const dayOfWeek  = new Date(currentYear, currentMonth, day).getDay();
        const isSunday   = dayOfWeek === 0;
        const isHoliday  = status === 'holiday' || !!holidayMap[dateKey];
        const holidayInfo = holidayMap[dateKey];
        const isPresent  = !isSunday && !isHoliday && !future && status === 'present';
        const isAbsent   = !isSunday && !isHoliday && !future && status === 'absent';

        let variant = 'inactive';
        if (todayFlag && !isSunday)      variant = 'today';
        else if (isSunday)               variant = 'weekend';
        else if (isHoliday)              variant = 'holiday';
        else if (future)                 variant = 'future';
        else if (isPresent)              variant = 'present';
        else if (isAbsent)               variant = 'absent';

        const canHover = !future && !isSunday;

        calendarDays.push(
            <motion.div
                key={day}
                className={`sac-day sac-day--${variant}`}
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: day * 0.008, duration: 0.25, ease: 'easeOut' }}
                whileHover={canHover ? { y: -3, scale: 1.03, boxShadow: '0 6px 16px rgba(0,0,0,0.10)' } : {}}
                whileTap={canHover ? { scale: 0.95 } : {}}
                title={isHoliday && holidayInfo ? `${holidayInfo.name}` : undefined}
            >
                <span className="sac-day__num">{day}</span>
                <span className="sac-day__icon">
                    {variant === 'present' && <CheckIcon />}
                    {variant === 'today'   && <CalendarIcon />}
                    {variant === 'absent'  && <AbsentIcon />}
                </span>
                {variant === 'holiday' && holidayInfo && (
                    <span className="sac-day__holiday-name">
                        {holidayInfo.name?.split(' ').slice(0, 2).join(' ')}
                    </span>
                )}
            </motion.div>
        );
    }

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];

    const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const miniWeekDays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

    const viewYear = currentYear + yearOffset;

    /* Build mini month cells for year view */
    const buildMiniMonth = (year, monthIdx) => {
        const daysInM = new Date(year, monthIdx + 1, 0).getDate();
        const firstD  = new Date(year, monthIdx, 1).getDay();
        const cells   = [];
        for (let i = 0; i < firstD; i++) cells.push(null);
        for (let d = 1; d <= daysInM; d++) cells.push(d);
        return cells;
    };

    const getMiniVariant = (year, monthIdx, day) => {
        if (!day) return 'empty';
        const todayD = new Date(); todayD.setHours(0,0,0,0);
        const cellD  = new Date(year, monthIdx, day); cellD.setHours(0,0,0,0);
        const ds     = formatDate(year, monthIdx, day);
        const dow    = cellD.getDay();
        if (cellD.getTime() === todayD.getTime()) return 'today';
        if (holidayMap[ds])        return 'holiday';
        if (cellD > todayD)        return 'future';
        if (dow === 0)             return 'weekend';
        const st = calendarData[ds];
        if (st === 'absent')       return 'absent';
        if (st === 'present')      return 'present';
        return 'past';
    };

    /* Count stats for the displayed month */
    const monthStats = { present: 0, absent: 0, holiday: 0 };
    for (let d = 1; d <= daysInMonth; d++) {
        const key = formatDate(currentYear, currentMonth, d);
        const dow = new Date(currentYear, currentMonth, d).getDay();
        if (dow === 0) continue;
        if (holidayMap[key] || calendarData[key] === 'holiday') { monthStats.holiday++; continue; }
        if (calendarData[key] === 'present') monthStats.present++;
        else if (calendarData[key] === 'absent') monthStats.absent++;
    }

    return (
        <>
        <motion.div
            className="sac-wrapper"
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
        >
            <div className="sac-card">
                {/* ── Header ── */}
                <div className="sac-header">
                    <div className="sac-header__left">
                        <div className="sac-header__title-row">
                            <motion.button
                                className="sac-year-btn"
                                onClick={() => { setYearOffset(0); setYearView(true); }}
                                whileHover={{ scale: 1.12, backgroundColor: 'rgba(59,130,246,0.1)' }}
                                whileTap={{ scale: 0.92 }}
                                title="View Full Year Calendar"
                                aria-label="View Full Year Calendar"
                            >
                                <YearGridIcon />
                                <span className="sac-year-btn__label">Year View</span>
                            </motion.button>
                            <AnimatePresence mode="wait">
                                <motion.h2
                                    key={`${currentMonth}-${currentYear}`}
                                    className="sac-header__title"
                                    initial={{ opacity: 0, x: -12 }}
                                    animate={{ opacity: 1, x: 0 }}
                                    exit={{ opacity: 0, x: 12 }}
                                    transition={{ duration: 0.28 }}
                                >
                                    {monthNames[currentMonth]} {currentYear}
                                </motion.h2>
                            </AnimatePresence>
                        </div>
                        <p className="sac-header__subtitle">Smart Attendance Tracking System</p>
                    </div>

                    <div className="sac-header__nav">
                        <motion.button
                            className="sac-nav-btn"
                            onClick={previousMonth}
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.92 }}
                            aria-label="Previous month"
                        >
                            <ChevronLeft />
                        </motion.button>
                        <motion.button
                            className="sac-nav-btn"
                            onClick={nextMonth}
                            whileHover={{ scale: 1.08 }}
                            whileTap={{ scale: 0.92 }}
                            aria-label="Next month"
                        >
                            <ChevronRight />
                        </motion.button>
                    </div>
                </div>

                {/* ── KPI Cards Row ── */}
                <div className="sac-kpi-row">
                    <div className="sac-kpi-card sac-kpi-card--present">
                        <div className="sac-kpi-card__label">
                            <span className="sac-kpi-card__dot" /> Present
                        </div>
                        <div className="sac-kpi-card__num">{monthStats.present}</div>
                        <div className="sac-kpi-card__sublabel">Days this month</div>
                    </div>
                    <div className="sac-kpi-card sac-kpi-card--absent">
                        <div className="sac-kpi-card__label">
                            <span className="sac-kpi-card__dot" /> Absent
                        </div>
                        <div className="sac-kpi-card__num">{monthStats.absent}</div>
                        <div className="sac-kpi-card__sublabel">Days this month</div>
                    </div>
                    <div className="sac-kpi-card sac-kpi-card--holiday">
                        <div className="sac-kpi-card__label">
                            <span className="sac-kpi-card__dot" /> Holiday
                        </div>
                        <div className="sac-kpi-card__num">{monthStats.holiday}</div>
                        <div className="sac-kpi-card__sublabel">Days this month</div>
                    </div>
                </div>

                {/* ── Weekday Labels ── */}
                <div className="sac-weekdays">
                    {weekDays.map((d, i) => (
                        <div key={d} className={`sac-weekday${i === 0 ? ' sac-weekday--sun' : ''}`}>
                            {d}
                        </div>
                    ))}
                </div>

                {/* ── Calendar Grid ── */}
                <AnimatePresence mode="wait">
                    <motion.div
                        key={`${currentMonth}-${currentYear}`}
                        className="sac-grid"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -12 }}
                        transition={{ duration: 0.28 }}
                    >
                        {calendarDays}
                    </motion.div>
                </AnimatePresence>

                {/* ── Legend ── */}
                <div className="sac-legend">
                    <div className="sac-legend__item">
                        <span className="sac-legend__swatch sac-legend__swatch--present" />
                        <span>Present</span>
                    </div>
                    <div className="sac-legend__item">
                        <span className="sac-legend__swatch sac-legend__swatch--absent" />
                        <span>Absent</span>
                    </div>
                    <div className="sac-legend__item">
                        <span className="sac-legend__swatch sac-legend__swatch--holiday" />
                        <span>Holiday</span>
                    </div>
                    <div className="sac-legend__item">
                        <span className="sac-legend__swatch sac-legend__swatch--today" />
                        <span>Today</span>
                    </div>
                    <div className="sac-legend__item">
                        <span className="sac-legend__swatch sac-legend__swatch--future" />
                        <span>Upcoming</span>
                    </div>
                </div>
            </div>
        </motion.div>

            {/* ── Full Year View Modal ── */}
            <AnimatePresence>
                {yearView && (
                    <motion.div
                        className="sac-yrmodal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.25 }}
                        onClick={(e) => e.target === e.currentTarget && setYearView(false)}
                    >
                        <motion.div
                            className="sac-yrmodal"
                            initial={{ opacity: 0, scale: 0.92, y: 32 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.92, y: 32 }}
                            transition={{ duration: 0.32, ease: [0.22, 1, 0.36, 1] }}
                        >
                            {/* Modal Header */}
                            <div className="sac-yrmodal__header">
                                <div className="sac-yrmodal__header-left">
                                    <motion.button
                                        className="sac-yrmodal__nav-btn"
                                        onClick={() => setYearOffset(y => y - 1)}
                                        whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                    ><ChevronLeft /></motion.button>
                                    <h3 className="sac-yrmodal__title">{viewYear} — Full Year Calendar</h3>
                                    <motion.button
                                        className="sac-yrmodal__nav-btn"
                                        onClick={() => setYearOffset(y => y + 1)}
                                        whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                                    ><ChevronRight /></motion.button>
                                </div>
                                <motion.button
                                    className="sac-yrmodal__close"
                                    onClick={() => setYearView(false)}
                                    whileHover={{ scale: 1.1, backgroundColor: 'rgba(239,68,68,0.12)' }}
                                    whileTap={{ scale: 0.9 }}
                                    aria-label="Close"
                                ><CloseIcon /></motion.button>
                            </div>

                            {/* 12-Month Grid */}
                            <div className="sac-yr-grid">
                                {monthNames.map((mName, mIdx) => {
                                    const isCurrentViewMonth = mIdx === currentMonth && viewYear === currentYear;
                                    const miniCells = buildMiniMonth(viewYear, mIdx);
                                    return (
                                        <motion.div
                                            key={mIdx}
                                            className={`sac-mini-month${isCurrentViewMonth ? ' sac-mini-month--active' : ''}`}
                                            whileHover={{ y: -4, boxShadow: '0 8px 24px rgba(0,0,0,0.12)' }}
                                            onClick={() => {
                                                setCurrentDate(new Date(viewYear, mIdx, 1));
                                                setYearOffset(0);
                                                setYearView(false);
                                            }}
                                        >
                                            <div className="sac-mini-month__title">{mName}</div>
                                            <div className="sac-mini-month__weekdays">
                                                {miniWeekDays.map((wd, wi) => (
                                                    <span key={wi} className={`sac-mini-wd${wi === 0 ? ' sac-mini-wd--sun' : ''}`}>{wd}</span>
                                                ))}
                                            </div>
                                            <div className="sac-mini-month__grid">
                                                {miniCells.map((day, ci) => {
                                                    const v = getMiniVariant(viewYear, mIdx, day);
                                                    return (
                                                        <span key={ci} className={`sac-mini-day sac-mini-day--${v}`}>
                                                            {day || ''}
                                                        </span>
                                                    );
                                                })}
                                            </div>
                                        </motion.div>
                                    );
                                })}
                            </div>

                            {/* Legend */}
                            <div className="sac-yrmodal__legend">
                                {[['present','#22c55e','Present'],['absent','#f43f5e','Absent'],['holiday','#f59e0b','Holiday'],['today','#3b82f6','Today'],['future','#cbd5e1','Upcoming']].map(([k,c,l]) => (
                                    <div key={k} className="sac-yrmodal__legend-item">
                                        <span className="sac-yrmodal__legend-dot" style={{ background: c }} />
                                        <span>{l}</span>
                                    </div>
                                ))}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </>
    );
}

export default AttendanceCalendar;

