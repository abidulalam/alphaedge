import { createBrowserClient } from '@supabase/ssr'

// Uses @supabase/ssr so the session is stored in cookies (not localStorage),
// making it readable by the middleware's server-side Supabase client.
export const supabase = createBrowserClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)
