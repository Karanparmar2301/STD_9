export const DEMO_UID = '46a04e54-aedf-4c38-bb23-571b7e0ba0e1';
export const DEMO_REMOTE_PDF = 'https://mozilla.github.io/pdf.js/web/compressed.tracemonkey-pldi-09.pdf';

export const DEMO_SUBJECT_CATALOG = [
    { slug: 'Std_8_math', title: 'Mathematics', chapterCount: 12, completedCount: 5 },
    { slug: 'Std_8_eng', title: 'English Literature', chapterCount: 10, completedCount: 4 },
    { slug: 'Std_8_hindi', title: 'Hindi', chapterCount: 9, completedCount: 3 },
    { slug: 'Std_8_science', title: 'Science', chapterCount: 11, completedCount: 6 },
    { slug: 'Std_8_arts', title: 'Fine Arts', chapterCount: 8, completedCount: 2 },
    { slug: 'Std_8_social', title: 'Social Science', chapterCount: 10, completedCount: 4 },
    { slug: 'Std_8_sanskrit', title: 'Sanskrit', chapterCount: 7, completedCount: 2 },
    { slug: 'Std_8_physed', title: 'Physical Education', chapterCount: 6, completedCount: 1 },
    { slug: 'Std_8_voced', title: 'Vocational Education', chapterCount: 5, completedCount: 1 },
];

const CHAPTER_NAME_PARTS = [
    'Introduction',
    'Core Concepts',
    'Worked Examples',
    'Practice Set',
    'Revision',
    'Application',
    'Assessment',
];

function getSubjectCatalogItem(subjectSlug) {
    return DEMO_SUBJECT_CATALOG.find((item) => item.slug.toLowerCase() === String(subjectSlug || '').toLowerCase());
}

function buildChapterTitle(subjectTitle, chapterNumber) {
    const part = CHAPTER_NAME_PARTS[(chapterNumber - 1) % CHAPTER_NAME_PARTS.length];
    return `Chapter ${chapterNumber}: ${part}`;
}

export function getDemoBookStats() {
    return DEMO_SUBJECT_CATALOG.map((subject, idx) => ({
        slug: subject.slug,
        count: subject.chapterCount,
        completedCount: subject.completedCount,
        lastOpenedAt: new Date(Date.now() - 86400000 * (idx + 1)).toISOString(),
    }));
}

export function getDemoBookStatsMap() {
    return Object.fromEntries(
        DEMO_SUBJECT_CATALOG.map((subject) => [
            subject.slug,
            {
                count: subject.chapterCount,
                completedCount: subject.completedCount,
            },
        ])
    );
}

export function getDemoBookChapters(subjectSlug) {
    const subject = getSubjectCatalogItem(subjectSlug) || {
        slug: subjectSlug,
        title: String(subjectSlug || 'Subject').replace(/_/g, ' '),
        chapterCount: 8,
        completedCount: 2,
    };

    const chapterCount = Math.max(subject.chapterCount || 0, 1);
    const completedCount = Math.min(subject.completedCount || 0, chapterCount);
    const nextReadId = Math.min(completedCount + 1, chapterCount);

    return Array.from({ length: chapterCount }, (_, index) => {
        const chapterId = index + 1;
        return {
            id: chapterId,
            title: buildChapterTitle(subject.title, chapterId),
            file: DEMO_REMOTE_PDF,
            filename: `${subject.slug}_Chapter_${chapterId}.pdf`,
            is_index: false,
            completed: chapterId <= completedCount,
            isLastOpened: chapterId === nextReadId,
        };
    });
}

export function getDemoPerformanceSubjects() {
    return [
        { name: 'Mathematics', avg: 90, trend: 5, grade: 'A+' },
        { name: 'English', avg: 81, trend: 2, grade: 'A' },
        { name: 'Hindi', avg: 75, trend: 1, grade: 'B' },
        { name: 'Science', avg: 86, trend: 3, grade: 'A' },
        { name: 'Fine Arts', avg: 77, trend: 4, grade: 'B' },
        { name: 'Social Science', avg: 78, trend: 4, grade: 'B' },
        { name: 'Sanskrit', avg: 74, trend: 2, grade: 'B' },
        { name: 'Physical Education', avg: 94, trend: 5, grade: 'A+' },
        { name: 'Vocational Education', avg: 79, trend: 3, grade: 'B' },
    ];
}
