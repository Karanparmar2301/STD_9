import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft } from 'lucide-react';
import { apiService } from '../services/api';
import './Books.css';

/* ── Subject metadata ─────────────────────────────────────── */
const BOOKS_META = [
    {
        id: 1, title: 'Mathematics', slug: 'Std_8_math', subject: 'Math',
        icon: '📐', iconBg: '#EFF6FF', iconColor: '#2563EB',
        badgeColor: '#2563EB', badgeBg: '#EFF6FF',
    },
    {
        id: 2, title: 'English Literature', slug: 'Std_8_eng', subject: 'English',
        icon: '📖', iconBg: '#F0FDF4', iconColor: '#16A34A',
        badgeColor: '#15803D', badgeBg: '#DCFCE7',
    },
    {
        id: 3, title: 'Hindi', slug: 'Std_8_hindi', subject: 'Hindi',
        icon: 'अ', iconBg: '#FFF1F2', iconColor: '#BE123C',
        badgeColor: '#BE123C', badgeBg: '#FFE4E6',
    },
    {
        id: 4, title: 'Science', slug: 'Std_8_science', subject: 'Science',
        icon: '🔬', iconBg: '#F0FDFA', iconColor: '#0F766E',
        badgeColor: '#0F766E', badgeBg: '#CCFBF1',
    },
    {
        id: 5, title: 'Fine Arts', slug: 'Std_8_arts', subject: 'Arts',
        icon: '🎨', iconBg: '#FAF5FF', iconColor: '#7E22CE',
        badgeColor: '#7E22CE', badgeBg: '#F3E8FF',
    },
    {
        id: 6, title: 'Social Science', slug: 'Std_8_social', subject: 'Social Sc.',
        icon: '🌍', iconBg: '#FFF7ED', iconColor: '#C2410C',
        badgeColor: '#C2410C', badgeBg: '#FFEDD5',
    },
    {
        id: 7, title: 'Sanskrit', slug: 'Std_8_sanskrit', subject: 'Sanskrit',
        icon: 'स', iconBg: '#FDF2F8', iconColor: '#9D174D',
        badgeColor: '#9D174D', badgeBg: '#FCE7F3',
    },
    {
        id: 8, title: 'Physical Education', slug: 'Std_8_physed', subject: 'Phy. Ed.',
        icon: '🏃', iconBg: '#F7FEE7', iconColor: '#4D7C0F',
        badgeColor: '#4D7C0F', badgeBg: '#ECFCCB',
    },
    {
        id: 9, title: 'Vocational Education', slug: 'Std_8_voced', subject: 'Voc. Ed.',
        icon: '🛠️', iconBg: '#EEF2FF', iconColor: '#3730A3',
        badgeColor: '#3730A3', badgeBg: '#E0E7FF',
    },
];

const FILTERS = ['All Books', 'Video Learning', 'Recently Opened', 'Completed', 'Favorites', 'Pending'];

const DEMO_BOOK_STATS = {
    Std_8_math: { count: 12, completedCount: 5 },
    Std_8_eng: { count: 10, completedCount: 4 },
    Std_8_hindi: { count: 9, completedCount: 3 },
    Std_8_science: { count: 11, completedCount: 6 },
    Std_8_arts: { count: 8, completedCount: 2 },
    Std_8_social: { count: 10, completedCount: 4 },
    Std_8_sanskrit: { count: 7, completedCount: 2 },
    Std_8_physed: { count: 6, completedCount: 1 },
    Std_8_voced: { count: 5, completedCount: 1 },
};

const SUBJECT_YOUTUBE_LINKS = {
    Std_8_math: 'https://www.youtube.com/results?search_query=Class+8+Mathematics+NCERT+chapter+wise',
    Std_8_eng: 'https://www.youtube.com/results?search_query=Class+8+English+NCERT+chapter+wise',
    Std_8_hindi: 'https://www.youtube.com/results?search_query=Class+8+Hindi+NCERT+chapter+wise',
    Std_8_science: 'https://www.youtube.com/results?search_query=Class+8+Science+NCERT+chapter+wise',
    Std_8_arts: 'https://www.youtube.com/results?search_query=Class+8+Fine+Arts+lessons',
    Std_8_social: 'https://www.youtube.com/results?search_query=Class+8+Social+Science+NCERT+chapter+wise',
    Std_8_sanskrit: 'https://www.youtube.com/results?search_query=Class+8+Sanskrit+NCERT+chapter+wise',
    Std_8_physed: 'https://www.youtube.com/results?search_query=Class+8+Physical+Education+lessons',
    Std_8_voced: 'https://www.youtube.com/results?search_query=Class+8+Vocational+Education+lessons',
};

const SUBJECT_VIDEO_UNITS = {
    Std_8_math: [
        { id: 1, title: 'Chapter 1: A Square and A Cube - Part 1', description: 'Mathematics', url: 'https://youtu.be/1CECPkW44rc?si=hCrI2YERaP3JJQsP' },
        { id: 2, title: 'Chapter 1: A Square and A Cube - Part 2', description: 'Mathematics', url: 'https://youtu.be/RE1zucilLTE?si=lyYvHOsNOUwRYYq6' },
        { id: 3, title: 'Chapter 1: A Square and A Cube - Part 3', description: 'Mathematics', url: 'https://youtu.be/Kk-D1rHo5C0?si=0ya4ze1a3Jo27x9o' },
        { id: 4, title: 'Chapter 1: A Square and A Cube - Part 4', description: 'Mathematics', url: 'https://youtu.be/fWU_m8XZ1rU?si=sB-PnekU_45dRQE7' },
        { id: 5, title: 'Chapter 1: A Square and A Cube - Part 5', description: 'Mathematics', url: 'https://youtu.be/4TstcUaHWkk?si=XhCNhuqAHKnNIsqu' },
        { id: 6, title: 'Chapter 1: A Square and A Cube - Part 6', description: 'Mathematics', url: 'https://youtu.be/ktAhoKD1M5w?si=xjWLDmmQTLVTuQOo' },
        { id: 7, title: 'Chapter 1: A Square and A Cube - Part 7', description: 'Mathematics', url: 'https://youtu.be/RKZKu5O9RVI?si=iexI9q7volhaMAkx' },
        { id: 8, title: 'Chapter 1: A Square and A Cube - Part 8', description: 'Mathematics', url: 'https://youtu.be/7_KiPTDzz30?si=388nx9HNjJs0525_' },
        { id: 9, title: 'Chapter 1: A Square and A Cube - Part 9', description: 'Mathematics', url: 'https://youtu.be/WMALqspqFcQ?si=Uc96l4rih4xy2HBE' },
        { id: 10, title: 'Chapter 1: A Square and A Cube - Part 10', description: 'Mathematics', url: 'https://youtu.be/CozgUWFe0_g?si=0Z6BuxllvJIWXQ7L' },
        { id: 11, title: 'Chapter 2: Power Play - Part 1', description: 'Mathematics', url: 'https://youtu.be/KWrRgveyvyQ?si=oDO2IcGPEb2q72_t' },
        { id: 12, title: 'Chapter 2: Power Play - Part 2', description: 'Mathematics', url: 'https://youtu.be/DVyjG4uDEVk?si=vI4hcvkYQhr81y9_' },
        { id: 13, title: 'Chapter 2: Power Play - Part 3', description: 'Mathematics', url: 'https://youtu.be/Sfi2sfQFSu8?si=1a1BQOeuVXSZtsl8' },
        { id: 14, title: 'Chapter 2: Power Play - Part 4', description: 'Mathematics', url: 'https://youtu.be/j89aAcWKCxM?si=1ywHPyUPBqCzTqiR' },
        { id: 15, title: 'Chapter 2: Power Play - Part 5', description: 'Mathematics', url: 'https://youtu.be/j89aAcWKCxM?si=Jxilew70ole6ysnO' },
        { id: 16, title: 'Chapter 2: Power Play - Part 6', description: 'Mathematics', url: 'https://youtu.be/SF3zup1oHMI?si=9-y-2glepYGA6jA8' },
        { id: 17, title: 'Chapter 2: Power Play - Part 7', description: 'Mathematics', url: 'https://youtu.be/p4kuB7VRFPY?si=ZAh_o3KlK2RNZoSR' },
        { id: 18, title: 'Chapter 2: Power Play - Part 8', description: 'Mathematics', url: 'https://youtu.be/4z1c4W58eTY?si=goyEqrj9jGiDp_hN' },
        { id: 19, title: 'Chapter 2: Power Play - Part 9', description: 'Mathematics', url: 'https://youtu.be/RE_B6eSvUHA?si=3tLDD1IlVfn7FWPA' },
        { id: 20, title: 'Chapter 2: Power Play - Part 10', description: 'Mathematics', url: 'https://youtu.be/0Fi2FZ6PwUs?si=OiPe4OrM_U5Mi8Ze' },
        { id: 21, title: 'Chapter 2: Power Play - Part 11', description: 'Mathematics', url: 'https://youtu.be/gFKdCIQ1lQ4?si=ABp-f5viG0vjkbCa' },
        { id: 22, title: 'Chapter 2: Power Play - Part 12', description: 'Mathematics', url: 'https://youtu.be/hgSvXe5NZkw?si=CiwX36sieiPhDE0t' },
        { id: 23, title: 'Chapter 2: Power Play - Part 13', description: 'Mathematics', url: 'https://youtu.be/HrzlIv3yOPA?si=0C8v2KWpf5IvZkmX' },
        { id: 24, title: 'Chapter 3: A Story of Numbers - Part 1', description: 'Mathematics', url: 'https://youtu.be/eNibgsD0NrI?si=I9B3jwC2qGjlVWK2' },
        { id: 25, title: 'Chapter 3: A Story of Numbers - Part 2', description: 'Mathematics', url: 'https://youtu.be/Hbn32JdJCcM?si=0cqSxTv14oovWBeT' },
        { id: 26, title: 'Chapter 3: A Story of Numbers - Part 3', description: 'Mathematics', url: 'https://youtu.be/_LpLc7gi_PU?si=XboEEbvgRW-QDIhd' },
        { id: 27, title: 'Chapter 3: A Story of Numbers - Part 4', description: 'Mathematics', url: 'https://youtu.be/HZ0qexAHHvQ?si=bkwl98pIio9HniGP' },
        { id: 28, title: 'Chapter 3: A Story of Numbers - Part 5', description: 'Mathematics', url: 'https://youtu.be/uKQRyVsec_w?si=8T6VZn0VEelPJbbw' },
        { id: 29, title: 'Chapter 3: A Story of Numbers - Part 6', description: 'Mathematics', url: 'https://youtu.be/5_ItlC0aZyY?si=qbavH-fK1G_KVkI4' },
        { id: 30, title: 'Chapter 3: A Story of Numbers - Part 7', description: 'Mathematics', url: 'https://youtu.be/HVmRtqgVxPc?si=KuWVO42IfJLzHuzJ' },
        { id: 31, title: 'Chapter 3: A Story of Numbers - Part 8', description: 'Mathematics', url: 'https://youtu.be/3HdEqfYq5NU?si=U0YPngrbSBTrtjmX' },
        { id: 32, title: 'Chapter 4: Quadrilaterals - Part 1', description: 'Mathematics', url: 'https://youtu.be/jeoNO6MIorA?si=4e5MkOxYRZGhfIfq' },
        { id: 33, title: 'Chapter 4: Quadrilaterals - Part 2', description: 'Mathematics', url: 'https://youtu.be/GspO74apOwM?si=ffItjpdrBC21MvH6' },
        { id: 34, title: 'Chapter 4: Quadrilaterals - Part 3', description: 'Mathematics', url: 'https://youtu.be/sEAJIs1gqKo?si=dJnn-tnyWSR5O1UR' },
        { id: 35, title: 'Chapter 4: Quadrilaterals - Part 4', description: 'Mathematics', url: 'https://youtu.be/i3LQImMfrjk?si=PHSpDJqevvbLEmOq' },
        { id: 36, title: 'Chapter 4: Quadrilaterals - Part 5', description: 'Mathematics', url: 'https://youtu.be/QRhR8nvTyjE?si=SWqUcWuubqiuxxiH' },
        { id: 37, title: 'Chapter 4: Quadrilaterals - Part 6', description: 'Mathematics', url: 'https://youtu.be/9_ml7_fNC6Q?si=kMa1wAJAVNS2Ugk_' },
        { id: 38, title: 'Chapter 4: Quadrilaterals - Part 7', description: 'Mathematics', url: 'https://youtu.be/ZzOgFmjJ8Ls?si=1V3TxmGoEewjgfiv' },
        { id: 39, title: 'Chapter 4: Quadrilaterals - Part 8', description: 'Mathematics', url: 'https://youtu.be/ZzOgFmjJ8Ls?si=HjJrRMq__AkMCVV8' },
        { id: 40, title: 'Chapter 4: Quadrilaterals - Part 9', description: 'Mathematics', url: 'https://youtu.be/OMH18UmK-Ak?si=sOW2FYK3WTdBArFC' },
        { id: 41, title: 'Chapter 5: Number Play - Part 1', description: 'Mathematics', url: 'https://youtu.be/3HdEqfYq5NU?si=kXCM-_yajOO2uHqU' },
        { id: 42, title: 'Chapter 5: Number Play - Part 2', description: 'Mathematics', url: 'https://youtu.be/qnn9UxVVUUw?si=ipL-NOcZ_lKHA-l6' },
        { id: 43, title: 'Chapter 5: Number Play - Part 3', description: 'Mathematics', url: 'https://youtu.be/JSGOVIYnFGo?si=jhOgBGdjfMWLUFRG' },
        { id: 44, title: 'Chapter 5: Number Play - Part 4', description: 'Mathematics', url: 'https://youtu.be/xEChEPK03QY?si=9Z77lPjaEFwHsA46' },
        { id: 45, title: 'Chapter 5: Number Play - Part 5', description: 'Mathematics', url: 'https://youtu.be/AsMqffQomH4?si=LowTs2vM-0LRsGAm' },
        { id: 46, title: 'Chapter 5: Number Play - Part 6', description: 'Mathematics', url: 'https://youtu.be/vcJcxq5Z1c0?si=hm-xeJy8XMX8gLbQ' },
        { id: 47, title: 'Chapter 5: Number Play - Part 7', description: 'Mathematics', url: 'https://youtu.be/6BA_HFxC35c?si=qK1IjmlIQsUMaBtN' },
        { id: 48, title: 'Chapter 5: Number Play - Part 8', description: 'Mathematics', url: 'https://youtu.be/gLLpWAzgU2k?si=emGlh_RcC9I5qm85' },
        { id: 49, title: 'Chapter 5: Number Play - Part 9', description: 'Mathematics', url: 'https://youtu.be/2A2qDmZSPHE?si=adI2LJ33cRtFT_2c' },
        { id: 50, title: 'Chapter 5: Number Play - Part 10', description: 'Mathematics', url: 'https://youtu.be/fVNcx_07BxI?si=skg2lEmeahCxbCFB' },
        { id: 51, title: 'Chapter 5: Number Play - Part 11', description: 'Mathematics', url: 'https://youtu.be/bNUZ7WL1Ga4?si=sYEjUOa6uoT-Sp8e' },
        { id: 52, title: 'Chapter 6: We Distribute, Yet Things Multiply - Part 1', description: 'Mathematics', url: 'https://youtu.be/IYtwI4TrqLw?si=0Yod1EPyCmlYlwaJ' },
        { id: 53, title: 'Chapter 6: We Distribute, Yet Things Multiply - Part 2', description: 'Mathematics', url: 'https://youtu.be/DYeuu3Q4CW8?si=Md3Papyk5KDyqy3k' },
        { id: 54, title: 'Chapter 6: We Distribute, Yet Things Multiply - Part 3', description: 'Mathematics', url: 'https://youtu.be/31Qcks4-JYk?si=YfK6c2T09_2rMTyX' },
        { id: 55, title: 'Chapter 6: We Distribute, Yet Things Multiply - Part 4', description: 'Mathematics', url: 'https://youtu.be/ZohIP7UAvYU?si=Fxs6R50MWKLEQUXW' },
        { id: 56, title: 'Chapter 6: We Distribute, Yet Things Multiply - Part 5', description: 'Mathematics', url: 'https://youtu.be/TNMbK9oAyDE?si=ZVNJe_k9CDbzYQoX' },
        { id: 57, title: 'Chapter 6: We Distribute, Yet Things Multiply - Part 6', description: 'Mathematics', url: 'https://youtu.be/O38BGUsG3fo?si=ly39Ny022bm46IkU' },
        { id: 58, title: 'Chapter 6: We Distribute, Yet Things Multiply - Part 7', description: 'Mathematics', url: 'https://youtu.be/uP7yjZbsZhw?si=5v5m-akKfl0X4PiN' },
        { id: 59, title: 'Chapter 6: We Distribute, Yet Things Multiply - Part 8', description: 'Mathematics', url: 'https://youtu.be/m0IAEUuSRgg?si=nusZDW8Zx21FhTzL' },
        { id: 60, title: 'Chapter 6: We Distribute, Yet Things Multiply - Part 9', description: 'Mathematics', url: 'https://youtu.be/LEy3tKLq9G0?si=xLMSlDF-vpOJ2OTx' },
        { id: 61, title: 'Chapter 7: Proportional Reasoning-1 - Part 1', description: 'Mathematics', url: 'https://youtu.be/2Ea7dC0dtmY?si=WmF4VidtECRrcK-B' },
        { id: 62, title: 'Chapter 7: Proportional Reasoning-1 - Part 2', description: 'Mathematics', url: 'https://youtu.be/HHkmsEAmwcY?si=hFDNZ_6WcnxFEKr3' },
        { id: 63, title: 'Chapter 7: Proportional Reasoning-1 - Part 3', description: 'Mathematics', url: 'https://youtu.be/hYLncr-O7as?si=AkXgPrtVbHiXN1ln' },
        { id: 64, title: 'Chapter 7: Proportional Reasoning-1 - Part 4', description: 'Mathematics', url: 'https://youtu.be/yR4GB4uiu4o?si=cDPygJ1sAwfJH5bF' },
        { id: 65, title: 'Chapter 7: Proportional Reasoning-1 - Part 5', description: 'Mathematics', url: 'https://youtu.be/k30xHrjY_Oo?si=9BcPn4bHEY4kHw6b' },
        { id: 66, title: 'Chapter 7: Proportional Reasoning-1 - Part 6', description: 'Mathematics', url: 'https://youtu.be/ZIoTIrZen3Y?si=1r9hR23Bu7HKw8UT' },
    ],
    Std_8_eng: [
        { id: 1, title: 'Unit 1: The Wit that Won Hearts', description: 'Wit and Wisdom', url: 'https://youtu.be/aY2tXGalnAA?si=lOOhZherBovvBUn3' },
        { id: 2, title: 'Unit 1: The Wit that Won Hearts (Summary)', description: 'Wit and Wisdom Summary', url: 'https://youtu.be/p_OpAq7r51E?si=7VfmyLUzvvTGkvY2' },
        { id: 3, title: 'Unit 1: Concrete Example', description: 'Wit and Wisdom', url: 'https://youtu.be/tqNKxgPF13U?si=0RmwUKnCvTjM0KyF' },
        { id: 4, title: 'Unit 1: Concrete Example (Summary)', description: 'Wit and Wisdom Summary', url: 'https://youtu.be/1un--jgaNA0?si=JpDOF-CzulorgLjy' },
        { id: 5, title: 'Unit 1: Wisdom Paves the Way', description: 'Wit and Wisdom', url: 'https://youtu.be/Gdv5FXcVdPk?si=1VGWwugyk_B4rwht' },
        { id: 6, title: 'Unit 1: Wisdom Paves the Way (Summary)', description: 'Wit and Wisdom Summary', url: 'https://youtu.be/Wkup1c7dkB8?si=7g7j90mu07OpyYLy' },
        { id: 7, title: 'Unit 2: A Tale of Valour', description: 'Values and Dispositions', url: 'https://youtu.be/DCWp15Mm3oc?si=_bM4SIoFOcqtBlvE' },
        { id: 8, title: 'Unit 2: A Tale of Valour (Summary)', description: 'Values and Dispositions Summary', url: 'https://youtu.be/CJL6tPrdeZA?si=YQiGekIEZRiPJeyq' },
        { id: 9, title: 'Unit 2: Somebody’s Mother', description: 'Values and Dispositions', url: 'https://youtu.be/44o6S2Dcrgs?si=0Evwg0_ALpbUOnRK' },
        { id: 10, title: 'Unit 2: Somebody’s Mother (Summary)', description: 'Values and Dispositions Summary', url: 'https://youtu.be/sXHJH9AEsHs?si=ztm2kLP3x4v7viVu' },
        { id: 11, title: 'Unit 2: Verghese Kurien—I Too Had A Dream', description: 'Values and Dispositions', url: 'https://youtu.be/A5CnV9K7-b4?si=exkbWw-0ScsVDSE_' },
        { id: 12, title: 'Unit 2: Verghese Kurien (Summary)', description: 'Values and Dispositions Summary', url: 'https://youtu.be/3qEdTRh_VJA?si=MRyoDkY6CmMnXGOf' },
        { id: 13, title: 'Unit 3: The Case of the Fifth Word', description: 'Mystery and Magic', url: 'https://youtu.be/YWDNWInlvTY?si=m66rgB0Z1EirMmek' },
        { id: 14, title: 'Unit 3: The Case of the Fifth Word (Summary)', description: 'Mystery and Magic Summary', url: 'https://youtu.be/iL26FIdUfPM?si=juNe64HGEXuw1Rw5' },
        { id: 15, title: 'Unit 3: The Magic Brush of Dreams', description: 'Mystery and Magic', url: 'https://youtu.be/X3gR96h7lnA?si=4p5r6Vbd2cmVNOiO' },
        { id: 16, title: 'Unit 3: The Magic Brush of Dreams (Summary)', description: 'Mystery and Magic Summary', url: 'https://youtu.be/Vx_iR1wakVw?si=j9Oc_25lE8h7uOne' },
        { id: 17, title: 'Unit 3: Spectacular Wonders', description: 'Mystery and Magic', url: 'https://youtu.be/M5hw_dAPRg0?si=aJ4m1YB7_vjoDTpT' },
        { id: 18, title: 'Unit 3: Spectacular Wonders (Summary)', description: 'Mystery and Magic Summary', url: 'https://youtu.be/g2-bw_7ZFSc?si=_h24JdyEDTOLOUzZ' },
        { id: 19, title: 'Unit 4: The Cherry Tree', description: 'Environment', url: 'https://youtu.be/CGp9rsxowRE?si=2o55eAsJObrxugZq' },
        { id: 20, title: 'Unit 4: The Cherry Tree (Summary)', description: 'Environment Summary', url: 'https://youtu.be/wAMOlRq7Ye4?si=zu8tqF9HQUCBGcxz' },
        { id: 21, title: 'Unit 4: Harvest Hymn', description: 'Environment', url: 'https://youtu.be/0ztUd-QI8yo?si=ybNiaISiHuYqGL8D' },
        { id: 22, title: 'Unit 4: Harvest Hymn (Summary)', description: 'Environment Summary', url: 'https://youtu.be/79i9Un4cdKM?si=Y-8zC0kUoLHX05jd' },
        { id: 23, title: 'Unit 4: Waiting for the Rain', description: 'Environment', url: 'https://youtu.be/DBcSY8rN4I8?si=-2v9flMXvw4-JMG-' },
        { id: 24, title: 'Unit 4: Waiting for the Rain (Summary)', description: 'Environment Summary', url: 'https://youtu.be/EiQF8Lr1wCE?si=Zjm-XT3odcQm6uFI' },
        { id: 25, title: 'Unit 5: Feathered Friend', description: 'Science and Curiosity', url: 'https://youtu.be/zQ2SsVIg4tA?si=rR1e_dAvE0IuNOtv' },
        { id: 26, title: 'Unit 5: Feathered Friend (Summary)', description: 'Science and Curiosity Summary', url: 'https://youtu.be/YANjxJgvRwY?si=DnngFYp7yskSd8-F' },
        { id: 27, title: 'Unit 5: Magnifying Glass', description: 'Science and Curiosity', url: 'https://youtu.be/EqUPc2r80PM?si=K8te4oPTTBVopkm8' },
        { id: 28, title: 'Unit 5: Magnifying Glass (Summary)', description: 'Science and Curiosity Summary', url: 'https://youtu.be/9c_YIchrq2c?si=H78fu6yxr_cxdLhp' },
        { id: 29, title: 'Unit 5: Bibha Chowdhuri', description: 'Science and Curiosity', url: 'https://youtu.be/slHpasv8GVw?si=vTW_Vfv8YG_UtZm0' },
        { id: 30, title: 'Unit 5: Bibha Chowdhuri (Summary)', description: 'Science and Curiosity Summary', url: 'https://youtu.be/mjWtityJu8g?si=m3o6xC7wehHlWxoK' },
    ],
    Std_8_hindi: [
        { id: 1, title: 'Chapter 1: स्वदेश', description: 'कविता', url: 'https://youtu.be/sugp1iZFeBk?si=ngk2wWq1wlqewDwc' },
        { id: 2, title: 'Chapter 2: दो गौरैया', description: 'कहानी', url: 'https://youtu.be/kO0qnXJs3HA?si=zByfzKxmSlqa7h4C' },
        { id: 3, title: 'Chapter 3: एक आशीर्वाद', description: 'कविता', url: 'https://youtu.be/ObKeLW09glA?si=VivzWSejVPoz4vlH' },
        { id: 4, title: 'Chapter 4: हरिद्वार', description: 'पत्र', url: 'https://youtu.be/J3lh4Czq5Ks?si=z611TgKRJnvsBm8T' },
        { id: 5, title: 'Chapter 5: कबीर के दोहे', description: 'दोहे', url: 'https://youtu.be/ekpc5E5pFAA?si=rEvXIHHRRrj96_Hf' },
        { id: 6, title: 'कदम मिलाकर चलना होगा', description: 'पढ़ने के लिए', url: 'https://youtu.be/HiaPeXEZlL8?si=EpGYH6dVxIIQLomt' },
        { id: 7, title: 'Chapter 6: एक टोकरी भर मिट्टी', description: 'कहानी', url: 'https://youtu.be/vGBHvKpRevU?si=fh3HBMZSqPXG1amq' },
        { id: 8, title: 'Chapter 7: मत बाँधो', description: 'कविता', url: 'https://youtu.be/h86To2dDxBg?si=WqYVt9xHTLPeH0LF' },
        { id: 9, title: 'Chapter 8: नए मेहमान', description: 'एकांकी', url: 'https://youtu.be/nN1Q_Ihw_Bo?si=c5jW4XcfXzwR9pIn' },
        { id: 10, title: 'Chapter 9: आदमी का अनुपात', description: 'कविता', url: 'https://youtu.be/tXoFq09wG_o?si=xGI0EB3WYTs28Sef' },
        { id: 11, title: 'Chapter 10: तरुण के स्वप्न', description: 'उद्बोधन', url: 'https://youtu.be/JmYZPe3Ga9Q?si=65P38NlIdEypvsYLs' },
        { id: 12, title: 'भारति, जय, विजय करे !', description: 'पढ़ने के लिए', url: 'https://youtu.be/SaZrj3IIRqk?si=-8xcN8E6-etIYLWY' },
    ],
    Std_8_science: [
        { id: 1, title: 'Chapter 1: Exploring the Investigative World of Science', description: 'Science', url: 'https://youtu.be/XjxVSTP0FKw?si=k_S0qaCaKpl1rPvN' },
        { id: 2, title: 'Chapter 2: The Invisible Living World: Beyond Our Naked Eye', description: 'Science', url: 'https://youtu.be/zozh0SsQZ-Q?si=bRq7MxjqVKDq3tJV' },
        { id: 3, title: 'Chapter 3: Health: The Ultimate Treasure', description: 'Science', url: 'https://youtu.be/b9IbIJr-SNI?si=bsBZwXMGwmRsdAWN' },
        { id: 4, title: 'Chapter 4: Electricity: Magnetic and Heating Effects', description: 'Science', url: 'https://youtu.be/nZgtZ9qLWCw?si=RpjXAMHRITdkekvS' },
        { id: 5, title: 'Chapter 5: Exploring Forces', description: 'Science', url: 'https://youtu.be/abhIqzYjxHs?si=LWECsySz24SOVolE' },
        { id: 6, title: 'Chapter 6: Pressure, Winds, Storms, and Cyclones', description: 'Science', url: 'https://youtu.be/ViGNcJlE1OI?si=NX2IyoXSZ8XjCebs' },
        { id: 7, title: 'Chapter 7: Particulate Nature of Matter', description: 'Science', url: 'https://youtu.be/NQNeBNceW2g?si=dtQ_wK0BrYJ2JH3R' },
        { id: 8, title: 'Chapter 8: Nature of Matter: Elements, Compounds, and Mixtures', description: 'Science', url: 'https://youtu.be/EazEKAAKm0o?si=II2ApRVGmojWgmuB' },
        { id: 9, title: 'Chapter 9: The Amazing World of Solutes, Solvents, and Solutions', description: 'Science', url: 'https://youtu.be/2jh2xT6iX38?si=FALqCCiNQFcsjg8x' },
        { id: 10, title: 'Chapter 10: Light: Mirrors and Lenses', description: 'Science', url: 'https://youtu.be/lv00PCHa_HE?si=qWIYCwaESHYttCfp' },
        { id: 11, title: 'Chapter 11: Keeping Time with the Skies', description: 'Science', url: 'https://youtu.be/Bje7pEELWAk?si=TpVwfE8KUzt7lkOJ' },
        { id: 12, title: 'Chapter 12: How Nature Works in Harmony', description: 'Science', url: 'https://youtu.be/-Aqx3uMVJs8?si=SZKtlBwvR2X5bJwn' },
        { id: 13, title: 'Chapter 13: Our Home: Earth, a Unique Life Sustaining Planet', description: 'Science', url: 'https://youtu.be/n5_5skRNBvA?si=jAdkFTNRfOZJRnrh' },
    ],
    Std_8_arts: [
        { id: 1, title: 'Chapter 1: Bringing Words Alive', description: 'Play Reading', url: 'https://youtu.be/ouJCM6PVMZE?si=2HNhCu3zMVQ-pKEp' },
        { id: 2, title: 'Chapter 2: One Stage, Many Scripts', description: 'Theatre', url: 'https://youtu.be/wmPPPjGlbCg?si=isaHOgmULeyc5rJE' },
        { id: 3, title: 'Chapter 3: From Page to Stage', description: 'Theatre', url: 'https://youtu.be/IO4w06zW7es?si=KDvvZM2kRfIQ30ot' },
        { id: 4, title: 'Chapter 4: Applause and Advice', description: 'Theatre', url: 'https://youtu.be/Nis2fzjFMB8?si=M5GmaW9d1VavnmBg' },
        { id: 5, title: 'Chapter 5: Discovering the Elements of Music', description: 'Music', url: 'https://youtu.be/ZchMsMFqEEo?si=k8HzE5QtBFx5SFWy' },
        { id: 6, title: 'Chapter 6: Musical Instruments', description: 'Music', url: 'https://youtu.be/Ptou03aVMYo?si=U81dJBK_FNoEhiJW' },
        { id: 7, title: 'Chapter 7: Indian Classical Music', description: 'Music', url: 'https://youtu.be/Gd5nFuBePMY?si=JGK7X6ewEPrSbh3w' },
        { id: 8, title: 'Chapter 8: Inspiration and Imagination', description: 'Music', url: 'https://youtu.be/2Edq6T9Lmaw?si=dCGq_KHoarQStcul' },
        { id: 9, title: 'Chapter 9: My World of Music', description: 'Music', url: 'https://youtu.be/lBvlydNC4SU?si=E3cRDTM2PPzYehAZ' },
        { id: 10, title: 'Chapter 10: Inner Dynamics of Dance', description: 'Dance', url: 'https://youtu.be/BbGQNAMfx0E?si=tJJ9DqHo4EckeoWu' },
        { id: 11, title: 'Chapter 11: Pan Indian Dance Forms', description: 'Dance', url: 'https://youtu.be/rUJjSmGj-zQ?si=S89WDarZXYSV98JS' },
        { id: 12, title: 'Chapter 12: Dance for Well-being', description: 'Dance', url: 'https://youtu.be/i08A7SrQwjE?si=8h6kAnMeN9Hz1nk6' },
        { id: 13, title: 'Chapter 13: Innovation, Inclusivity and Inspiring Change', description: 'Dance', url: 'https://youtu.be/zx-fdehtl1I?si=qanBBp5qxDvh-8zF' },
        { id: 14, title: 'Chapter 14: A Presentation of Dance and Choreography', description: 'Dance', url: 'https://youtu.be/5DuTsfNW0N4?si=AtOq2pYBzJOf08W6' },
        { id: 15, title: 'Chapter 15: Elements and Principles of Visual Art and Design', description: 'Visual Art', url: 'https://youtu.be/AGRrKGdwLn8?si=2mWvIEyIpycNokMw' },
        { id: 16, title: 'Chapter 16: Still Life in Colour', description: 'Visual Art', url: 'https://youtu.be/rPsIf9PWOZ8?si=_dHQi0kfmr9SXEaJ' },
        { id: 17, title: 'Chapter 17: People in Places', description: 'Visual Art', url: 'https://youtu.be/I0bcGOoBvlk?si=uVD906YrcGutqJhA' },
        { id: 18, title: 'Chapter 18: Arts of the People', description: 'Visual Art', url: 'https://youtu.be/rm2WeVpijsM?si=0nQ4ATqnCvgMEEcG' },
        { id: 19, title: 'Chapter 19: Campaign for Art Awareness', description: 'Visual Art', url: 'https://youtu.be/Ep8fd1u2fVg?si=a90ior3ZRxafwTmy' },
    ],
    Std_8_social: [
        { id: 1, title: 'Chapter 1: Natural Resources and Their Use', description: 'Theme A - India and the World', url: 'https://youtu.be/SmxYv_aFkq0?si=kuLf5vsrQTDgoR55' },
        { id: 2, title: 'Chapter 2: Reshaping India\'s Political Map', description: 'Theme B - Tapestry of the Past', url: 'https://youtu.be/uN1ON4wUh0s?si=6yhevMq-eby5nDu0' },
        { id: 3, title: 'Chapter 3: The Rise of the Marathas', description: 'Theme B - Tapestry of the Past', url: 'https://youtu.be/Z7vmpgMiT3E?si=ARBybLFPwJbEnbgC' },
        { id: 4, title: 'Chapter 4: The Colonial Era in India', description: 'Theme B - Tapestry of the Past', url: 'https://youtu.be/TJxnHZhldVY?si=Tk8GwgSJo9v0y54W' },
        { id: 5, title: 'Chapter 5: Universal Franchise and India\'s Electoral System', description: 'Theme D - Governance and Democracy', url: 'https://youtu.be/80ajUjKSwBA?si=EHYcXfEoWncslVqh' },
        { id: 6, title: 'Chapter 6: The Parliamentary System: Legislature and Executive', description: 'Theme D - Governance and Democracy', url: 'https://youtu.be/fEsnd3_d_y8?si=06KeT-w-mhX2SgJ_' },
        { id: 7, title: 'Chapter 7: Factors of Production', description: 'Theme E - Economic Life Around Us', url: 'https://youtu.be/ScbgI-VUabA?si=yjMfKwM6aIziJbw2' },
    ],
    Std_8_sanskrit: [
        { id: 1, title: 'Chapter 1: संगच्छध्वं संवदध्वम्', description: 'Sanskrit', url: 'https://youtu.be/Swk3-LTEDSw?si=4lzXUcZoJZxzZThJ' },
        { id: 2, title: 'Chapter 2: अल्पानामपि वस्तूनां संहतिः कार्यसाधिका', description: 'Sanskrit', url: 'https://youtu.be/_v84uJmxQPM?si=xwLprPSC7GqDraG3' },
        { id: 3, title: 'Chapter 3: सुभाषितरसं पीत्वा जीवनं सफलं कुरु', description: 'Sanskrit', url: 'https://youtu.be/zNtjouUks2w?si=yNl_OXMtwCBYNTbx' },
        { id: 4, title: 'Chapter 4: प्रणम्यो देशभक्तोऽयं गोपबन्धुर्महामनाः', description: 'Sanskrit', url: 'https://youtu.be/iBQwJ6c7so8?si=37nbtdCKRjSj6l7D' },
        { id: 5, title: 'Chapter 5: गीता सुगीता कर्तव्या', description: 'Sanskrit', url: 'https://youtu.be/iUrC9hRpJeg?si=e6vnSD18csiEGPcn' },
        { id: 6, title: 'Chapter 6: डिजिभारतम् - युगपरिवर्तनम्', description: 'Sanskrit', url: 'https://youtu.be/ZJGdZAPk9ws?si=ws7OhYTDyzuutkHT' },
        { id: 7, title: 'Chapter 7: मञ्जुलमञ्जूषा सुन्दरसुरभाषा', description: 'Sanskrit', url: 'https://youtu.be/A7Xam7a5xDI?si=ok0tIQOWyNYLf4ID' },
        { id: 8, title: 'Chapter 8: पश्यत कोणमैशान्यं भारतस्य मनोहरम्', description: 'Sanskrit', url: 'https://youtu.be/wjEpSovNirg?si=QqtFmwNiw2sB0rM7' },
        { id: 9, title: 'Chapter 9: कोऽरुक् ? कोऽरुक् ? कोऽरुक् ?', description: 'Sanskrit', url: 'https://youtu.be/KEVNcyTfZYU?si=Vn2WQlXxZuIkPnBc' },
        { id: 10, title: 'Chapter 10: सन्निमित्ते वरं त्यागः (क-भागः)', description: 'Sanskrit', url: 'https://youtu.be/lfHloXYo_5E?si=YW8JIL4PWKFF3oOi' },
        { id: 11, title: 'Chapter 11: सन्निमित्ते वरं त्यागः (ख-भागः)', description: 'Sanskrit', url: 'https://youtu.be/-pxbsEfqd5c?si=BYFZ09FF76ihHne4' },
        { id: 12, title: 'Chapter 12: सम्यग्वर्णप्रयोगेण ब्रह्मलोके महीयते', description: 'Sanskrit', url: 'https://youtu.be/XoTE4SdZtK4?si=mFM3x5Wh7modqEZe' },
        { id: 13, title: 'Chapter 13: वर्णोच्चारण-शिक्षा १', description: 'Sanskrit', url: 'https://youtu.be/kp4q9Wb-Hs0?si=YN7XzuWBWK6p8VgY' },
    ],
    Std_8_physed: [
        { id: 1, title: 'Unit 1: Foundation of Physical Education and Well-being - Part 1', description: 'Physical Education and Well-being', url: 'https://youtu.be/Y9NgYBZaBNk?si=K5Oh48c3JzeYEFCQ' },
        { id: 2, title: 'Unit 1: Foundation of Physical Education and Well-being - Part 2', description: 'Physical Education and Well-being', url: 'https://youtu.be/kuVP51msxyk?si=CLiVDr6cNpniydjM' },
        { id: 3, title: 'Unit 1: Foundation of Physical Education and Well-being - Part 3', description: 'Physical Education and Well-being', url: 'https://youtu.be/NSLPlUBZ6zY?si=7Ano-Pcak6u_dtS3' },
        { id: 4, title: 'Unit 1: Foundation of Physical Education and Well-being - Part 4', description: 'Physical Education and Well-being', url: 'https://www.youtube.com/live/IbupvY2_jTE?si=53y1Kp8jKDtsFha3' },
        { id: 5, title: 'Unit 2: Physical and Motor Fitness - Part 1', description: 'Physical Education and Well-being', url: 'https://youtu.be/1Le7ginBqf8?si=Rlx-6H6Vgihr6bng' },
        { id: 6, title: 'Unit 2: Physical and Motor Fitness - Part 2', description: 'Physical Education and Well-being', url: 'https://youtu.be/_qg2n6LHFYw?si=qAr9qWmjzG32PB1Z' },
        { id: 7, title: 'Unit 3: Fundamental Skills of Sports - Athletics - Part 1', description: 'Physical Education and Well-being', url: 'https://youtu.be/pN7WTKsVUOY?si=enMrRhvh1CsNa5XT' },
        { id: 8, title: 'Unit 3: Fundamental Skills of Sports - Athletics - Part 2', description: 'Physical Education and Well-being', url: 'https://youtu.be/WzuT-AN1hgk?si=iQBMFbo0lc3GBO6r' },
        { id: 9, title: 'Unit 4: Fundamental Skills of Sports - Table Tennis - Part 1', description: 'Physical Education and Well-being', url: 'https://youtu.be/TGBgGGMCzMs?si=3JiYBa8ClU5Vzi1t' },
        { id: 10, title: 'Unit 4: Fundamental Skills of Sports - Table Tennis - Part 2', description: 'Physical Education and Well-being', url: 'https://youtu.be/gvVtpNVwNFY?si=lrNEy-qylGaJCcVO' },
        { id: 11, title: 'Unit 4: Fundamental Skills of Sports - Table Tennis - Part 3', description: 'Physical Education and Well-being', url: 'https://www.youtube.com/live/9_tPRU4dksY?si=pE61B5tM5dpaw2i4' },
        { id: 12, title: 'Unit 5: Fundamental Skills of Sports - Volleyball - Part 1', description: 'Physical Education and Well-being', url: 'https://youtu.be/1P8i7tXzh-U?si=ilIvkwv2pZXxMUmc' },
        { id: 13, title: 'Unit 5: Fundamental Skills of Sports - Volleyball - Part 2', description: 'Physical Education and Well-being', url: 'https://youtu.be/25r8ENza-lQ?si=e_1lx2Zg5y3mcYKa' },
        { id: 14, title: 'Unit 5: Fundamental Skills of Sports - Volleyball - Part 3', description: 'Physical Education and Well-being', url: 'https://www.youtube.com/live/utURSMJ4GnY?si=5MZdDuDaFKInFGCg' },
        { id: 15, title: 'Unit 6: Yoga - Part 1', description: 'Physical Education and Well-being', url: 'https://youtu.be/xJAZNk50xnE?si=uiOaf5o1zpfTAkFV' },
        { id: 16, title: 'Unit 6: Yoga - Part 2', description: 'Physical Education and Well-being', url: 'https://youtu.be/5ezJp1-Zao8?si=jIty8-sVJVYpOZal' },
        { id: 17, title: 'Unit 6: Yoga - Part 3', description: 'Physical Education and Well-being', url: 'https://youtu.be/xbF-gHKKdD0?si=ruIajy0WpG7dl6oE' },
        { id: 18, title: 'Unit 6: Yoga - Part 4', description: 'Physical Education and Well-being', url: 'https://youtu.be/lIjh20zEXMQ?si=WnsXpCm6LUTTeOiB' },
        { id: 19, title: 'Unit 6: Yoga - Part 5', description: 'Physical Education and Well-being', url: 'https://www.youtube.com/live/Qbrm7YIVdjY?si=CVjcmqKTc6NJGjJX' },
    ],
    Std_8_voced: [
        { id: 1, title: 'Project 1: Hydroponics: Growing Plants without Soil', description: 'Part 1: Work with Life Forms', url: 'https://youtu.be/lzNjpBxsvL4?si=0sr01R3PhRCqFyco' },
        { id: 2, title: 'Project 2: Feeding and Caring for Farm Animals - Part 1', description: 'Part 1: Work with Life Forms', url: 'https://youtu.be/lt1sdIVMnnw?si=ZoEbpJFC3M8x4F9j' },
        { id: 3, title: 'Project 2: Feeding and Caring for Farm Animals - Part 2', description: 'Part 1: Work with Life Forms', url: 'https://youtu.be/buvlF1Wn92A?si=mLObUGqohDCByiyu' },
        { id: 4, title: 'Project 3: Working with Wood and Bamboo - Part 1', description: 'Part 2: Work with Machines and Materials', url: 'https://youtu.be/nOi-Cb26Vpw?si=h7-dkXcaFKKJFQXg' },
        { id: 5, title: 'Project 3: Working with Wood and Bamboo - Part 2', description: 'Part 2: Work with Machines and Materials', url: 'https://youtu.be/vCaYJYRuYT8?si=hHy8aeKNS7Bv7xHi' },
        { id: 6, title: 'Project 4: Home Automation - Part 1', description: 'Part 2: Work with Machines and Materials', url: 'https://youtu.be/je2Rn31jGos?si=e4T_KM97Dd7nm1Ub' },
        { id: 7, title: 'Project 4: Home Automation - Part 2', description: 'Part 2: Work with Machines and Materials', url: 'https://youtu.be/Od5MC20PQqI?si=x8z4RQYcWuVK2ZMG' },
        { id: 8, title: 'Project 5: Water Audit for Water Management', description: 'Part 3: Work in Human Services', url: 'https://www.youtube.com/live/X2w4Wkxd4js?si=e6oVn2ydC2xl5ifQ' },
        { id: 9, title: 'Project 6: Creating Advertisements - Part 1', description: 'Part 3: Work in Human Services', url: 'https://youtu.be/a8i4W0Il1VU?si=TGWbHIMIe60aeG-U' },
        { id: 10, title: 'Project 6: Creating Advertisements - Part 2', description: 'Part 3: Work in Human Services', url: 'https://youtu.be/aPNePGgi2j4?si=w7a54qsiNCzrMxfb' },
    ]
};

function getSubjectVideoUnits(book) {
    if (SUBJECT_VIDEO_UNITS[book.slug]) {
        return SUBJECT_VIDEO_UNITS[book.slug];
    }
    return Array.from({ length: Math.min(book.chapters || 5, 8) }, (_, i) => ({
        id: i + 1,
        title: `Unit ${i + 1}`,
        description: `${book.title} Topic ${i + 1}`,
        url: SUBJECT_YOUTUBE_LINKS[book.slug] || `https://www.youtube.com/results?search_query=${encodeURIComponent(`Class 8 ${book.title} chapter ${i + 1}`)}`
    }));
}

function getYouTubeVideoId(url) {
    try {
        const parsed = new URL(url);
        const host = parsed.hostname.replace(/^www\./, '');

        if (host === 'youtu.be') {
            return parsed.pathname.split('/').filter(Boolean)[0] || null;
        }

        if (host.endsWith('youtube.com')) {
            const fromQuery = parsed.searchParams.get('v');
            if (fromQuery) return fromQuery;

            const parts = parsed.pathname.split('/').filter(Boolean);
            const liveIndex = parts.indexOf('live');
            if (liveIndex !== -1 && parts[liveIndex + 1]) return parts[liveIndex + 1];

            const embedIndex = parts.indexOf('embed');
            if (embedIndex !== -1 && parts[embedIndex + 1]) return parts[embedIndex + 1];

            const vIndex = parts.indexOf('v');
            if (vIndex !== -1 && parts[vIndex + 1]) return parts[vIndex + 1];
        }
    } catch {
        // Fallback for malformed URLs.
        const fallback = url.match(/(?:v=|youtu\.be\/|youtube\.com\/live\/|youtube\.com\/embed\/)([a-zA-Z0-9_-]{11})/);
        return fallback ? fallback[1] : null;
    }

    return null;
}

function getYouTubeThumbnail(url) {
    const videoId = getYouTubeVideoId(url);
    return videoId ? `https://img.youtube.com/vi/${videoId}/hqdefault.jpg` : null;
}

function getYouTubeEmbedUrl(url) {
    const videoId = getYouTubeVideoId(url);
    return videoId ? `https://www.youtube.com/embed/${videoId}?autoplay=1&rel=0` : null;
}

/* ── Circular SVG Progress Ring ─────────────────────────── */
function CircleRing({ pct }) {
    const r = 32, circ = 2 * Math.PI * r;
    return (
        <svg width="84" height="84" viewBox="0 0 84 84">
            <defs>
                <linearGradient id="ringGrad" x1="0%" y1="0%" x2="100%" y2="0%">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#6366f1" />
                </linearGradient>
            </defs>
            <circle cx="42" cy="42" r={r} fill="none" stroke="#f1f5f9" strokeWidth="7" />
            <motion.circle
                cx="42" cy="42" r={r}
                fill="none" stroke="url(#ringGrad)" strokeWidth="7"
                strokeLinecap="round"
                strokeDasharray={circ}
                initial={{ strokeDashoffset: circ }}
                animate={{ strokeDashoffset: circ - (circ * pct) / 100 }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
                transform="rotate(-90 42 42)"
            />
            <text x="42" y="47" textAnchor="middle" fontSize="13" fontWeight="800" fill="#0f172a">
                {pct}%
            </text>
        </svg>
    );
}

/* ── Subject KPI Card (per-subject strip) ────────────────── */
function SubjectKpiCard({ book }) {
    const navigate = useNavigate();
    const { title, icon, iconBg, iconColor, badgeColor, progress, chapters, completedCount } = book;
    const status   = progress === 100 ? 'Done' : progress > 0 ? 'In Progress' : 'Not Started';
    const statusBg = progress === 100 ? '#dcfce7' : progress > 0 ? '#eff6ff' : '#f1f5f9';
    const statusCl = progress === 100 ? '#15803d' : progress > 0 ? '#2563eb'  : '#94a3b8';
    return (
        <motion.div
            className="sk-card"
            whileHover={{ y: -4, boxShadow: '0 14px 32px rgba(0,0,0,0.11)' }}
            transition={{ duration: 0.2 }}
            onClick={() => navigate(`/books/${book.slug}`)}
            style={{ cursor: 'pointer' }}
            title={title}
        >
            <div className="sk-card__icon" style={{ background: iconBg, color: iconColor }}>{icon}</div>
            <div className="sk-card__title">{title}</div>
            <div className="sk-card__bar-wrap">
                <motion.div
                    className="sk-card__bar"
                    style={{ background: iconColor }}
                    initial={{ width: 0 }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 1, ease: 'easeOut' }}
                />
            </div>
            <div className="sk-card__pct" style={{ color: iconColor }}>{progress}%</div>
            <div className="sk-card__chapters">{completedCount} / {chapters} ch</div>
            <span className="sk-card__status" style={{ color: statusCl, background: statusBg }}>{status}</span>
        </motion.div>
    );
}

/* ── KPI Card ─────────────────────────────────────────────── */
function KpiCard({ icon, iconBg, label, value, sub, ring, pct }) {
    return (
        <motion.div
            className="sc-kpi"
            whileHover={{ scale: 1.04, boxShadow: '0 16px 36px rgba(0,0,0,0.11)' }}
            transition={{ duration: 0.22 }}
        >
            {ring ? (
                <>
                    <div className="sc-kpi__label">{label}</div>
                    <CircleRing pct={pct} />
                </>
            ) : (
                <>
                    <div className="sc-kpi__icon" style={{ background: iconBg }}>{icon}</div>
                    <div className="sc-kpi__label">{label}</div>
                    <div className="sc-kpi__val">{value}</div>
                    {sub && <div className="sc-kpi__sub">{sub}</div>}
                </>
            )}
        </motion.div>
    );
}

/* ── Subject Card ─────────────────────────────────────────── */
function SubjectCard({ book, isFav, onFavToggle }) {
    const navigate = useNavigate();

    const handleDownload = async (e) => {
        e.stopPropagation();
        try {
            const resp = await apiService.downloadAllPdfs(book.slug);
            const url  = URL.createObjectURL(resp.data);
            const link = document.createElement('a');
            link.href     = url;
            link.download = `${book.title.replace(/\s+/g, '_')}_Full.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);
        } catch {
            alert('No PDFs available for download yet.');
        }
    };
    const {
        id, title, icon, iconBg, iconColor,
        badgeColor, badgeBg,
        progress, chapters, lastOpened,
    } = book;

    const btnLabel =
        chapters === 0   ? 'Explore' :
        progress === 100 ? 'Review' :
        progress > 0     ? 'Continue' :
                           'Start Learning';

    const subtitle = chapters === 0
        ? 'Coming Soon'
        : lastOpened
            ? `${chapters} Chapters • Last opened ${lastOpened}`
            : `${chapters} Chapters`;
    return (
        <motion.div
            className="sc-card"
            initial={{ opacity: 0, y: 28 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }}
            whileHover={{ y: -6, boxShadow: '0 20px 48px rgba(0,0,0,0.13)' }}
            transition={{ duration: 0.25 }}
            onClick={() => navigate(`/books/${book.slug}`)}
            style={{ cursor: 'pointer' }}
            role="button"
            aria-label={`Open ${title} subject page`}
        >
            {/* Icon circle */}
            <div
                className="sc-card__icon-circle"
                style={{ background: iconBg, color: iconColor }}
            >
                {icon}
            </div>

            {/* Title */}
            <h3 className="sc-card__title">{title}</h3>

            {/* Subtitle */}
            <p className="sc-card__subtitle">{subtitle}</p>

            {/* Completion / status badge */}
            <span
                className="sc-card__badge"
                style={chapters === 0
                    ? { color: '#92400e', background: '#fef3c7' }
                    : { color: badgeColor, background: badgeBg }
                }
                aria-label={chapters === 0 ? 'Coming soon' : `${progress}% completed`}
            >
                {chapters === 0 ? '🔒 Coming Soon' : `${progress}% Completed`}
            </span>

            {/* Actions */}
            <div className="sc-card__actions">
                {/* Heart */}
                <button
                    className={`sc-card__icon-btn${isFav ? ' sc-card__icon-btn--fav' : ''}`}
                    onClick={e => { e.stopPropagation(); onFavToggle(id); }}
                    aria-label={isFav ? 'Remove from favourites' : 'Add to favourites'}
                >
                    {isFav ? '❤️' : '🤍'}
                </button>

                {/* CTA */}
                <motion.button
                    className="sc-card__cta"
                    style={{ background: iconColor }}
                    whileHover={{ scale: 1.06 }}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => navigate(`/books/${book.slug}`)}
                    aria-label={`${btnLabel} ${title}`}
                >
                    {btnLabel}
                </motion.button>

                {/* Download */}
                <button
                    className="sc-card__icon-btn"
                    onClick={handleDownload}
                    aria-label={`Download ${title}`}
                    title={`Download all PDFs for ${title}`}
                >
                    ⬇️
                </button>
            </div>
        </motion.div>
    );
}

/* ── Main Component ───────────────────────────────────────── */
export default function Books() {
    const navigate  = useNavigate();
    const user      = useSelector((state) => state.auth.user);
    const isDemoUser = !!user?.isDemoMode || String(user?.email || '').toLowerCase() === 'demo@school.com';
    const [filter,    setFilter]    = useState('All Books');
    const [search,    setSearch]    = useState('');
    const [favorites, setFavorites] = useState(() => {
        try { return new Set(JSON.parse(localStorage.getItem('bookFavorites') || '[]')); }
        catch { return new Set(); }
    });
    const [apiSubjects, setApiSubjects] = useState([]);  // from /api/books
    const [loadingApi, setLoadingApi]   = useState(true);
    const [selectedVideoSubject, setSelectedVideoSubject] = useState(null);
    const [playingVideo, setPlayingVideo] = useState(null);

    // Reset drilldown when filter changes
    useEffect(() => {
        setSelectedVideoSubject(null);
        setPlayingVideo(null);
    }, [filter]);

    const openYoutube = useCallback((book) => {
        const fallback = `https://www.youtube.com/results?search_query=${encodeURIComponent(`Class 8 ${book.title} chapter wise`)}`;
        const url = SUBJECT_YOUTUBE_LINKS[book.slug] || fallback;
        window.open(url, '_blank', 'noopener,noreferrer');
    }, []);

    /* ── Fetch real data from API ── */
    const fetchSubjects = useCallback(async () => {
        setLoadingApi(true);
        try {
            const { data } = await apiService.getAllSubjects();
            setApiSubjects(data);
        } catch {
            // Fallback: no API data, use metadata only
        } finally {
            setLoadingApi(false);
        }
    }, []);

    useEffect(() => { fetchSubjects(); }, [fetchSubjects]);

    /* ── Merge API data into metadata ── */
    const BOOKS = useMemo(() => {
        return BOOKS_META.map(meta => {
            const api = apiSubjects.find(s => s.slug === meta.slug);
            const demoStats = DEMO_BOOK_STATS[meta.slug] || { count: 0, completedCount: 0 };
            const apiCount = typeof api?.count === 'number' ? api.count : 0;
            const shouldUseDemoStats = isDemoUser && apiCount === 0;
            const chapters = shouldUseDemoStats ? demoStats.count : apiCount;
            const completedCount = shouldUseDemoStats ? demoStats.completedCount : (api?.completedCount || 0);
            const progress = chapters > 0 ? Math.round((completedCount / chapters) * 100) : 0;
            const lastOpenedAt = api?.lastOpenedAt || (shouldUseDemoStats ? new Date(Date.now() - 86400000).toISOString() : null);

            // Format last opened as relative time
            let lastOpened = null;
            if (progress === 100) {
                lastOpened = 'Completed';
            } else if (lastOpenedAt) {
                const diff = Date.now() - new Date(lastOpenedAt).getTime();
                const hours = Math.floor(diff / 3600000);
                const days = Math.floor(diff / 86400000);
                if (hours < 1) lastOpened = 'just now';
                else if (hours < 24) lastOpened = `${hours}h ago`;
                else if (days === 1) lastOpened = 'yesterday';
                else if (days < 7) lastOpened = `${days} days ago`;
                else lastOpened = `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
            }

            return {
                ...meta,
                chapters,
                completedCount,
                progress,
                lastOpened,
            };
        }); // Always show all 9 subjects regardless of whether PDFs are uploaded
    }, [apiSubjects, isDemoUser]);

    // KPI totals — always based on all 9 subjects
    const totalCompleted = useMemo(() => BOOKS.filter(b => b.progress === 100).length, [BOOKS]);
    const avgProgress    = useMemo(() => {
        const withChapters = BOOKS.filter(b => b.chapters > 0);
        return withChapters.length > 0
            ? Math.round(withChapters.reduce((s, b) => s + b.progress, 0) / withChapters.length)
            : 0;
    }, [BOOKS]);
    const chaptersRead   = useMemo(() => BOOKS.reduce((s, b) => s + (b.completedCount || 0), 0), [BOOKS]);
    const totalChapters  = useMemo(() => BOOKS.reduce((s, b) => s + (b.chapters || 0), 0), [BOOKS]);

    const visible = useMemo(() => {
        const q = search.toLowerCase();
        return BOOKS.filter(b => {
            const matchSearch = !q || b.title.toLowerCase().includes(q) || b.subject.toLowerCase().includes(q);
            if (!matchSearch) return false;
            switch (filter) {
                case 'Video Learning':  return b.chapters > 0;
                case 'Completed':       return b.progress === 100;
                case 'Favorites':       return favorites.has(b.id);
                case 'Pending':         return b.progress === 0;
                case 'Recently Opened': return b.lastOpened !== null && b.progress < 100;
                default:                return true;
            }
        });
    }, [filter, search, favorites, BOOKS]);

    const toggleFav = id => setFavorites(prev => {
        const s = new Set(prev);
        s.has(id) ? s.delete(id) : s.add(id);
        localStorage.setItem('bookFavorites', JSON.stringify([...s]));
        return s;
    });

    return (
        <div className="sc-wrapper">

            {/* ── KPI Row ── */}
            <div className="sc-kpi-row">
                <KpiCard icon="📚" iconBg="#EFF6FF" label="Total Books"     value={BOOKS_META.length} />
                <KpiCard icon="✅" iconBg="#F0FDF4" label="Completed"       value={totalCompleted} />
                <KpiCard ring pct={avgProgress}     label="Overall Progress" value={`${avgProgress}%`} />
                <KpiCard icon="📖" iconBg="#F5F3FF" label="Chapters Read"   value={chaptersRead} sub={`of ${totalChapters}`} />
            </div>

            {/* ── Toolbar ── */}
            <div className="sc-toolbar">
                <div className="sc-search-wrap">
                    <span className="sc-search-icon">🔍</span>
                    <input
                        className="sc-search"
                        placeholder="Search subjects..."
                        value={search}
                        onChange={e => setSearch(e.target.value)}
                        aria-label="Search subjects"
                    />
                    {search && (
                        <button className="sc-search-clear" onClick={() => setSearch('')} aria-label="Clear search">×</button>
                    )}
                </div>
                <div className="sc-filters" role="tablist" aria-label="Filter books">
                    {FILTERS.map(f => (
                        <motion.button
                            key={f}
                            role="tab"
                            aria-selected={filter === f}
                            className={`sc-filter${f === 'Video Learning' ? ' sc-filter--video' : ''}${filter === f ? ' sc-filter--active' : ''}`}
                            onClick={() => setFilter(f)}
                            whileTap={{ scale: 0.95 }}
                        >
                            {f}
                        </motion.button>
                    ))}
                </div>
            </div>

            {/* ── Content ── */}
            {visible.length === 0 ? (
                <div className="sc-empty">
                    <span>📭</span>
                    <p>No books found{search ? ` for "${search}"` : ` in "${filter}"`}</p>
                </div>
            ) : filter === 'Video Learning' ? (
                playingVideo ? (
                    <div className="sc-video-player-view">
                        <div 
                            style={{ 
                                display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '12px'
                            }} 
                        >
                            <motion.div 
                                whileHover={{ scale: 1.05, background: '#f1f5f9' }}
                                whileTap={{ scale: 0.95 }}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '8px', background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', cursor: 'pointer' }}
                                onClick={() => setPlayingVideo(null)}
                            >
                                <ArrowLeft size={20} color="#475569" strokeWidth={2.5} />
                            </motion.div>
                            <h2 style={{ fontSize: '18px', fontWeight: '600', margin: 0, color: '#334155' }}>Back to {selectedVideoSubject?.title}</h2>
                        </div>

                        <div className="video-player-container" style={{
                            background: '#ffffff',
                            borderRadius: '16px',
                            padding: '24px',
                            boxShadow: '0 4px 20px rgba(0,0,0,0.05)'
                        }}>
                            <div className="video-header" style={{ display: 'flex', alignItems: 'center', marginBottom: '24px' }}>
                                <div style={{
                                    width: '48px', height: '48px', borderRadius: '50%',
                                    background: '#f59e0b', color: '#fff',
                                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                                    marginRight: '16px', fontSize: '24px'
                                }}>▶</div>
                                <div>
                                    <h2 style={{ margin: 0, fontSize: '22px', color: '#f59e0b' }}>{playingVideo.title}</h2>
                                    <div style={{ display: 'flex', alignItems: 'center', color: '#10b981', fontSize: '14px', marginTop: '4px', fontWeight: '600' }}>
                                        <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#10b981', marginRight: '8px' }}></span>
                                        Now Playing — Safe Learning Mode
                                    </div>
                                </div>
                            </div>
                            
                            <div className="iframe-wrapper" style={{
                                position: 'relative',
                                paddingBottom: '56.25%', /* 16:9 */
                                height: 0,
                                overflow: 'hidden',
                                borderRadius: '12px',
                                background: '#000'
                            }}>
                                {getYouTubeEmbedUrl(playingVideo.url) ? (
                                    <iframe 
                                        style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', border: 'none' }}
                                        src={getYouTubeEmbedUrl(playingVideo.url)} 
                                        title={playingVideo.title}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                                        allowFullScreen
                                    />
                                ) : (
                                    <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', display: 'flex', alignItems:'center', justifyContent: 'center', color: '#fff' }}>
                                        Video cannot be embedded. <a href={playingVideo.url} target="_blank" rel="noreferrer" style={{color: '#60a5fa', marginLeft: '6px'}}>Watch on YouTube</a>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>
                ) : selectedVideoSubject ? (
                    <div className="sc-video-drilldown">
                        <div 
                            style={{ 
                                display: 'flex', alignItems: 'center', marginBottom: '24px', gap: '12px'
                            }} 
                        >
                            <motion.div 
                                whileHover={{ scale: 1.05, background: '#f1f5f9' }}
                                whileTap={{ scale: 0.95 }}
                                style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '36px', height: '36px', borderRadius: '8px', background: '#fff', border: '1px solid #e2e8f0', boxShadow: '0 1px 3px rgba(0,0,0,0.05)', cursor: 'pointer' }}
                                onClick={() => { setSelectedVideoSubject(null); setPlayingVideo(null); }}
                            >
                                <ArrowLeft size={20} color="#475569" strokeWidth={2.5} />
                            </motion.div>
                            <span style={{ fontSize: '24px' }}>{selectedVideoSubject.icon}</span>
                            <h2 style={{ fontSize: '20px', fontWeight: '700', margin: 0, color: '#0f172a' }}>{selectedVideoSubject.title} Learning Units</h2>
                        </div>
                        <motion.div className="sc-video-grid" layout>
                            <AnimatePresence mode="popLayout">
                                {getSubjectVideoUnits(selectedVideoSubject).map((unit, i) => (
                                    <motion.article
                                        key={unit.id}
                                        className="sc-video-card"
                                        layout
                                        initial={{ opacity: 0, y: 18 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        exit={{ opacity: 0, y: 12 }}
                                        transition={{ duration: 0.22, delay: i * 0.04 }}
                                    >
                                        <div className="sc-video-thumb" style={{ 
                                            background: getYouTubeThumbnail(unit.url) ? `url(${getYouTubeThumbnail(unit.url)}) center/cover` : `linear-gradient(135deg, ${selectedVideoSubject.iconBg} 0%, #ffffff 100%)` 
                                        }}>
                                            <span className="sc-video-emoji" style={{ color: selectedVideoSubject.iconColor, background: '#ffffff', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}>▶️</span>
                                        </div>
                                        <div className="sc-video-body">
                                            <h3 style={{ fontSize: '16px', fontWeight: '800' }}>{unit.title}</h3>
                                            <p style={{ minHeight: '40px' }}>{unit.description}</p>
                                            <button
                                                className="sc-video-btn"
                                                onClick={() => setPlayingVideo(unit)}
                                                style={{ background: 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)' }}
                                                aria-label={`Watch ${unit.title}`}
                                            >
                                                ▶ Watch Video
                                            </button>
                                        </div>
                                    </motion.article>
                                ))}
                            </AnimatePresence>
                        </motion.div>
                    </div>
                ) : (
                    <motion.div className="sc-video-grid" layout>
                        <AnimatePresence mode="popLayout">
                            {visible.map((book, i) => (
                                <motion.article
                                    key={book.id}
                                    className="sc-video-card"
                                    layout
                                    initial={{ opacity: 0, y: 18 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    exit={{ opacity: 0, y: 12 }}
                                    transition={{ duration: 0.22, delay: i * 0.04 }}
                                >
                                    <div className="sc-video-thumb" style={{ background: `linear-gradient(135deg, ${book.iconBg} 0%, #ffffff 100%)` }}>
                                        <span className="sc-video-emoji" style={{ color: book.iconColor }}>{book.icon}</span>
                                    </div>
                                    <div className="sc-video-body">
                                        <h3>{book.title} Learning Units</h3>
                                        <p>{book.chapters} lessons available</p>
                                        <button
                                            className="sc-video-btn"
                                            onClick={() => setSelectedVideoSubject(book)}
                                            aria-label={`Open videos for ${book.title}`}
                                        >
                                            ▶ View Units
                                        </button>
                                    </div>
                                </motion.article>
                            ))}
                        </AnimatePresence>
                    </motion.div>
                )
            ) : (
                <motion.div className="sc-grid" layout>
                    <AnimatePresence mode="popLayout">
                        {visible.map((book, i) => (
                            <motion.div
                                key={book.id}
                                layout
                                transition={{ duration: 0.22, delay: i * 0.045 }}
                            >
                                <SubjectCard
                                    book={book}
                                    isFav={favorites.has(book.id)}
                                    onFavToggle={toggleFav}
                                />
                            </motion.div>
                        ))}
                    </AnimatePresence>
                </motion.div>
            )}
        </div>
    );
}
