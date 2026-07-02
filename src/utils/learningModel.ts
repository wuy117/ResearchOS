import type {
  Collection,
  DocumentMetadata,
  PerformanceRecord,
  ResearchDocument,
  ResearchState,
} from '../types/research';

export type TimelineEvent = {
  id: string;
  date: string;
  sortKey: string;
  academicYear: string;
  term: string;
  type: 'Report' | 'Assessment' | 'Source';
  title: string;
  detail: string;
  subjects: string[];
  subjectRecords: Array<{
    id: string;
    subject: string;
    teacher?: string;
    teacherComment?: string;
    effort?: string;
    attainment?: string;
    percentage?: number;
    grade?: string;
    predictedGrade?: string;
    targetGrade?: string;
  }>;
};

const termPatterns: Array<[RegExp, string]> = [
  [/\b(autumn|fall|michaelmas)\b/i, 'Michaelmas'],
  [/\b(spring|lent)\b/i, 'Lent'],
  [/\b(summer|trinity)\b/i, 'Summer'],
  [/\b(term\s*[123])\b/i, '$1'],
];

const documentTypePatterns: Array<[RegExp, string]> = [
  [/\b(report|teacher comment|progress review)\b/i, 'Teacher report'],
  [/\b(exam|mock|assessment|test)\b/i, 'Assessment'],
  [/\b(coursework|essay|project)\b/i, 'Coursework'],
  [/\b(notes?|worksheet|handout)\b/i, 'Notes'],
];

function unique(values: Array<string | undefined | null>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function safeStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function titleCase(value: string) {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase());
}

function inferAcademicYears(text: string) {
  const yearPairs = [...text.matchAll(/\b(20\d{2})\s*[-/]\s*(\d{2}|20\d{2})\b/g)].map((match) => {
    const end = match[2].length === 2 ? `20${match[2]}` : match[2];
    return `${match[1]}-${end}`;
  });
  const singleYears = [...text.matchAll(/\b(20\d{2})\b/g)].map((match) => match[1]);
  return unique([...yearPairs, ...singleYears]).slice(0, 4);
}

function inferTerms(text: string) {
  return unique(
    termPatterns.map(([pattern, label]) => {
      const match = text.match(pattern);
      return match ? titleCase(label.replace('$1', match[1] ?? label)) : undefined;
    }),
  );
}

function inferDocumentTypes(text: string, fallbackType: ResearchDocument['type']) {
  const types = documentTypePatterns.flatMap(([pattern, label]) => (pattern.test(text) ? [label] : []));
  return unique([...types, fallbackType]);
}

function inferTeacherNames(text: string) {
  const names = [...text.matchAll(/\b(?:Mr|Mrs|Ms|Miss|Dr)\.?\s+[A-Z][a-z]+(?:\s+[A-Z][a-z]+)?\b/g)].map((match) => match[0].replace(/\./g, ''));
  return unique(names).slice(0, 6);
}

function inferCollections(document: ResearchDocument, metadata: Omit<DocumentMetadata, 'collections' | 'tags'>) {
  const documentTags = safeStringArray(document.tags);

  return unique([
    metadata.documentCategory,
    metadata.term,
    metadata.academicYear,
    metadata.linkedAssessmentName,
    ...safeStringArray(metadata.academicYears),
    ...safeStringArray(metadata.terms).map((term) => `${term} ${safeStringArray(metadata.academicYears)[0] ?? ''}`),
    ...safeStringArray(metadata.documentTypes),
    ...safeStringArray(metadata.assessments),
    ...safeStringArray(metadata.subjects),
    ...documentTags.filter((tag) => !/upload|failed/i.test(tag)).slice(0, 4),
  ]).slice(0, 10);
}

export function buildDocumentMetadata(document: ResearchDocument, performanceRecords: PerformanceRecord[] = []): DocumentMetadata {
  const documentTags = safeStringArray(document.tags);
  const safeRecords = Array.isArray(performanceRecords) ? performanceRecords : [];
  const sourceText = [document.title, document.summary, document.authors, documentTags.join(' '), document.extractedText?.slice(0, 8000)].filter(Boolean).join('\n');
  const linkedRecords = safeRecords.filter((record) => record.sourceDocumentId === document.id);
  const subjects = unique([...linkedRecords.map((record) => record.subject), ...documentTags.filter((tag) => !/upload|failed/i.test(tag)).slice(0, 6)]);
  const topics = unique([...documentTags.filter((tag) => !/upload|failed/i.test(tag)), ...linkedRecords.flatMap((record) => [...safeStringArray(record.strengths), ...safeStringArray(record.weaknesses)])]).slice(0, 12);
  const academicYears = unique([...linkedRecords.map((record) => record.academicYear), ...inferAcademicYears(sourceText)]);
  const terms = unique([...linkedRecords.map((record) => record.term), ...inferTerms(sourceText)]);
  const assessments = unique(linkedRecords.map((record) => record.title));
  const documentTypes = inferDocumentTypes(sourceText, document.type);
  const teacherNames = inferTeacherNames(sourceText);
  const skills = unique(linkedRecords.flatMap((record) => [...safeStringArray(record.strengths), ...safeStringArray(record.weaknesses), ...safeStringArray(record.actionPoints)])).slice(0, 12);
  const performanceRecordNames = linkedRecords.map((record) => record.title);
  const baseMetadata = {
    sourceDate: document.metadata?.sourceDate,
    academicYear: document.metadata?.academicYear,
    term: document.metadata?.term,
    linkedAssessmentName: document.metadata?.linkedAssessmentName,
    documentCategory: document.metadata?.documentCategory,
    ignoreInstrumentalMusic: document.metadata?.ignoreInstrumentalMusic ?? false,
    metadataConfidence: document.metadata?.metadataConfidence,
    metadataSource: document.metadata?.metadataSource,
    shouldAffectAcademicPerformance: document.metadata?.shouldAffectAcademicPerformance,
    extractedFacts: document.metadata?.extractedFacts ?? [],
    inferredMetadata: document.metadata?.inferredMetadata ?? [],
    subjects: unique([...(document.metadata?.subjects ?? []), ...subjects]),
    topics: unique([...(document.metadata?.topics ?? []), ...topics]),
    academicYears: unique([document.metadata?.academicYear, ...academicYears]),
    terms: unique([document.metadata?.term, ...terms]),
    assessments: unique([document.metadata?.linkedAssessmentName, ...assessments]),
    documentTypes: unique([document.metadata?.documentCategory, ...documentTypes]),
    teacherNames: unique([...(document.metadata?.teacherNames ?? []), ...teacherNames]),
    skills: unique([...(document.metadata?.skills ?? []), ...skills]),
    performanceRecords: performanceRecordNames,
  };

  return {
    ...baseMetadata,
    collections: inferCollections(document, baseMetadata),
    tags: unique([...documentTags, ...topics, ...subjects]),
  };
}

export function getDocumentMetadata(document: ResearchDocument, records: PerformanceRecord[] = []) {
  return document.metadata ?? buildDocumentMetadata(document, records);
}

export function deriveCollections(state: ResearchState): Collection[] {
  const existing = Array.isArray(state.collections) ? state.collections : [];
  const byName = new Map(existing.filter((collection) => collection.source !== 'metadata').map((collection) => [collection.name.toLowerCase(), collection]));
  const now = new Date().toISOString();

  const documents = Array.isArray(state.documents) ? state.documents : [];
  const performanceRecords = Array.isArray(state.performanceRecords) ? state.performanceRecords : [];

  documents.forEach((document) => {
    safeStringArray(getDocumentMetadata(document, performanceRecords).collections).forEach((name) => {
      if (!byName.has(name.toLowerCase())) {
        byName.set(name.toLowerCase(), {
          id: `collection-${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
          name,
          source: 'metadata',
          createdAt: document.addedAt || now,
        });
      }
    });
  });

  performanceRecords.forEach((record) => {
    [record.subject, record.academicYear, record.term, record.assessmentType].filter(Boolean).forEach((name) => {
      const label = titleCase(String(name));
      if (!byName.has(label.toLowerCase())) {
        byName.set(label.toLowerCase(), {
          id: `collection-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`,
          name: label,
          source: 'metadata',
          createdAt: record.createdAt,
        });
      }
    });
  });

  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function getCollectionDocumentCount(collection: Collection, documents: ResearchDocument[], records: PerformanceRecord[]) {
  const name = collection.name.toLowerCase();
  return documents.filter((document) => getDocumentMetadata(document, records).collections.some((item) => item.toLowerCase() === name)).length;
}

function parseDateValue(date: string) {
  const value = date.trim();
  const isoMatch = value.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (isoMatch) {
    return Date.UTC(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
  }

  const ukMatch = value.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})$/);
  if (ukMatch) {
    const year = Number(ukMatch[3].length === 2 ? `20${ukMatch[3]}` : ukMatch[3]);
    return Date.UTC(year, Number(ukMatch[2]) - 1, Number(ukMatch[1]));
  }

  const parsed = new Date(date).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function hasExactDate(date?: string) {
  return Boolean(date?.trim() && parseDateValue(date) > 0);
}

function formatDateLabel(date: string) {
  const time = parseDateValue(date);
  if (!time) return date || 'Undated';
  return new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }).format(new Date(time));
}

function getAcademicYearFromDate(date: string) {
  const time = parseDateValue(date);
  if (!time) return 'Undated';
  const parsed = new Date(time);
  if (Number.isNaN(parsed.getTime())) return 'Undated';
  const year = parsed.getFullYear();
  return parsed.getMonth() >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

function getTermFromDate(date: string) {
  const time = parseDateValue(date);
  if (!time) return 'Unsorted';
  const month = new Date(time).getMonth();
  if (Number.isNaN(month)) return 'Unsorted';
  if (month >= 8 || month <= 0) return 'Michaelmas';
  if (month <= 3) return 'Lent';
  return 'Summer';
}

function getAcademicYearSortValue(academicYear?: string) {
  const match = academicYear?.match(/\b(20\d{2})\b/);
  return match ? Number(match[1]) : 0;
}

function getTermSortValue(term?: string) {
  const normalized = term?.toLowerCase() ?? '';
  if (normalized.includes('michaelmas') || normalized.includes('autumn')) return 1;
  if (normalized.includes('lent') || normalized.includes('spring')) return 2;
  if (normalized.includes('summer') || normalized.includes('trinity')) return 3;
  return 4;
}

function normalizeSortText(value?: string) {
  return (value ?? '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function getAcademicSortKey({ exactDate, academicYear, term, assessmentName, fallbackTime }: { exactDate?: string; academicYear?: string; term?: string; assessmentName?: string; fallbackTime?: string }) {
  if (hasExactDate(exactDate)) {
    const exactTime = parseDateValue(exactDate ?? '');
    return [
      String(getAcademicYearSortValue(getAcademicYearFromDate(exactDate ?? ''))).padStart(4, '0'),
      String(getTermSortValue(getTermFromDate(exactDate ?? ''))).padStart(2, '0'),
      '0',
      String(exactTime).padStart(16, '0'),
    ].join('|');
  }

  return [
    String(getAcademicYearSortValue(academicYear)).padStart(4, '0'),
    String(getTermSortValue(term)).padStart(2, '0'),
    '1',
    normalizeSortText(assessmentName),
    fallbackTime ?? '',
  ].join('|');
}

function getAcademicTimeLabel({ exactDate, academicYear, term, assessmentName }: { exactDate?: string; academicYear?: string; term?: string; assessmentName?: string }) {
  if (hasExactDate(exactDate)) return formatDateLabel(exactDate ?? '');
  const label = [assessmentName || term, academicYear].filter(Boolean).join('\n');
  return label || 'Undated';
}

export function buildTimelineEvents(state: ResearchState): TimelineEvent[] {
  const documentEvents = state.documents.map((document) => {
    const metadata = getDocumentMetadata(document, state.performanceRecords);
    const linkedRecords = state.performanceRecords.filter((record) => record.sourceDocumentId === document.id);
    const academicYear = metadata.academicYear ?? metadata.academicYears[0] ?? getAcademicYearFromDate(document.addedAt);
    const term = metadata.term ?? metadata.terms[0] ?? getTermFromDate(document.addedAt);
    const assessmentName = metadata.linkedAssessmentName ?? metadata.assessments[0] ?? document.title;
    const subjects = unique([...metadata.subjects, ...linkedRecords.map((record) => record.subject)]);
    const eventType: TimelineEvent['type'] = metadata.documentCategory === 'Report'
      ? 'Report'
      : metadata.documentCategory === 'Exam result' || metadata.documentCategory === 'Mark sheet'
        ? 'Assessment'
        : 'Source';
    return {
      id: `timeline-document-${document.id}`,
      date: getAcademicTimeLabel({ exactDate: metadata.sourceDate, academicYear, term, assessmentName }),
      sortKey: getAcademicSortKey({ exactDate: metadata.sourceDate, academicYear, term, assessmentName, fallbackTime: document.addedAt }),
      academicYear,
      term,
      type: eventType,
      title: assessmentName || document.title,
      detail: [document.title, metadata.documentCategory, subjects.length ? `${subjects.length} subject${subjects.length === 1 ? '' : 's'}` : undefined].filter(Boolean).join(' / '),
      subjects,
      subjectRecords: linkedRecords.map((record) => ({
        id: record.id,
        subject: record.subject,
        teacher: record.teacher,
        teacherComment: record.teacherComment,
        effort: record.effort,
        attainment: record.attainment,
        percentage: typeof record.percentage === 'number' ? record.percentage : typeof record.score === 'number' && typeof record.maxScore === 'number' && record.maxScore > 0 ? Math.round((record.score / record.maxScore) * 100) : undefined,
        grade: record.grade,
        predictedGrade: record.predictedGrade,
        targetGrade: record.targetGrade,
      })),
    };
  });

  return documentEvents.sort((a, b) => b.sortKey.localeCompare(a.sortKey));
}
