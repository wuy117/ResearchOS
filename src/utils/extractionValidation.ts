import type {
  AssessmentType,
  ExtractionConfidence,
  ExtractionFieldConfidence,
  PerformanceRecord,
} from '../types/research';

export type ExtractionClassification = 'academic' | 'instrumental';

export type ValidatedExtractionRecord = {
  subject: string;
  teacher?: string;
  teacherComment?: string;
  percentage?: number;
  grade?: string;
  effort?: string;
  attainment?: string;
  predictedGrade?: string;
  targetGrade?: string;
  rank?: string;
  rawEvidence: string[];
  confidence: ExtractionConfidence;
  confidenceReasons: string[];
  fieldConfidence: ExtractionFieldConfidence;
  needsReviewReason?: string;
  classification: ExtractionClassification;
  excludeFromAcademicAnalysis: boolean;
};

export type ExtractionQualityReport = {
  expectedSubjects?: number;
  subjectsFound: number;
  subjectsMatched: number;
  marksFound: number;
  teachersFound: number;
  commentsLinked: number;
  gradesFound: number;
  effortFound: number;
  attainmentFound: number;
  targetsFound: number;
  predictedGradesFound: number;
  duplicateRows: number;
  excludedInstrumentalRecords: number;
  needsReview: number;
  ocrConsistency: 'Excellent' | 'Good' | 'Poor';
  confidence: ExtractionConfidence;
  confidenceReasons: string[];
  potentialProblems: string[];
};

export type ExtractionTimings = {
  ocrMs: number;
  extractionMs: number;
  aiLatencyMs: number;
  validationMs: number;
  totalMs: number;
  aiCalls: number;
};

export type LocalExtractionResult = {
  records: ValidatedExtractionRecord[];
  metadata: {
    term?: string;
    academicYear?: string;
    linkedAssessmentName: string;
    documentCategory: 'Report' | 'Exam result' | 'Mark sheet' | 'Other';
    shouldAffectAcademicPerformance: boolean;
    ignoreInstrumentalMusic: boolean;
  };
  warnings: string[];
  duplicateRows: number;
  quality: ExtractionQualityReport;
  timings: ExtractionTimings;
};

type CandidateRecord = Omit<ValidatedExtractionRecord, 'confidence' | 'confidenceReasons' | 'fieldConfidence' | 'classification' | 'excludeFromAcademicAnalysis'> & {
  warnings: string[];
  rowIntact: boolean;
  invalidPercentage?: number;
};

export type ExternalExtractionRecord = {
  subject?: unknown;
  teacher?: unknown;
  teacherComment?: unknown;
  percentage?: unknown;
  grade?: unknown;
  effort?: unknown;
  attainment?: unknown;
  predictedGrade?: unknown;
  targetGrade?: unknown;
  target?: unknown;
  rank?: unknown;
  rawEvidence?: unknown;
  needsReviewReason?: unknown;
};

const academicSubjects = [
  'English Literature',
  'Computer Science',
  'Religious Studies',
  'Physical Education',
  'Composition Coursework',
  'Music Appraising',
  'English Language',
  'Mathematics',
  'Geography',
  'Chemistry',
  'Biology',
  'Physics',
  'History',
  'French',
  'Spanish',
  'German',
  'Mandarin',
  'Classics',
  'Latin',
  'Drama',
  'Art',
  'Music',
  'English',
].sort((a, b) => b.length - a.length);

const instrumentalSubjects = [
  'French Horn',
  'Double Bass',
  'Saxophone',
  'Clarinet',
  'Trumpet',
  'Violin',
  'Cello',
  'Flute',
  'Guitar',
  'Piano',
  'Organ',
  'Singing',
  'Voice',
  'Drums',
].sort((a, b) => b.length - a.length);

const allSubjects = [...academicSubjects, ...instrumentalSubjects].sort((a, b) => b.length - a.length);

function nowMs() {
  return typeof performance !== 'undefined' && typeof performance.now === 'function' ? performance.now() : Date.now();
}

function unique(values: Array<string | undefined | null>) {
  return [...new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))];
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function canonicalSubject(value: string) {
  return value.toLowerCase().replace(/\bgcse\b/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
}

export function normalizeOcrText(text: string) {
  return text
    .normalize('NFKC')
    .replace(/\r\n?/g, '\n')
    .replace(/([A-Za-z])-\s*\n\s*([A-Za-z])/g, '$1$2')
    .replace(/\bunder-standing\b/gi, 'understanding')
    .replace(/\b(\d*)[Oo](\d*)\s*%/g, (_match, before: string, after: string) => `${before}0${after}%`)
    .replace(/[ \t]+/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function classifyMusicRecord(subject: string, context = ''): ExtractionClassification {
  const value = `${subject} ${context}`.toLowerCase();
  const explicitlyAcademic = /\b(gcse|a[ -]?level|appraising|composition|coursework|set works?|music theory|listening (?:paper|exam|assessment)|academic report)\b/.test(value);
  const explicitlyInstrumental = /\b(abrsm|trinity|instrumental|lesson|graded instrument|ensemble|orchestra|choir|piano|violin|cello|flute|clarinet|saxophone|trumpet|guitar|organ|singing|vocal|voice|drums?)\b/.test(value);

  return explicitlyInstrumental && !explicitlyAcademic ? 'instrumental' : 'academic';
}

function inferMetadata(title: string, text: string) {
  const source = `${title}\n${text.slice(0, 800)}`;
  const yearMatch = source.match(/\b(20\d{2})\s*[-/]\s*(\d{2}|20\d{2})\b/);
  const academicYear = yearMatch
    ? `${yearMatch[1]}-${yearMatch[2].length === 2 ? `20${yearMatch[2]}` : yearMatch[2]}`
    : undefined;
  const term = /\b(michaelmas|autumn)\b/i.test(source)
    ? 'Michaelmas'
    : /\b(lent|spring)\b/i.test(source)
      ? 'Lent'
      : /\b(summer|trinity)\b/i.test(source)
        ? 'Summer'
        : undefined;
  const documentCategory = /\bmock results?|exam results?\b/i.test(source)
    ? 'Exam result'
    : /\bmarks?\s*(?:only|sheet)\b/i.test(source)
      ? 'Mark sheet'
      : /\breport\b/i.test(source)
        ? 'Report'
        : 'Other';

  return { academicYear, term, documentCategory } as const;
}

function findSubjectOccurrences(line: string) {
  const matches: Array<{ subject: string; index: number }> = [];

  allSubjects.forEach((subject) => {
    const regex = new RegExp(`\\b${escapeRegExp(subject)}\\b`, 'gi');
    let match: RegExpExecArray | null;
    while ((match = regex.exec(line))) {
      if (!matches.some((existing) => match && existing.index === match.index)) {
        matches.push({ subject, index: match.index });
      }
    }
  });

  return matches.sort((a, b) => a.index - b.index);
}

function splitMergedSubjectLine(line: string) {
  const occurrences = findSubjectOccurrences(line);
  if (occurrences.length <= 1) return [{ line, merged: false }];

  return occurrences.map((occurrence, index) => ({
    line: line.slice(occurrence.index, occurrences[index + 1]?.index ?? line.length).trim(),
    merged: true,
  }));
}

function detectSubject(line: string) {
  const pipeCandidate = line.split('|')[0]?.trim().replace(/\s+-$/, '');
  const exactPipeSubject = allSubjects.find((subject) => pipeCandidate?.toLowerCase() === subject.toLowerCase());
  if (exactPipeSubject) return exactPipeSubject;

  return findSubjectOccurrences(line).find((match) => match.index <= 8)?.subject;
}

function extractLabelValue(line: string, label: string) {
  const match = line.match(new RegExp(`\\b${label}\\s*:\\s*([^|]+)`, 'i'));
  return match?.[1]?.trim();
}

function cleanComment(value?: string) {
  if (!value) return undefined;
  const cleaned = value
    .replace(/^[-|:;\s]+/, '')
    .replace(/\bno mark shown\.?$/i, '')
    .replace(/\s+/g, ' ')
    .trim();
  return cleaned || undefined;
}

function optionalString(value: unknown) {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function optionalStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())).map((item) => item.trim()) : [];
}

function parseCandidate(segment: string, subject: string, context: string, merged: boolean, hadOcrSubstitution: boolean): CandidateRecord {
  const warnings: string[] = [];
  const rawEvidence = [segment];
  const labelledTeacher = extractLabelValue(segment, 'Teacher');
  const titledTeacher = segment.match(/\b(?:Mr|Mrs|Ms|Miss|Dr|Mme)\.?\s+[A-Z][A-Za-z?'-]+(?:\s+[A-Z][A-Za-z?'-]+)?/i)?.[0];
  const teacher = (labelledTeacher ?? titledTeacher)?.replace(/\s+comment$/i, '').trim();
  const percentageToken = segment.match(/\b(\d{1,3})\s*%/);
  const parsedPercentage = percentageToken ? Number(percentageToken[1]) : undefined;
  const invalidPercentage = parsedPercentage !== undefined && (parsedPercentage < 0 || parsedPercentage > 100) ? parsedPercentage : undefined;
  const percentage = invalidPercentage === undefined ? parsedPercentage : undefined;
  const grade = segment.match(/\bGrade\s*:?\s*([A-Z*+\-]|\d{1,2})\b/i)?.[1]
    ?? segment.match(/\bGrade\s+([A-Z*+\-]|\d{1,2})\b/i)?.[1];
  const effort = extractLabelValue(segment, 'Effort');
  const attainment = extractLabelValue(segment, 'Attainment');
  const predictedGrade = segment.match(/\bPredicted(?:\s+grade)?\s*:\s*([^|,;]+)/i)?.[1]?.trim();
  const targetGrade = segment.match(/\bTarget(?:\s+grade)?\s*:\s*([A-Z*+\-]|\d{1,2})\b/i)?.[1]?.trim();
  const rank = segment.match(/\bRank\s*:?\s*([^|,;]+)/i)?.[1]?.trim()
    ?? segment.match(/\bRank\s+(\d+\s*\/\s*\d+)/i)?.[1]?.trim();
  const explicitComment = segment.match(/\bComment\s*:\s*(.*)$/i)?.[1];

  let teacherComment = cleanComment(explicitComment);
  if (!teacherComment && !segment.includes('|')) {
    const fieldMatches = [
      titledTeacher ? { index: segment.indexOf(titledTeacher), length: titledTeacher.length } : undefined,
      percentageToken ? { index: percentageToken.index ?? 0, length: percentageToken[0].length } : undefined,
      ...[...segment.matchAll(/\b(?:Grade\s+\S+|Rank\s+\S+|Target\s*:\s*\S+|Predicted\s*:\s*\S+)\b/gi)].map((match) => ({ index: match.index ?? 0, length: match[0].length })),
    ].filter((match): match is { index: number; length: number } => Boolean(match));
    const endOfFields = fieldMatches.reduce((end, match) => Math.max(end, match.index + match.length), subject.length);
    teacherComment = cleanComment(segment.slice(endOfFields));
  }

  if (merged) warnings.push('Merged OCR row detected');
  if (hadOcrSubstitution && /\d0\d*%|\d+0%/.test(segment)) warnings.push('OCR character substitution repaired');
  if (invalidPercentage !== undefined) warnings.push('Impossible percentage rejected');
  if (teacher?.includes('?')) warnings.push('Teacher name contains uncertain OCR characters');

  return {
    subject,
    teacher,
    teacherComment,
    percentage,
    grade,
    effort,
    attainment,
    predictedGrade,
    targetGrade,
    rank,
    rawEvidence,
    warnings,
    rowIntact: !merged,
    invalidPercentage,
    needsReviewReason: invalidPercentage !== undefined ? `Impossible percentage ${invalidPercentage}% was rejected.` : undefined,
  };
}

function appendContinuation(record: CandidateRecord, line: string) {
  const explicitComment = line.match(/\bComment\s*:\s*(.*)$/i)?.[1];
  const targetGrade = line.match(/^Target(?:\s+grade)?\s*:\s*([A-Z*+\-]|\d{1,2})\s*$/i)?.[1];
  const predictedGrade = line.match(/^Predicted(?:\s+grade)?\s*:\s*([A-Z*+\-]|\d{1,2})\s*$/i)?.[1];

  if (targetGrade) record.targetGrade = targetGrade;
  else if (predictedGrade) record.predictedGrade = predictedGrade;
  else if (!/^Action point\s*:/i.test(line) && !/^No exam mark awarded/i.test(line)) {
    const continuation = cleanComment(explicitComment ?? line);
    if (continuation) record.teacherComment = [record.teacherComment, continuation].filter(Boolean).join(' ');
  }
  record.rawEvidence.push(line);
}

export function evaluateEvidenceConfidence(record: Pick<CandidateRecord, 'subject' | 'teacher' | 'teacherComment' | 'percentage' | 'grade' | 'effort' | 'attainment' | 'predictedGrade' | 'targetGrade' | 'warnings' | 'rowIntact' | 'invalidPercentage'>) {
  const reasons: string[] = [];
  let score = 0;

  if (record.subject.trim()) {
    score += 2;
    reasons.push('Subject recognised');
  } else {
    reasons.push('Subject missing');
  }
  if (record.percentage !== undefined) {
    score += 2;
    reasons.push('Percentage is valid');
  }
  if (record.grade || record.effort || record.attainment || record.predictedGrade || record.targetGrade) {
    score += 1;
    reasons.push('Structured attainment evidence found');
  }
  if (record.teacher && !record.teacher.includes('?')) {
    score += 1;
    reasons.push('Teacher recognised');
  }
  if (record.teacherComment) {
    score += 1;
    reasons.push('Comment linked to subject');
  }
  if (record.rowIntact) {
    score += 1;
    reasons.push('Row structure intact');
  } else {
    score -= 1;
    reasons.push('Merged OCR row repaired');
  }
  if (record.warnings.includes('OCR character substitution repaired')) {
    score -= 1;
    reasons.push('OCR character substitution required');
  }
  if (record.invalidPercentage !== undefined) {
    score -= 4;
    reasons.push('Impossible percentage rejected');
  }
  if (record.teacher?.includes('?')) {
    score -= 2;
    reasons.push('Teacher name uncertain');
  }

  const confidence: ExtractionConfidence = record.invalidPercentage !== undefined || score < 2
    ? 'Low'
    : score >= 5 && !record.warnings.includes('OCR character substitution repaired')
      ? 'High'
      : 'Medium';

  return { confidence, reasons };
}

function toValidatedRecord(candidate: CandidateRecord, context: string): ValidatedExtractionRecord {
  const { confidence, reasons } = evaluateEvidenceConfidence(candidate);
  const classification = classifyMusicRecord(candidate.subject, context);
  const valueConfidence = confidence === 'Low' ? 'Low' : candidate.warnings.length ? 'Medium' : 'High';
  const fieldConfidence: ExtractionFieldConfidence = {
    subject: candidate.subject ? 'High' : 'Low',
    teacher: candidate.teacher ? (candidate.teacher.includes('?') ? 'Low' : valueConfidence) : undefined,
    teacherComment: candidate.teacherComment ? valueConfidence : undefined,
    percentage: candidate.percentage !== undefined ? valueConfidence : candidate.invalidPercentage !== undefined ? 'Low' : undefined,
    grade: candidate.grade ? valueConfidence : undefined,
    effort: candidate.effort ? valueConfidence : undefined,
    attainment: candidate.attainment ? valueConfidence : undefined,
    predictedGrade: candidate.predictedGrade ? valueConfidence : undefined,
    targetGrade: candidate.targetGrade ? valueConfidence : undefined,
    rank: candidate.rank ? valueConfidence : undefined,
  };

  return {
    subject: candidate.subject,
    teacher: candidate.teacher,
    teacherComment: candidate.teacherComment,
    percentage: candidate.percentage,
    grade: candidate.grade,
    effort: candidate.effort,
    attainment: candidate.attainment,
    predictedGrade: candidate.predictedGrade,
    targetGrade: candidate.targetGrade,
    rank: candidate.rank,
    rawEvidence: candidate.rawEvidence,
    confidence,
    confidenceReasons: reasons,
    fieldConfidence,
    needsReviewReason: candidate.needsReviewReason ?? (confidence === 'Low' ? reasons.filter((reason) => /missing|uncertain|impossible|merged/i.test(reason)).join('; ') : undefined),
    classification,
    excludeFromAcademicAnalysis: classification === 'instrumental' || confidence === 'Low',
  };
}

function mergeRecords(existing: ValidatedExtractionRecord, next: ValidatedExtractionRecord) {
  const conflictingPercentage = existing.percentage !== undefined && next.percentage !== undefined && existing.percentage !== next.percentage;
  const confidence: ExtractionConfidence = conflictingPercentage ? 'Low' : existing.confidence === 'Low' || next.confidence === 'Low' ? 'Low' : existing.confidence === 'Medium' || next.confidence === 'Medium' ? 'Medium' : 'High';

  return {
    ...existing,
    teacher: existing.teacher ?? next.teacher,
    teacherComment: unique([existing.teacherComment, next.teacherComment]).join(' ') || undefined,
    percentage: existing.percentage ?? next.percentage,
    grade: existing.grade ?? next.grade,
    effort: existing.effort ?? next.effort,
    attainment: existing.attainment ?? next.attainment,
    predictedGrade: existing.predictedGrade ?? next.predictedGrade,
    targetGrade: existing.targetGrade ?? next.targetGrade,
    rank: existing.rank ?? next.rank,
    rawEvidence: unique([...existing.rawEvidence, ...next.rawEvidence]),
    confidence,
    confidenceReasons: unique([
      ...existing.confidenceReasons,
      ...next.confidenceReasons,
      conflictingPercentage ? 'Contradictory percentage values detected' : undefined,
      'Duplicate subject rows merged',
    ]),
    fieldConfidence: {
      ...next.fieldConfidence,
      ...existing.fieldConfidence,
      percentage: conflictingPercentage ? 'Low' : existing.fieldConfidence.percentage ?? next.fieldConfidence.percentage,
    },
    needsReviewReason: conflictingPercentage ? 'Contradictory percentage values were found for the same subject.' : existing.needsReviewReason ?? next.needsReviewReason,
    excludeFromAcademicAnalysis: existing.excludeFromAcademicAnalysis || next.excludeFromAcademicAnalysis || conflictingPercentage,
  } satisfies ValidatedExtractionRecord;
}

export function deduplicateExtractionRecords(records: ValidatedExtractionRecord[]) {
  const ordered: ValidatedExtractionRecord[] = [];
  const indexBySubject = new Map<string, number>();
  let duplicateRows = 0;

  records.forEach((record) => {
    const key = canonicalSubject(record.subject);
    const existingIndex = indexBySubject.get(key);
    if (existingIndex === undefined) {
      indexBySubject.set(key, ordered.length);
      ordered.push(record);
      return;
    }

    duplicateRows += 1;
    ordered[existingIndex] = mergeRecords(ordered[existingIndex], record);
  });

  return { records: ordered, duplicateRows };
}

export function shouldRecordNeedReview(record: Pick<ValidatedExtractionRecord, 'subject' | 'percentage' | 'confidence' | 'needsReviewReason' | 'fieldConfidence'>) {
  if (!record.subject.trim() || record.confidence === 'Low' || record.needsReviewReason) return true;
  if (record.percentage !== undefined && (record.percentage < 0 || record.percentage > 100)) return true;
  return Object.values(record.fieldConfidence).some((value) => value === 'Low');
}

export function buildExtractionQualityReport(
  records: ValidatedExtractionRecord[],
  options: { expectedSubjects?: number; duplicateRows?: number; warnings?: string[] } = {},
): ExtractionQualityReport {
  const warnings = unique(options.warnings ?? []);
  const needsReview = records.filter(shouldRecordNeedReview).length;
  const confidence: ExtractionConfidence = needsReview || warnings.some((warning) => /impossible|contradictory|missing subject/i.test(warning))
    ? 'Low'
    : warnings.length || records.some((record) => record.confidence === 'Medium')
      ? 'Medium'
      : records.length
        ? 'High'
        : 'Low';
  const expectedSubjects = options.expectedSubjects;
  const subjectsMatched = expectedSubjects === undefined ? records.length : Math.min(expectedSubjects, records.length);
  const potentialProblems = unique([
    ...warnings,
    expectedSubjects !== undefined && records.length < expectedSubjects ? `${expectedSubjects - records.length} expected subject(s) missing` : undefined,
    options.duplicateRows ? `${options.duplicateRows} duplicate row(s) merged` : undefined,
    ...records.map((record) => record.needsReviewReason),
  ]);

  return {
    expectedSubjects,
    subjectsFound: records.length,
    subjectsMatched,
    marksFound: records.filter((record) => record.percentage !== undefined).length,
    teachersFound: records.filter((record) => record.teacher).length,
    commentsLinked: records.filter((record) => record.teacherComment).length,
    gradesFound: records.filter((record) => record.grade).length,
    effortFound: records.filter((record) => record.effort).length,
    attainmentFound: records.filter((record) => record.attainment).length,
    targetsFound: records.filter((record) => record.targetGrade).length,
    predictedGradesFound: records.filter((record) => record.predictedGrade).length,
    duplicateRows: options.duplicateRows ?? 0,
    excludedInstrumentalRecords: records.filter((record) => record.classification === 'instrumental').length,
    needsReview,
    ocrConsistency: warnings.some((warning) => /merged|impossible|contradictory/i.test(warning)) ? 'Poor' : warnings.length ? 'Good' : 'Excellent',
    confidence,
    confidenceReasons: unique(records.flatMap((record) => record.confidenceReasons)).slice(0, 8),
    potentialProblems,
  };
}

export function parseReportText(title: string, rawText: string) {
  const hadOcrSubstitution = /\b\d*[Oo]\d*\s*%|REP0RT/i.test(rawText);
  const text = normalizeOcrText(rawText);
  const lines = text.split('\n').map((line) => line.trim()).filter(Boolean);
  const context = `${title}\n${text}`;
  const candidates: CandidateRecord[] = [];
  const warnings: string[] = [];
  let current: CandidateRecord | undefined;

  const flushCurrent = () => {
    if (current) candidates.push(current);
    current = undefined;
  };

  lines.forEach((line) => {
    const isHeader = /\brep(?:o|0)rt\b/i.test(line) && !/%|teacher\s*:|comment\s*:/i.test(line);
    if (isHeader) {
      if (/\blesson\b/i.test(line)) {
        const subject = detectSubject(line);
        if (subject) {
          flushCurrent();
          current = parseCandidate(line, subject, context, false, hadOcrSubstitution);
        }
      }
      return;
    }

    if (/^Teacher\s*:/i.test(line) && current) {
      current.teacher = extractLabelValue(line, 'Teacher');
      current.rawEvidence.push(line);
      return;
    }

    const segments = splitMergedSubjectLine(line);
    const detectedSegments = segments
      .map((segment) => ({ ...segment, subject: detectSubject(segment.line) }))
      .filter((segment): segment is { line: string; merged: boolean; subject: string } => Boolean(segment.subject));

    if (detectedSegments.length) {
      flushCurrent();
      detectedSegments.forEach((segment, index) => {
        const candidate = parseCandidate(segment.line, segment.subject, context, segment.merged, hadOcrSubstitution);
        warnings.push(...candidate.warnings);
        if (index < detectedSegments.length - 1) candidates.push(candidate);
        else current = candidate;
      });
      return;
    }

    if (current && !/^(?:academic year|subj\s+tchr)/i.test(line)) appendContinuation(current, line);
  });
  flushCurrent();

  const validated = candidates.map((candidate) => toValidatedRecord(candidate, context));
  const deduplicated = deduplicateExtractionRecords(validated);
  return {
    text,
    records: deduplicated.records,
    warnings: unique([...warnings, ...(hadOcrSubstitution ? ['OCR character substitution repaired'] : [])]),
    duplicateRows: deduplicated.duplicateRows,
  };
}

export function validateExternalExtractionRecords(records: ExternalExtractionRecord[], context: string) {
  const warnings: string[] = [];
  const validated = records
    .map((record) => {
      const subject = optionalString(record.subject);
      if (!subject) {
        warnings.push('Missing subject rejected');
        return undefined;
      }
      const rawPercentage = typeof record.percentage === 'number' && Number.isFinite(record.percentage) ? record.percentage : undefined;
      const invalidPercentage = rawPercentage !== undefined && (rawPercentage < 0 || rawPercentage > 100) ? rawPercentage : undefined;
      const needsReviewReason = optionalString(record.needsReviewReason);
      const candidateWarnings = unique([
        invalidPercentage !== undefined ? 'Impossible percentage rejected' : undefined,
        needsReviewReason && /merged/i.test(needsReviewReason) ? 'Merged OCR row detected' : undefined,
        needsReviewReason && /contradict/i.test(needsReviewReason) ? 'Contradictory values detected' : undefined,
      ]);
      warnings.push(...candidateWarnings);
      const candidate: CandidateRecord = {
        subject,
        teacher: optionalString(record.teacher),
        teacherComment: optionalString(record.teacherComment),
        percentage: invalidPercentage === undefined ? rawPercentage : undefined,
        grade: optionalString(record.grade),
        effort: optionalString(record.effort),
        attainment: optionalString(record.attainment),
        predictedGrade: optionalString(record.predictedGrade),
        targetGrade: optionalString(record.targetGrade ?? record.target),
        rank: optionalString(record.rank),
        rawEvidence: optionalStringArray(record.rawEvidence),
        warnings: candidateWarnings,
        rowIntact: !candidateWarnings.includes('Merged OCR row detected'),
        invalidPercentage,
        needsReviewReason: invalidPercentage !== undefined ? `Impossible percentage ${invalidPercentage}% was rejected.` : needsReviewReason,
      };
      return toValidatedRecord(candidate, context);
    })
    .filter((record): record is ValidatedExtractionRecord => Boolean(record));
  const deduplicated = deduplicateExtractionRecords(validated);

  return {
    records: deduplicated.records,
    duplicateRows: deduplicated.duplicateRows,
    warnings: unique(warnings),
  };
}

export function runLocalExtractionPipeline({
  title,
  text,
  expectedSubjects,
  ocrMs = 0,
}: {
  title: string;
  text: string;
  expectedSubjects?: number;
  ocrMs?: number;
}): LocalExtractionResult {
  const totalStarted = nowMs();
  const extractionStarted = nowMs();
  const parsed = parseReportText(title, text);
  const extractionMs = nowMs() - extractionStarted;
  const validationStarted = nowMs();
  const quality = buildExtractionQualityReport(parsed.records, {
    expectedSubjects,
    duplicateRows: parsed.duplicateRows,
    warnings: parsed.warnings,
  });
  const validationMs = nowMs() - validationStarted;
  const inferred = inferMetadata(title, parsed.text);
  const hasAcademicRecords = parsed.records.some((record) => record.classification === 'academic');

  return {
    records: parsed.records,
    metadata: {
      ...inferred,
      linkedAssessmentName: title,
      shouldAffectAcademicPerformance: hasAcademicRecords,
      ignoreInstrumentalMusic: parsed.records.length > 0 && parsed.records.every((record) => record.classification === 'instrumental'),
    },
    warnings: parsed.warnings,
    duplicateRows: parsed.duplicateRows,
    quality,
    timings: {
      ocrMs,
      extractionMs,
      aiLatencyMs: 0,
      validationMs,
      totalMs: nowMs() - totalStarted + ocrMs,
      aiCalls: 0,
    },
  };
}

export async function runExtractionWorkflow({
  title,
  source,
  expectedSubjects,
  extractOcr,
  onStage,
}: {
  title: string;
  source: { kind: 'text'; text: string } | { kind: 'ocr'; input: unknown };
  expectedSubjects?: number;
  extractOcr?: (input: unknown) => Promise<string>;
  onStage?: (stage: 'Upload' | 'OCR Complete' | 'Extraction' | 'Validation') => void;
}) {
  onStage?.('Upload');
  let text: string;
  let ocrMs = 0;

  if (source.kind === 'ocr') {
    if (!extractOcr) throw new Error('An OCR extractor is required for OCR sources.');
    const ocrStarted = nowMs();
    text = await extractOcr(source.input);
    ocrMs = nowMs() - ocrStarted;
    onStage?.('OCR Complete');
  } else {
    text = source.text;
  }

  onStage?.('Extraction');
  const result = runLocalExtractionPipeline({ title, text, expectedSubjects, ocrMs });
  onStage?.('Validation');
  return result;
}

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

export function createProgressRecordsFromExtraction({
  documentId,
  title,
  records,
  academicYear,
  term,
  createdAt = '1970-01-01T00:00:00.000Z',
}: {
  documentId: string;
  title: string;
  records: ValidatedExtractionRecord[];
  academicYear?: string;
  term?: string;
  createdAt?: string;
}): PerformanceRecord[] {
  return records.map((record, index) => {
    const assessmentType: AssessmentType = record.classification === 'instrumental' ? 'music' : 'report';
    const needsReview = shouldRecordNeedReview(record);
    return {
      id: `performance-${documentId}-${slug(record.subject)}-${index}`,
      title,
      sourceDocumentId: documentId,
      date: '',
      academicYear,
      term,
      subject: record.subject,
      assessmentType,
      domain: record.classification === 'instrumental' ? 'performance' : 'academic',
      excludeFromAcademicAnalysis: record.excludeFromAcademicAnalysis || needsReview,
      percentage: record.percentage,
      grade: record.grade,
      rank: record.rank,
      teacher: record.teacher,
      teacherComment: record.teacherComment,
      effort: record.effort,
      attainment: record.attainment,
      predictedGrade: record.predictedGrade,
      targetGrade: record.targetGrade,
      rawEvidence: record.rawEvidence,
      needsReviewReason: record.needsReviewReason,
      marksExtracted: record.percentage !== undefined || Boolean(record.grade || record.attainment || record.predictedGrade || record.targetGrade),
      extractionConfidence: record.confidence,
      fieldConfidence: record.fieldConfidence,
      reviewStatus: needsReview ? 'needs_review' : 'confirmed',
      strengths: [],
      weaknesses: [],
      actionPoints: [],
      createdAt,
    };
  });
}
