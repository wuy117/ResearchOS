import { initialState } from '../data/mockData';
import type { ResearchState } from '../types/research';

const STORAGE_KEY = 'research-os-state-v1';

export function loadResearchState(): ResearchState {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) {
      return initialState;
    }

    return {
      ...initialState,
      ...JSON.parse(saved),
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
