import { initialState } from '../data/mockData';
import type { ResearchState } from '../types/research';

const STORAGE_KEY = 'research-os-state-v1';

export function loadResearchState(): ResearchState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return initialState;
    }

    const parsed = JSON.parse(saved) as Partial<ResearchState>;

    return {
      ...initialState,
      ...parsed,
      chunks: parsed.chunks ?? [],
      documents: parsed.documents ?? initialState.documents,
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
