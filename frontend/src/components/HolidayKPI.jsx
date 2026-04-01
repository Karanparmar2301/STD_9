import React, { useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import {
    selectHolidayList,
    selectNextHoliday,
    selectPastHolidays,
} from '../store/holidaysSlice';
import './HolidayKPI.css';

// Map holiday types to emoji badges
const TYPE_EMOJI = {
    National:              '🇮🇳',
    Festival:              '🎉',
    'National Observance': '🏛️',
    Regional:              '🌏',
    Optional:              '✨',
};

// Type colours  [bg, border, text, badge-bg]
const TYPE_COLORS = {
    National:              ['#eff6ff', '#bfdbfe', '#1e40af', '#3b82f6'],
    Festival:              ['#fff7ed', '#fed7aa', '#9a3412', '#f97316'],
    'National Observance': ['#f5f3ff', '#ddd6fe', '#5b21b6', '#7c3aed'],
    Regional:              ['#f0fdf4', '#bbf7d0', '#14532d', '#22c55e'],
    Optional:              ['#fdf4ff', '#f5d0fe', '#701a75', '#c026d3'],
};

// Descriptions for each holiday type
const TYPE_DESC = {
    National: 'National holidays are gazetted public holidays observed across all of India, marking pivotal moments in the country\'s history — Independence, Republic Day, and the birth anniversaries of national leaders.',
    Festival: 'Festival holidays celebrate India\'s vibrant cultural and religious diversity. From Diwali and Holi to Eid and Christmas, these days reflect the unity in diversity of the nation.',
    'National Observance': 'Days of national significance that honour historical figures, movements, or causes. These spark awareness, remembrance, and pride in India\'s heritage.',
    Regional: 'Regional holidays are specific to particular states or communities, honouring local heroes, traditions, and cultural milestones unique to that region.',
    Optional: 'Optional holidays give students and staff the freedom to observe days of personal, religious, or cultural relevance that may not be universally observed.',
};

// Short fun fact per holiday (keyed by date)
const HOLIDAY_FACTS = {
    '2026-01-01': 'New Year\'s Day marks the start of the Gregorian calendar year, celebrated worldwide with fireworks and festivities.',
    '2026-01-14': 'Makar Sankranti marks the sun\'s transition into Capricorn — a harvest festival celebrated with kite flying, til-gur sweets and bonfires.',
    '2026-01-23': 'Netaji Subhas Chandra Bose\'s birth anniversary — honouring the fearless freedom fighter who founded the Indian National Army.',
    '2026-01-26': 'On this day in 1950 India\'s Constitution came into effect, making India a sovereign democratic republic. Celebrated with a grand parade in New Delhi.',
    '2026-02-12': 'Maharishi Dayanand Saraswati was the founder of Arya Samaj and a pioneer of the Indian independence movement.',
    '2026-02-15': 'Maha Shivaratri — "The Great Night of Shiva" — is a night of fasting, prayer, and all-night vigils in honour of Lord Shiva.',
    '2026-02-19': 'Chhatrapati Shivaji Maharaj founded the Maratha Empire and is celebrated as a symbol of bravery, justice and good governance.',
    '2026-03-03': 'Holika Dahan is the bonfire night before Holi, symbolising the victory of good over evil through the legend of Prahlad and Holika.',
    '2026-03-04': 'Holi — the Festival of Colours — welomes spring by throwing vibrant coloured powders and water, celebrating joy and new beginnings.',
    '2026-03-19': 'Ugadi/Gudi Padwa marks the Hindu New Year for several communities across Maharashtra, Andhra Pradesh, Telangana and Karnataka.',
    '2026-03-21': 'Eid-ul-Fitr marks the end of Ramadan, the holy month of fasting — celebrated with prayers, feasts, and giving to charity (Zakat).',
    '2026-03-26': 'Ram Navami celebrates the birth of Lord Rama, the seventh avatar of Vishnu and the hero of the epic Ramayana.',
    '2026-03-31': 'Mahavir Jayanti marks the birth of Vardhamana Mahavira, the 24th Tirthankara and the principal founder of Jainism.',
    '2026-04-02': 'Hanuman Jayanti celebrates the birth of Lord Hanuman, the deity of strength, devotion and selfless service.',
    '2026-04-03': 'Good Friday commemorates the crucifixion of Jesus Christ — observed with prayer, fasting, and church services worldwide.',
    '2026-04-14': 'Baisakhi marks the harvest festival of Punjab and also the founding of the Khalsa Panth by Guru Gobind Singh in 1699.',
    '2026-04-19': 'Akshaya Tritiya is considered one of the most auspicious days in the Hindu calendar — "Akshaya" means never diminishing.',
    '2026-05-01': 'Labour Day honours workers worldwide. Buddha Purnima also falls on this day in 2026, marking the birth of Gautama Buddha.',
    '2026-05-27': 'Eid-ul-Zuha (Bakrid) commemorates Ibrahim\'s willingness to sacrifice his son — observed with prayers and sharing of meat with the poor.',
    '2026-06-26': 'Muharram is the Islamic New Year. The 10th day (Ashura) is a day of mourning for Shia Muslims and fasting for Sunni Muslims.',
    '2026-08-15': 'Independence Day marks India\'s freedom from British rule on 15 August 1947. The Prime Minister addresses the nation from the Red Fort.',
    '2026-08-26': 'Milad-un-Nabi celebrates the birth of the Prophet Muhammad (PBUH) with prayers, processions, and recitation of the Quran.',
    '2026-08-28': 'Raksha Bandhan — sisters tie a rakhi (sacred thread) on their brothers\' wrists as a symbol of love and protection.',
    '2026-09-04': 'Janmashtami celebrates the birth of Lord Krishna at midnight, with devotion, fasting, Dahi Handi, and devotional songs (bhajans).',
    '2026-09-14': 'Ganesh Chaturthi marks the birth of Lord Ganesha. Huge clay idols are installed and immersed in water after 10 days of festivities.',
    '2026-09-15': 'Hartalika Teej is observed by married women for the long life and well-being of their husbands through fasting and prayer to Parvati.',
    '2026-10-02': 'Gandhi Jayanti marks the birthday of Mahatma Gandhi — Father of the Nation — celebrated as the International Day of Non-Violence.',
    '2026-10-20': 'Dussehra (Vijayadashami) celebrates the victory of Lord Rama over Ravana — symbolising the triumph of good over evil.',
    '2026-11-08': 'Diwali — the Festival of Lights — is India\'s biggest festival. Rows of oil lamps (diyas) light up homes to welcome Goddess Lakshmi.',
    '2026-11-24': 'Guru Nanak Jayanti (Gurpurab) marks the birthday of Guru Nanak Dev Ji, the founder of Sikhism, with Prabhat Pheris and langar.',
    '2026-12-25': 'Christmas celebrates the birth of Jesus Christ. Churches hold midnight mass, and gifts are exchanged to spread goodwill and joy.',
};

function HolidayKPI() {
    const allHolidays   = useSelector(selectHolidayList);
    const nextHoliday   = useSelector(selectNextHoliday);
    const pastHolidays  = useSelector(selectPastHolidays);

    // Modal state: { type: 'type'|'holiday', value: typeString | holidayObj }
    const [modal, setModal] = useState(null);

    const countdown = useMemo(() => {
        if (!nextHoliday) return null;
        const today  = new Date();
        today.setHours(0, 0, 0, 0);
        const target = new Date(nextHoliday.date);
        return Math.round((target - today) / 86400000);
    }, [nextHoliday]);

    const totalHolidays = allHolidays.length;
    const upcomingCount = totalHolidays - (pastHolidays?.length ?? 0);
    const nextEmoji     = nextHoliday ? (TYPE_EMOJI[nextHoliday.type] ?? '🎊') : '—';

    // Group holidays by type for the modal
    const byType = useMemo(() => {
        const map = {};
        allHolidays.forEach(h => {
            if (!map[h.type]) map[h.type] = [];
            map[h.type].push(h);
        });
        return map;
    }, [allHolidays]);

    const openTypeModal  = (type)    => setModal({ kind: 'type',    value: type });
    const openHoliModal  = (holiday) => setModal({ kind: 'holiday', value: holiday });
    const closeModal     = ()        => setModal(null);

    const cardVariants = {
        hidden:  { opacity: 0, y: 24 },
        visible: { opacity: 1, y: 0, transition: { duration: 0.5, ease: 'easeOut' } },
    };
    const statVariants = {
        hidden:  { opacity: 0, scale: 0.8 },
        visible: (i) => ({
            opacity: 1, scale: 1,
            transition: { delay: 0.15 + i * 0.1, type: 'spring', stiffness: 260 },
        }),
    };

    /* ── Render modal content ─────────────────────── */
    const renderModalContent = () => {
        if (!modal) return null;

        if (modal.kind === 'type') {
            const type      = modal.value;
            const emoji     = TYPE_EMOJI[type] ?? '🎊';
            const desc      = TYPE_DESC[type] ?? '';
            const holidays  = byType[type] ?? [];
            const [bg, border, text, badge] = TYPE_COLORS[type] ?? ['#f8fafc','#e2e8f0','#1e293b','#64748b'];
            return (
                <>
                    <div className="hkpi-modal__top" style={{ background: bg, borderColor: border }}>
                        <span className="hkpi-modal__type-emoji">{emoji}</span>
                        <div>
                            <h3 className="hkpi-modal__type-title" style={{ color: text }}>{type} Holidays</h3>
                            <span className="hkpi-modal__badge" style={{ background: badge }}>{holidays.length} in 2026</span>
                        </div>
                    </div>
                    <p className="hkpi-modal__desc">{desc}</p>
                    <div className="hkpi-modal__list">
                        {holidays.map(h => (
                            <div key={h.date} className="hkpi-modal__item" style={{ borderLeftColor: badge }}>
                                <div className="hkpi-modal__item-info">
                                    <span className="hkpi-modal__item-name">{h.name}</span>
                                    <span className="hkpi-modal__item-date">
                                        {new Date(h.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                                    </span>
                                </div>
                                {HOLIDAY_FACTS[h.date] && (
                                    <p className="hkpi-modal__item-fact">{HOLIDAY_FACTS[h.date]}</p>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            );
        }

        if (modal.kind === 'holiday') {
            const h    = modal.value;
            const emoji = TYPE_EMOJI[h.type] ?? '🎊';
            const fact  = HOLIDAY_FACTS[h.date];
            const [bg, border, text, badge] = TYPE_COLORS[h.type] ?? ['#f8fafc','#e2e8f0','#1e293b','#64748b'];
            return (
                <>
                    <div className="hkpi-modal__top" style={{ background: bg, borderColor: border }}>
                        <span className="hkpi-modal__type-emoji">{emoji}</span>
                        <div style={{ flex: 1 }}>
                            <h3 className="hkpi-modal__type-title" style={{ color: text }}>{h.name}</h3>
                            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 4 }}>
                                <span className="hkpi-modal__badge" style={{ background: badge }}>{h.type}</span>
                                <span className="hkpi-modal__badge" style={{ background: '#64748b' }}>
                                    {new Date(h.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                                </span>
                            </div>
                        </div>
                    </div>
                    {fact && <p className="hkpi-modal__desc">{fact}</p>}
                    <div className="hkpi-modal__type-info">
                        <span className="hkpi-modal__type-label">Holiday Category</span>
                        <p className="hkpi-modal__type-text">{TYPE_DESC[h.type]}</p>
                    </div>
                </>
            );
        }
    };

    return (
        <>
        <motion.div
            className="holiday-kpi-card"
            variants={cardVariants}
            initial="hidden"
            animate="visible"
        >
            {/* Decorative blobs */}
            <div className="hkpi-blob hkpi-blob--1" />
            <div className="hkpi-blob hkpi-blob--2" />

            {/* Header */}
            <div className="hkpi-header">
                <div className="hkpi-icon-wrap">
                    <span className="hkpi-icon">🗓️</span>
                </div>
                <div>
                    <h3 className="hkpi-title">2026 Holidays</h3>
                    <p className="hkpi-subtitle">Indian School Calendar</p>
                </div>
                <div className="hkpi-badge">{upcomingCount} upcoming</div>
            </div>

            {/* Stats row */}
            <div className="hkpi-stats">
                {[
                    { label: 'Total',    value: totalHolidays,       icon: '📋' },
                    { label: 'Past',     value: pastHolidays.length, icon: '✅' },
                    { label: 'Upcoming', value: upcomingCount,        icon: '🔜' },
                ].map((stat, i) => (
                    <motion.div
                        key={stat.label}
                        className="hkpi-stat"
                        custom={i}
                        variants={statVariants}
                        initial="hidden"
                        animate="visible"
                    >
                        <span className="hkpi-stat-icon">{stat.icon}</span>
                        <span className="hkpi-stat-value">{stat.value}</span>
                        <span className="hkpi-stat-label">{stat.label}</span>
                    </motion.div>
                ))}
            </div>

            {/* Divider */}
            <div className="hkpi-divider" />

            {/* Next holiday panel — clickable */}
            {nextHoliday ? (
                <motion.div
                    className="hkpi-next hkpi-next--clickable"
                    onClick={() => openHoliModal(nextHoliday)}
                    whileHover={{ scale: 1.015 }}
                    whileTap={{ scale: 0.98 }}
                    title="Click to learn more"
                >
                    <div className="hkpi-next-left">
                        <span className="hkpi-next-emoji">{nextEmoji}</span>
                        <div>
                            <p className="hkpi-next-label">Next Holiday — tap for details</p>
                            <p className="hkpi-next-name">{nextHoliday.name}</p>
                            <p className="hkpi-next-date">
                                {new Date(nextHoliday.date).toLocaleDateString('en-IN', {
                                    day: 'numeric', month: 'long', year: 'numeric',
                                })}
                            </p>
                        </div>
                    </div>
                    <motion.div
                        className="hkpi-countdown"
                        animate={{ scale: [1, 1.05, 1] }}
                        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
                    >
                        <span className="hkpi-countdown-num">
                            {countdown === 0 ? 'Today!' : countdown}
                        </span>
                        {countdown > 0 && (
                            <span className="hkpi-countdown-unit">
                                {countdown === 1 ? 'day' : 'days'}
                            </span>
                        )}
                        <span className="hkpi-countdown-sub">remaining</span>
                    </motion.div>
                </motion.div>
            ) : (
                <div className="hkpi-no-next">
                    <span>🎊</span>
                    <p>All 2026 holidays have passed!</p>
                </div>
            )}

            {/* Type chips — each clickable */}
            <div className="hkpi-type-legend">
                <span className="hkpi-type-hint">Tap a category to explore →</span>
                {Object.entries(TYPE_EMOJI).map(([type, emoji]) => (
                    <motion.span
                        key={type}
                        className="hkpi-type-chip hkpi-type-chip--btn"
                        onClick={() => openTypeModal(type)}
                        whileHover={{ scale: 1.06, y: -2 }}
                        whileTap={{ scale: 0.95 }}
                        title={`View all ${type} holidays`}
                    >
                        {emoji} {type}
                        <span className="hkpi-chip-count">{(byType[type] ?? []).length}</span>
                    </motion.span>
                ))}
            </div>
        </motion.div>

        {/* ── Modal overlay ───────────────────────────── */}
        <AnimatePresence>
            {modal && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        className="hkpi-modal-backdrop"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={closeModal}
                    />

                    {/* Panel */}
                    <motion.div
                        className="hkpi-modal"
                        initial={{ opacity: 0, y: 40, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 30, scale: 0.96 }}
                        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
                    >
                        {/* Close button */}
                        <button className="hkpi-modal__close" onClick={closeModal} aria-label="Close">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                                <line x1="18" y1="6" x2="6" y2="18" />
                                <line x1="6" y1="6" x2="18" y2="18" />
                            </svg>
                        </button>

                        <div className="hkpi-modal__body">
                            {renderModalContent()}
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
        </>
    );
}

export default HolidayKPI;
