import { createBrowserClient as createSupabaseBrowserClient } from '@supabase/auth-helpers-nextjs';
import type { SupabaseClient } from '@supabase/supabase-js';

let clientInstance: SupabaseClient | null = null;

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

function isConfiguredUrl(url?: string): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  return (
    trimmed.length > 0 &&
    !trimmed.includes('placeholder') &&
    (trimmed.startsWith('https://') || trimmed.startsWith('http://'))
  );
}

function isConfiguredKey(key?: string): boolean {
  if (!key) return false;
  const trimmed = key.trim();
  return trimmed.length > 0 && !trimmed.includes('placeholder');
}

/**
 * Returns a singleton browser Supabase client if configured, or null if unconfigured/placeholder.
 */
export function createBrowserClient(): SupabaseClient | null {
  if (!isConfiguredUrl(SUPABASE_URL) || !isConfiguredKey(SUPABASE_ANON_KEY)) {
    return null;
  }

  if (!clientInstance) {
    clientInstance = createSupabaseBrowserClient(
      SUPABASE_URL!,
      SUPABASE_ANON_KEY!
    );
  }

  return clientInstance;
}
