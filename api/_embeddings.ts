export class EmbeddingError extends Error {
  statusCode: number;
  isConfigurationError: boolean;

  constructor(message: string, statusCode = 500, isConfigurationError = false) {
    super(message);
    this.name = 'EmbeddingError';
    this.statusCode = statusCode;
    this.isConfigurationError = isConfigurationError;
  }
}

type EmbeddingResponse = {
  data?: Array<{
    embedding?: unknown;
  }>;
  error?: {
    message?: string;
  };
};

const DEFAULT_BASE_URL = 'https://api.openai.com/v1';
const DEFAULT_MODEL = 'text-embedding-3-small';

function getEmbeddingConfig() {
  const apiKey = process.env.EMBEDDING_API_KEY?.trim();
  const baseUrl = (process.env.EMBEDDING_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/$/, '');
  const model = process.env.EMBEDDING_MODEL?.trim() || DEFAULT_MODEL;

  if (!apiKey) {
    throw new EmbeddingError(
      'Embedding API key is not configured. Set EMBEDDING_API_KEY to enable semantic search.',
      503,
      true,
    );
  }

  return {
    apiKey,
    endpoint: baseUrl.endsWith('/embeddings') ? baseUrl : `${baseUrl}/embeddings`,
    model,
  };
}

function normalizeEmbedding(value: unknown) {
  if (!Array.isArray(value)) {
    return null;
  }

  const embedding = value.map((item) => (typeof item === 'number' ? item : Number(item)));
  return embedding.every((item) => Number.isFinite(item)) ? embedding : null;
}

export function getEmbeddingModelName() {
  return process.env.EMBEDDING_MODEL?.trim() || DEFAULT_MODEL;
}

export async function createEmbeddings(input: string[]): Promise<number[][]> {
  const texts = input.map((item) => item.trim()).filter(Boolean);

  if (texts.length === 0) {
    return [];
  }

  const config = getEmbeddingConfig();
  let response: Response;

  try {
    response = await fetch(config.endpoint, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        input: texts,
      }),
    });
  } catch {
    throw new EmbeddingError('Unable to reach the embedding service. Keyword search remains available.', 502);
  }

  let data: EmbeddingResponse;

  try {
    data = (await response.json()) as EmbeddingResponse;
  } catch {
    throw new EmbeddingError('The embedding service returned an unreadable response.', 502);
  }

  if (!response.ok) {
    const message = data.error?.message ?? `Embedding request failed with status ${response.status}.`;
    throw new EmbeddingError(message, response.status);
  }

  const embeddings = data.data?.map((item) => normalizeEmbedding(item.embedding)) ?? [];

  if (embeddings.length !== texts.length || embeddings.some((item) => item === null)) {
    throw new EmbeddingError('The embedding service returned invalid embeddings.', 502);
  }

  return embeddings as number[][];
}

export async function createEmbedding(input: string): Promise<number[]> {
  const [embedding] = await createEmbeddings([input]);

  if (!embedding) {
    throw new EmbeddingError('The embedding service returned no embedding.', 502);
  }

  return embedding;
}
