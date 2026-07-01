-- Development-only rollback helper for Research OS Auth/RLS work.
-- Do not run casually in production. Disabling RLS can expose all app rows to
-- any client using the anon key, depending on grants.
--
-- This script keeps user_id columns and data by default. Removing user_id columns
-- is intentionally left commented out at the bottom.

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
      execute format('drop policy if exists %I on public.%I', table_name || '_select_own_rows', table_name);
      execute format('drop policy if exists %I on public.%I', table_name || '_insert_own_rows', table_name);
      execute format('drop policy if exists %I on public.%I', table_name || '_update_own_rows', table_name);
      execute format('drop policy if exists %I on public.%I', table_name || '_delete_own_rows', table_name);
      execute format('alter table public.%I disable row level security', table_name);
    end if;
  end loop;
end;
$$;

-- If you are rebuilding a development database from scratch and have exported
-- anything important, you may choose to remove auth ownership columns manually.
-- Uncomment only in a disposable development project:
--
-- alter table public.workspaces drop column if exists user_id;
-- alter table public.documents drop column if exists user_id;
-- alter table public.document_chunks drop column if exists user_id;
-- alter table public.collections drop column if exists user_id;
-- alter table public.insights drop column if exists user_id;
-- alter table public.chat_messages drop column if exists user_id;
-- alter table public.study_artifacts drop column if exists user_id;
-- alter table public.performance_records drop column if exists user_id;
-- alter table public.performance_summaries drop column if exists user_id;
-- alter table public.tutor_lessons drop column if exists user_id;
-- alter table public.tutor_attempts drop column if exists user_id;
-- alter table public.tutor_socratic_turns drop column if exists user_id;
-- alter table public.tutor_exam_sessions drop column if exists user_id;
-- alter table public.tutor_memory drop column if exists user_id;
