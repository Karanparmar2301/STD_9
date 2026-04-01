import React, { useMemo, useState } from 'react';
import { motion } from 'framer-motion';
import SubjectCard from './SubjectCard';
import './TimetableGrid.css';

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const DAY_ABBR = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const WEEKDAY_MAP = { 1: 'Monday', 2: 'Tuesday', 3: 'Wednesday', 4: 'Thursday', 5: 'Friday', 6: 'Saturday' };

function parseTime(t) {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + m;
}

function isNowSlot(slot) {
    const now = new Date();
    const cur = now.getHours() * 60 + now.getMinutes();
    return cur >= parseTime(slot.start) && cur < parseTime(slot.end);
}

function TimetableGrid({ slots = [], schedule = {} }) {
    const [accordionOpen, setAccordionOpen] = useState(null);

    const todayName = useMemo(() => WEEKDAY_MAP[new Date().getDay()] || null, []);

    const nextSlotId = useMemo(() => {
        if (!todayName) return null;
        const todaySchedule = schedule[todayName] || {};
        const now = new Date();
        const curMin = now.getHours() * 60 + now.getMinutes();
        for (const slot of slots) {
            if (slot.is_break) continue;
            const cell = todaySchedule[slot.id];
            if (!cell || cell.subject === 'Break') continue;
            if (parseTime(slot.start) > curMin) return slot.id;
        }
        return null;
    }, [slots, schedule, todayName]);

    /* ── Desktop Grid ── */
    return (
        <>
            {/* Desktop / Tablet */}
            <div className="tt-grid-wrapper">
                <div className="tt-grid">
                    {/* Header Row */}
                    <div className="tt-header-cell tt-time-header">
                        <span className="tt-clock-icon">⏰</span>
                        <span>TIME</span>
                    </div>
                    {DAYS.map((day, i) => (
                        <div
                            key={day}
                            className={`tt-header-cell${day === todayName ? ' tt-header-today' : ''}`}
                        >
                            {day.toUpperCase()}
                        </div>
                    ))}

                    {/* Data Rows */}
                    {slots.map((slot, rowIdx) => {
                        const isBreakRow = slot.is_break;
                        const nowSlot = !isBreakRow && isNowSlot(slot);

                        return (
                            <React.Fragment key={slot.id}>
                                {/* Time Column */}
                                <div className={`tt-time-cell${isBreakRow ? ' tt-time-cell--break' : ''}`}>
                                    {isBreakRow ? (
                                        <>
                                            <span className="tt-break-coffee">☕</span>
                                            <span className="tt-break-label">Break</span>
                                            <span className="tt-break-time">{slot.start} – {slot.end}</span>
                                        </>
                                    ) : (
                                        <>
                                            <span className="tt-lecture-label">{slot.label}</span>
                                            <span className="tt-lecture-time">{slot.start} – {slot.end}</span>
                                        </>
                                    )}
                                </div>

                                {/* Day Cells */}
                                {DAYS.map((day) => {
                                    const daySchedule = schedule[day] || {};
                                    const cell = daySchedule[slot.id];
                                    const isToday = day === todayName;

                                    if (cell === null || cell === undefined) {
                                        return (
                                            <div
                                                key={day}
                                                className={`tt-cell tt-cell--empty${isToday ? ' tt-cell--today' : ''}`}
                                            >
                                                <span className="tt-dash">—</span>
                                            </div>
                                        );
                                    }

                                    if (cell.subject === 'Break') {
                                        return (
                                            <div
                                                key={day}
                                                className={`tt-cell tt-cell--break${isToday ? ' tt-cell--today' : ''}`}
                                            >
                                                <span className="tt-break-badge">☕ Break · 20 min</span>
                                            </div>
                                        );
                                    }

                                    return (
                                        <div
                                            key={day}
                                            className={`tt-cell${isToday ? ' tt-cell--today' : ''}`}
                                        >
                                            <SubjectCard
                                                subject={cell.subject}
                                                teacher={cell.teacher}
                                                isNow={isToday && nowSlot}
                                                isNext={isToday && slot.id === nextSlotId}
                                            />
                                        </div>
                                    );
                                })}
                            </React.Fragment>
                        );
                    })}
                </div>
            </div>

            {/* Mobile Accordion */}
            <div className="tt-mobile-accordion">
                {DAYS.map((day, i) => (
                    <div
                        key={day}
                        className={`tt-accordion-item${day === todayName ? ' tt-accordion-today' : ''}`}
                    >
                        <button
                            className="tt-accordion-header"
                            onClick={() => setAccordionOpen(accordionOpen === day ? null : day)}
                        >
                            <span>
                                {day === todayName && <span className="tt-today-dot" />}
                                {day}
                            </span>
                            <span className="tt-accordion-chevron">
                                {accordionOpen === day ? '▲' : '▼'}
                            </span>
                        </button>

                        {accordionOpen === day && (
                            <motion.div
                                className="tt-accordion-body"
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.25 }}
                            >
                                {slots.map((slot) => {
                                    const cell = (schedule[day] || {})[slot.id];
                                    const nowSlot = !slot.is_break && isNowSlot(slot);

                                    if (cell === null || cell === undefined) return null;
                                    if (cell.subject === 'Break') {
                                        return (
                                            <div key={slot.id} className="tt-mob-row tt-mob-break">
                                                <span>☕ Break · {slot.start} – {slot.end}</span>
                                            </div>
                                        );
                                    }
                                    return (
                                        <div key={slot.id} className="tt-mob-row">
                                            <div className="tt-mob-time">
                                                <span>{slot.label}</span>
                                                <span className="tt-mob-time-str">{slot.start} – {slot.end}</span>
                                            </div>
                                            <div className="tt-mob-card">
                                                <SubjectCard
                                                    subject={cell.subject}
                                                    teacher={cell.teacher}
                                                    isNow={day === todayName && nowSlot}
                                                    isMobile
                                                />
                                            </div>
                                        </div>
                                    );
                                })}
                            </motion.div>
                        )}
                    </div>
                ))}
            </div>
        </>
    );
}

export default TimetableGrid;
