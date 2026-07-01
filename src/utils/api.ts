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
  teacherComment?: string | null;
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
};

export type DocumentMetadataAnalysisResponse = {
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
    records: Array.isArray(data.records) ? data.records : [],
    message: typeof data.message === 'string' ? data.message : undefined,
  };
}

function normalizeStringArray(value: unknown) {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string' && Boolean(item.trim())) : [];
}

export async function analyseDocumentMetadata({
  title,
  text,
  uploadMetadata,
}: {
  title: string;
  text: string;
  uploadMetadata: unknown;
}): Promise<DocumentMetadataAnalysisResponse> {
  const data = await postJson<DocumentMetadataAnalysisResponse>(
    '/api/analyse-document-metadata',
    { title, text, uploadMetadata },
    'Document metadata analysis is unreachable. Local metadata fallback remains available.',
  );

  const metadata = data && typeof data.metadata === 'object' ? data.metadata : {};
  const summary = data && typeof data.summary === 'object' ? data.summary : {};

  return {
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
    performanceRecords: Array.isArray(data.performanceRecords) ? data.performanceRecords : [],
    message: typeof data.message === 'string' ? data.message : undefined,
  };
}

export async function generatePerformanceAdvice(records: unknown[]): Promise<PerformanceAdviceResponse> {
  const data = await postJson<PerformanceAdviceResponse>(
    '/api/performance-advice',
    { records },
    'Performance advice is unreachable. Please try again.',
  );

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
