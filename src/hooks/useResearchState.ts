import { useEffect, useRef, useState } from 'react';
import { initialState } from '../data/initialState';
import { isSupabaseEnabled } from '../lib/supabase';
import { loadState, saveState, type StorageStatus } from '../services/researchStore';
import type { ResearchState } from '../types/research';
import {
  clearClaimableResearchState,
  hasClaimableResearchState,
  loadClaimableResearchState,
  loadResearchState,
  saveClaimableResearchState,
} from '../utils/storage';

export type AppStorageStatus = 'loading' | StorageStatus;

export function useResearchState(userId?: string | null) {
  const [state, setState] = useState<ResearchState>(() => loadResearchState());
  const [storageStatus, setStorageStatus] = useState<AppStorageStatus>(isSupabaseEnabled ? 'client-created' : 'missing-env');
  const [claimableLocalState, setClaimableLocalState] = useState<ResearchState | null>(() => loadClaimableResearchState());
  const hasLoadedRemoteState = useRef(false);

  useEffect(() => {
    let isMounted = true;
    hasLoadedRemoteState.current = false;

    if (isSupabaseEnabled && !userId) {
      setState(initialState);
      setStorageStatus('auth-required');
      setClaimableLocalState(loadClaimableResearchState());
      return () => {
        isMounted = false;
      };
    }

    const localBeforeRemote = loadResearchState();
    if (isSupabaseEnabled && userId && hasClaimableResearchState(localBeforeRemote)) {
      saveClaimableResearchState(localBeforeRemote);
      setClaimableLocalState(localBeforeRemote);
    }

    loadState({ userId }).then(({ state: loadedState, status }) => {
      if (!isMounted) return;

      setState(loadedState);
      setStorageStatus(status);
      hasLoadedRemoteState.current = true;
    });

    return () => {
      isMounted = false;
    };
  }, [userId]);

  useEffect(() => {
    if (!hasLoadedRemoteState.current) return;

    saveState(state, { userId }).then((status) => {
      setStorageStatus(status);
    });
  }, [state, userId]);

  function dismissClaimableLocalState() {
    clearClaimableResearchState();
    setClaimableLocalState(null);
  }

  return { state, setState, storageStatus, claimableLocalState, dismissClaimableLocalState };
}
