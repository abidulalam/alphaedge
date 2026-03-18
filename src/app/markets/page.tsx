'use client'
import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
import Link from 'next/link'

const mono = 'IBM Plex Mono, monospace'

function pct(n: number | null) {
  if (n == null) return '—'
  return (n >= 0 ? '+' : '') + n.toFixed(2) + '%'
}
function pc(n: number | null) {
  if (n == null) return 'var(--text3)'
  return n >= 0 ? 'var(--green)' : 'var(--red)'
}
function price(n: number | null, decimals = 2) {
  if (n == null) return '—'
  return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

function IndexCard({ item }: { item: any }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
      <div>
        <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 4, fontFamily: mono }}>{item.name}</div>
        <div style={{ fontSize: 20, fontWeight: 600, fontFamily: mono }}>{price(item.price)}</div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: pc(item.changePct), fontFamily: mono }}>{pct(item.changePct)}</div>
        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, fontFamily: mono }}>{item.sym}</div>
      </div>
    </div>
  )
}

function SectorBar({ item, max }: { item: any; max: number }) {
  const w = max === 0 ? 0 : Math.abs(item.changePct) / max * 100
  const pos = item.changePct >= 0
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderBottom: '1px solid var(--border)' }}>
      <div style={{ width: 110, fontSize: 12, color: 'var(--text2)', flexShrink: 0 }}>{item.name}</div>
      <div style={{ flex: 1, height: 6, background: 'var(--border2)', borderRadius: 3, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: w + '%', background: pos ? 'var(--green)' : 'var(--red)', borderRadius: 3, transition: 'width .4s' }} />
      </div>
      <div style={{ width: 64, textAlign: 'right', fontSize: 13, fontWeight: 600, color: pc(item.changePct), fontFamily: mono, flexShrink: 0 }}>{pct(item.changePct)}</div>
    </div>
  )
}

function MoverRow({ item, rank }: { item: any; rank: number }) {
  return (
    <Link href={`/dashboard?ticker=${item.sym}`} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 14px', borderBottom: '1px solid var(--border)', background: rank % 2 === 0 ? 'var(--bg2)' : 'var(--bg3)', textDecoration: 'none', cursor: 'pointer' }}>
      <span style={{ width: 16, fontSize: 11, color: 'var(--text3)', fontFamily: mono }}>{rank}</span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 600, fontFamily: mono }}>{item.sym}</span>
      <span style={{ fontSize: 13, fontFamily: mono }}>${price(item.price)}</span>
      <span style={{ width: 72, textAlign: 'right', fontSize: 13, fontWeight: 700, color: pc(item.changePct), fontFamily: mono }}>{pct(item.changePct)}</span>
    </Link>
  )
}

function Panel({ title, tag, children }: { title: string; tag?: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
      <div style={{ background: 'var(--bg3)', padding: '10px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {tag && <span style={{ fontSize: 10, color: 'var(--accent)', fontFamily: mono, letterSpacing: 2 }}>{tag}</span>}
          <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', fontFamily: mono }}>{title}</span>
        </div>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
      </div>
      <div style={{ padding: '12px 16px' }}>{children}</div>
    </div>
  )
}

export default function Markets() {
  const [data, setData]       = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [time, setTime]       = useState('')

  useEffect(() => {
    fetch('/api/markets').then(r => r.json()).then(setData).finally(() => setLoading(false))
    const tick = () => setTime(new Date().toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/New_York' }) + ' EST')
    tick(); const id = setInterval(tick, 1000); return () => clearInterval(id)
  }, [])

  const maxSectorMove = data ? Math.max(...data.sectors.map((s: any) => Math.abs(s.changePct))) : 1

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: 3, textTransform: 'uppercase', fontFamily: mono }}>// MKT</div>
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Market Overview</h1>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: loading ? 'var(--amber)' : 'var(--green)', display: 'inline-block' }} />
          <span style={{ fontSize: 12, fontFamily: mono, color: 'var(--text2)' }}>{time}</span>
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', fontFamily: mono, fontSize: 13, color: 'var(--text3)', letterSpacing: 2 }}>
          LOADING MARKET DATA…
        </div>
      )}

      {data && (
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: '24px 32px', display: 'flex', flexDirection: 'column', gap: 24 }}>

          {/* Indices */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12 }}>
            {data.indices.map((item: any) => <IndexCard key={item.sym} item={item} />)}
          </div>

          {/* Main grid */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 20 }}>

            {/* Sectors */}
            <Panel title="Sector Performance" tag="// SECT">
              {data.sectors.map((s: any) => <SectorBar key={s.sym} item={s} max={maxSectorMove} />)}
            </Panel>

            {/* Gainers + Losers */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <Panel title="Top Gainers" tag="// TOP">
                <div style={{ margin: '-12px -16px' }}>
                  {data.gainers.map((g: any, i: number) => <MoverRow key={g.sym} item={g} rank={i + 1} />)}
                </div>
              </Panel>
              <Panel title="Top Losers" tag="// BTM">
                <div style={{ margin: '-12px -16px' }}>
                  {data.losers.map((g: any, i: number) => <MoverRow key={g.sym} item={g} rank={i + 1} />)}
                </div>
              </Panel>
            </div>

            {/* FX + Commodities */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <Panel title="FX Rates" tag="// FX">
                {data.fx.map((f: any) => (
                  <div key={f.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                    <span style={{ fontSize: 13, fontWeight: 600, fontFamily: mono }}>{f.label}</span>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontFamily: mono }}>{price(f.price, 4)}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: pc(f.changePct), fontFamily: mono, width: 64, textAlign: 'right' }}>{pct(f.changePct)}</span>
                    </div>
                  </div>
                ))}
              </Panel>

              <Panel title="Commodities" tag="// CMD">
                {data.commodities.map((c: any) => (
                  <div key={c.sym} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, fontFamily: mono }}>{c.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', fontFamily: mono }}>{c.sym}</div>
                    </div>
                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <span style={{ fontSize: 13, fontFamily: mono }}>${price(c.price)}</span>
                      <span style={{ fontSize: 12, fontWeight: 600, color: pc(c.changePct), fontFamily: mono, width: 64, textAlign: 'right' }}>{pct(c.changePct)}</span>
                    </div>
                  </div>
                ))}
              </Panel>

              {data.crypto && data.crypto.length > 0 && (
                <Panel title="Crypto" tag="// DCP">
                  {data.crypto.map((c: any) => (
                    <div key={c.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontSize: 13, fontWeight: 600, fontFamily: mono }}>{c.label}</span>
                      <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                        <span style={{ fontSize: 13, fontFamily: mono }}>${price(c.price, c.price > 100 ? 2 : 4)}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: pc(c.changePct), fontFamily: mono, width: 64, textAlign: 'right' }}>{pct(c.changePct)}</span>
                      </div>
                    </div>
                  ))}
                </Panel>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
