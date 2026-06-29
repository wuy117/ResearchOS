import type {
  Collection,
  DocumentMetadata,
  PerformanceRecord,
  ResearchDocument,
  ResearchState,
  TutorAttempt,
  TutorLesson,
} from '../types/research';

export type TimelineEvent = {
  id: string;
  date: string;
  academicYear: string;
  term: string;
  type: 'Upload' | 'Performance' | 'Tutor' | 'Study' | 'Knowledge';
  title: string;
  detail: string;
  subjects: string[];
};

const termPatterns: Array<[RegExp, string]> = [
  [/\b(autumn|fall|michaelmas)\b/i, 'Autumn'],
  [/\b(spring|lent)\b/i, 'Spring'],
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
  return unique([
    ...metadata.academicYears,
    ...metadata.terms.map((term) => `${term} ${metadata.academicYears[0] ?? ''}`),
    ...metadata.documentTypes,
    ...metadata.assessments,
    ...metadata.subjects,
    ...document.tags.filter((tag) => !/upload|failed/i.test(tag)).slice(0, 4),
  ]).slice(0, 10);
}

export function buildDocumentMetadata(document: ResearchDocument, performanceRecords: PerformanceRecord[] = []): DocumentMetadata {
  const sourceText = [document.title, document.summary, document.authors, document.tags.join(' '), document.extractedText?.slice(0, 8000)].filter(Boolean).join('\n');
  const linkedRecords = performanceRecords.filter((record) => record.sourceDocumentId === document.id);
  const subjects = unique([...linkedRecords.map((record) => record.subject), ...document.tags.filter((tag) => !/upload|failed/i.test(tag)).slice(0, 6)]);
  const topics = unique([...document.tags.filter((tag) => !/upload|failed/i.test(tag)), ...linkedRecords.flatMap((record) => [...record.strengths, ...record.weaknesses])]).slice(0, 12);
  const academicYears = unique([...linkedRecords.map((record) => record.academicYear), ...inferAcademicYears(sourceText)]);
  const terms = unique([...linkedRecords.map((record) => record.term), ...inferTerms(sourceText)]);
  const assessments = unique(linkedRecords.map((record) => record.title));
  const documentTypes = inferDocumentTypes(sourceText, document.type);
  const teacherNames = inferTeacherNames(sourceText);
  const skills = unique(linkedRecords.flatMap((record) => [...record.strengths, ...record.weaknesses, ...record.actionPoints])).slice(0, 12);
  const performanceRecordNames = linkedRecords.map((record) => record.title);
  const baseMetadata = {
    subjects,
    topics,
    academicYears,
    terms,
    assessments,
    documentTypes,
    teacherNames,
    skills,
    performanceRecords: performanceRecordNames,
  };

  return {
    ...baseMetadata,
    collections: inferCollections(document, baseMetadata),
    tags: unique([...document.tags, ...topics, ...subjects]),
  };
}

export function getDocumentMetadata(document: ResearchDocument, records: PerformanceRecord[] = []) {
  return document.metadata ?? buildDocumentMetadata(document, records);
}

export function deriveCollections(state: ResearchState): Collection[] {
  const existing = state.collections ?? [];
  const byName = new Map(existing.filter((collection) => collection.source !== 'metadata').map((collection) => [collection.name.toLowerCase(), collection]));
  const now = new Date().toISOString();

  state.documents.forEach((document) => {
    getDocumentMetadata(document, state.performanceRecords).collections.forEach((name) => {
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

  state.performanceRecords.forEach((record) => {
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

function getAcademicYearFromDate(date: string) {
  const parsed = new Date(date);
  if (Number.isNaN(parsed.getTime())) return 'Undated';
  const year = parsed.getFullYear();
  return parsed.getMonth() >= 8 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

function getTermFromDate(date: string) {
  const month = new Date(date).getMonth();
  if (Number.isNaN(month)) return 'Unsorted';
  if (month >= 8 || month <= 0) return 'Autumn';
  if (month <= 3) return 'Spring';
  return 'Summer';
}

export function buildTimelineEvents(state: ResearchState): TimelineEvent[] {
  const documentEvents = state.documents.map((document) => {
    const metadata = getDocumentMetadata(document, state.performanceRecords);
    return {
      id: `timeline-document-${document.id}`,
      date: document.addedAt,
      academicYear: metadata.academicYears[0] ?? getAcademicYearFromDate(document.addedAt),
      term: metadata.terms[0] ?? getTermFromDate(document.addedAt),
      type: 'Upload' as const,
      title: document.title,
      detail: `${document.status} source${metadata.collections.length ? ` in ${metadata.collections.slice(0, 3).join(', ')}` : ''}`,
      subjects: metadata.subjects,
    };
  });
  const performanceEvents = state.performanceRecords.map((record) => ({
    id: `timeline-performance-${record.id}`,
    date: record.date,
    academicYear: record.academicYear ?? getAcademicYearFromDate(record.date),
    term: record.term ?? getTermFromDate(record.date),
    type: 'Performance' as const,
    title: record.title,
    detail: [record.subject, record.grade, record.percentage !== undefined ? `${record.percentage}%` : undefined].filter(Boolean).join(' / '),
    subjects: [record.subject],
  }));
  const tutorEvents = state.tutorLessons.map((lesson: TutorLesson) => ({
    id: `timeline-tutor-${lesson.id}`,
    date: lesson.completedAt ?? lesson.createdAt,
    academicYear: getAcademicYearFromDate(lesson.completedAt ?? lesson.createdAt),
    term: getTermFromDate(lesson.completedAt ?? lesson.createdAt),
    type: 'Tutor' as const,
    title: lesson.status === 'completed' ? `Completed ${lesson.topic}` : `Started ${lesson.topic}`,
    detail: lesson.objective,
    subjects: [lesson.topic],
  }));
  const attemptEvents = state.tutorAttempts.slice(0, 20).map((attempt: TutorAttempt) => ({
    id: `timeline-study-${attempt.id}`,
    date: attempt.createdAt,
    academicYear: getAcademicYearFromDate(attempt.createdAt),
    term: getTermFromDate(attempt.createdAt),
    type: 'Study' as const,
    title: `${attempt.mode} practice: ${attempt.topic}`,
    detail: attempt.feedback,
    subjects: [attempt.topic],
  }));
  const knowledgeEvents = state.documents
    .filter((document) => document.status === 'Ready' || document.status === 'Indexed')
    .map((document) => ({
      id: `timeline-knowledge-${document.id}`,
      date: document.addedAt,
      academicYear: getAcademicYearFromDate(document.addedAt),
      term: getTermFromDate(document.addedAt),
      type: 'Knowledge' as const,
      title: `Mapped topics from ${document.title}`,
      detail: getDocumentMetadata(document, state.performanceRecords).topics.slice(0, 5).join(', ') || 'Ready for topic mapping',
      subjects: getDocumentMetadata(document, state.performanceRecords).subjects,
    }));

  return [...documentEvents, ...performanceEvents, ...tutorEvents, ...attemptEvents, ...knowledgeEvents].sort((a, b) => b.date.localeCompare(a.date));
}
