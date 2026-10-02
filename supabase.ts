import { createClient, type Session } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim() || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim() || '';

export const isCloudBrainConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = isCloudBrainConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export async function ensureBrainSession(): Promise<Session | null> {
  if (!supabase) return null;

  const current = await supabase.auth.getSession();
  if (current.data.session) return current.data.session;

  const created = await supabase.auth.signInAnonymously();
  if (created.error) throw created.error;
  return created.data.session;
}

export async function getBrainAccessToken(): Promise<string | null> {
  if (!supabase) return null;
  const session = await ensureBrainSession();
  return session?.access_token || null;
}
