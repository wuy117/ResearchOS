import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() ?? '';

export const hasSupabaseUrl = Boolean(supabaseUrl);
export const hasSupabaseAnonKey = Boolean(supabaseAnonKey);
export const isSupabaseEnabled = hasSupabaseUrl && hasSupabaseAnonKey;

export const supabase = isSupabaseEnabled ? createClient(supabaseUrl, supabaseAnonKey) : null;

console.debug('Supabase env check', {
  hasViteSupabaseUrl: hasSupabaseUrl,
  hasViteSupabaseAnonKey: hasSupabaseAnonKey,
});
