'use client'
import { useEffect, useState } from 'react'

interface Tick { sym: string; name: string; price: number; changePct: number }

export default function TickerTape() {
  const [tickers, setTickers] = useState<Tick[]>([])

  useEffect(() => {
    const load = () =>
      fetch('/api/ticker').then(r => r.json()).then(d => {
        if (d.tickers?.length) setTickers(d.tickers)
      }).catch(() => {})
    load()
    const id = setInterval(load, 30000)
    return () => clearInterval(id)
  }, [])

  if (!tickers.length) return (
    <div style={{ height: 30, background: 'var(--bg2)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <span style={{ fontSize: 10, color: 'var(--text3)', letterSpacing: 2 }}>LOADING MARKET DATA…</span>
    </div>
  )

  const items = [...tickers, ...tickers]
  return (
    <div style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', overflow: 'hidden', padding: '5px 0', userSelect: 'none' }}>
      <style>{`.ti{display:flex;white-space:nowrap;animation:ticker-scroll 50s linear infinite}.ti:hover{animation-play-state:paused}`}</style>
      <div className="ti">
        {items.map((t, i) => (
          <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 8, padding: '0 24px', fontSize: 11, borderRight: '1px solid var(--border)' }}>
            <span style={{ fontWeight: 700, color: 'var(--text)', letterSpacing: 1 }}>{t.sym}</span>
            <span style={{ color: 'var(--text2)' }}>{t.price.toFixed(2)}</span>
            <span style={{ color: t.changePct >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 600 }}>
              {t.changePct >= 0 ? '+' : ''}{t.changePct.toFixed(2)}%
            </span>
          </span>
        ))}
      </div>
    </div>
  )
}
