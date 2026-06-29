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

export type StorageStatus = 'missing-env' | 'client-created' | 'connection-failed' | 'connected';
type StoredRow<T> = {
  local_id: string;
  data: T;
  created_at?: string;
  updated_at?: string;
};

type SupabasePayload<T extends { id: string }> = {
  local_id: string;
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

async function selectData<T>(table: string): Promise<T[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client.from(table).select('local_id, data, created_at').order('created_at', { ascending: true });
  if (error) throw error;

  return ((data ?? []) as StoredRow<T>[]).map((row) => row.data);
}

async function selectOptionalData<T>(table: string): Promise<T[]> {
  try {
    return await selectData<T>(table);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.debug(`${table} is unavailable; continuing without optional Tutor data.`, error);
    }

    return [];
  }
}

async function upsertData<T extends { id: string }>(table: string, item: T) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase is not configured.');

  const now = getNow();
  const { error } = await client.from(table).upsert(buildSupabasePayload(table, item, now), { onConflict: 'local_id' });

  if (error) throw error;
}

async function upsertMany<T extends { id: string }>(table: string, items: T[]) {
  const client = getSupabaseClient();
  if (!client || items.length === 0) return;

  const now = getNow();
  const { error } = await client.from(table).upsert(items.map((item) => buildSupabasePayload(table, item, now)), { onConflict: 'local_id' });

  if (error) throw error;
}

async function upsertOptionalData<T extends { id: string }>(table: string, item: T) {
  try {
    await upsertData(table, item);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.debug(`${table} was not saved; optional table may be missing.`, error);
    }
  }
}

async function upsertOptionalMany<T extends { id: string }>(table: string, items: T[]) {
  try {
    await upsertMany(table, items);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.debug(`${table} was not saved; optional table may be missing.`, error);
    }
  }
}

async function deleteDataByIds(table: string, ids: string[]) {
  const client = getSupabaseClient();
  if (!client || ids.length === 0) return;

  const { error } = await client.from(table).delete().in('local_id', ids);
  if (error) throw error;
}

async function deleteOptionalDataByIds(table: string, ids: string[]) {
  try {
    await deleteDataByIds(table, ids);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.debug(`${table} rows were not deleted; optional table may be missing.`, error);
    }
  }
}

async function clearTable(table: string) {
  const client = getSupabaseClient();
  if (!client) return;

  const { error } = await client.from(table).delete().neq('local_id', '__never__');
  if (error) throw error;
}

async function clearOptionalTable(table: string) {
  try {
    await clearTable(table);
  } catch (error) {
    if (import.meta.env.DEV) {
      console.debug(`${table} was not cleared; optional table may be missing.`, error);
    }
  }
}

function buildSupabasePayload<T extends { id: string }>(table: string, item: T, updatedAt: string): SupabasePayload<T> {
  const payload: SupabasePayload<T> = {
    local_id: item.id,
    data: item,
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

export async function loadState(): Promise<LoadStateResult> {
  const localState = loadResearchState();

  if (!isSupabaseEnabled) {
    return { state: localState, status: 'missing-env' };
  }

  try {
    const [workspaces, collections, documents, chunks, insights, chat, performanceRecords, performanceSummaries, tutorLessons, tutorAttempts, tutorSocraticTurns, tutorExamSessions, tutorMemory] = await Promise.all([
      selectData<Workspace>('workspaces'),
      selectOptionalData<Collection>('collections'),
      selectData<ResearchDocument>('documents'),
      selectData<DocumentChunk>('document_chunks'),
      selectData<Insight>('insights'),
      selectData<ChatMessage>('chat_messages'),
      selectData<PerformanceRecord>('performance_records'),
      selectData<PerformanceSummary>('performance_summaries'),
      selectOptionalData<TutorLesson>('tutor_lessons'),
      selectOptionalData<TutorAttempt>('tutor_attempts'),
      selectOptionalData<TutorSocraticTurn>('tutor_socratic_turns'),
      selectOptionalData<TutorExamSession>('tutor_exam_sessions'),
      selectOptionalData<TutorMemory>('tutor_memory'),
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

export async function saveState(state: ResearchState): Promise<StorageStatus> {
  saveResearchState(state);

  if (!isSupabaseEnabled) {
    return 'missing-env';
  }

  try {
    await Promise.all([
      upsertMany('workspaces', state.workspaces),
      upsertOptionalMany('collections', state.collections),
      upsertMany('documents', state.documents),
      upsertMany('document_chunks', state.chunks),
      upsertMany('insights', state.insights),
      upsertMany('chat_messages', state.chat),
      upsertMany('performance_records', state.performanceRecords),
      upsertMany('performance_summaries', state.performanceSummaries),
      upsertOptionalMany('tutor_lessons', state.tutorLessons),
      upsertOptionalMany('tutor_attempts', state.tutorAttempts),
      upsertOptionalMany('tutor_socratic_turns', state.tutorSocraticTurns),
      upsertOptionalMany('tutor_exam_sessions', state.tutorExamSessions),
      upsertOptionalData('tutor_memory', { id: 'tutor-memory', ...state.tutorMemory }),
    ]);

    return 'connected';
  } catch (error) {
    console.warn('Supabase save failed; localStorage fallback remains current.', error);
    return 'connection-failed';
  }
}

export async function saveWorkspace(workspace: Workspace) {
  try {
    await upsertData('workspaces', workspace);
  } catch (error) {
    const state = loadResearchState();
    saveResearchState({
      ...state,
      workspaces: state.workspaces.map((item) => (item.id === workspace.id ? workspace : item)),
    });
    console.warn('Workspace saved locally after Supabase failed.', error);
  }
}

export async function saveDocument(document: ResearchDocument) {
  try {
    await upsertData('documents', document);
  } catch (error) {
    const state = loadResearchState();
    saveResearchState({
      ...state,
      documents: [document, ...state.documents.filter((item) => item.id !== document.id)],
    });
    console.warn('Document saved locally after Supabase failed.', error);
  }
}

export async function saveChunks(chunks: DocumentChunk[]) {
  try {
    await upsertMany('document_chunks', chunks);
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

export async function saveInsight(insight: Insight) {
  try {
    await upsertData('insights', insight);
  } catch (error) {
    const state = loadResearchState();
    saveResearchState({
      ...state,
      insights: [insight, ...state.insights.filter((item) => item.id !== insight.id)],
    });
    console.warn('Insight saved locally after Supabase failed.', error);
  }
}

export async function saveChatMessage(message: ChatMessage) {
  try {
    await upsertData('chat_messages', message);
  } catch (error) {
    const state = loadResearchState();
    saveResearchState({
      ...state,
      chat: [...state.chat.filter((item) => item.id !== message.id), message],
    });
    console.warn('Chat message saved locally after Supabase failed.', error);
  }
}

export async function savePerformanceRecord(record: PerformanceRecord) {
  try {
    await upsertData('performance_records', record);
  } catch (error) {
    const state = loadResearchState();
    saveResearchState({
      ...state,
      performanceRecords: [record, ...state.performanceRecords.filter((item) => item.id !== record.id)],
    });
    console.warn('Performance record saved locally after Supabase failed.', error);
  }
}

export async function savePerformanceSummary(summary: PerformanceSummary) {
  try {
    await upsertData('performance_summaries', summary);
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
>>) {
  if (!isSupabaseEnabled) return;

  await Promise.all([
    deleteDataByIds('workspaces', rows.workspaces ?? []),
    deleteOptionalDataByIds('collections', rows.collections ?? []),
    deleteDataByIds('documents', rows.documents ?? []),
    deleteDataByIds('document_chunks', rows.document_chunks ?? []),
    deleteDataByIds('insights', rows.insights ?? []),
    deleteDataByIds('chat_messages', rows.chat_messages ?? []),
    deleteDataByIds('performance_records', rows.performance_records ?? []),
    deleteDataByIds('performance_summaries', rows.performance_summaries ?? []),
    deleteOptionalDataByIds('tutor_lessons', rows.tutor_lessons ?? []),
    deleteOptionalDataByIds('tutor_attempts', rows.tutor_attempts ?? []),
    deleteOptionalDataByIds('tutor_socratic_turns', rows.tutor_socratic_turns ?? []),
    deleteOptionalDataByIds('tutor_exam_sessions', rows.tutor_exam_sessions ?? []),
    deleteOptionalDataByIds('tutor_memory', rows.tutor_memory ?? []),
  ]);
}

export type SupabaseResetScope = 'documents' | 'performance' | 'tutor' | 'collections' | 'full';

export async function clearSupabaseScope(scope: SupabaseResetScope) {
  if (!isSupabaseEnabled) {
    throw new Error('Supabase is not configured for this app instance.');
  }

  if (scope === 'documents' || scope === 'full') {
    await Promise.all([
      clearTable('document_chunks'),
      clearTable('documents'),
    ]);
  }

  if (scope === 'performance' || scope === 'full') {
    await Promise.all([
      clearTable('performance_records'),
      clearTable('performance_summaries'),
    ]);
  }

  if (scope === 'tutor' || scope === 'full') {
    await Promise.all([
      clearOptionalTable('tutor_lessons'),
      clearOptionalTable('tutor_attempts'),
      clearOptionalTable('tutor_socratic_turns'),
      clearOptionalTable('tutor_exam_sessions'),
      clearOptionalTable('tutor_memory'),
    ]);
  }

  if (scope === 'collections' || scope === 'full') {
    await clearOptionalTable('collections');
  }

  if (scope === 'full') {
    await Promise.all([
      clearTable('insights'),
      clearTable('chat_messages'),
    ]);
  }
}

export function clearLocalStateOnly() {
  clearResearchState();
}
