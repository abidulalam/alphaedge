import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { snapRegisterUser } from '@/lib/snaptrade'

/**
 * POST /api/snaptrade/register
 * Registers the authenticated user with SnapTrade (idempotent — safe to call multiple times).
 * Stores the returned userSecret in the `profiles` table.
 * Returns { userSecret }.
 */
export async function POST() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Check if user is already registered (has a stored secret)
  const { data: profile } = await supabase
    .from('profiles')
    .select('snaptrade_user_secret')
    .eq('user_id', user.id)
    .single()

  if (profile?.snaptrade_user_secret) {
    return NextResponse.json({ userSecret: profile.snaptrade_user_secret })
  }

  // Register with SnapTrade (userId = Supabase user.id)
  const { userSecret } = await snapRegisterUser(user.id)

  // Persist the secret
  await supabase.from('profiles').upsert({
    user_id: user.id,
    snaptrade_user_secret: userSecret,
  })

  return NextResponse.json({ userSecret })
}
