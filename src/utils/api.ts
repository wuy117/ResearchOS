export type RequestMetadataValue = string | boolean | string[] | undefined;

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

  try {
    response = await fetch('/api/research-chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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

  try {
    response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
