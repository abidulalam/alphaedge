import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { snapLoginUrl } from '@/lib/snaptrade'

/**
 * POST /api/snaptrade/connect
 * Generates a SnapTrade OAuth portal URL for the authenticated user.
 * Body: { broker?: string }
 * Returns { redirectUrl }
 */
export async function POST(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('snaptrade_user_secret')
    .eq('user_id', user.id)
    .single()

  if (!profile?.snaptrade_user_secret) {
    return NextResponse.json({ error: 'User not registered with SnapTrade' }, { status: 400 })
  }

  const body = await req.json().catch(() => ({}))
  const redirectUrl = await snapLoginUrl(user.id, profile.snaptrade_user_secret, body.broker)
  return NextResponse.json({ redirectUrl })
}
