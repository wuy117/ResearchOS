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

type AdviceBody = {
  records?: unknown;
};

function parseBody(body: unknown): AdviceBody {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as AdviceBody;
    } catch {
      return {};
    }
  }

  if (body && typeof body === 'object') {
    return body as AdviceBody;
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

function normalizeRecords(records: unknown) {
  if (!Array.isArray(records)) {
    return [];
  }

  return records.slice(0, 80).filter((record) => record && typeof record === 'object');
}

function buildMessages(records: unknown[]) {
  return [
    {
      role: 'system' as const,
      content: [
        'You are an experienced tutor reading school reports and assessment records.',
        'Return JSON only. Do not wrap it in Markdown.',
        'Group teacher feedback by meaning, even when teachers use different words. For example, "justify conclusions", "use evidence", and "explain how results support the answer" belong to one reasoning-and-evidence theme.',
        'Do not create separate themes for phrases that express the same underlying learning habit.',
        'Every recommendation must state a concrete action, why it matters now, and the report evidence behind it.',
        'Write like a calm, experienced tutor. Never use analytics, extraction, confidence-score, or dashboard language.',
        'Do not make harsh comments or fixed predictions. If evidence is limited, say so naturally.',
      ].join(' '),
    },
    {
      role: 'user' as const,
      content: [
        'Generate this exact JSON shape:',
        '{"subjects":["string"],"strongestSubjects":["string"],"weakestSubjects":["string"],"improvingSubjects":["string"],"decliningSubjects":["string"],"recurringStrengths":["string"],"recurringWeaknesses":["string"],"recommendedActions":["string"],"overallCommentary":"string","teacherThemes":[{"theme":"string","classification":"Strength|Priority|Improving","summary":"string","why":"string","evidence":["short teacher quote"],"subjects":["string"]}],"coachingRecommendations":[{"title":"string","action":"string","why":"string","evidence":"short teacher quote or same-subject change"}]}',
        '',
        'Performance records:',
        JSON.stringify(records).slice(0, 14000),
      ].join('\n'),
    },
  ];
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const records = normalizeRecords(parseBody(req.body).records);

  if (records.length === 0) {
    return res.status(400).json({ error: 'At least one performance record is required.' });
  }

  try {
    const content = await callOpenRouterChat(buildMessages(records));
    return res.status(200).json(extractJsonObject(content));
  } catch (error: unknown) {
    console.error("Performance advice error:", error);
    const statusCode = error instanceof OpenRouterError ? error.statusCode : 500;
    const message = error instanceof Error ? error.message : "Unknown server error";
    return res.status(statusCode).json({ error: message });
  }
}
