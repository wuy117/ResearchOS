import { useCallback, useEffect, useState } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { isSupabaseEnabled, supabase } from '../lib/supabase';

export type AuthResult = {
  currentUser: User | null;
  session: Session | null;
  authLoading: boolean;
  authError: string;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

export function useAuth(): AuthResult {
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState(isSupabaseEnabled);
  const [authError, setAuthError] = useState('');

  useEffect(() => {
    if (!supabase) {
      setAuthLoading(false);
      setSession(null);
      return;
    }

    let isMounted = true;

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!isMounted) return;
        if (error) setAuthError(error.message);
        setSession(data.session ?? null);
      })
      .catch((error: unknown) => {
        if (!isMounted) return;
        setAuthError(error instanceof Error ? error.message : 'Unable to read Supabase session.');
      })
      .finally(() => {
        if (isMounted) setAuthLoading(false);
      });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      setAuthLoading(false);
      setAuthError('');
    });

    return () => {
      isMounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase is not configured. Research OS is running in local-only mode.');
    setAuthLoading(true);
    setAuthError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setAuthLoading(false);
    if (error) {
      setAuthError(error.message);
      throw error;
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase is not configured. Research OS is running in local-only mode.');
    setAuthLoading(true);
    setAuthError('');
    const { error } = await supabase.auth.signUp({ email, password });
    setAuthLoading(false);
    if (error) {
      setAuthError(error.message);
      throw error;
    }
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    setAuthLoading(true);
    const { error } = await supabase.auth.signOut();
    setAuthLoading(false);
    if (error) {
      setAuthError(error.message);
      throw error;
    }
  }, []);

  return {
    currentUser: session?.user ?? null,
    session,
    authLoading,
    authError,
    signIn,
    signUp,
    signOut,
  };
}
