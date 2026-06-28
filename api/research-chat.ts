import { callOpenRouterChat, OpenRouterError } from "./_openrouter.js";

type ApiRequest = {
  method?: string;
  body?: unknown;
};

type ApiResponse = {
  status: (statusCode: number) => {
    json: (body: unknown) => void;
  };
  setHeader?: (name: string, value: string) => void;
};

type ResearchChatDocument = {
  title: string;
  summary?: string;
  topics?: string[];
  extractedText?: string;
};

type ResearchChatBody = {
  question?: unknown;
  workspaceName?: unknown;
  documents?: unknown;
};

type SourceCard = {
  documentTitle: string;
  location: string;
  excerpt: string;
};

const MAX_DOCUMENTS = 8;
const MAX_TEXT_LENGTH = 1600;

function parseBody(body: unknown): ResearchChatBody {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as ResearchChatBody;
    } catch {
      return {};
    }
  }

  if (body && typeof body === 'object') {
    return body as ResearchChatBody;
  }

  return {};
}

function normalizeDocuments(documents: unknown): ResearchChatDocument[] {
  if (!Array.isArray(documents)) {
    return [];
  }

  return documents
    .filter((document): document is ResearchChatDocument => {
      return Boolean(document && typeof document === 'object' && 'title' in document && typeof document.title === 'string');
    })
    .slice(0, MAX_DOCUMENTS)
    .map((document) => ({
      title: document.title.trim(),
      summary: typeof document.summary === 'string' ? document.summary.trim() : '',
      topics: Array.isArray(document.topics) ? document.topics.filter((topic): topic is string => typeof topic === 'string') : [],
      extractedText: typeof document.extractedText === 'string' ? document.extractedText.trim().slice(0, MAX_TEXT_LENGTH) : '',
    }));
}

function buildDocumentContext(documents: ResearchChatDocument[]) {
  if (documents.length === 0) {
    return 'No documents were supplied.';
  }

  return documents
    .map((document, index) => {
      const topics = document.topics?.length ? document.topics.join(', ') : 'No topics supplied';
      const summary = document.summary || 'No summary supplied';
      const extractedText = document.extractedText || 'No extracted text supplied';

      return [
        `Document ${index + 1}: ${document.title}`,
        `Topics: ${topics}`,
        `Summary: ${summary}`,
        `Extracted text: ${extractedText}`,
      ].join('\n');
    })
    .join('\n\n---\n\n');
}

function buildMessages(question: string, workspaceName: string, documents: ResearchChatDocument[]) {
  const documentContext = buildDocumentContext(documents);

  return [
    {
      role: 'system' as const,
      content:
        'You are Research OS, a careful research assistant. Answer only from the supplied documents. If the supplied documents do not contain enough information, clearly say what is missing. Never invent facts. Cite every factual claim with [Source: Document Title].',
    },
    {
      role: 'user' as const,
      content: [
        `Workspace: ${workspaceName}`,
        '',
        'Supplied documents:',
        documentContext,
        '',
        `Question: ${question}`,
      ].join('\n'),
    },
  ];
}

function extractSources(answer: string, documents: ResearchChatDocument[]): SourceCard[] {
  const citedTitles = new Set<string>();
  const sourcePattern = /\[Source:\s*([^\]]+)\]/g;
  let match: RegExpExecArray | null;

  while ((match = sourcePattern.exec(answer)) !== null) {
    citedTitles.add(match[1].trim());
  }

  return documents
    .filter((document) => citedTitles.has(document.title))
    .map((document) => ({
      documentTitle: document.title,
      location: 'Supplied document context',
      excerpt: document.summary || document.extractedText?.slice(0, 180) || 'Referenced in the AI answer.',
    }));
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const body = parseBody(req.body);
  const question = typeof body.question === 'string' ? body.question.trim() : '';
  const workspaceName = typeof body.workspaceName === 'string' && body.workspaceName.trim() ? body.workspaceName.trim() : 'Research workspace';
  const documents = normalizeDocuments(body.documents);

  if (!question) {
    return res.status(400).json({ error: 'Question is required.' });
  }

  try {
    const answer = await callOpenRouterChat(buildMessages(question, workspaceName, documents));
    return res.status(200).json({
      answer,
      sources: extractSources(answer, documents),
    });
} catch (error: unknown) {
    console.error("Research chat error:", error);
    const statusCode =
      error instanceof OpenRouterError ? error.statusCode : 500;
    const message =
      error instanceof Error ? error.message : "Unknown server error";
    return res.status(statusCode).json({
     error: message,
    });
  }
}