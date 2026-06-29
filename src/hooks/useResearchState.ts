import { useEffect, useRef, useState } from 'react';
import { loadState, saveState } from '../services/researchStore';
import type { ResearchState } from '../types/research';
import { loadResearchState } from '../utils/storage';

export type StorageStatus = 'loading' | 'local' | 'supabase';

export function useResearchState() {
  const [state, setState] = useState<ResearchState>(() => loadResearchState());
  const [storageStatus, setStorageStatus] = useState<StorageStatus>('loading');
  const hasLoadedRemoteState = useRef(false);

  useEffect(() => {
    let isMounted = true;

    loadState().then(({ state: loadedState, mode }) => {
      if (!isMounted) return;

      setState(loadedState);
      setStorageStatus(mode);
      hasLoadedRemoteState.current = true;
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedRemoteState.current) return;

    saveState(state).then((mode) => {
      setStorageStatus(mode);
    });
  }, [state]);

  return { state, setState, storageStatus };
}
