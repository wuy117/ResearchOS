import { initialState } from '../data/initialState';
import { isSupabaseEnabled, supabase } from '../lib/supabase';
import type {
  ChatMessage,
  Collection,
  DocumentChunk,
  Insight,
  PerformanceRecord,
  PerformanceSummary,
  ResearchDocument,
  ResearchState,
  TutorAttempt,
  TutorExamSession,
  TutorLesson,
  TutorMemory,
  TutorSocraticTurn,
  Workspace,
} from '../types/research';
import { clearResearchState, loadResearchState, saveResearchState } from '../utils/storage';

export type StorageStatus = 'missing-env' | 'auth-required' | 'client-created' | 'connection-failed' | 'connected';
type StoredRow<T> = {
  local_id: string;
  data: T;
  created_at?: string;
  updated_at?: string;
};

type SupabasePayload<T extends { id: string }> = {
  local_id: string;
  user_id?: string;
  data: T;
  updated_at: string;
  workspace_local_id?: string;
  title?: string;
  document_type?: string;
  status?: string;
  tags?: string[];
  document_local_id?: string;
  chunk_index?: number;
  text_content?: string;
  word_count?: number;
  embedding_status?: string;
  embedding_error?: string | null;
};

export type LoadStateResult = {
  state: ResearchState;
  status: StorageStatus;
};

type UserScopedOptions = {
  userId?: string | null;
};

function getNow() {
  return new Date().toISOString();
}

function getSupabaseClient() {
  return isSupabaseEnabled ? supabase : null;
}

function mergeStateFromSupabase(localState: ResearchState, rows: {
  workspaces: Workspace[];
  collections: Collection[];
  documents: ResearchDocument[];
  chunks: DocumentChunk[];
  insights: Insight[];
  chat: ChatMessage[];
  performanceRecords: PerformanceRecord[];
  performanceSummaries: PerformanceSummary[];
  tutorLessons: TutorLesson[];
  tutorAttempts: TutorAttempt[];
  tutorSocraticTurns: TutorSocraticTurn[];
  tutorExamSessions: TutorExamSession[];
  tutorMemory: TutorMemory[];
}): ResearchState {
  return {
    ...initialState,
    ...localState,
    workspaces: rows.workspaces.length ? rows.workspaces : localState.workspaces,
    activeWorkspaceId: localState.activeWorkspaceId || initialState.activeWorkspaceId,
    collections: rows.collections.length ? rows.collections : localState.collections ?? [],
    documents: rows.documents,
    chunks: rows.chunks,
    insights: rows.insights,
    chat: rows.chat,
    performanceRecords: rows.performanceRecords,
    performanceSummaries: rows.performanceSummaries,
    tutorLessons: rows.tutorLessons,
    tutorAttempts: rows.tutorAttempts,
    tutorSocraticTurns: rows.tutorSocraticTurns,
    tutorExamSessions: rows.tutorExamSessions,
    tutorMemory: rows.tutorMemory[0] ?? localState.tutorMemory ?? initialState.tutorMemory,
  };
}

function hasRemoteResearchData(rows: {
  documents: ResearchDocument[];
  collections: Collection[];
  chunks: DocumentChunk[];
  insights: Insight[];
  chat: ChatMessage[];
  performanceRecords: PerformanceRecord[];
  performanceSummaries: PerformanceSummary[];
  tutorLessons: TutorLesson[];
  tutorAttempts: TutorAttempt[];
  tutorSocraticTurns: TutorSocraticTurn[];
  tutorExamSessions: TutorExamSession[];
  tutorMemory: TutorMemory[];
}) {
  return (
    rows.documents.length > 0 ||
    rows.collections.length > 0 ||
    rows.chunks.length > 0 ||
    rows.insights.length > 0 ||
    rows.chat.length > 0 ||
    rows.performanceRecords.length > 0 ||
    rows.performanceSummaries.length > 0 ||
    rows.tutorLessons.length > 0 ||
    rows.tutorAttempts.length > 0 ||
    rows.tutorSocraticTurns.length > 0 ||
    rows.tutorExamSessions.length > 0 ||
    rows.tutorMemory.length > 0
  );
}

function requireUserId(userId?: string | null) {
  if (!userId) {
    throw new Error('Sign in is required before Research OS can read or write Supabase data.');
  }

  return userId;
}

function withUserId<T>(item: T, userId: string): T {
  return item && typeof item === 'object' ? { ...item, userId } : item;
}

function isSecurityOrPermissionError(error: unknown) {
  const message = error instanceof Error ? error.message.toLowerCase() : String(error).toLowerCase();
  return message.includes('row-level security') || message.includes('permission') || message.includes('policy') || message.includes('jwt') || message.includes('auth');
}

async function selectData<T>(table: string, userId?: string | null): Promise<T[]> {
  const client = getSupabaseClient();
  if (!client) return [];
  const ownerId = requireUserId(userId);

  const { data, error } = await client.from(table).select('local_id, data, created_at').eq('user_id', ownerId).order('created_at', { ascending: true });
  if (error) throw error;

  return ((data ?? []) as StoredRow<T>[]).map((row) => withUserId(row.data, ownerId));
}

async function selectOptionalData<T>(table: string, userId?: string | null): Promise<T[]> {
  try {
    return await selectData<T>(table, userId);
  } catch (error) {
    if (isSecurityOrPermissionError(error)) throw error;
    if (import.meta.env.DEV) {
      console.debug(`${table} is unavailable; continuing without optional Tutor data.`, error);
    }

    return [];
  }
}

async function upsertData<T extends { id: string }>(table: string, item: T, userId?: string | null) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase is not configured.');
  const ownerId = requireUserId(userId);

  const now = getNow();
  const { error } = await client.from(table).upsert(buildSupabasePayload(table, item, now, ownerId), { onConflict: 'user_id,local_id' });

  if (error) throw error;
}

async function upsertMany<T extends { id: string }>(table: string, items: T[], userId?: string | null) {
  const client = getSupabaseClient();
  if (!client || items.length === 0) return;
  const ownerId = requireUserId(userId);

  const now = getNow();
  const { error } = await client.from(table).upsert(items.map((item) => buildSupabasePayload(table, item, now, ownerId)), { onConflict: 'user_id,local_id' });

  if (error) throw error;
}

async function upsertOptionalData<T extends { id: string }>(table: string, item: T, userId?: string | null) {
  try {
    await upsertData(table, item, userId);
  } catch (error) {
    if (isSecurityOrPermissionError(error)) throw error;
    if (import.meta.env.DEV) {
      console.debug(`${table} was not saved; optional table may be missing.`, error);
    }
  }
}

async function upsertOptionalMany<T extends { id: string }>(table: string, items: T[], userId?: string | null) {
  try {
    await upsertMany(table, items, userId);
  } catch (error) {
    if (isSecurityOrPermissionError(error)) throw error;
    if (import.meta.env.DEV) {
      console.debug(`${table} was not saved; optional table may be missing.`, error);
    }
  }
}

async function deleteDataByIds(table: string, ids: string[], userId?: string | null) {
  const client = getSupabaseClient();
  if (!client || ids.length === 0) return;
  const ownerId = requireUserId(userId);

  const { error } = await client.from(table).delete().eq('user_id', ownerId).in('local_id', ids);
  if (error) throw error;
}

async function deleteOptionalDataByIds(table: string, ids: string[], userId?: string | null) {
  try {
    await deleteDataByIds(table, ids, userId);
  } catch (error) {
    if (isSecurityOrPermissionError(error)) throw error;
    if (import.meta.env.DEV) {
      console.debug(`${table} rows were not deleted; optional table may be missing.`, error);
    }
  }
}

async function clearTable(table: string, userId?: string | null) {
  const client = getSupabaseClient();
  if (!client) return;
  const ownerId = requireUserId(userId);

  const { error } = await client.from(table).delete().eq('user_id', ownerId).neq('local_id', '__never__');
  if (error) throw error;
}

async function clearOptionalTable(table: string, userId?: string | null) {
  try {
    await clearTable(table, userId);
  } catch (error) {
    if (isSecurityOrPermissionError(error)) throw error;
    if (import.meta.env.DEV) {
      console.debug(`${table} was not cleared; optional table may be missing.`, error);
    }
  }
}

function buildSupabasePayload<T extends { id: string }>(table: string, item: T, updatedAt: string, userId: string): SupabasePayload<T> {
  const payload: SupabasePayload<T> = {
    local_id: item.id,
    user_id: userId,
    data: withUserId(item, userId),
    updated_at: updatedAt,
  };

  if (table === 'documents') {
    const document = item as unknown as ResearchDocument;

    return {
      ...payload,
      workspace_local_id: document.workspaceId,
      title: document.title,
      document_type: document.type,
      status: document.status,
      tags: document.tags,
    };
  }

  if (table === 'document_chunks') {
    const chunk = item as unknown as DocumentChunk;

    return {
      ...payload,
      document_local_id: chunk.documentId,
      chunk_index: chunk.chunkIndex,
      text_content: chunk.text,
      word_count: chunk.wordCount,
      embedding_status: chunk.embeddingStatus ?? 'pending',
      embedding_error: chunk.embeddingError ?? null,
    };
  }

  return payload;
}

export async function loadState(options: UserScopedOptions = {}): Promise<LoadStateResult> {
  const localState = loadResearchState();

  if (!isSupabaseEnabled) {
    return { state: localState, status: 'missing-env' };
  }

  if (!options.userId) {
    return { state: initialState, status: 'auth-required' };
  }

  try {
    const [workspaces, collections, documents, chunks, insights, chat, performanceRecords, performanceSummaries, tutorLessons, tutorAttempts, tutorSocraticTurns, tutorExamSessions, tutorMemory] = await Promise.all([
      selectData<Workspace>('workspaces', options.userId),
      selectOptionalData<Collection>('collections', options.userId),
      selectData<ResearchDocument>('documents', options.userId),
      selectData<DocumentChunk>('document_chunks', options.userId),
      selectData<Insight>('insights', options.userId),
      selectData<ChatMessage>('chat_messages', options.userId),
      selectData<PerformanceRecord>('performance_records', options.userId),
      selectData<PerformanceSummary>('performance_summaries', options.userId),
      selectOptionalData<TutorLesson>('tutor_lessons', options.userId),
      selectOptionalData<TutorAttempt>('tutor_attempts', options.userId),
      selectOptionalData<TutorSocraticTurn>('tutor_socratic_turns', options.userId),
      selectOptionalData<TutorExamSession>('tutor_exam_sessions', options.userId),
      selectOptionalData<TutorMemory>('tutor_memory', options.userId),
    ]);

    const rows = {
      workspaces,
      collections,
      documents,
      chunks,
      insights,
      chat,
      performanceRecords,
      performanceSummaries,
      tutorLessons,
      tutorAttempts,
      tutorSocraticTurns,
      tutorExamSessions,
      tutorMemory,
    };
    const state = hasRemoteResearchData(rows) ? mergeStateFromSupabase(localState, rows) : localState;

    saveResearchState(state);
    return { state, status: 'connected' };
  } catch (error) {
    console.warn('Supabase load failed; using localStorage fallback.', error);
    return { state: localState, status: 'connection-failed' };
  }
}

export async function saveState(state: ResearchState, options: UserScopedOptions = {}): Promise<StorageStatus> {
  saveResearchState(state);

  if (!isSupabaseEnabled) {
    return 'missing-env';
  }

  if (!options.userId) {
    return 'auth-required';
  }

  try {
    await Promise.all([
      upsertMany('workspaces', state.workspaces, options.userId),
      upsertOptionalMany('collections', state.collections, options.userId),
      upsertMany('documents', state.documents, options.userId),
      upsertMany('document_chunks', state.chunks, options.userId),
      upsertMany('insights', state.insights, options.userId),
      upsertMany('chat_messages', state.chat, options.userId),
      upsertMany('performance_records', state.performanceRecords, options.userId),
      upsertMany('performance_summaries', state.performanceSummaries, options.userId),
      upsertOptionalMany('tutor_lessons', state.tutorLessons, options.userId),
      upsertOptionalMany('tutor_attempts', state.tutorAttempts, options.userId),
      upsertOptionalMany('tutor_socratic_turns', state.tutorSocraticTurns, options.userId),
      upsertOptionalMany('tutor_exam_sessions', state.tutorExamSessions, options.userId),
      upsertOptionalData('tutor_memory', { id: 'tutor-memory', ...state.tutorMemory }, options.userId),
    ]);

    return 'connected';
  } catch (error) {
    console.warn('Supabase save failed; localStorage fallback remains current.', error);
    return 'connection-failed';
  }
}

export async function saveWorkspace(workspace: Workspace, options: UserScopedOptions = {}) {
  try {
    await upsertData('workspaces', workspace, options.userId);
  } catch (error) {
    const state = loadResearchState();
    saveResearchState({
      ...state,
      workspaces: state.workspaces.map((item) => (item.id === workspace.id ? workspace : item)),
    });
    console.warn('Workspace saved locally after Supabase failed.', error);
  }
}

export async function saveDocument(document: ResearchDocument, options: UserScopedOptions = {}) {
  try {
    await upsertData('documents', document, options.userId);
  } catch (error) {
    const state = loadResearchState();
    saveResearchState({
      ...state,
      documents: [document, ...state.documents.filter((item) => item.id !== document.id)],
    });
    console.warn('Document saved locally after Supabase failed.', error);
  }
}

export async function saveChunks(chunks: DocumentChunk[], options: UserScopedOptions = {}) {
  try {
    await upsertMany('document_chunks', chunks, options.userId);
  } catch (error) {
    const state = loadResearchState();
    const chunkIds = new Set(chunks.map((chunk) => chunk.id));
    saveResearchState({
      ...state,
      chunks: [...chunks, ...state.chunks.filter((chunk) => !chunkIds.has(chunk.id))],
    });
    console.warn('Document chunks saved locally after Supabase failed.', error);
  }
}

export async function saveInsight(insight: Insight, options: UserScopedOptions = {}) {
  try {
    await upsertData('insights', insight, options.userId);
  } catch (error) {
    const state = loadResearchState();
    saveResearchState({
      ...state,
      insights: [insight, ...state.insights.filter((item) => item.id !== insight.id)],
    });
    console.warn('Insight saved locally after Supabase failed.', error);
  }
}

export async function saveChatMessage(message: ChatMessage, options: UserScopedOptions = {}) {
  try {
    await upsertData('chat_messages', message, options.userId);
  } catch (error) {
    const state = loadResearchState();
    saveResearchState({
      ...state,
      chat: [...state.chat.filter((item) => item.id !== message.id), message],
    });
    console.warn('Chat message saved locally after Supabase failed.', error);
  }
}

export async function savePerformanceRecord(record: PerformanceRecord, options: UserScopedOptions = {}) {
  try {
    await upsertData('performance_records', record, options.userId);
  } catch (error) {
    const state = loadResearchState();
    saveResearchState({
      ...state,
      performanceRecords: [record, ...state.performanceRecords.filter((item) => item.id !== record.id)],
    });
    console.warn('Performance record saved locally after Supabase failed.', error);
  }
}

export async function savePerformanceSummary(summary: PerformanceSummary, options: UserScopedOptions = {}) {
  try {
    await upsertData('performance_summaries', summary, options.userId);
  } catch (error) {
    const state = loadResearchState();
    saveResearchState({
      ...state,
      performanceSummaries: [summary, ...state.performanceSummaries.filter((item) => item.id !== summary.id)],
    });
    console.warn('Performance summary saved locally after Supabase failed.', error);
  }
}

export async function deleteSupabaseRows(rows: Partial<Record<
  | 'workspaces'
  | 'collections'
  | 'documents'
  | 'document_chunks'
  | 'insights'
  | 'chat_messages'
  | 'performance_records'
  | 'performance_summaries'
  | 'tutor_lessons'
  | 'tutor_attempts'
  | 'tutor_socratic_turns'
  | 'tutor_exam_sessions'
  | 'tutor_memory',
  string[]
>>, options: UserScopedOptions = {}) {
  if (!isSupabaseEnabled) return;
  const ownerId = requireUserId(options.userId);

  await Promise.all([
    deleteDataByIds('workspaces', rows.workspaces ?? [], ownerId),
    deleteOptionalDataByIds('collections', rows.collections ?? [], ownerId),
    deleteDataByIds('documents', rows.documents ?? [], ownerId),
    deleteDataByIds('document_chunks', rows.document_chunks ?? [], ownerId),
    deleteDataByIds('insights', rows.insights ?? [], ownerId),
    deleteDataByIds('chat_messages', rows.chat_messages ?? [], ownerId),
    deleteDataByIds('performance_records', rows.performance_records ?? [], ownerId),
    deleteDataByIds('performance_summaries', rows.performance_summaries ?? [], ownerId),
    deleteOptionalDataByIds('tutor_lessons', rows.tutor_lessons ?? [], ownerId),
    deleteOptionalDataByIds('tutor_attempts', rows.tutor_attempts ?? [], ownerId),
    deleteOptionalDataByIds('tutor_socratic_turns', rows.tutor_socratic_turns ?? [], ownerId),
    deleteOptionalDataByIds('tutor_exam_sessions', rows.tutor_exam_sessions ?? [], ownerId),
    deleteOptionalDataByIds('tutor_memory', rows.tutor_memory ?? [], ownerId),
  ]);
}

export type SupabaseResetScope = 'local' | 'supabase' | 'chat' | 'documents' | 'performance' | 'tutor' | 'collections' | 'full';

export async function clearSupabaseScope(scope: SupabaseResetScope, options: UserScopedOptions = {}) {
  if (!isSupabaseEnabled) {
    throw new Error('Supabase is not configured for this app instance.');
  }
  const ownerId = requireUserId(options.userId);

  if (scope === 'local') return;

  if (scope === 'documents' || scope === 'supabase' || scope === 'full') {
    await Promise.all([
      clearTable('insights', ownerId),
      clearTable('document_chunks', ownerId),
      clearTable('documents', ownerId),
    ]);
  }

  if (scope === 'performance' || scope === 'supabase' || scope === 'full') {
    await Promise.all([
      clearTable('performance_records', ownerId),
      clearTable('performance_summaries', ownerId),
    ]);
  }

  if (scope === 'tutor' || scope === 'supabase' || scope === 'full') {
    await Promise.all([
      clearOptionalTable('tutor_lessons', ownerId),
      clearOptionalTable('tutor_attempts', ownerId),
      clearOptionalTable('tutor_socratic_turns', ownerId),
      clearOptionalTable('tutor_exam_sessions', ownerId),
      clearOptionalTable('tutor_memory', ownerId),
    ]);
  }

  if (scope === 'collections' || scope === 'supabase' || scope === 'full') {
    await clearOptionalTable('collections', ownerId);
  }

  if (scope === 'chat' || scope === 'supabase' || scope === 'full') {
    await clearTable('chat_messages', ownerId);
  }

  if (scope === 'supabase' || scope === 'full') {
    await Promise.all([
      clearOptionalTable('study_artifacts', ownerId),
      clearTable('workspaces', ownerId),
    ]);
  }
}

export function clearLocalStateOnly() {
  clearResearchState();
}
