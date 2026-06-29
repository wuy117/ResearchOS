create extension if not exists pgcrypto;
create extension if not exists vector;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.workspaces (
  id uuid primary key default gen_random_uuid(),
  local_id text not null unique,
  name text,
  description text,
  color text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.documents (
  id uuid primary key default gen_random_uuid(),
  local_id text not null unique,
  workspace_local_id text,
  title text,
  document_type text,
  status text,
  tags jsonb not null default '[]'::jsonb,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.document_chunks (
  id uuid primary key default gen_random_uuid(),
  local_id text not null unique,
  document_local_id text,
  chunk_index integer,
  text_content text,
  word_count integer,
  embedding vector,
  embedding_model text,
  embedding_status text not null default 'pending' check (embedding_status in ('pending', 'embedded', 'failed')),
  embedding_error text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.document_chunks add column if not exists embedding vector;
alter table public.document_chunks add column if not exists embedding_model text;
alter table public.document_chunks add column if not exists embedding_status text not null default 'pending';
alter table public.document_chunks add column if not exists embedding_error text;
alter table public.document_chunks add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'document_chunks_embedding_status_check'
      and conrelid = 'public.document_chunks'::regclass
  ) then
    alter table public.document_chunks
      add constraint document_chunks_embedding_status_check
      check (embedding_status in ('pending', 'embedded', 'failed'));
  end if;
end;
$$;

create table if not exists public.insights (
  id uuid primary key default gen_random_uuid(),
  local_id text not null unique,
  source_local_id text,
  title text,
  body text,
  confidence numeric,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.chat_messages (
  id uuid primary key default gen_random_uuid(),
  local_id text not null unique,
  role text,
  content text,
  citations jsonb not null default '[]'::jsonb,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.study_artifacts (
  id uuid primary key default gen_random_uuid(),
  local_id text not null unique,
  workspace_local_id text,
  document_local_ids jsonb not null default '[]'::jsonb,
  artifact_type text,
  title text,
  content jsonb not null default '{}'::jsonb,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.performance_records (
  id uuid primary key default gen_random_uuid(),
  local_id text not null unique,
  source_document_local_id text,
  subject text,
  assessment_type text,
  score numeric,
  max_score numeric,
  percentage numeric,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.performance_summaries (
  id uuid primary key default gen_random_uuid(),
  local_id text not null unique,
  generated_at timestamptz,
  subjects jsonb not null default '[]'::jsonb,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tutor_lessons (
  id uuid primary key default gen_random_uuid(),
  local_id text not null unique,
  workspace_local_id text,
  topic text,
  status text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tutor_attempts (
  id uuid primary key default gen_random_uuid(),
  local_id text not null unique,
  workspace_local_id text,
  lesson_local_id text,
  mode text,
  topic text,
  correct boolean,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tutor_socratic_turns (
  id uuid primary key default gen_random_uuid(),
  local_id text not null unique,
  workspace_local_id text,
  topic text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tutor_exam_sessions (
  id uuid primary key default gen_random_uuid(),
  local_id text not null unique,
  workspace_local_id text,
  topic text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.tutor_memory (
  id uuid primary key default gen_random_uuid(),
  local_id text not null unique,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace trigger set_workspaces_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create or replace trigger set_documents_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

create or replace trigger set_document_chunks_updated_at
before update on public.document_chunks
for each row execute function public.set_updated_at();

create or replace function public.match_document_chunks(
  query_embedding vector,
  match_count int,
  workspace_filter text default null
)
returns table (
  id text,
  document_id text,
  text text,
  similarity double precision,
  page_start int,
  page_end int,
  document_title text,
  document_type text
)
language sql
stable
as $$
  select
    c.local_id as id,
    coalesce(c.document_local_id, c.data->>'documentId') as document_id,
    coalesce(c.text_content, c.data->>'text') as text,
    1 - (c.embedding <=> query_embedding) as similarity,
    nullif(c.data->>'pageStart', '')::int as page_start,
    nullif(c.data->>'pageEnd', '')::int as page_end,
    coalesce(d.title, d.data->>'title') as document_title,
    coalesce(d.document_type, d.data->>'type') as document_type
  from public.document_chunks c
  join public.documents d
    on d.local_id = coalesce(c.document_local_id, c.data->>'documentId')
  where c.embedding is not null
    and c.embedding_status = 'embedded'
    and (
      workspace_filter is null
      or workspace_filter = ''
      or d.workspace_local_id = workspace_filter
      or d.data->>'workspaceId' = workspace_filter
    )
  order by c.embedding <=> query_embedding
  limit greatest(match_count, 1);
$$;

create or replace trigger set_insights_updated_at
before update on public.insights
for each row execute function public.set_updated_at();

create or replace trigger set_chat_messages_updated_at
before update on public.chat_messages
for each row execute function public.set_updated_at();

create or replace trigger set_study_artifacts_updated_at
before update on public.study_artifacts
for each row execute function public.set_updated_at();

create or replace trigger set_performance_records_updated_at
before update on public.performance_records
for each row execute function public.set_updated_at();

create or replace trigger set_performance_summaries_updated_at
before update on public.performance_summaries
for each row execute function public.set_updated_at();

create or replace trigger set_tutor_lessons_updated_at
before update on public.tutor_lessons
for each row execute function public.set_updated_at();

create or replace trigger set_tutor_attempts_updated_at
before update on public.tutor_attempts
for each row execute function public.set_updated_at();

create or replace trigger set_tutor_socratic_turns_updated_at
before update on public.tutor_socratic_turns
for each row execute function public.set_updated_at();

create or replace trigger set_tutor_exam_sessions_updated_at
before update on public.tutor_exam_sessions
for each row execute function public.set_updated_at();

create or replace trigger set_tutor_memory_updated_at
before update on public.tutor_memory
for each row execute function public.set_updated_at();

alter table public.workspaces disable row level security;
alter table public.documents disable row level security;
alter table public.document_chunks disable row level security;
alter table public.insights disable row level security;
alter table public.chat_messages disable row level security;
alter table public.study_artifacts disable row level security;
alter table public.performance_records disable row level security;
alter table public.performance_summaries disable row level security;
alter table public.tutor_lessons disable row level security;
alter table public.tutor_attempts disable row level security;
alter table public.tutor_socratic_turns disable row level security;
alter table public.tutor_exam_sessions disable row level security;
alter table public.tutor_memory disable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
grant execute on function public.match_document_chunks(vector, int, text) to anon, authenticated;
