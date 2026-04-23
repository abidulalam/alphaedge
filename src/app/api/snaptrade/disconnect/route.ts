import { NextRequest, NextResponse } from 'next/server'
import { createSupabaseServerClient } from '@/lib/supabase-server'
import { snapDeleteAccount } from '@/lib/snaptrade'

/**
 * DELETE /api/snaptrade/disconnect
 * Disconnects a SnapTrade brokerage account.
 * Body: { accountId: string }
 */
export async function DELETE(req: NextRequest) {
  const supabase = await createSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('snaptrade_user_secret')
    .eq('user_id', user.id)
    .single()

  if (!profile?.snaptrade_user_secret) {
    return NextResponse.json({ error: 'No SnapTrade connection found' }, { status: 400 })
  }

  const { accountId } = await req.json()
  if (!accountId) return NextResponse.json({ error: 'accountId required' }, { status: 400 })

  try {
    await snapDeleteAccount(user.id, profile.snaptrade_user_secret, accountId)
    return NextResponse.json({ ok: true })
  } catch (err: any) {
    console.error('[snaptrade/disconnect] error:', err?.message ?? err)
    const msg = err?.response?.data?.detail ?? err?.message ?? 'Disconnect failed'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
