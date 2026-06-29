# Research OS

Research OS is a local-first research desk for uploading TXT, PDF, and DOCX files, chunking documents, retrieving semantic or keyword context, chatting through OpenRouter, and tracking performance records.

## Setup

Install dependencies:

```bash
npm install
```

Create a local environment file from the example:

```bash
cp .env.example .env.local
```

Add your OpenRouter key if you want chat and performance advice:

```bash
OPENROUTER_API_KEY=
```

## Supabase Persistence And Semantic Search

Supabase is optional. If the Supabase variables are missing or a Supabase request fails, Research OS keeps using localStorage and local keyword retrieval.

1. Create a Supabase project.
2. Open the Supabase SQL editor.
3. Run [supabase/schema.sql](/Users/yimowu/Documents/ResearchOS/supabase/schema.sql). The script enables `pgcrypto` and `vector`, adds embedding columns to `document_chunks`, and creates the `match_document_chunks(...)` RPC.
4. Add these values to `.env.local`:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

5. Add server-side Supabase values for API routes. These are read only on the server:

```bash
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
```

For local development, the API can fall back to `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`, but production deployments should use server-only Supabase variables.

6. Add server-side embedding variables:

```bash
EMBEDDING_API_KEY=
EMBEDDING_BASE_URL=https://api.openai.com/v1
EMBEDDING_MODEL=text-embedding-3-small
```

`EMBEDDING_BASE_URL` should point to an OpenAI-compatible API root or directly to an `/embeddings` endpoint. OpenRouter-compatible embedding endpoints can be used if the selected provider/model supports embeddings.

7. Restart the dev server after changing `.env.local`.

The schema stores app objects as JSONB and keeps local app IDs in `local_id` columns while using UUID primary keys in Supabase. Auth is intentionally not enabled yet.

After TXT/PDF/DOCX ingestion saves a document and chunks to Supabase, the frontend asks `/api/embed-chunks` to generate embeddings server-side. Research Chat first tries `/api/semantic-search`, which embeds the query server-side and calls `match_document_chunks(...)`. If Supabase, pgvector, embeddings, or the semantic RPC are unavailable, chat falls back to the existing local keyword retrieval. Uploads still complete when embedding variables are missing; affected documents are marked “Keyword search only”.

## Development

Start the app:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```
