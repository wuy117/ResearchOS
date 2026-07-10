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

## Supabase Auth, Persistence, And Semantic Search

Supabase is optional. If the Supabase variables are missing, Research OS runs in local-only mode using localStorage and local keyword retrieval. When Supabase is configured, Research OS requires Supabase Auth before loading user-owned cloud data.

1. Create a Supabase project.
2. In Supabase Dashboard, open Authentication, Providers, Email, and enable email/password signups for your project.
3. Open the Supabase SQL editor.
4. Run [supabase/schema.sql](/Users/yimowu/Documents/ResearchOS/supabase/schema.sql). The script enables `pgcrypto` and `vector`, creates the JSONB-backed app tables, adds embedding columns to `document_chunks`, and creates the base `match_document_chunks(...)` RPC.
5. Run [supabase/auth-migration.sql](/Users/yimowu/Documents/ResearchOS/supabase/auth-migration.sql). This adds `user_id`, per-user local ID uniqueness, RLS policies, and the authenticated `match_document_chunks(..., user_filter)` RPC.
6. Add these values to `.env.local`:

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
```

7. Add server-side Supabase values for API routes. These are read only on the server:

```bash
SUPABASE_URL=
SUPABASE_ANON_KEY=
```

The serverless routes verify the browser's Supabase access token and use the anon key so RLS remains active. Do not put a service role key in frontend code.

8. Add server-side embedding variables:

```bash
EMBEDDING_API_KEY=
EMBEDDING_BASE_URL=https://api.openai.com/v1
EMBEDDING_MODEL=text-embedding-3-small
```

`EMBEDDING_BASE_URL` should point to an OpenAI-compatible API root or directly to an `/embeddings` endpoint. OpenRouter-compatible embedding endpoints can be used if the selected provider/model supports embeddings.

9. Add the same Vercel environment variables, then redeploy. Vercel does not apply new env vars to an existing deployment until a new deploy runs.

10. Restart the local dev server after changing `.env.local`.

The schema stores app objects as JSONB and keeps local app IDs in `local_id` columns while using UUID primary keys in Supabase. Auth ownership is stored in `user_id`; frontend data uses optional `userId` for compatibility with existing localStorage records.

After TXT/PDF/DOCX ingestion saves a document and chunks to Supabase, the frontend asks `/api/embed-chunks` to generate embeddings server-side with the signed-in user's access token. Research Chat first tries `/api/semantic-search`, which verifies the token, embeds the query server-side, and calls `match_document_chunks(...)` filtered to that user. If Supabase, pgvector, embeddings, or the semantic RPC are unavailable, chat falls back to the existing local keyword retrieval. Uploads still complete when embedding variables are missing; affected documents are marked “Keyword search only”.

### Local Data And Legacy Rows

Existing browser data is not uploaded automatically. After sign-in, Research OS offers to copy claimable local browser data into the current account and shows a summary of documents, chunks, performance records, Tutor sessions, and collections before import. The original local data is not deleted unless you confirm a local clear.

Existing Supabase rows with `user_id is null` are preserved by the migration. They will not appear in normal authenticated queries once RLS is enabled. To keep old cloud data, either re-import from local browser data after signing in or manually assign specific legacy rows to the correct `auth.users.id` after exporting/backing up your database.

### Testing Auth

1. Open a fresh browser with Supabase env vars configured.
2. Confirm the sign-in screen appears.
3. Sign up with email/password.
4. Refresh and confirm the session persists.
5. Upload a TXT/PDF/DOCX source.
6. Confirm the inserted Supabase rows have `user_id`.
7. Sign out, sign back in, and confirm data reappears.
8. Create a second Supabase Auth user and confirm the second user cannot see the first user's rows.
9. Test the local data claim flow using a browser with pre-auth localStorage data.
10. In dev mode, test Developer Tools scoped reset for the signed-in user.

### Troubleshooting

- `Missing Supabase access token` or `Invalid or expired Supabase access token`: sign out and sign in again. Confirm the frontend is using `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- RLS permission errors: run `supabase/auth-migration.sql`, confirm `user_id` is set on new rows, and confirm API routes use `SUPABASE_ANON_KEY`, not a service role shortcut.
- Missing env vars: local-only mode is expected if `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` is absent. Server routes also need `SUPABASE_URL` and `SUPABASE_ANON_KEY`.
- Legacy rows not showing: rows with `user_id is null` are intentionally hidden by RLS until manually claimed or re-imported.
- Vercel deployment still failing after env changes: redeploy after changing env vars.

## Development

Start the app:

```bash
npm run dev
```

Build for production:

```bash
npm run build
```

### Extraction regression suite

Run every unit, golden, API, and end-to-end extraction test:

```bash
npm test
```

Run only the extraction suite or its concise benchmark report:

```bash
npm run test:extraction
npm run test:regression
```

The golden dataset lives in `src/data/extractionFixtures.ts`. Each fixture contains source text plus exact expected subjects, marks, teachers, comments, grades, effort, attainment, targets, predicted grades, academic period, classification, confidence, and review count. Add a new object to that array to extend the regression suite; the parameterized golden and end-to-end tests pick it up automatically.

The offline benchmark measures deterministic extraction and validation only, so its AI and OCR latency values are zero unless an injected OCR stage is used. Real API responses include `extractionTimings` with AI call count, AI latency, validation time, and total time. Developer builds also log upload stages, OCR completion, subject/comment counts, duplicate rows, confidence reasons, academic record creation, and the Progress update. These diagnostics are disabled in production.

Clean structured reports use one AI validation call. Messy OCR and unusually long or merged rows use the deeper four-call path, with the independent marks and comments calls running in parallel. If AI is unavailable or returns malformed JSON, deterministic local extraction remains available and the result is labelled `Local fallback`.
