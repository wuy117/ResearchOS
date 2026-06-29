import { createClient } from '@supabase/supabase-js';

export class SupabaseServerError extends Error {
  statusCode: number;

  constructor(message: string, statusCode = 500) {
    super(message);
    this.name = 'SupabaseServerError';
    this.statusCode = statusCode;
  }
}

export function getSupabaseServerClient() {
  const supabaseUrl = process.env.SUPABASE_URL?.trim() || process.env.VITE_SUPABASE_URL?.trim();
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    process.env.SUPABASE_ANON_KEY?.trim() ||
    process.env.VITE_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl || !supabaseKey) {
    throw new SupabaseServerError('Supabase server environment is not configured.', 503);
  }

  return createClient(supabaseUrl, supabaseKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}

export function parseBody<TBody>(body: unknown): TBody {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as TBody;
    } catch {
      return {} as TBody;
    }
  }

  if (body && typeof body === 'object') {
    return body as TBody;
  }

  return {} as TBody;
}

export function vectorLiteral(embedding: number[]) {
  return `[${embedding.map((value) => Number(value.toFixed(8))).join(',')}]`;
}
