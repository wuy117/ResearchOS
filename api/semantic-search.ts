import { AuthError, requireUser } from './_auth.js';
import { createEmbedding, EmbeddingError } from './_embeddings.js';
import { parseBody, SupabaseServerError, vectorLiteral } from './_supabase.js';

type ApiRequest = {
  method?: string;
  headers?: Record<string, string | string[] | undefined>;
  body?: unknown;
};

type ApiResponse = {
  status: (statusCode: number) => {
    json: (body: unknown) => void;
  };
  setHeader?: (name: string, value: string) => void;
};

type SemanticSearchBody = {
  query?: unknown;
  workspaceId?: unknown;
  matchCount?: unknown;
};

type MatchRow = {
  id: string;
  document_id: string;
  text: string;
  similarity: number;
  page_start: number | null;
  page_end: number | null;
  document_title: string;
  document_type: string;
};

const DEFAULT_MATCH_COUNT = 6;
const MAX_MATCH_COUNT = 12;

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const body = parseBody<SemanticSearchBody>(req.body);
  const query = typeof body.query === 'string' ? body.query.trim() : '';
  const workspaceId = typeof body.workspaceId === 'string' ? body.workspaceId.trim() : '';
  const requestedCount = typeof body.matchCount === 'number' && Number.isFinite(body.matchCount) ? body.matchCount : DEFAULT_MATCH_COUNT;
  const matchCount = Math.max(1, Math.min(MAX_MATCH_COUNT, Math.round(requestedCount)));

  if (!query) {
    return res.status(400).json({ error: 'query is required.' });
  }

  try {
    const { client, userId } = await requireUser(req);
    const embedding = await createEmbedding(query);
    const { data, error } = await client.rpc('match_document_chunks', {
      query_embedding: vectorLiteral(embedding),
      match_count: matchCount,
      workspace_filter: workspaceId || null,
      user_filter: userId,
    });

    if (error) {
      throw error;
    }

    const matches = ((data ?? []) as MatchRow[]).map((match) => ({
      id: match.id,
      documentId: match.document_id,
      text: match.text,
      similarity: match.similarity,
      pageStart: match.page_start ?? undefined,
      pageEnd: match.page_end ?? undefined,
      documentTitle: match.document_title,
      documentType: match.document_type,
    }));

    return res.status(200).json({ matches });
  } catch (error: unknown) {
    console.error('Semantic search error:', error);

    if (error instanceof AuthError || error instanceof EmbeddingError || error instanceof SupabaseServerError) {
      return res.status(error.statusCode).json({
        error: error.message,
        configurationMissing: error instanceof EmbeddingError ? error.isConfigurationError : error instanceof SupabaseServerError,
        matches: [],
      });
    }

    const message = error instanceof Error ? error.message : 'Semantic search failed.';
    return res.status(500).json({ error: message, matches: [] });
  }
}
