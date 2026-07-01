import { initialState } from '../data/initialState';
import type { ResearchState } from '../types/research';

const STORAGE_KEY = 'research-os-state-v1';
const CLAIM_STORAGE_KEY = 'research-os-local-claim-v1';
const DEMO_DOCUMENT_IDS = new Set(['doc-1', 'doc-2', 'doc-3', 'doc-4']);
const DEMO_INSIGHT_IDS = new Set(['insight-1', 'insight-2', 'insight-3']);
const DEMO_ACTION_IDS = new Set(['action-1', 'action-2', 'action-3']);
const DEMO_CHAT_IDS = new Set(['chat-1', 'chat-2']);
const DEMO_WORKSPACE_IDS = new Set([
  'workspace-climate',
  'workspace-attention',
  'workspace-thesis',
  'workspace-biology',
  'workspace-history',
  'workspace-ai-medicine',
  'workspace-music-analysis',
  'workspace-classical-civilisation',
]);

function removeKnownDemoData(state: ResearchState): ResearchState {
  const workspaceIdsWithDocuments = new Set(state.documents.map((document) => document.workspaceId));

  return {
    ...state,
    workspaces: state.workspaces.filter((workspace) => !DEMO_WORKSPACE_IDS.has(workspace.id) || workspaceIdsWithDocuments.has(workspace.id)),
    documents: state.documents.filter((document) => !DEMO_DOCUMENT_IDS.has(document.id)),
    chunks: state.chunks.filter((chunk) => !DEMO_DOCUMENT_IDS.has(chunk.documentId)),
    insights: state.insights.filter((insight) => !DEMO_INSIGHT_IDS.has(insight.id) && !DEMO_DOCUMENT_IDS.has(insight.sourceId)),
    actions: state.actions.filter((action) => !DEMO_ACTION_IDS.has(action.id)),
    chat: state.chat.filter((message) => !DEMO_CHAT_IDS.has(message.id)),
  };
}

export function loadResearchState(): ResearchState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return initialState;
    }

    const parsed = JSON.parse(saved) as Partial<ResearchState>;

    const state = {
      ...initialState,
      ...parsed,
      chunks: parsed.chunks ?? [],
      collections: parsed.collections ?? [],
      documents: parsed.documents ?? initialState.documents,
      insights: parsed.insights ?? [],
      actions: parsed.actions ?? [],
      chat: parsed.chat ?? [],
      performanceRecords: parsed.performanceRecords ?? [],
      performanceSummaries: parsed.performanceSummaries ?? [],
      tutorLessons: parsed.tutorLessons ?? [],
      tutorAttempts: parsed.tutorAttempts ?? [],
      tutorSocraticTurns: parsed.tutorSocraticTurns ?? [],
      tutorExamSessions: parsed.tutorExamSessions ?? [],
      tutorMemory: parsed.tutorMemory ?? initialState.tutorMemory,
    };

    const cleaned = removeKnownDemoData(state);

    return {
      ...cleaned,
      workspaces: cleaned.workspaces.length ? cleaned.workspaces : initialState.workspaces,
      activeWorkspaceId: cleaned.workspaces.some((workspace) => workspace.id === cleaned.activeWorkspaceId)
        ? cleaned.activeWorkspaceId
        : cleaned.workspaces[0]?.id ?? initialState.activeWorkspaceId,
    };
  } catch {
    return initialState;
  }
}

export function saveResearchState(state: ResearchState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Local-first apps should keep running even when browser storage is unavailable.
  }
}

export function saveClaimableResearchState(state: ResearchState) {
  try {
    localStorage.setItem(CLAIM_STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Claim snapshots are best-effort; the live app should keep working.
  }
}

export function loadClaimableResearchState(): ResearchState | null {
  try {
    const saved = localStorage.getItem(CLAIM_STORAGE_KEY);
    return saved ? ({ ...initialState, ...(JSON.parse(saved) as Partial<ResearchState>) } as ResearchState) : null;
  } catch {
    return null;
  }
}

export function clearClaimableResearchState() {
  try {
    localStorage.removeItem(CLAIM_STORAGE_KEY);
  } catch {
    // Clearing a claim snapshot should never crash the app.
  }
}

export function clearResearchState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Clearing local data should never crash the app.
  }
}

export function getResearchStateSummary(state: ResearchState) {
  return {
    documents: state.documents.length,
    chunks: state.chunks.length,
    performanceRecords: state.performanceRecords.length,
    tutorSessions: state.tutorLessons.length + state.tutorSocraticTurns.length + state.tutorExamSessions.length,
    collections: state.collections.length,
  };
}

export function hasClaimableResearchState(state: ResearchState) {
  const summary = getResearchStateSummary(state);
  const userOwnedItems = [
    ...state.workspaces,
    ...state.collections,
    ...state.documents,
    ...state.chunks,
    ...state.insights,
    ...state.chat,
    ...state.performanceRecords,
    ...state.performanceSummaries,
    ...state.tutorLessons,
    ...state.tutorAttempts,
    ...state.tutorSocraticTurns,
    ...state.tutorExamSessions,
  ];

  return Object.values(summary).some((value) => value > 0) && !userOwnedItems.some((item) => Boolean(item.userId));
}

export function getResearchStorageStats() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    return {
      hasState: Boolean(saved),
      bytes: saved ? new Blob([saved]).size : 0,
      keys: Object.keys(localStorage).length,
    };
  } catch {
    return {
      hasState: false,
      bytes: 0,
      keys: 0,
    };
  }
}
