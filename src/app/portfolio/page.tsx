'use client'
import { useEffect, useState, useCallback } from 'react'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-browser'

const mono = 'IBM Plex Mono, monospace'

function pct(n: number | null) {
  if (n == null) return '—'
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}
function pc(n: number) { return n >= 0 ? 'var(--green)' : 'var(--red)' }
function money(n: number) {
  const abs = Math.abs(n)
  const s   = abs >= 1e6 ? '$' + (abs / 1e6).toFixed(2) + 'M' : '$' + abs.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return (n < 0 ? '-' : '') + s
}

interface Position { id: string; ticker: string; shares: number; avg_cost: number }
interface Live      { price: number; changePct: number }

export default function Portfolio() {
  const [positions, setPositions] = useState<Position[]>([])
  const [live, setLive]           = useState<Record<string, Live>>({})
  const [loading, setLoading]     = useState(true)
  const [authErr, setAuthErr]     = useState(false)
  const [form, setForm]           = useState({ ticker: '', shares: '', avg_cost: '' })
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAuthErr(true); setLoading(false); return }
    const { data } = await supabase.from('portfolio').select('*').order('created_at')
    setPositions(data ?? [])
    setLoading(false)

    // Fetch live prices for all tickers
    if (data && data.length > 0) {
      const tickers = Array.from(new Set(data.map((p: Position) => p.ticker)))
      const results = await Promise.allSettled(
        tickers.map(t => fetch(`/api/quote?ticker=${t}`).then(r => r.json()))
      )
      const priceMap: Record<string, Live> = {}
      results.forEach((r, i) => {
        if (r.status === 'fulfilled' && r.value.price) {
          priceMap[tickers[i]] = { price: r.value.price, changePct: r.value.changePct ?? 0 }
        }
      })
      setLive(priceMap)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function addPosition(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setErr(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setErr('Not signed in'); setSaving(false); return }
    const { error } = await supabase.from('portfolio').insert({
      user_id:  user.id,
      ticker:   form.ticker.toUpperCase().trim(),
      shares:   parseFloat(form.shares),
      avg_cost: parseFloat(form.avg_cost),
    })
    if (error) { setErr(error.message); setSaving(false); return }
    setForm({ ticker: '', shares: '', avg_cost: '' })
    setSaving(false)
    load()
  }

  async function remove(id: string) {
    await supabase.from('portfolio').delete().eq('id', id)
    setPositions(p => p.filter(x => x.id !== id))
  }

  // Compute totals
  const totalCost  = positions.reduce((s, p) => s + p.shares * p.avg_cost, 0)
  const totalValue = positions.reduce((s, p) => s + p.shares * (live[p.ticker]?.price ?? p.avg_cost), 0)
  const totalPnl   = totalValue - totalCost
  const totalPct   = totalCost ? (totalPnl / totalCost) * 100 : 0

  if (authErr) return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '60vh', gap: 16 }}>
        <div style={{ fontFamily: mono, fontSize: 13, color: 'var(--text3)', letterSpacing: 2 }}>SIGN IN REQUIRED</div>
        <Link href="/?auth=signin" style={{ padding: '10px 24px', background: 'var(--accent)', color: '#000', fontWeight: 700, borderRadius: 4, fontSize: 13 }}>Sign In</Link>
      </div>
    </div>
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: 3, textTransform: 'uppercase', fontFamily: mono }}>// PORT</span>
        <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Portfolio Tracker</h1>
      </div>

      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '24px 32px' }}>

        {/* Summary cards */}
        {positions.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
            {[
              { label: 'Total Value',    value: money(totalValue),            color: 'var(--text)' },
              { label: 'Total Cost',     value: money(totalCost),             color: 'var(--text2)' },
              { label: 'Total P&L',      value: (totalPnl >= 0 ? '+' : '') + money(totalPnl), color: pc(totalPnl) },
              { label: 'Return',         value: pct(totalPct),                color: pc(totalPct) },
            ].map(c => (
              <div key={c.label} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 2, textTransform: 'uppercase', fontFamily: mono, marginBottom: 6 }}>{c.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: mono, color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Positions table */}
        {loading ? (
          <div style={{ fontFamily: mono, fontSize: 13, color: 'var(--text3)', letterSpacing: 2, paddingTop: 40, textAlign: 'center' }}>LOADING…</div>
        ) : positions.length > 0 ? (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 28 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 90px 90px 100px 110px 110px 80px 48px', background: 'var(--bg3)', borderBottom: '1px solid var(--border)', padding: '8px 16px', gap: 10 }}>
              {['Ticker', 'Shares', 'Avg Cost', 'Price', 'Change', 'Value', 'P&L', 'Return', ''].map((h, i) => (
                <div key={i} style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: mono, textAlign: i > 0 && i < 8 ? 'right' : 'left' }}>{h}</div>
              ))}
            </div>
            {positions.map((p, i) => {
              const lv     = live[p.ticker]
              const price  = lv?.price ?? null
              const val    = price ? p.shares * price : null
              const cost   = p.shares * p.avg_cost
              const pnl    = val != null ? val - cost : null
              const ret    = pnl != null ? (pnl / cost) * 100 : null
              return (
                <div key={p.id} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 90px 90px 100px 110px 110px 80px 48px', padding: '12px 16px', gap: 10, borderBottom: i < positions.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'var(--bg2)' : 'transparent', alignItems: 'center' }}>
                  <Link href={`/dashboard?ticker=${p.ticker}`} style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{p.ticker}</Link>
                  <div style={{ fontFamily: mono, fontSize: 13, textAlign: 'right' }}>{p.shares.toLocaleString()}</div>
                  <div style={{ fontFamily: mono, fontSize: 13, textAlign: 'right', color: 'var(--text2)' }}>${p.avg_cost.toFixed(2)}</div>
                  <div style={{ fontFamily: mono, fontSize: 13, textAlign: 'right' }}>{price ? '$' + price.toFixed(2) : '—'}</div>
                  <div style={{ fontFamily: mono, fontSize: 13, textAlign: 'right', color: lv ? pc(lv.changePct) : 'var(--text3)' }}>{lv ? pct(lv.changePct) : '—'}</div>
                  <div style={{ fontFamily: mono, fontSize: 13, textAlign: 'right' }}>{val ? money(val) : '—'}</div>
                  <div style={{ fontFamily: mono, fontSize: 13, textAlign: 'right', color: pnl != null ? pc(pnl) : 'var(--text3)', fontWeight: 600 }}>{pnl != null ? (pnl >= 0 ? '+' : '') + money(pnl) : '—'}</div>
                  <div style={{ fontFamily: mono, fontSize: 13, textAlign: 'right', color: ret != null ? pc(ret) : 'var(--text3)' }}>{pct(ret)}</div>
                  <button onClick={() => remove(p.id)} style={{ fontFamily: mono, fontSize: 12, color: 'var(--red)', cursor: 'pointer', textAlign: 'center', padding: '4px 8px', border: '1px solid rgba(255,51,51,.3)', borderRadius: 4 }}>✕</button>
                </div>
              )
            })}
          </div>
        ) : (
          <div style={{ fontFamily: mono, fontSize: 13, color: 'var(--text3)', letterSpacing: 1, paddingBottom: 24 }}>No positions yet. Add one below.</div>
        )}

        {/* Add position form */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ background: 'var(--bg3)', padding: '10px 16px', borderBottom: '1px solid var(--border)', fontFamily: mono, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text2)' }}>
            Add Position
          </div>
          <form onSubmit={addPosition} style={{ padding: '16px', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {[
              { key: 'ticker',   label: 'Ticker',    placeholder: 'AAPL', type: 'text'   },
              { key: 'shares',   label: 'Shares',    placeholder: '10',   type: 'number' },
              { key: 'avg_cost', label: 'Avg Cost $', placeholder: '150.00', type: 'number' },
            ].map(f => (
              <div key={f.key} style={{ flex: 1, minWidth: 160 }}>
                <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{f.label}</div>
                <input
                  type={f.type} placeholder={f.placeholder} required
                  value={(form as any)[f.key]}
                  onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}
                  step={f.key !== 'ticker' ? 'any' : undefined}
                  style={{ width: '100%' }}
                />
              </div>
            ))}
            <button type="submit" disabled={saving} style={{ padding: '8px 24px', background: 'var(--accent)', color: '#000', fontFamily: mono, fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', border: 'none', borderRadius: 4, cursor: 'pointer', alignSelf: 'flex-end', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Adding…' : '+ Add'}
            </button>
          </form>
          {err && <div style={{ padding: '0 16px 12px', fontSize: 13, color: 'var(--red)' }}>{err}</div>}
        </div>
      </div>
    </div>
  )
}
