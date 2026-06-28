type OpenRouterRole = 'system' | 'user' | 'assistant';

export type OpenRouterMessage = {
  role: OpenRouterRole;
  content: string;
};

type OpenRouterChoice = {
  message?: {
    content?: unknown;
  };
};

type OpenRouterResponse = {
  choices?: OpenRouterChoice[];
  error?: {
    message?: string;
  };
};

export class OpenRouterError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'OpenRouterError';
    this.statusCode = statusCode;
  }
}

export async function callOpenRouterChat(messages: OpenRouterMessage[]) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    throw new OpenRouterError('OpenRouter API key is not configured.', 500);
  }

  let response: Response;

  try {
    response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'http://localhost:3000/',
        'X-Title': 'Research OS',
      },
      body: JSON.stringify({
        model: 'openai/gpt-4o-mini',
        messages,
      }),
    });
  } catch {
    throw new OpenRouterError('Unable to reach OpenRouter. Please try again.', 502);
  }

  let data: OpenRouterResponse;
  let rawBody: string;

  try {
    rawBody = await response.text();
  } catch {
    throw new OpenRouterError('Unable to read the OpenRouter response.', 502);
  }

  try {
    data = JSON.parse(rawBody) as OpenRouterResponse;
  } catch {
    if (!response.ok) {
      throw new OpenRouterError(`OpenRouter request failed with status ${response.status}.`, response.status);
    }

    throw new OpenRouterError('OpenRouter returned an invalid JSON response.', 502);
  }

  if (!response.ok) {
    const message = data.error?.message ?? `OpenRouter request failed with status ${response.status}.`;
    throw new OpenRouterError(message, response.status);
  }

  const content = data.choices?.[0]?.message?.content;

  if (typeof content !== 'string' || !content.trim()) {
    throw new OpenRouterError('OpenRouter returned an empty or invalid assistant response.', 502);
  }

  return content.trim();
}
