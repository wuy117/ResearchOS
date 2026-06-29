import { initialState } from '../data/initialState';
import { isSupabaseEnabled, supabase } from '../lib/supabase';
import type {
  ChatMessage,
  DocumentChunk,
  Insight,
  PerformanceRecord,
  PerformanceSummary,
  ResearchDocument,
  ResearchState,
  Workspace,
} from '../types/research';
import { loadResearchState, saveResearchState } from '../utils/storage';

export type StorageStatus = 'missing-env' | 'client-created' | 'connection-failed' | 'connected';
type StoredRow<T> = {
  local_id: string;
  data: T;
  created_at?: string;
  updated_at?: string;
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
  documents: ResearchDocument[];
  chunks: DocumentChunk[];
  insights: Insight[];
  chat: ChatMessage[];
  performanceRecords: PerformanceRecord[];
  performanceSummaries: PerformanceSummary[];
}): ResearchState {
  return {
    ...initialState,
    ...localState,
    workspaces: rows.workspaces.length ? rows.workspaces : localState.workspaces,
    activeWorkspaceId: localState.activeWorkspaceId || initialState.activeWorkspaceId,
    documents: rows.documents,
    chunks: rows.chunks,
    insights: rows.insights,
    chat: rows.chat,
    performanceRecords: rows.performanceRecords,
    performanceSummaries: rows.performanceSummaries,
  };
}

function hasRemoteResearchData(rows: {
  documents: ResearchDocument[];
  chunks: DocumentChunk[];
  insights: Insight[];
  chat: ChatMessage[];
  performanceRecords: PerformanceRecord[];
  performanceSummaries: PerformanceSummary[];
}) {
  return (
    rows.documents.length > 0 ||
    rows.chunks.length > 0 ||
    rows.insights.length > 0 ||
    rows.chat.length > 0 ||
    rows.performanceRecords.length > 0 ||
    rows.performanceSummaries.length > 0
  );
}

async function selectData<T>(table: string): Promise<T[]> {
  const client = getSupabaseClient();
  if (!client) return [];

  const { data, error } = await client.from(table).select('local_id, data, created_at').order('created_at', { ascending: true });
  if (error) throw error;

  return ((data ?? []) as StoredRow<T>[]).map((row) => row.data);
}

async function upsertData<T extends { id: string }>(table: string, item: T) {
  const client = getSupabaseClient();
  if (!client) throw new Error('Supabase is not configured.');

  const now = getNow();
  const { error } = await client.from(table).upsert(
    {
      local_id: item.id,
      data: item,
      updated_at: now,
    },
    { onConflict: 'local_id' },
  );

  if (error) throw error;
}

async function upsertMany<T extends { id: string }>(table: string, items: T[]) {
  const client = getSupabaseClient();
  if (!client || items.length === 0) return;

  const now = getNow();
  const { error } = await client.from(table).upsert(
    items.map((item) => ({
      local_id: item.id,
      data: item,
      updated_at: now,
    })),
    { onConflict: 'local_id' },
  );

  if (error) throw error;
}

export async function loadState(): Promise<LoadStateResult> {
  const localState = loadResearchState();

  if (!isSupabaseEnabled) {
    return { state: localState, status: 'missing-env' };
  }

  try {
    const [workspaces, documents, chunks, insights, chat, performanceRecords, performanceSummaries] = await Promise.all([
      selectData<Workspace>('workspaces'),
      selectData<ResearchDocument>('documents'),
      selectData<DocumentChunk>('document_chunks'),
      selectData<Insight>('insights'),
      selectData<ChatMessage>('chat_messages'),
      selectData<PerformanceRecord>('performance_records'),
      selectData<PerformanceSummary>('performance_summaries'),
    ]);

    const rows = {
      workspaces,
      documents,
      chunks,
      insights,
      chat,
      performanceRecords,
      performanceSummaries,
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
      upsertMany('documents', state.documents),
      upsertMany('document_chunks', state.chunks),
      upsertMany('insights', state.insights),
      upsertMany('chat_messages', state.chat),
      upsertMany('performance_records', state.performanceRecords),
      upsertMany('performance_summaries', state.performanceSummaries),
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
