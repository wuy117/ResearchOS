export type RequestMetadataValue = string | boolean | string[] | undefined;

let accessTokenProvider: (() => string | undefined) | null = null;

export function setApiAccessTokenProvider(provider: (() => string | undefined) | null) {
  accessTokenProvider = provider;
}

export type ResearchChatRequestDocument = {
  title: string;
  summary: string;
  topics: string[];
  extractedText: string;
  location?: string;
  pageStart?: number;
  pageEnd?: number;
  matchedTerms?: string[];
  metadata?: Record<string, RequestMetadataValue>;
  performanceContext?: string[];
  tutorContext?: string[];
};

export type ExtractionConfidence = 'High' | 'Medium' | 'Low';
export type ExtractionFieldConfidence = Partial<Record<
  | 'subject'
  | 'teacher'
  | 'teacherComment'
  | 'effort'
  | 'attainment'
  | 'score'
  | 'maxScore'
  | 'percentage'
  | 'grade'
  | 'predictedGrade'
  | 'targetGrade'
  | 'rank',
  ExtractionConfidence
>>;

export type ExtractionDiagnostics = {
  detectedSubjectSections: number;
  subjectsWithMarks: number;
  subjectsWithComments: number;
  uncertainFields: number;
  duplicateRows?: number;
  ocrConsistency?: 'Excellent' | 'Good' | 'Poor';
  confidenceReasons?: string[];
  warnings: string[];
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

export type ResearchChatSource = {
  documentTitle: string;
  location: string;
  excerpt: string;
  matchedTerms?: string[];
  score?: number;
  reason?: string;
};

export type ResearchChatResponse = {
  answer: string;
  sources: ResearchChatSource[];
};

export type EmbedChunksResponse = {
  embedded: number;
  failed: number;
  skipped: number;
  configurationMissing?: boolean;
};

export type SemanticSearchMatch = {
  id: string;
  documentId: string;
  text: string;
  similarity: number;
  pageStart?: number;
  pageEnd?: number;
  documentTitle: string;
  documentType: string;
};

export type SemanticSearchResponse = {
  matches: SemanticSearchMatch[];
  configurationMissing?: boolean;
};

export type PerformanceAnalysisRecord = {
  title?: string;
  date?: string;
  term?: string | null;
  academicYear?: string | null;
  subject?: string;
  assessmentType?: string;
  score?: number | null;
  maxScore?: number | null;
  percentage?: number | null;
  grade?: string | null;
  rank?: string | null;
  teacher?: string | null;
  teacherComment?: string | null;
  effort?: string | null;
  attainment?: string | null;
  predictedGrade?: string | null;
  targetGrade?: string | null;
  rawEvidence?: string[];
  confidenceReasons?: string[];
  needsReviewReason?: string | null;
  marksExtracted?: boolean | null;
  extractionConfidence?: ExtractionConfidence | null;
  fieldConfidence?: ExtractionFieldConfidence | null;
  strengths?: string[];
  weaknesses?: string[];
  actionPoints?: string[];
  excludeFromAcademicAnalysis?: boolean | null;
};

export type PerformanceAnalysisResponse = {
  records: PerformanceAnalysisRecord[];
  message?: string;
};

export type PerformanceAdviceResponse = {
  subjects: string[];
  strongestSubjects: string[];
  weakestSubjects: string[];
  improvingSubjects: string[];
  decliningSubjects: string[];
  recurringStrengths: string[];
  recurringWeaknesses: string[];
  recommendedActions: string[];
  overallCommentary: string;
  teacherThemes: Array<{
    theme: string;
    classification: 'Strength' | 'Priority' | 'Improving';
    summary: string;
    why: string;
    evidence: string[];
    subjects: string[];
  }>;
  coachingRecommendations: Array<{
    title: string;
    action: string;
    why: string;
    evidence: string;
  }>;
};

export type DocumentMetadataAnalysisResponse = {
  documentSummary?: string;
  subjects?: Array<{
    subject?: string | null;
    teacher?: string | null;
    percentage?: number | null;
    grade?: string | null;
    effort?: string | null;
    attainment?: string | null;
    target?: string | null;
    predictedGrade?: string | null;
    teacherComment?: string | null;
    strengths?: string[];
    weaknesses?: string[];
    actionPoints?: string[];
    rawEvidence?: string[];
    confidence?: ExtractionConfidence | null;
    fieldConfidence?: ExtractionFieldConfidence | null;
    needsReviewReason?: string | null;
  }>;
  extractionWarnings?: string[];
  missingLikelySubjects?: string[];
  extractionDiagnostics?: ExtractionDiagnostics;
  confidence?: ExtractionConfidence;
  metadata: {
    sourceDate?: string | null;
    academicYear?: string | null;
    term?: string | null;
    linkedAssessmentName?: string | null;
    documentCategory?: string | null;
    subjects?: string[];
    topics?: string[];
    teacherNames?: string[];
    skills?: string[];
    tags?: string[];
    ignoreInstrumentalMusic?: boolean;
    shouldAffectAcademicPerformance?: boolean;
    metadataConfidence?: 'High' | 'Medium' | 'Low';
    extractedFacts?: string[];
    inferredMetadata?: string[];
    metadataSource?: 'AI generated' | 'Local fallback';
  };
  summary: {
    sourceType?: string;
    mainSubjects?: string[];
    mainTopics?: string[];
    keyEvidence?: string[];
    importantCommentsOrResults?: string[];
    suggestedUse?: string;
    summaryText?: string;
  };
  performanceRecords: PerformanceAnalysisRecord[];
  extractionQuality?: ExtractionQualityReport;
  extractionTimings?: ExtractionTimings;
  message?: string;
};

export type TutorRequestDocument = ResearchChatRequestDocument;

export type TutorLessonResponse = {
  topic: string;
  objective: string;
  estimatedDuration: string;
  difficulty: 'Foundation' | 'Core' | 'Stretch';
  explanation: string;
  checkpointQuestions: Array<{
    prompt: string;
    answer: string;
    explanation: string;
    difficulty: 'Foundation' | 'Core' | 'Stretch';
  }>;
  recap: string;
  nextRecommendation: string;
};

export type TutorSocraticResponse = {
  question: string;
  feedback: string;
  followUp: string;
  difficulty: 'Foundation' | 'Core' | 'Stretch';
  idealAnswer: string;
};

export type TutorExamResponse = {
  topic: string;
  questions: Array<{
    prompt: string;
    marks: number;
    commandWord: string;
    markScheme: string;
  }>;
};

export type TutorMarkResponse = {
  score: number;
  maxScore: number;
  feedback: string;
  markSchemeReasoning: string;
  suggestedImprovements: string[];
  modelAnswer: string;
  correct: boolean;
};

type ResearchChatErrorResponse = {
  error?: string;
};

export async function askResearchChat({
  question,
  workspaceName,
  documents,
}: {
  question: string;
  workspaceName: string;
  documents: ResearchChatRequestDocument[];
}): Promise<ResearchChatResponse> {
  let response: Response;
  const token = accessTokenProvider?.();

  try {
    response = await fetch('/api/research-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ question, workspaceName, documents }),
    });
  } catch {
    throw new Error('Research chat is unreachable. Please check your connection and try again.');
  }

  let data: ResearchChatResponse | ResearchChatErrorResponse;

  try {
    data = (await response.json()) as ResearchChatResponse | ResearchChatErrorResponse;
  } catch {
    throw new Error('Research chat returned an unreadable response.');
  }

  if (!response.ok) {
    throw new Error('error' in data && data.error ? data.error : 'Research chat failed. Please try again.');
  }

  if (!('answer' in data) || typeof data.answer !== 'string') {
    throw new Error('Research chat returned an invalid response.');
  }

  return {
    answer: data.answer,
    sources: Array.isArray(data.sources) ? data.sources : [],
  };
}

async function postJson<TResponse>(url: string, body: unknown, fallbackError: string): Promise<TResponse> {
  let response: Response;
  const token = accessTokenProvider?.();

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(body),
    });
  } catch {
    throw new Error(fallbackError);
  }

  let data: TResponse | ResearchChatErrorResponse;

  try {
    data = (await response.json()) as TResponse | ResearchChatErrorResponse;
  } catch {
    throw new Error('The server returned an unreadable response.');
  }

  if (!response.ok) {
    const message = data && typeof data === 'object' && 'error' in data && data.error ? data.error : fallbackError;
    throw new Error(message);
  }

  return data as TResponse;
}

export async function analysePerformanceDocument({
  title,
  text,
}: {
  title: string;
  text: string;
}): Promise<PerformanceAnalysisResponse> {
  const data = await postJson<PerformanceAnalysisResponse>(
    '/api/analyse-performance',
    { title, text },
    'Performance analysis is unreachable. Please try again.',
  );

  return {
    records: Array.isArray(data.records) ? data.records.map(normalizePerformanceRecord) : [],
    message: typeof data.message === 'string' ? data.message : undefined,
  };
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [];
}

function normalizeNumberInRange(value: unknown, min: number, max: number): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value >= min && value <= max ? value : null;
}

function normalizeConfidence(value: unknown): ExtractionConfidence | undefined {
  return value === 'High' || value === 'Medium' || value === 'Low' ? value : undefined;
}

const confidenceFieldKeys = [
  'subject',
  'teacher',
  'teacherComment',
  'effort',
  'attainment',
  'score',
  'maxScore',
  'percentage',
  'grade',
  'predictedGrade',
  'targetGrade',
  'rank',
] as const;

function normalizeFieldConfidence(value: unknown): ExtractionFieldConfidence | undefined {
  if (!value || typeof value !== 'object') return undefined;

  const fieldConfidence: ExtractionFieldConfidence = {};
  confidenceFieldKeys.forEach((key) => {
    const confidence = normalizeConfidence((value as Record<string, unknown>)[key]);
    if (confidence) fieldConfidence[key] = confidence;
  });

  return Object.keys(fieldConfidence).length ? fieldConfidence : undefined;
}

function normalizePerformanceRecord(record: PerformanceAnalysisRecord): PerformanceAnalysisRecord {
  return {
    ...record,
    percentage: normalizeNumberInRange(record?.percentage, 0, 100),
    rawEvidence: normalizeStringArray(record?.rawEvidence),
    confidenceReasons: normalizeStringArray(record?.confidenceReasons),
    needsReviewReason: typeof record?.needsReviewReason === 'string' ? record.needsReviewReason : null,
    extractionConfidence: normalizeConfidence(record?.extractionConfidence),
    fieldConfidence: normalizeFieldConfidence(record?.fieldConfidence),
  };
}

function normalizeExtractionDiagnostics(value: unknown): ExtractionDiagnostics | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const diagnostics = value as Partial<ExtractionDiagnostics>;

  return {
    detectedSubjectSections: typeof diagnostics.detectedSubjectSections === 'number' ? diagnostics.detectedSubjectSections : 0,
    subjectsWithMarks: typeof diagnostics.subjectsWithMarks === 'number' ? diagnostics.subjectsWithMarks : 0,
    subjectsWithComments: typeof diagnostics.subjectsWithComments === 'number' ? diagnostics.subjectsWithComments : 0,
    uncertainFields: typeof diagnostics.uncertainFields === 'number' ? diagnostics.uncertainFields : 0,
    duplicateRows: typeof diagnostics.duplicateRows === 'number' ? diagnostics.duplicateRows : 0,
    ocrConsistency: diagnostics.ocrConsistency === 'Excellent' || diagnostics.ocrConsistency === 'Good' || diagnostics.ocrConsistency === 'Poor' ? diagnostics.ocrConsistency : undefined,
    confidenceReasons: normalizeStringArray(diagnostics.confidenceReasons),
    warnings: normalizeStringArray(diagnostics.warnings),
  };
}

function normalizeExtractionQuality(value: unknown): ExtractionQualityReport | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const report = value as Partial<ExtractionQualityReport>;
  const count = (candidate: unknown) => typeof candidate === 'number' && Number.isFinite(candidate) ? candidate : 0;
  return {
    expectedSubjects: typeof report.expectedSubjects === 'number' ? report.expectedSubjects : undefined,
    subjectsFound: count(report.subjectsFound),
    subjectsMatched: count(report.subjectsMatched),
    marksFound: count(report.marksFound),
    teachersFound: count(report.teachersFound),
    commentsLinked: count(report.commentsLinked),
    gradesFound: count(report.gradesFound),
    effortFound: count(report.effortFound),
    attainmentFound: count(report.attainmentFound),
    targetsFound: count(report.targetsFound),
    predictedGradesFound: count(report.predictedGradesFound),
    duplicateRows: count(report.duplicateRows),
    excludedInstrumentalRecords: count(report.excludedInstrumentalRecords),
    needsReview: count(report.needsReview),
    ocrConsistency: report.ocrConsistency === 'Excellent' || report.ocrConsistency === 'Good' || report.ocrConsistency === 'Poor' ? report.ocrConsistency : 'Poor',
    confidence: normalizeConfidence(report.confidence) ?? 'Low',
    confidenceReasons: normalizeStringArray(report.confidenceReasons),
    potentialProblems: normalizeStringArray(report.potentialProblems),
  };
}

function normalizeExtractionTimings(value: unknown): ExtractionTimings | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const timings = value as Partial<ExtractionTimings>;
  const duration = (candidate: unknown) => typeof candidate === 'number' && Number.isFinite(candidate) && candidate >= 0 ? candidate : 0;
  return {
    ocrMs: duration(timings.ocrMs),
    extractionMs: duration(timings.extractionMs),
    aiLatencyMs: duration(timings.aiLatencyMs),
    validationMs: duration(timings.validationMs),
    totalMs: duration(timings.totalMs),
    aiCalls: duration(timings.aiCalls),
  };
}

export async function analyseDocumentMetadata({
  title,
  text,
  uploadMetadata,
  pipelineTimings,
}: {
  title: string;
  text: string;
  uploadMetadata: unknown;
  pipelineTimings?: { ocrMs?: number };
}): Promise<DocumentMetadataAnalysisResponse> {
  const data = await postJson<DocumentMetadataAnalysisResponse>(
    '/api/analyse-document-metadata',
    { title, text, uploadMetadata, pipelineTimings },
    'Document metadata analysis is unreachable. Local metadata fallback remains available.',
  );

  const metadata = data && typeof data.metadata === 'object' ? data.metadata : {};
  const summary = data && typeof data.summary === 'object' ? data.summary : {};

  return {
    documentSummary: typeof data.documentSummary === 'string' ? data.documentSummary : undefined,
    subjects: Array.isArray(data.subjects) ? data.subjects : [],
    extractionWarnings: normalizeStringArray(data.extractionWarnings),
    missingLikelySubjects: normalizeStringArray(data.missingLikelySubjects),
    extractionDiagnostics: normalizeExtractionDiagnostics(data.extractionDiagnostics),
    confidence: normalizeConfidence(data.confidence),
    metadata: {
      sourceDate: typeof metadata.sourceDate === 'string' ? metadata.sourceDate : null,
      academicYear: typeof metadata.academicYear === 'string' ? metadata.academicYear : null,
      term: typeof metadata.term === 'string' ? metadata.term : null,
      linkedAssessmentName: typeof metadata.linkedAssessmentName === 'string' ? metadata.linkedAssessmentName : null,
      documentCategory: typeof metadata.documentCategory === 'string' ? metadata.documentCategory : null,
      subjects: normalizeStringArray(metadata.subjects),
      topics: normalizeStringArray(metadata.topics),
      teacherNames: normalizeStringArray(metadata.teacherNames),
      skills: normalizeStringArray(metadata.skills),
      tags: normalizeStringArray(metadata.tags),
      ignoreInstrumentalMusic: Boolean(metadata.ignoreInstrumentalMusic),
      shouldAffectAcademicPerformance: typeof metadata.shouldAffectAcademicPerformance === 'boolean' ? metadata.shouldAffectAcademicPerformance : undefined,
      metadataConfidence: metadata.metadataConfidence === 'High' || metadata.metadataConfidence === 'Medium' || metadata.metadataConfidence === 'Low' ? metadata.metadataConfidence : 'Low',
      extractedFacts: normalizeStringArray(metadata.extractedFacts),
      inferredMetadata: normalizeStringArray(metadata.inferredMetadata),
      metadataSource: metadata.metadataSource === 'Local fallback' ? 'Local fallback' : 'AI generated',
    },
    summary: {
      sourceType: typeof summary.sourceType === 'string' ? summary.sourceType : undefined,
      mainSubjects: normalizeStringArray(summary.mainSubjects),
      mainTopics: normalizeStringArray(summary.mainTopics),
      keyEvidence: normalizeStringArray(summary.keyEvidence),
      importantCommentsOrResults: normalizeStringArray(summary.importantCommentsOrResults),
      suggestedUse: typeof summary.suggestedUse === 'string' ? summary.suggestedUse : undefined,
      summaryText: typeof summary.summaryText === 'string' ? summary.summaryText : undefined,
    },
    performanceRecords: Array.isArray(data.performanceRecords) ? data.performanceRecords.map(normalizePerformanceRecord) : [],
    extractionQuality: normalizeExtractionQuality(data.extractionQuality),
    extractionTimings: normalizeExtractionTimings(data.extractionTimings),
    message: typeof data.message === 'string' ? data.message : undefined,
  };
}

export async function generatePerformanceAdvice(records: unknown[]): Promise<PerformanceAdviceResponse> {
  const data = await postJson<PerformanceAdviceResponse>(
    '/api/performance-advice',
    { records },
    'Performance advice is unreachable. Please try again.',
  );

  const teacherThemes = Array.isArray(data.teacherThemes) ? data.teacherThemes.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const value = item as Record<string, unknown>;
    const classification: PerformanceAdviceResponse['teacherThemes'][number]['classification'] = value.classification === 'Strength' || value.classification === 'Priority' || value.classification === 'Improving' ? value.classification : 'Priority';
    if (typeof value.theme !== 'string' || typeof value.summary !== 'string' || typeof value.why !== 'string') return [];
    return [{
      theme: value.theme,
      classification,
      summary: value.summary,
      why: value.why,
      evidence: normalizeStringArray(value.evidence),
      subjects: normalizeStringArray(value.subjects),
    }];
  }) : [];
  const coachingRecommendations = Array.isArray(data.coachingRecommendations) ? data.coachingRecommendations.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const value = item as Record<string, unknown>;
    if (typeof value.title !== 'string' || typeof value.action !== 'string' || typeof value.why !== 'string') return [];
    return [{ title: value.title, action: value.action, why: value.why, evidence: typeof value.evidence === 'string' ? value.evidence : '' }];
  }) : [];

  return {
    subjects: Array.isArray(data.subjects) ? data.subjects : [],
    strongestSubjects: Array.isArray(data.strongestSubjects) ? data.strongestSubjects : [],
    weakestSubjects: Array.isArray(data.weakestSubjects) ? data.weakestSubjects : [],
    improvingSubjects: Array.isArray(data.improvingSubjects) ? data.improvingSubjects : [],
    decliningSubjects: Array.isArray(data.decliningSubjects) ? data.decliningSubjects : [],
    recurringStrengths: Array.isArray(data.recurringStrengths) ? data.recurringStrengths : [],
    recurringWeaknesses: Array.isArray(data.recurringWeaknesses) ? data.recurringWeaknesses : [],
    recommendedActions: Array.isArray(data.recommendedActions) ? data.recommendedActions : [],
    overallCommentary: typeof data.overallCommentary === 'string' ? data.overallCommentary : '',
    teacherThemes,
    coachingRecommendations,
  };
}

export async function embedChunks({ documentId, chunkIds }: { documentId?: string; chunkIds?: string[] }): Promise<EmbedChunksResponse> {
  const data = await postJson<EmbedChunksResponse>(
    '/api/embed-chunks',
    { documentId, chunkIds },
    'Chunk embedding is unavailable. Keyword search remains available.',
  );

  return {
    embedded: typeof data.embedded === 'number' ? data.embedded : 0,
    failed: typeof data.failed === 'number' ? data.failed : 0,
    skipped: typeof data.skipped === 'number' ? data.skipped : 0,
    configurationMissing: Boolean(data.configurationMissing),
  };
}

export async function semanticSearch({
  query,
  workspaceId,
  matchCount,
}: {
  query: string;
  workspaceId?: string;
  matchCount?: number;
}): Promise<SemanticSearchResponse> {
  const data = await postJson<SemanticSearchResponse>(
    '/api/semantic-search',
    { query, workspaceId, matchCount },
    'Semantic search is unavailable. Keyword search remains available.',
  );

  return {
    matches: Array.isArray(data.matches) ? data.matches : [],
    configurationMissing: Boolean(data.configurationMissing),
  };
}

export async function generateTutorContent<TResponse>({
  action,
  topic,
  difficulty,
  documents,
  history,
  question,
  answer,
}: {
  action: 'lesson' | 'socratic' | 'exam' | 'mark';
  topic?: string;
  difficulty?: string;
  documents: TutorRequestDocument[];
  history?: unknown;
  question?: string;
  answer?: string;
}): Promise<TResponse> {
  return postJson<TResponse>(
    '/api/tutor',
    { action, topic, difficulty, documents, history, question, answer },
    'AI Tutor is unreachable. Please try again.',
  );
}
