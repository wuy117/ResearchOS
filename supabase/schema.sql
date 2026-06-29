create extension if not exists pgcrypto;

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
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

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

create or replace trigger set_workspaces_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create or replace trigger set_documents_updated_at
before update on public.documents
for each row execute function public.set_updated_at();

create or replace trigger set_document_chunks_updated_at
before update on public.document_chunks
for each row execute function public.set_updated_at();

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

alter table public.workspaces disable row level security;
alter table public.documents disable row level security;
alter table public.document_chunks disable row level security;
alter table public.insights disable row level security;
alter table public.chat_messages disable row level security;
alter table public.study_artifacts disable row level security;
alter table public.performance_records disable row level security;
alter table public.performance_summaries disable row level security;

grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on all tables in schema public to anon, authenticated;
