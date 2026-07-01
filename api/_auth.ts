import { createClient } from '@supabase/supabase-js';
import { SupabaseServerError } from './_supabase.js';

type ApiRequestWithHeaders = {
  headers?: Record<string, string | string[] | undefined>;
};

export class AuthError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 401) {
    super(message);
    this.name = 'AuthError';
    this.statusCode = statusCode;
  }
}

function getHeader(req: ApiRequestWithHeaders, name: string) {
  const value = req.headers?.[name] ?? req.headers?.[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

export function getSupabaseAnonConfig() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY?.trim() || process.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new SupabaseServerError('Supabase server environment is not configured.', 503);
  }

  return { supabaseUrl, supabaseAnonKey };
}

export async function requireUser(req: ApiRequestWithHeaders) {
  const authorization = getHeader(req, 'authorization');
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();

  if (!token) {
    throw new AuthError('Missing Supabase access token.');
  }

  const { supabaseUrl, supabaseAnonKey } = getSupabaseAnonConfig();
  const client = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });

  const { data, error } = await client.auth.getUser(token);

  if (error || !data.user) {
    throw new AuthError('Invalid or expired Supabase access token.');
  }

  return {
    user: data.user,
    userId: data.user.id,
    client,
  };
}
