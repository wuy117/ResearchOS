export type ResearchChatRequestDocument = {
  title: string;
  summary: string;
  topics: string[];
  extractedText: string;
  location?: string;
  pageStart?: number;
  pageEnd?: number;
  matchedTerms?: string[];
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
