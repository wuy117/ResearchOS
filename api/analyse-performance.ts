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

type AnalysePerformanceBody = {
  title?: unknown;
  text?: unknown;
};

function parseBody(body: unknown): AnalysePerformanceBody {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as AnalysePerformanceBody;
    } catch {
      return {};
    }
  }

  if (body && typeof body === 'object') {
    return body as AnalysePerformanceBody;
  }

  return {};
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

function buildMessages(title: string, text: string) {
  return [
    {
      role: 'system' as const,
      content: [
        'You extract academic performance records from school reports, exam results, mark sheets, teacher comments, and assessment records.',
        'Return JSON only. Do not wrap it in Markdown.',
        'If the document does not look like an academic report or exam result, return {"records":[],"message":"This document does not appear to contain school report or assessment data."}.',
        'Never invent subjects, marks, grades, ranks, or teacher comments. Use null or empty arrays when data is missing.',
        'Use careful wording for strengths, weaknesses, and action points.',
      ].join(' '),
    },
    {
      role: 'user' as const,
      content: [
        `Document title: ${title}`,
        '',
        'Extract records as this exact JSON shape:',
        '{"records":[{"title":"string","date":"YYYY-MM-DD or empty string","term":"string or null","academicYear":"string or null","subject":"string","assessmentType":"exam|report|coursework|music|mock|other","score":number|null,"maxScore":number|null,"percentage":number|null,"grade":"string or null","rank":"string or null","teacherComment":"string or null","strengths":["string"],"weaknesses":["string"],"actionPoints":["string"]}],"message":"string"}',
        '',
        'Document text:',
        text.slice(0, 12000),
      ].join('\n'),
    },
  ];
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const body = parseBody(req.body);
  const title = typeof body.title === 'string' && body.title.trim() ? body.title.trim() : 'Uploaded document';
  const text = typeof body.text === 'string' ? body.text.trim() : '';

  if (!text) {
    return res.status(400).json({ error: 'Document text is required.' });
  }

  try {
    const content = await callOpenRouterChat(buildMessages(title, text));
    return res.status(200).json(extractJsonObject(content));
  } catch (error: unknown) {
    console.error("Performance analysis error:", error);
    const statusCode = error instanceof OpenRouterError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : "Unknown server error";
    return res.status(statusCode).json({ error: message });
  }
}
