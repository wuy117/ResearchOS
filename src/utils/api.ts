export type ResearchChatRequestDocument = {
  title: string;
  summary: string;
  topics: string[];
  extractedText: string;
  location?: string;
};

export type ResearchChatSource = {
  documentTitle: string;
  location: string;
  excerpt: string;
};

export type ResearchChatResponse = {
  answer: string;
  sources: ResearchChatSource[];
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
