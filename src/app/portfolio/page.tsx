'use client'
import { useEffect, useState, useCallback } from 'react'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-browser'
import ChatBot from '@/components/ChatBot'

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

interface Position  { id: string; ticker: string; shares: number; avg_cost: number }
interface Live      { price: number; changePct: number }
interface ExtHolding {
  accountId:   string
  broker:      string
  accountName: string
  ticker:      string
  shares:      number
  price:       number | null
  value:       number | null
  cost:        number | null
}
interface SnapAccount { id: string; authorizationId: string; name: string; institutionName: string; number: string }

// Unified row type for the table
type Row =
  | { kind: 'internal'; pos: Position; live: Live | undefined }
  | { kind: 'external'; holding: ExtHolding }

export default function Portfolio() {
  const [positions, setPositions]         = useState<Position[]>([])
  const [live, setLive]                   = useState<Record<string, Live>>({})
  const [loading, setLoading]             = useState(true)
  const [authErr, setAuthErr]             = useState(false)
  const [form, setForm]                   = useState({ ticker: '', shares: '', avg_cost: '' })
  const [saving, setSaving]               = useState(false)
  const [err, setErr]                     = useState<string | null>(null)

  // SnapTrade state
  const [snapAccounts, setSnapAccounts]   = useState<SnapAccount[]>([])
  const [extHoldings, setExtHoldings]     = useState<ExtHolding[]>([])
  const [snapLoading, setSnapLoading]     = useState(false)
  const [connecting, setConnecting]       = useState(false)
  const [disconnecting, setDisconnecting] = useState<string | null>(null)
  const [snapErr, setSnapErr]             = useState<string | null>(null)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAuthErr(true); setLoading(false); return }
    const { data } = await supabase.from('portfolio').select('*').order('created_at')
    setPositions(data ?? [])
    setLoading(false)

    // Fetch live prices for local positions
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

  const loadSnap = useCallback(async () => {
    setSnapLoading(true)
    try {
      const res = await fetch('/api/snaptrade/holdings')
      if (res.ok) {
        const data = await res.json()
        setSnapAccounts(data.accounts ?? [])
        setExtHoldings(data.holdings ?? [])
      }
    } catch (_) {}
    setSnapLoading(false)
  }, [])

  useEffect(() => { load() }, [load])
  useEffect(() => { loadSnap() }, [loadSnap])

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

  async function connectBroker() {
    setConnecting(true); setSnapErr(null)
    try {
      // Register user with SnapTrade first (idempotent)
      const regRes = await fetch('/api/snaptrade/register', { method: 'POST' })
      if (!regRes.ok) {
        const regErr = await regRes.json().catch(() => ({}))
        throw new Error(regErr.error ?? 'Registration failed')
      }

      // Get OAuth portal URL
      const conRes = await fetch('/api/snaptrade/connect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' })
      if (!conRes.ok) {
        const conErr = await conRes.json().catch(() => ({}))
        throw new Error(conErr.error ?? 'Could not get connection URL')
      }
      const { redirectUrl } = await conRes.json()

      // Open in a popup window
      const popup = window.open(redirectUrl, 'snaptrade-connect', 'width=600,height=700,left=200,top=100')

      // Poll for popup close, then reload holdings
      const poll = setInterval(() => {
        if (popup?.closed) {
          clearInterval(poll)
          setConnecting(false)
          loadSnap()
        }
      }, 800)
    } catch (e: any) {
      setSnapErr(e.message ?? 'Connection failed')
      setConnecting(false)
    }
  }

  async function disconnectAccount(authorizationId: string, accountId: string) {
    if (!confirm('Disconnect this account? All its positions will be removed from your portfolio view.')) return
    setDisconnecting(accountId)
    try {
      await fetch('/api/snaptrade/disconnect', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountId: authorizationId }),
      })
      await loadSnap()
    } catch (_) {}
    setDisconnecting(null)
  }

  // Build unified rows
  const internalRows: Row[] = positions.map(pos => ({ kind: 'internal', pos, live: live[pos.ticker] }))
  const externalRows: Row[] = extHoldings.map(holding => ({ kind: 'external', holding }))
  const allRows: Row[] = [...internalRows, ...externalRows]

  // Compute totals (internal + external)
  const intCost  = positions.reduce((s, p) => s + p.shares * p.avg_cost, 0)
  const intValue = positions.reduce((s, p) => s + p.shares * (live[p.ticker]?.price ?? p.avg_cost), 0)
  const extValue = extHoldings.reduce((s, h) => s + (h.value ?? 0), 0)
  const extCost  = extHoldings.reduce((s, h) => s + (h.cost ?? 0), 0)
  const totalValue = intValue + extValue
  const totalCost  = intCost  + extCost
  const totalPnl   = totalValue - totalCost
  const totalPct   = totalCost ? (totalPnl / totalCost) * 100 : 0

  // Badge color per broker
  const brokerColor = (broker: string) => {
    const h = broker.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
    const colors = ['#FF5500', '#0088FF', '#00CC66', '#FFAA00', '#AA44FF', '#FF3388']
    return colors[h % colors.length]
  }

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
    <>
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '16px 32px', display: 'flex', alignItems: 'center', gap: 16 }}>
        <span style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: 3, textTransform: 'uppercase', fontFamily: mono }}>// PORT</span>
        <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Portfolio Tracker</h1>
      </div>

      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '24px 32px' }}>

        {/* Summary cards */}
        {allRows.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 28 }}>
            {[
              { label: 'Total Value', value: money(totalValue), color: 'var(--text)' },
              { label: 'Total Cost',  value: money(totalCost),  color: 'var(--text2)' },
              { label: 'Total P&L',   value: (totalPnl >= 0 ? '+' : '') + money(totalPnl), color: pc(totalPnl) },
              { label: 'Return',      value: pct(totalPct),     color: pc(totalPct) },
            ].map(c => (
              <div key={c.label} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 16px' }}>
                <div style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 2, textTransform: 'uppercase', fontFamily: mono, marginBottom: 6 }}>{c.label}</div>
                <div style={{ fontSize: 20, fontWeight: 700, fontFamily: mono, color: c.color }}>{c.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Connected Accounts panel */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ background: 'var(--bg3)', padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text2)' }}>
              Connected Accounts {snapAccounts.length > 0 && <span style={{ color: 'var(--accent)' }}>({snapAccounts.length})</span>}
            </div>
            <button
              onClick={connectBroker}
              disabled={connecting}
              style={{ padding: '6px 16px', background: connecting ? 'var(--bg4)' : 'var(--accent)', color: connecting ? 'var(--text3)' : '#000', fontFamily: mono, fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', border: 'none', borderRadius: 4, cursor: connecting ? 'not-allowed' : 'pointer' }}
            >
              {connecting ? 'Connecting…' : '+ Connect Broker'}
            </button>
          </div>

          <div style={{ padding: '12px 16px', background: 'var(--bg2)' }}>
            {snapErr && (
              <div style={{ marginBottom: 10, fontSize: 12, color: 'var(--red)', fontFamily: mono }}>{snapErr}</div>
            )}
            {snapLoading ? (
              <div style={{ fontFamily: mono, fontSize: 12, color: 'var(--text3)' }}>Loading connected accounts…</div>
            ) : snapAccounts.length === 0 ? (
              <div style={{ fontSize: 13, color: 'var(--text3)', lineHeight: 1.6 }}>
                No brokers connected. Click <span style={{ color: 'var(--accent)', fontFamily: mono }}>+ Connect Broker</span> to link Robinhood, Fidelity, Schwab, IBKR, and 20+ others via secure OAuth — no passwords stored.
              </div>
            ) : (
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {snapAccounts.map(acct => {
                  const bc = brokerColor(acct.institutionName)
                  return (
                    <div key={acct.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', background: 'var(--bg3)', border: `1px solid ${bc}44`, borderRadius: 6 }}>
                      <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 600, color: bc }}>{acct.institutionName}</span>
                      {acct.number && <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--text3)' }}>···{acct.number.slice(-4)}</span>}
                      <button
                        onClick={() => disconnectAccount(acct.authorizationId, acct.id)}
                        disabled={disconnecting === acct.id}
                        style={{ fontSize: 11, color: 'var(--text3)', background: 'transparent', border: 'none', cursor: 'pointer', padding: '0 2px', lineHeight: 1 }}
                        title="Disconnect account"
                      >
                        {disconnecting === acct.id ? '…' : '✕'}
                      </button>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>

        {/* Unified positions table */}
        {loading ? (
          <div style={{ fontFamily: mono, fontSize: 13, color: 'var(--text3)', letterSpacing: 2, paddingTop: 40, textAlign: 'center' }}>LOADING…</div>
        ) : allRows.length > 0 ? (
          <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden', marginBottom: 28 }}>
            {/* Table header */}
            <div style={{ display: 'grid', gridTemplateColumns: '100px 120px 1fr 90px 90px 100px 110px 110px 80px 48px', background: 'var(--bg3)', borderBottom: '1px solid var(--border)', padding: '8px 16px', gap: 10 }}>
              {['Source', 'Ticker', 'Account / Name', 'Shares', 'Avg Cost', 'Price', 'Value', 'P&L', 'Return', ''].map((h, i) => (
                <div key={i} style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: mono, textAlign: i > 2 && i < 9 ? 'right' : 'left' }}>{h}</div>
              ))}
            </div>

            {allRows.map((row, i) => {
              const isLast = i === allRows.length - 1
              const bg     = i % 2 === 0 ? 'var(--bg2)' : 'transparent'

              if (row.kind === 'internal') {
                const { pos, live: lv } = row
                const price = lv?.price ?? null
                const val   = price ? pos.shares * price : null
                const cost  = pos.shares * pos.avg_cost
                const pnl   = val != null ? val - cost : null
                const ret   = pnl != null ? (pnl / cost) * 100 : null
                const bc    = brokerColor('AlphaEdge')
                return (
                  <div key={pos.id} style={{ display: 'grid', gridTemplateColumns: '100px 120px 1fr 90px 90px 100px 110px 110px 80px 48px', padding: '12px 16px', gap: 10, borderBottom: isLast ? 'none' : '1px solid var(--border)', background: bg, alignItems: 'center' }}>
                    <div>
                      <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 3, background: `${bc}22`, color: bc, fontFamily: mono, fontWeight: 600 }}>AlphaEdge</span>
                    </div>
                    <Link href={`/dashboard?ticker=${pos.ticker}`} style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{pos.ticker}</Link>
                    <div style={{ fontSize: 12, color: 'var(--text3)' }}>Manual position</div>
                    <div style={{ fontFamily: mono, fontSize: 13, textAlign: 'right' }}>{pos.shares.toLocaleString()}</div>
                    <div style={{ fontFamily: mono, fontSize: 13, textAlign: 'right', color: 'var(--text2)' }}>${pos.avg_cost.toFixed(2)}</div>
                    <div style={{ fontFamily: mono, fontSize: 13, textAlign: 'right' }}>{price ? '$' + price.toFixed(2) : '—'}</div>
                    <div style={{ fontFamily: mono, fontSize: 13, textAlign: 'right' }}>{val ? money(val) : '—'}</div>
                    <div style={{ fontFamily: mono, fontSize: 13, textAlign: 'right', color: pnl != null ? pc(pnl) : 'var(--text3)', fontWeight: 600 }}>{pnl != null ? (pnl >= 0 ? '+' : '') + money(pnl) : '—'}</div>
                    <div style={{ fontFamily: mono, fontSize: 13, textAlign: 'right', color: ret != null ? pc(ret) : 'var(--text3)' }}>{pct(ret)}</div>
                    <button onClick={() => remove(pos.id)} style={{ fontFamily: mono, fontSize: 12, color: 'var(--red)', cursor: 'pointer', textAlign: 'center', padding: '4px 8px', border: '1px solid rgba(255,51,51,.3)', borderRadius: 4 }}>✕</button>
                  </div>
                )
              }

              // External (SnapTrade) row
              const { holding } = row
              const bc = brokerColor(holding.broker)
              const pnl = holding.value != null && holding.cost != null ? holding.value - holding.cost : null
              const ret = pnl != null && holding.cost ? (pnl / holding.cost) * 100 : null
              const avgCost = holding.cost && holding.shares ? holding.cost / holding.shares : null
              return (
                <div key={`${holding.accountId}-${holding.ticker}`} style={{ display: 'grid', gridTemplateColumns: '100px 120px 1fr 90px 90px 100px 110px 110px 80px 48px', padding: '12px 16px', gap: 10, borderBottom: isLast ? 'none' : '1px solid var(--border)', background: bg, alignItems: 'center' }}>
                  <div>
                    <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 3, background: `${bc}22`, color: bc, fontFamily: mono, fontWeight: 600 }}>{holding.broker}</span>
                  </div>
                  <Link href={`/dashboard?ticker=${holding.ticker}`} style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{holding.ticker}</Link>
                  <div style={{ fontSize: 12, color: 'var(--text3)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{holding.accountName}</div>
                  <div style={{ fontFamily: mono, fontSize: 13, textAlign: 'right' }}>{holding.shares.toLocaleString()}</div>
                  <div style={{ fontFamily: mono, fontSize: 13, textAlign: 'right', color: 'var(--text2)' }}>{avgCost ? '$' + avgCost.toFixed(2) : '—'}</div>
                  <div style={{ fontFamily: mono, fontSize: 13, textAlign: 'right' }}>{holding.price ? '$' + holding.price.toFixed(2) : '—'}</div>
                  <div style={{ fontFamily: mono, fontSize: 13, textAlign: 'right' }}>{holding.value ? money(holding.value) : '—'}</div>
                  <div style={{ fontFamily: mono, fontSize: 13, textAlign: 'right', color: pnl != null ? pc(pnl) : 'var(--text3)', fontWeight: 600 }}>{pnl != null ? (pnl >= 0 ? '+' : '') + money(pnl) : '—'}</div>
                  <div style={{ fontFamily: mono, fontSize: 13, textAlign: 'right', color: ret != null ? pc(ret) : 'var(--text3)' }}>{pct(ret)}</div>
                  <button
                    onClick={() => {
                      const acct = snapAccounts.find(a => a.id === holding.accountId)
                      disconnectAccount(acct?.authorizationId ?? holding.accountId, holding.accountId)
                    }}
                    disabled={disconnecting === holding.accountId}
                    style={{ fontFamily: mono, fontSize: 12, color: 'var(--text3)', cursor: 'pointer', textAlign: 'center', padding: '4px 8px', border: '1px solid var(--border)', borderRadius: 4 }}
                    title="Disconnect this account"
                  >✕</button>
                </div>
              )
            })}
          </div>
        ) : !loading && (
          <div style={{ fontFamily: mono, fontSize: 13, color: 'var(--text3)', letterSpacing: 1, paddingBottom: 24 }}>No positions yet. Add one below or connect a broker above.</div>
        )}

        {/* Add position form */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ background: 'var(--bg3)', padding: '10px 16px', borderBottom: '1px solid var(--border)', fontFamily: mono, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text2)' }}>
            Add Manual Position
          </div>
          <form onSubmit={addPosition} style={{ padding: '16px', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            {[
              { key: 'ticker',   label: 'Ticker',     placeholder: 'AAPL',   type: 'text'   },
              { key: 'shares',   label: 'Shares',     placeholder: '10',     type: 'number' },
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
    <ChatBot />
    </>
  )
}
