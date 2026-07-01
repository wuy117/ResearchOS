-- Research OS Supabase Auth / RLS migration.
-- Run manually in the Supabase SQL Editor after supabase/schema.sql.
-- This migration is designed to be re-runnable.
--
-- Legacy rows with null user_id are intentionally preserved. They will not be
-- visible through normal authenticated RLS policies until you deliberately claim
-- or migrate them to a specific auth.users.id.

create extension if not exists pgcrypto;
create extension if not exists vector;

create table if not exists public.collections (
  id uuid primary key default gen_random_uuid(),
  local_id text not null,
  name text,
  description text,
  source text,
  data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

do $$
begin
  if not exists (
    select 1
    from pg_trigger
    where tgname = 'set_collections_updated_at'
  ) and to_regprocedure('public.set_updated_at()') is not null then
    create trigger set_collections_updated_at
    before update on public.collections
    for each row execute function public.set_updated_at();
  end if;
end;
$$;

do $$
declare
  table_name text;
  tables text[] := array[
    'workspaces',
    'documents',
    'document_chunks',
    'collections',
    'insights',
    'chat_messages',
    'study_artifacts',
    'performance_records',
    'performance_summaries',
    'tutor_lessons',
    'tutor_attempts',
    'tutor_socratic_turns',
    'tutor_exam_sessions',
    'tutor_memory'
  ];
begin
  foreach table_name in array tables loop
    if to_regclass(format('public.%I', table_name)) is not null then
      execute format('alter table public.%I add column if not exists user_id uuid references auth.users(id) on delete cascade', table_name);
      execute format('create index if not exists %I on public.%I(user_id)', table_name || '_user_id_idx', table_name);

      -- The original schema used globally unique local_id values. Authenticated
      -- multi-user data needs IDs to be unique per user instead.
      execute format('alter table public.%I drop constraint if exists %I', table_name, table_name || '_local_id_key');
      execute format('create unique index if not exists %I on public.%I(user_id, local_id)', table_name || '_user_local_id_key', table_name);

      execute format('alter table public.%I enable row level security', table_name);

      execute format('drop policy if exists %I on public.%I', table_name || '_select_own_rows', table_name);
      execute format('drop policy if exists %I on public.%I', table_name || '_insert_own_rows', table_name);
      execute format('drop policy if exists %I on public.%I', table_name || '_update_own_rows', table_name);
      execute format('drop policy if exists %I on public.%I', table_name || '_delete_own_rows', table_name);

      execute format(
        'create policy %I on public.%I for select to authenticated using (auth.uid() = user_id)',
        table_name || '_select_own_rows',
        table_name
      );
      execute format(
        'create policy %I on public.%I for insert to authenticated with check (auth.uid() = user_id)',
        table_name || '_insert_own_rows',
        table_name
      );
      execute format(
        'create policy %I on public.%I for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id)',
        table_name || '_update_own_rows',
        table_name
      );
      execute format(
        'create policy %I on public.%I for delete to authenticated using (auth.uid() = user_id)',
        table_name || '_delete_own_rows',
        table_name
      );
    end if;
  end loop;
end;
$$;

create or replace function public.match_document_chunks(
  query_embedding vector,
  match_count int,
  workspace_filter text default null,
  user_filter uuid default auth.uid()
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
    on d.user_id = c.user_id
   and d.local_id = coalesce(c.document_local_id, c.data->>'documentId')
  where c.user_id = user_filter
    and d.user_id = user_filter
    and c.embedding is not null
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

grant usage on schema public to authenticated;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant execute on function public.match_document_chunks(vector, int, text, uuid) to authenticated;

comment on column public.documents.user_id is
  'Research OS owner. Legacy rows may be null until manually claimed or re-imported by a signed-in user.';
