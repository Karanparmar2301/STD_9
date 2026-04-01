import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { SUBJECT_COLORS } from './SubjectCard';
import './NextClassWidget.css';

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

function parseTime(timeStr) {
    const [h, m] = timeStr.split(':').map(Number);
    return h * 60 + m;
}

function NextClassWidget({ slots = [], schedule = {} }) {
    const info = useMemo(() => {
        const now = new Date();
        const todayName = DAYS[now.getDay()];
        const currentMin = now.getHours() * 60 + now.getMinutes();

        // Check remaining slots today
        const todaySchedule = schedule[todayName] || {};
        for (const slot of slots) {
            if (slot.is_break) continue;
            const cell = todaySchedule[slot.id];
            if (!cell || cell.subject === 'Break') continue;
            const startMin = parseTime(slot.start);
            const endMin = parseTime(slot.end);

            if (currentMin >= startMin && currentMin < endMin) {
                return { type: 'now', subject: cell.subject, teacher: cell.teacher, time: `${slot.start} – ${slot.end}` };
            }
            if (startMin > currentMin) {
                return { type: 'next', subject: cell.subject, teacher: cell.teacher, time: slot.start };
            }
        }

        // Look at upcoming days this week
        const todayIdx = now.getDay();
        for (let d = 1; d <= 6; d++) {
            const nextDay = DAYS[(todayIdx + d) % 7];
            const daySchedule = schedule[nextDay] || {};
            const firstSlot = slots.find((s) => !s.is_break && daySchedule[s.id] && daySchedule[s.id].subject !== 'Break');
            if (firstSlot) {
                const cell = daySchedule[firstSlot.id];
                return { type: 'next', subject: cell.subject, teacher: cell.teacher, time: firstSlot.start, day: nextDay, isNextDay: true };
            }
        }
        return null;
    }, [slots, schedule]);

    if (!info) return null;

    const colors = SUBJECT_COLORS[info.subject] || { bg: '#f5f5f5', border: '#9e9e9e', text: '#444' };

    return (
        <motion.div
            className="next-class-widget"
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            style={{ '--ncw-border': colors.border, '--ncw-bg': colors.bg, '--ncw-text': colors.text }}
        >
            <span className="ncw-icon">{info.type === 'now' ? '🟢' : '⏰'}</span>
            <div className="ncw-content">
                <span className="ncw-label">
                    {info.type === 'now'
                        ? 'Currently in Progress'
                        : info.isNextDay
                            ? `Today's classes done · Next: ${info.day}`
                            : 'Next Class'}
                </span>
                <span className="ncw-subject">
                    {info.subject}
                    {info.teacher && <span className="ncw-teacher"> · {info.teacher}</span>}
                </span>
            </div>
            <span className="ncw-time">{info.isNextDay ? `${info.day} · ${info.time}` : info.time}</span>
        </motion.div>
    );
}

export default NextClassWidget;
