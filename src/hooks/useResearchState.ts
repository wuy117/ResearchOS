import { useEffect, useState } from 'react';
import { loadResearchState, saveResearchState } from '../utils/storage';
import type { ResearchState } from '../types/research';

export function useResearchState() {
  const [state, setState] = useState<ResearchState>(() => loadResearchState());

  useEffect(() => {
    saveResearchState(state);
  }, [state]);

  return { state, setState };
}
