import type { ExtractionConfidence } from '../types/research';

export type GoldenSubjectExpectation = {
  subject: string;
  percentage?: number;
  teacher?: string;
  commentIncludes?: string;
  grade?: string;
  effort?: string;
  attainment?: string;
  targetGrade?: string;
  predictedGrade?: string;
  classification?: 'academic' | 'instrumental';
};

export type ExtractionFixture = {
  id: string;
  title: string;
  description: string;
  sourceKind: 'text' | 'ocr';
  text: string;
  expected: {
    term?: string;
    academicYear?: string;
    subjects: GoldenSubjectExpectation[];
    comments: number;
    predictedGrades: number;
    needsReview: number;
    confidence: ExtractionConfidence;
    shouldAffectAcademicPerformance: boolean;
    warnings?: string[];
  };
};

const michaelmasRows = [
  'Biology | Teacher: W Jolly | Mark: 72% | Comment: Secure knowledge of cells and transport.',
  'Chemistry | Teacher: R Shah | Mark: 81% | Comment: Accurate practical observations.',
  'English | Teacher: A Jones | Mark: 94% | Comment: Perceptive analysis supported by precise quotations.',
  'Mathematics | Teacher: D Patel | Mark: 88% | Comment: Algebraic reasoning is consistently strong.',
  'Physics | Teacher: H Green | Mark: 79% | Comment: Applies equations carefully.',
  'History | Teacher: T Morgan | Mark: 76% | Comment: Source evaluation is balanced.',
  'Geography | Teacher: S Thomas | Mark: 83% | Comment: Case-study evidence is used effectively.',
  'French | Teacher: M Blanc | Mark: 74% | Comment: Spoken answers are increasingly confident.',
  'Latin | Teacher: P Avery | Mark: 86% | Comment: Translation choices are well justified.',
  'Computer Science | Teacher: K Evans | Mark: 91%',
  'Religious Studies | Teacher: J Ahmed | Mark: 84%',
  'Art | Teacher: L Chen | Mark: 78%',
  'Drama | Teacher: C Wright | Mark: 82%',
  'Music | Teacher: E Davies | Mark: 80%',
  'Physical Education | Teacher: N Brown | Mark: 89%',
];

export const extractionFixtures: ExtractionFixture[] = [
  {
    id: 'michaelmas-report',
    title: 'Michaelmas Report 2025-2026',
    description: 'Full multi-subject report used as the primary subject-count, ordering, teacher, mark, and comment baseline.',
    sourceKind: 'text',
    text: ['Michaelmas Report', 'Academic year 2025-2026', ...michaelmasRows].join('\n'),
    expected: {
      term: 'Michaelmas',
      academicYear: '2025-2026',
      subjects: michaelmasRows.map((row) => {
        const [subjectPart, teacherPart, markPart, commentPart] = row.split(' | ');
        return {
          subject: subjectPart,
          teacher: teacherPart.replace('Teacher: ', ''),
          percentage: Number(markPart.match(/\d+/)?.[0]),
          commentIncludes: commentPart?.replace('Comment: ', '').split(' ').slice(0, 3).join(' '),
          classification: 'academic' as const,
        };
      }),
      comments: 9,
      predictedGrades: 0,
      needsReview: 0,
      confidence: 'High',
      shouldAffectAcademicPerformance: true,
    },
  },
  {
    id: 'summer-report',
    title: 'Summer Report 2025-2026',
    description: 'A report containing grades, effort, attainment, targets, and predicted grades as well as marks.',
    sourceKind: 'text',
    text: [
      'Summer Report',
      'Academic year 2025-2026',
      'Mathematics | Teacher: Dr Patel | Mark: 87% | Grade: 8 | Effort: Excellent | Attainment: Above expected | Target: 9 | Predicted: 8',
      'Comment: Excellent algebraic reasoning. Show full method in multi-step proofs.',
      'English Literature | Teacher: Ms Jones | Mark: 74% | Grade: 7 | Effort: Good | Attainment: Secure | Target: 8 | Predicted: 7',
      'Comment: Strong textual evidence. Develop comparison paragraphs with more precise context.',
      'Chemistry | Teacher: Mr Shah | Mark: 69% | Grade: 6 | Effort: Good | Attainment: Secure | Target: 7 | Predicted: 7',
      'Comment: Practical work is careful. Revise bonding calculations.',
    ].join('\n'),
    expected: {
      term: 'Summer',
      academicYear: '2025-2026',
      subjects: [
        { subject: 'Mathematics', teacher: 'Dr Patel', percentage: 87, grade: '8', effort: 'Excellent', attainment: 'Above expected', targetGrade: '9', predictedGrade: '8', commentIncludes: 'Excellent algebraic reasoning', classification: 'academic' },
        { subject: 'English Literature', teacher: 'Ms Jones', percentage: 74, grade: '7', effort: 'Good', attainment: 'Secure', targetGrade: '8', predictedGrade: '7', commentIncludes: 'Strong textual evidence', classification: 'academic' },
        { subject: 'Chemistry', teacher: 'Mr Shah', percentage: 69, grade: '6', effort: 'Good', attainment: 'Secure', targetGrade: '7', predictedGrade: '7', commentIncludes: 'Practical work is careful', classification: 'academic' },
      ],
      comments: 3,
      predictedGrades: 3,
      needsReview: 0,
      confidence: 'High',
      shouldAffectAcademicPerformance: true,
    },
  },
  {
    id: 'comments-only-report',
    title: 'Comments-only report',
    description: 'Comments without marks must remain useful and must not cause invented marks or grades.',
    sourceKind: 'text',
    text: [
      'Michaelmas Tutor Report 2024-2025',
      'Classics - Teacher: Mr Avery',
      'Comment: Analytical vocabulary is improving. Action: embed shorter quotations more fluently.',
      'Art - Teacher: Ms Li',
      'Comment: Sketchbook experimentation is thoughtful. Action: annotate decisions with more precision.',
    ].join('\n'),
    expected: {
      term: 'Michaelmas',
      academicYear: '2024-2025',
      subjects: [
        { subject: 'Classics', teacher: 'Mr Avery', commentIncludes: 'Analytical vocabulary is improving', classification: 'academic' },
        { subject: 'Art', teacher: 'Ms Li', commentIncludes: 'Sketchbook experimentation is thoughtful', classification: 'academic' },
      ],
      comments: 2,
      predictedGrades: 0,
      needsReview: 0,
      confidence: 'High',
      shouldAffectAcademicPerformance: true,
    },
  },
  {
    id: 'marks-only-report',
    title: 'Marks-only report',
    description: 'Clear marks and grades must be accepted without forcing absent comments into review.',
    sourceKind: 'text',
    text: [
      'Summer Mock Results 2024-2025',
      'Physics | Mark: 91% | Grade: 9 | Rank: 2/48',
      'Geography | Mark: 78% | Grade: 7 | Rank: 8/42',
      'Latin | Mark: 66% | Grade: 6',
    ].join('\n'),
    expected: {
      term: 'Summer',
      academicYear: '2024-2025',
      subjects: [
        { subject: 'Physics', percentage: 91, grade: '9', classification: 'academic' },
        { subject: 'Geography', percentage: 78, grade: '7', classification: 'academic' },
        { subject: 'Latin', percentage: 66, grade: '6', classification: 'academic' },
      ],
      comments: 0,
      predictedGrades: 0,
      needsReview: 0,
      confidence: 'High',
      shouldAffectAcademicPerformance: true,
    },
  },
  {
    id: 'ocr-screenshot',
    title: 'OCR screenshot report',
    description: 'Common OCR substitutions and wrapped comments should be repaired while preserving uncertainty explanations.',
    sourceKind: 'ocr',
    text: [
      'SUMMER REP0RT 2024-2025',
      'SUBJ TCHR RESULT COMMENT',
      'Biology Mrs Green 8O % shows good under-standing of cells but',
      'needs to practise osmosis graph questions',
      'History Mr Thomas 62% Grade 5 confident source inference',
      'French Mme Blanc comment: oral confidence has improved; no mark shown',
    ].join('\n'),
    expected: {
      term: 'Summer',
      academicYear: '2024-2025',
      subjects: [
        { subject: 'Biology', teacher: 'Mrs Green', percentage: 80, commentIncludes: 'shows good understanding', classification: 'academic' },
        { subject: 'History', teacher: 'Mr Thomas', percentage: 62, grade: '5', commentIncludes: 'confident source inference', classification: 'academic' },
        { subject: 'French', teacher: 'Mme Blanc', commentIncludes: 'oral confidence has improved', classification: 'academic' },
      ],
      comments: 3,
      predictedGrades: 0,
      needsReview: 0,
      confidence: 'Medium',
      shouldAffectAcademicPerformance: true,
      warnings: ['OCR character substitution repaired'],
    },
  },
  {
    id: 'low-quality-scan',
    title: 'Low-quality scan',
    description: 'Merged rows and impossible percentages must be detected, isolated, and excluded from trusted Progress data.',
    sourceKind: 'ocr',
    text: [
      'MICHAELMAS REP0RT 2023/24',
      'Biology Mrs Gr?en 1O4% cells secure Chemistry Mr Shah 79% bonding improving',
      'English Ms Jones 88% perceptive analysis',
    ].join('\n'),
    expected: {
      term: 'Michaelmas',
      academicYear: '2023-2024',
      subjects: [
        { subject: 'Biology', teacher: 'Mrs Gr?en', classification: 'academic' },
        { subject: 'Chemistry', teacher: 'Mr Shah', percentage: 79, commentIncludes: 'bonding improving', classification: 'academic' },
        { subject: 'English', teacher: 'Ms Jones', percentage: 88, commentIncludes: 'perceptive analysis', classification: 'academic' },
      ],
      comments: 3,
      predictedGrades: 0,
      needsReview: 1,
      confidence: 'Low',
      shouldAffectAcademicPerformance: true,
      warnings: ['Merged OCR row detected', 'Impossible percentage rejected'],
    },
  },
  {
    id: 'music-gcse-report',
    title: 'Music GCSE report',
    description: 'GCSE Music and its marked coursework/appraising components must remain in academic Progress.',
    sourceKind: 'text',
    text: [
      'GCSE Music Summer Report 2025-2026',
      'Music Appraising | Teacher: Mr Davies | Mark: 82% | Grade: 8 | Target: 8',
      'Comment: Strong recognition of set works. Improve comparison of harmony and texture.',
      'Composition Coursework | Teacher: Mr Davies | Mark: 76% | Grade: 7',
      'Comment: Motif development is convincing; refine notation detail.',
    ].join('\n'),
    expected: {
      term: 'Summer',
      academicYear: '2025-2026',
      subjects: [
        { subject: 'Music Appraising', teacher: 'Mr Davies', percentage: 82, grade: '8', targetGrade: '8', commentIncludes: 'Strong recognition of set works', classification: 'academic' },
        { subject: 'Composition Coursework', teacher: 'Mr Davies', percentage: 76, grade: '7', commentIncludes: 'Motif development is convincing', classification: 'academic' },
      ],
      comments: 2,
      predictedGrades: 0,
      needsReview: 0,
      confidence: 'High',
      shouldAffectAcademicPerformance: true,
    },
  },
  {
    id: 'instrumental-lesson-report',
    title: 'Instrumental lesson report',
    description: 'Instrumental evidence is retained as source material but must never enter academic Progress.',
    sourceKind: 'text',
    text: [
      'Piano lesson feedback',
      'Teacher: Susan Wang',
      'Comment: Scales are more even this month. Strength: confident left-hand patterning.',
      'Action point: practise slow metronome work before increasing tempo.',
      'No exam mark awarded.',
    ].join('\n'),
    expected: {
      subjects: [
        { subject: 'Piano', teacher: 'Susan Wang', commentIncludes: 'Scales are more even this month', classification: 'instrumental' },
      ],
      comments: 1,
      predictedGrades: 0,
      needsReview: 0,
      confidence: 'High',
      shouldAffectAcademicPerformance: false,
    },
  },
];
