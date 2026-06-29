import { createEmbeddings, EmbeddingError, getEmbeddingModelName } from './_embeddings.js';
import { getSupabaseServerClient, parseBody, SupabaseServerError, vectorLiteral } from './_supabase.js';

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

type EmbedChunksBody = {
  documentId?: unknown;
  chunkIds?: unknown;
};

type StoredChunkData = {
  id?: string;
  documentId?: string;
  chunkIndex?: number;
  text?: string;
  wordCount?: number;
  pageStart?: number;
  pageEnd?: number;
  createdAt?: string;
  embeddingStatus?: string;
  embeddingModel?: string;
  embeddingError?: string;
};

type StoredChunkRow = {
  local_id: string;
  document_local_id: string | null;
  chunk_index: number | null;
  text_content: string | null;
  word_count: number | null;
  data: StoredChunkData | null;
  embedding_status: string | null;
};

const MAX_CHUNKS_PER_REQUEST = 96;
const EMBEDDING_BATCH_SIZE = 16;

function normalizeChunk(row: StoredChunkRow) {
  const data = row.data ?? {};

  return {
    id: row.local_id,
    documentId: row.document_local_id ?? data.documentId ?? '',
    chunkIndex: row.chunk_index ?? data.chunkIndex ?? 0,
    text: row.text_content ?? data.text ?? '',
    wordCount: row.word_count ?? data.wordCount ?? 0,
    data,
    embeddingStatus: row.embedding_status ?? data.embeddingStatus ?? 'pending',
  };
}

async function updateChunkFailure(client: ReturnType<typeof getSupabaseServerClient>, chunk: ReturnType<typeof normalizeChunk>, message: string) {
  await client
    .from('document_chunks')
    .update({
      embedding_status: 'failed',
      embedding_error: message,
      data: {
        ...chunk.data,
        embeddingStatus: 'failed',
        embeddingError: message,
      },
    })
    .eq('local_id', chunk.id);
}

async function updateDocumentEmbeddingStatus(client: ReturnType<typeof getSupabaseServerClient>, documentId: string, status: string, error?: string) {
  const { data: documentRow } = await client.from('documents').select('data').eq('local_id', documentId).maybeSingle();
  const documentData = documentRow && typeof documentRow.data === 'object' && documentRow.data ? documentRow.data : {};

  await client
    .from('documents')
    .update({
      data: {
        ...documentData,
        embeddingStatus: status,
        embeddingError: error,
      },
    })
    .eq('local_id', documentId);
}

async function loadCandidateChunks(client: ReturnType<typeof getSupabaseServerClient>, documentId: string, chunkIds: string[]) {
  let query = client
    .from('document_chunks')
    .select('local_id, document_local_id, chunk_index, text_content, word_count, data, embedding_status')
    .limit(1000);

  if (chunkIds.length > 0) {
    query = query.in('local_id', chunkIds);
  }

  const { data, error } = await query;

  if (error) {
    throw error;
  }

  return ((data ?? []) as StoredChunkRow[])
    .map(normalizeChunk)
    .filter((chunk) => {
      if (chunkIds.length > 0) {
        return chunkIds.includes(chunk.id);
      }

      return Boolean(documentId) && chunk.documentId === documentId;
    })
    .filter((chunk) => chunk.text.trim())
    .slice(0, MAX_CHUNKS_PER_REQUEST);
}

export default async function handler(req: ApiRequest, res: ApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader?.('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed.' });
  }

  const body = parseBody<EmbedChunksBody>(req.body);
  const documentId = typeof body.documentId === 'string' ? body.documentId.trim() : '';
  const chunkIds = Array.isArray(body.chunkIds) ? body.chunkIds.filter((id): id is string => typeof id === 'string' && Boolean(id.trim())) : [];

  if (!documentId && chunkIds.length === 0) {
    return res.status(400).json({ error: 'documentId or chunkIds is required.' });
  }

  try {
    const client = getSupabaseServerClient();
    const chunks = await loadCandidateChunks(client, documentId, chunkIds);
    const model = getEmbeddingModelName();
    let embedded = 0;
    let failed = 0;
    let skipped = 0;

    if (documentId) {
      await updateDocumentEmbeddingStatus(client, documentId, 'embedding');
    }

    for (let index = 0; index < chunks.length; index += EMBEDDING_BATCH_SIZE) {
      const batch = chunks.slice(index, index + EMBEDDING_BATCH_SIZE);

      try {
        const embeddings = await createEmbeddings(batch.map((chunk) => chunk.text));

        await Promise.all(
          batch.map((chunk, batchIndex) =>
            client
              .from('document_chunks')
              .update({
                document_local_id: chunk.documentId,
                chunk_index: chunk.chunkIndex,
                text_content: chunk.text,
                word_count: chunk.wordCount,
                embedding: vectorLiteral(embeddings[batchIndex]),
                embedding_model: model,
                embedding_status: 'embedded',
                embedding_error: null,
                data: {
                  ...chunk.data,
                  id: chunk.id,
                  documentId: chunk.documentId,
                  chunkIndex: chunk.chunkIndex,
                  text: chunk.text,
                  wordCount: chunk.wordCount,
                  embeddingStatus: 'embedded',
                  embeddingModel: model,
                  embeddingError: undefined,
                },
              })
              .eq('local_id', chunk.id),
          ),
        );

        embedded += batch.length;
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Embedding failed for this chunk.';
        failed += batch.length;
        await Promise.all(batch.map((chunk) => updateChunkFailure(client, chunk, message)));
      }
    }

    skipped = Math.max(0, (chunkIds.length || chunks.length) - embedded - failed);

    if (documentId) {
      await updateDocumentEmbeddingStatus(client, documentId, failed > 0 && embedded === 0 ? 'failed' : embedded > 0 ? 'embedded' : 'not_embedded');
    }

    return res.status(200).json({ embedded, failed, skipped });
  } catch (error: unknown) {
    console.error('Embed chunks error:', error);

    if (error instanceof EmbeddingError || error instanceof SupabaseServerError) {
      return res.status(error.statusCode).json({
        error: error.message,
        configurationMissing: error instanceof EmbeddingError ? error.isConfigurationError : error instanceof SupabaseServerError,
        embedded: 0,
        failed: 0,
        skipped: 0,
      });
    }

    const message = error instanceof Error ? error.message : 'Unable to embed document chunks.';
    return res.status(500).json({ error: message, embedded: 0, failed: 0, skipped: 0 });
  }
}
