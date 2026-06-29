# Research OS

Research OS is a local-first research desk for uploading TXT, PDF, and DOCX files, chunking documents, retrieving local context, chatting through OpenRouter, and tracking performance records.

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

## Supabase Persistence

Supabase is optional. If the Supabase variables are missing or a Supabase request fails, Research OS keeps using localStorage.

1. Create a Supabase project.
2. Open the Supabase SQL editor.
3. Run [supabase/schema.sql](/Users/yimowu/Documents/ResearchOS/supabase/schema.sql).
4. Add these values to `.env.local`:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

5. Restart the dev server after changing `.env.local`.

The current schema stores existing app objects as JSONB and keeps the app's local IDs in `local_id` columns while using UUID primary keys in Supabase. Auth, embeddings, pgvector, and vector search are intentionally not enabled yet.

## Development

Start the app:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```
