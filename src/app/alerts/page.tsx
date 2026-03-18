'use client'
import { useEffect, useState, useCallback } from 'react'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-browser'

const mono = 'IBM Plex Mono, monospace'

interface Alert { id: string; ticker: string; condition: string; price: number; triggered: boolean; created_at: string }

export default function AlertsPage() {
  const [alerts, setAlerts]   = useState<Alert[]>([])
  const [loading, setLoading] = useState(true)
  const [authErr, setAuthErr] = useState(false)
  const [form, setForm]       = useState({ ticker: '', condition: 'above', price: '' })
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAuthErr(true); setLoading(false); return }
    const { data } = await supabase.from('alerts').select('*').order('created_at', { ascending: false })
    setAlerts(data ?? [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // Check alerts against live prices
  async function checkAlerts() {
    if (alerts.length === 0) return
    setChecking(true)
    const active  = alerts.filter(a => !a.triggered)
    const tickers = Array.from(new Set(active.map(a => a.ticker)))
    const prices: Record<string, number> = {}
    await Promise.allSettled(
      tickers.map(t => fetch(`/api/quote?ticker=${t}`).then(r => r.json()).then(d => { if (d.price) prices[t] = d.price }))
    )
    // Update triggered status
    const toTrigger = active.filter(a => {
      const p = prices[a.ticker]
      if (!p) return false
      return a.condition === 'above' ? p >= a.price : p <= a.price
    })
    if (toTrigger.length > 0) {
      await Promise.allSettled(
        toTrigger.map(a => supabase.from('alerts').update({ triggered: true }).eq('id', a.id))
      )
      load()
    }
    setChecking(false)
  }

  useEffect(() => {
    if (alerts.length > 0) checkAlerts()
  }, [alerts.length]) // eslint-disable-line

  async function addAlert(e: React.FormEvent) {
    e.preventDefault(); setSaving(true); setErr(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setErr('Not signed in'); setSaving(false); return }
    const { error } = await supabase.from('alerts').insert({
      user_id:   user.id,
      ticker:    form.ticker.toUpperCase().trim(),
      condition: form.condition,
      price:     parseFloat(form.price),
    })
    if (error) { setErr(error.message); setSaving(false); return }
    setForm({ ticker: '', condition: 'above', price: '' })
    setSaving(false); load()
  }

  async function remove(id: string) {
    await supabase.from('alerts').delete().eq('id', id)
    setAlerts(a => a.filter(x => x.id !== id))
  }

  const active    = alerts.filter(a => !a.triggered)
  const triggered = alerts.filter(a => a.triggered)

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

      <div style={{ borderBottom: '1px solid var(--border)', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: 3, textTransform: 'uppercase', fontFamily: mono }}>// ALRT</span>
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Price Alerts</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {checking && <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--amber)', letterSpacing: 1 }}>CHECKING…</span>}
          <div style={{ fontFamily: mono, fontSize: 12, color: 'var(--text3)' }}>
            <span style={{ color: 'var(--green)', fontWeight: 700 }}>{active.length}</span> active · <span style={{ color: 'var(--text3)' }}>{triggered.length}</span> triggered
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 800, margin: '0 auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Add alert form */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <div style={{ background: 'var(--bg3)', padding: '10px 16px', borderBottom: '1px solid var(--border)', fontFamily: mono, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text2)' }}>
            New Alert
          </div>
          <form onSubmit={addAlert} style={{ padding: '16px', display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Ticker</div>
              <input type="text" placeholder="AAPL" required value={form.ticker} onChange={e => setForm(v => ({ ...v, ticker: e.target.value }))} />
            </div>
            <div style={{ minWidth: 130 }}>
              <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Condition</div>
              <select value={form.condition} onChange={e => setForm(v => ({ ...v, condition: e.target.value }))}>
                <option value="above">Price rises above</option>
                <option value="below">Price falls below</option>
              </select>
            </div>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Target Price $</div>
              <input type="number" step="any" placeholder="150.00" required value={form.price} onChange={e => setForm(v => ({ ...v, price: e.target.value }))} />
            </div>
            <button type="submit" disabled={saving} style={{ padding: '8px 24px', background: 'var(--accent)', color: '#000', fontFamily: mono, fontSize: 12, fontWeight: 700, letterSpacing: 1, border: 'none', borderRadius: 4, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
              {saving ? 'Setting…' : '+ Set Alert'}
            </button>
          </form>
          {err && <div style={{ padding: '0 16px 12px', fontSize: 13, color: 'var(--red)' }}>{err}</div>}
        </div>

        {/* Active alerts */}
        {loading ? (
          <div style={{ fontFamily: mono, fontSize: 13, color: 'var(--text3)', letterSpacing: 2, textAlign: 'center' }}>LOADING…</div>
        ) : (
          <>
            {active.length > 0 && (
              <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: 'var(--bg3)', padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
                  <span style={{ fontFamily: mono, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text2)' }}>Active Alerts</span>
                </div>
                {active.map((a, i) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', borderBottom: i < active.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'var(--bg2)' : 'transparent' }}>
                    <Link href={`/dashboard?ticker=${a.ticker}`} style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: 'var(--accent)', minWidth: 60 }}>{a.ticker}</Link>
                    <span style={{ fontSize: 13, color: 'var(--text2)', flex: 1 }}>
                      Alert when price <span style={{ color: a.condition === 'above' ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>{a.condition}</span> ${a.price.toFixed(2)}
                    </span>
                    <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--text3)' }}>{new Date(a.created_at).toLocaleDateString()}</span>
                    <button onClick={() => remove(a.id)} style={{ fontFamily: mono, fontSize: 12, color: 'var(--red)', cursor: 'pointer', padding: '3px 8px', border: '1px solid rgba(255,51,51,.3)', borderRadius: 4, background: 'transparent' }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {triggered.length > 0 && (
              <div style={{ border: '1px solid rgba(255,85,0,.3)', borderRadius: 8, overflow: 'hidden' }}>
                <div style={{ background: 'rgba(255,85,0,.06)', padding: '10px 16px', borderBottom: '1px solid rgba(255,85,0,.2)', fontFamily: mono, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--accent)' }}>
                  Triggered
                </div>
                {triggered.map((a, i) => (
                  <div key={a.id} style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '12px 16px', borderBottom: i < triggered.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'var(--bg2)' : 'transparent', opacity: 0.7 }}>
                    <Link href={`/dashboard?ticker=${a.ticker}`} style={{ fontFamily: mono, fontSize: 14, fontWeight: 700, color: 'var(--text3)', minWidth: 60 }}>{a.ticker}</Link>
                    <span style={{ fontSize: 13, color: 'var(--text3)', flex: 1 }}>
                      Price {a.condition} ${a.price.toFixed(2)} — <span style={{ color: 'var(--accent)' }}>✓ triggered</span>
                    </span>
                    <button onClick={() => remove(a.id)} style={{ fontFamily: mono, fontSize: 12, color: 'var(--text3)', cursor: 'pointer', padding: '3px 8px', border: '1px solid var(--border2)', borderRadius: 4, background: 'transparent' }}>✕</button>
                  </div>
                ))}
              </div>
            )}

            {alerts.length === 0 && (
              <div style={{ fontFamily: mono, fontSize: 13, color: 'var(--text3)', letterSpacing: 1, textAlign: 'center', paddingTop: 8 }}>No alerts set yet.</div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
