import { callOpenRouterChat, OpenRouterError } from './_openrouter.js';

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

type TutorBody = {
  action?: unknown;
  topic?: unknown;
  mode?: unknown;
  difficulty?: unknown;
  documents?: unknown;
  history?: unknown;
  question?: unknown;
  answer?: unknown;
};

type TutorDocument = {
  title: string;
  location?: string;
  topics?: string[];
  extractedText: string;
};

const validActions = new Set(['lesson', 'socratic', 'exam', 'mark']);

function parseBody(body: unknown): TutorBody {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as TutorBody;
    } catch {
      return {};
    }
  }

  if (body && typeof body === 'object') {
    return body as TutorBody;
  }

  return {};
}

function normalizeString(value: unknown, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback;
}

function normalizeDocuments(documents: unknown): TutorDocument[] {
  if (!Array.isArray(documents)) return [];

  return documents
    .filter((document): document is Record<string, unknown> => Boolean(document) && typeof document === 'object')
    .map((document) => ({
      title: normalizeString(document.title, 'Untitled source'),
      location: normalizeString(document.location),
      topics: Array.isArray(document.topics) ? document.topics.filter((topic): topic is string => typeof topic === 'string') : [],
      extractedText: normalizeString(document.extractedText),
    }))
    .filter((document) => document.extractedText)
    .slice(0, 8);
}

function extractJsonObject(content: string) {
  const fenced = content.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1];
  const raw = fenced ?? content;
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');

  if (start === -1 || end === -1 || end <= start) {
    throw new Error('No JSON object found.');
  }

  return JSON.parse(raw.slice(start, end + 1)) as unknown;
}

function buildDocumentContext(documents: TutorDocument[]) {
  if (documents.length === 0) {
    return 'No source chunks were retrieved. Say this clearly and ask the student to upload or embed source material.';
  }

  return documents
    .map((document, index) =>
      [
        `Source ${index + 1}: ${document.title}${document.location ? ` (${document.location})` : ''}`,
        document.topics?.length ? `Topics: ${document.topics.join(', ')}` : '',
        document.extractedText.slice(0, 1800),
      ]
        .filter(Boolean)
        .join('\n'),
    )
    .join('\n\n');
}

function buildShape(action: string) {
  if (action === 'lesson') {
    return '{"topic":"string","objective":"string","estimatedDuration":"string","difficulty":"Foundation|Core|Stretch","explanation":"string","checkpointQuestions":[{"prompt":"string","answer":"string","explanation":"string","difficulty":"Foundation|Core|Stretch"}],"recap":"string","nextRecommendation":"string"}';
  }

  if (action === 'socratic') {
    return '{"question":"string","feedback":"string","followUp":"string","difficulty":"Foundation|Core|Stretch","idealAnswer":"string"}';
  }

  if (action === 'exam') {
    return '{"topic":"string","questions":[{"prompt":"string","marks":number,"commandWord":"string","markScheme":"string"}]}';
  }

  return '{"score":number,"maxScore":number,"feedback":"string","markSchemeReasoning":"string","suggestedImprovements":["string"],"modelAnswer":"string","correct":boolean}';
}

function buildInstruction(action: string) {
  if (action === 'lesson') {
    return [
      'Create a structured teaching lesson. Teach before testing.',
      'Include 3 short active-recall checkpoint questions.',
      'Use only the retrieved source context. If evidence is thin, be transparent.',
    ].join(' ');
  }

  if (action === 'socratic') {
    return [
      'Act as a Socratic tutor. Ask exactly one question for the student to answer next.',
      'If a previous answer is supplied, give concise feedback first, then adapt the follow-up question.',
      'Do not reveal the full answer unless the student already attempted it.',
    ].join(' ');
  }

  if (action === 'exam') {
    return [
      'Generate exam-style questions from the retrieved source context.',
      'Use varied command words and include mark schemes that reward evidence and reasoning.',
      'Create 3 questions total.',
    ].join(' ');
  }

  return [
    'Mark the student answer against the mark scheme and source context.',
    'Explain the mark scheme reasoning, give specific improvements, and include a model answer.',
    'Be encouraging but honest.',
  ].join(' ');
}

function buildMessages(body: TutorBody, documents: TutorDocument[]) {
  const action = normalizeString(body.action, 'lesson');
  const topic = normalizeString(body.topic, 'the retrieved topic');
  const difficulty = normalizeString(body.difficulty, 'Core');
  const question = normalizeString(body.question);
  const answer = normalizeString(body.answer);

  return [
    {
      role: 'system' as const,
      content: [
        'You are AI Tutor inside Research OS: an adaptive academic tutor using retrieval-augmented source context.',
        'Your job is to teach, question, adapt, encourage active recall, and avoid simply answering as a chat assistant.',
        'Return JSON only. Do not wrap it in Markdown. Keep content grounded in the supplied source chunks.',
      ].join(' '),
    },
    {
      role: 'user' as const,
      content: [
        `Action: ${action}`,
        `Topic: ${topic}`,
        `Difficulty target: ${difficulty}`,
        buildInstruction(action),
        '',
        'Return this exact JSON shape:',
        buildShape(action),
        '',
        question ? `Current question or mark scheme:\n${question}` : '',
        answer ? `Student answer:\n${answer}` : '',
        body.history ? `Recent learning history:\n${JSON.stringify(body.history).slice(0, 4000)}` : '',
        '',
        'Retrieved source context:',
        buildDocumentContext(documents),
      ]
        .filter(Boolean)
        .join('\n'),
    },
  ];
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const body = parseBody(req.body);
  const action = normalizeString(body.action, 'lesson');

  if (!validActions.has(action)) {
    return res.status(400).json({ error: 'Unsupported tutor action.' });
  }

  const topic = normalizeString(body.topic);
  if (!topic && action !== 'mark') {
    return res.status(400).json({ error: 'Choose a topic before using AI Tutor.' });
  }

  try {
    const documents = normalizeDocuments(body.documents);
    const content = await callOpenRouterChat(buildMessages(body, documents));
    return res.status(200).json(extractJsonObject(content));
  } catch (error: unknown) {
    console.error('Tutor error:', error);
    const statusCode = error instanceof OpenRouterError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : 'Unknown server error';
    return res.status(statusCode).json({ error: message });
  }
}
