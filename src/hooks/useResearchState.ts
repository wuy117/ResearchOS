import { useEffect, useRef, useState } from 'react';
import { isSupabaseEnabled } from '../lib/supabase';
import { loadState, saveState, type StorageStatus } from '../services/researchStore';
import type { ResearchState } from '../types/research';
import { loadResearchState } from '../utils/storage';

export type AppStorageStatus = 'loading' | StorageStatus;

export function useResearchState() {
  const [state, setState] = useState<ResearchState>(() => loadResearchState());
  const [storageStatus, setStorageStatus] = useState<AppStorageStatus>(isSupabaseEnabled ? 'client-created' : 'missing-env');
  const hasLoadedRemoteState = useRef(false);

  useEffect(() => {
    let isMounted = true;

    loadState().then(({ state: loadedState, status }) => {
      if (!isMounted) return;

      setState(loadedState);
      setStorageStatus(status);
      hasLoadedRemoteState.current = true;
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasLoadedRemoteState.current) return;

    saveState(state).then((status) => {
      setStorageStatus(status);
    });
  }, [state]);

  return { state, setState, storageStatus };
}
