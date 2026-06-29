import { initialState } from '../data/initialState';
import type { ResearchState } from '../types/research';

const STORAGE_KEY = 'research-os-state-v1';
const DEMO_DOCUMENT_IDS = new Set(['doc-1', 'doc-2', 'doc-3', 'doc-4']);
const DEMO_INSIGHT_IDS = new Set(['insight-1', 'insight-2', 'insight-3']);
const DEMO_ACTION_IDS = new Set(['action-1', 'action-2', 'action-3']);
const DEMO_CHAT_IDS = new Set(['chat-1', 'chat-2']);

function removeKnownDemoData(state: ResearchState): ResearchState {
  return {
    ...state,
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

    return removeKnownDemoData(state);
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
