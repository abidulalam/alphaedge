import { NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { snapFetchHoldings, snapListAccounts } from '@/lib/snaptrade'

/**
 * GET /api/snaptrade/holdings
 * Returns all holdings from connected SnapTrade accounts + list of connected accounts.
 * Response: { accounts: SnapAccount[], holdings: SnapHolding[] }
 */
export async function GET() {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('snaptrade_user_secret')
    .eq('user_id', user.id)
    .single()

  if (!profile?.snaptrade_user_secret) {
    // User hasn't connected any brokers yet — return empty
    return NextResponse.json({ accounts: [], holdings: [] })
  }

  const [accounts, holdings] = await Promise.all([
    snapListAccounts(user.id, profile.snaptrade_user_secret),
    snapFetchHoldings(user.id, profile.snaptrade_user_secret),
  ])

  return NextResponse.json({ accounts, holdings })
}
