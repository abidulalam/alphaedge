'use client'
import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
import { useIsMobile } from '@/hooks/useIsMobile'

const mono = 'IBM Plex Mono, monospace'

const rateColor = (v: number | null) => {
  if (v == null) return 'var(--text3)'
  if (v >= 5)   return '#ff4d4d'
  if (v >= 3)   return '#f5a623'
  return '#00d97e'
}

export default function FedRatesPage() {
  const [fedData, setFedData]     = useState<any>(null)
  const [fedLoading, setFedLoading] = useState(true)
  const isMobile = useIsMobile()

  useEffect(() => {
    fetch('/api/fed-rates')
      .then(r => r.json())
      .then(d => { setFedData(d); setFedLoading(false) })
      .catch(() => setFedLoading(false))
  }, [])

  const rates: any[] = fedData?.rates ?? []

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 900, margin: '0 auto', padding: isMobile ? '20px 12px' : '32px 24px' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--accent)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Macro</div>
          <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)' }}>Fed Rates & Yield Curve</h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>US Treasury yields and interest rate monitor. Updated hourly.</p>
        </div>

        {fedLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '40px 0' }}>
            <div style={{ width: 18, height: 18, border: '2px solid var(--border2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
            <span style={{ fontFamily: mono, fontSize: 13, color: 'var(--text3)' }}>Loading rate data…</span>
          </div>
        ) : (
          <>
            <div style={{ marginBottom: 20, padding: '12px 16px', background: 'rgba(255,85,0,.05)', border: '1px solid rgba(255,85,0,.15)', borderRadius: 6 }}>
              <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--accent)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>US Interest Rate Monitor</div>
              <p style={{ fontSize: 13, color: 'var(--text2)', margin: 0 }}>
                Treasury yields reflect market expectations for Fed policy. The 3-month T-bill tracks the Fed Funds rate closely. An inverted yield curve (short &gt; long) has historically preceded recessions.
              </p>
            </div>

            {/* Current rates grid */}
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 1fr' : 'repeat(4, 1fr)', gap: 10, marginBottom: 28 }}>
              {rates.map(r => (
                <div key={r.symbol} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '12px 14px' }}>
                  <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: mono, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{r.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 700, fontFamily: mono, color: rateColor(r.current), marginBottom: 4 }}>
                    {r.current != null ? r.current.toFixed(2) + '%' : '—'}
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--text3)' }}>{r.desc}</div>
                </div>
              ))}
            </div>

            {/* Yield curve snapshot */}
            {rates.length >= 4 && rates.every(r => r.current != null) && (
              <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 18px', marginBottom: 24 }}>
                <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 14 }}>Yield Curve</div>
                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, height: 100 }}>
                  {rates.map(r => {
                    const maxRate = Math.max(...rates.map((x: any) => x.current ?? 0)) || 1
                    const h = Math.max(12, (r.current / maxRate) * 90)
                    return (
                      <div key={r.symbol} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                        <div style={{ fontFamily: mono, fontSize: 11, color: rateColor(r.current), fontWeight: 600 }}>{r.current?.toFixed(2)}%</div>
                        <div style={{ width: '100%', height: h, background: rateColor(r.current), borderRadius: '3px 3px 0 0', opacity: 0.8 }} />
                        <div style={{ fontFamily: mono, fontSize: 9, color: 'var(--text3)', textAlign: 'center', letterSpacing: 0.5 }}>{r.label}</div>
                      </div>
                    )
                  })}
                </div>
                {(() => {
                  const tbill = rates[0]?.current
                  const tenyr = rates[2]?.current
                  if (tbill != null && tenyr != null) {
                    const inverted = tbill > tenyr
                    return (
                      <div style={{ marginTop: 12, padding: '8px 12px', background: inverted ? 'rgba(255,77,77,.08)' : 'rgba(0,217,126,.08)', border: '1px solid ' + (inverted ? 'rgba(255,77,77,.2)' : 'rgba(0,217,126,.2)'), borderRadius: 4 }}>
                        <span style={{ fontFamily: mono, fontSize: 11, color: inverted ? '#ff4d4d' : '#00d97e' }}>
                          {inverted
                            ? `⚠ Inverted curve — 3-Mo (${tbill.toFixed(2)}%) > 10-Yr (${tenyr.toFixed(2)}%). Historically a recession signal.`
                            : `✓ Normal curve — 10-Yr (${tenyr.toFixed(2)}%) > 3-Mo (${tbill.toFixed(2)}%). Healthy risk premium.`}
                        </span>
                      </div>
                    )
                  }
                  return null
                })()}
              </div>
            )}

            {/* 1-year history charts */}
            {rates.map(r => {
              if (!r.history || r.history.length === 0) return null
              const vals = r.history.map((b: any) => b.v)
              const minV = Math.min(...vals)
              const maxV = Math.max(...vals)
              const range = maxV - minV || 0.01
              const w = 700; const h = 80; const pad = { l: 44, r: 12, t: 10, b: 24 }
              const iw = w - pad.l - pad.r
              const ih = h - pad.t - pad.b
              const n = r.history.length
              const pts = r.history.map((b: any, i: number) => ({
                x: pad.l + (i / (n - 1)) * iw,
                y: pad.t + ih - ((b.v - minV) / range) * ih,
                v: b.v,
                t: b.t,
              }))
              const pathD = pts.map((p: any, i: number) => (i === 0 ? `M${p.x},${p.y}` : `L${p.x},${p.y}`)).join(' ')
              const areaD = pathD + ` L${pts[pts.length-1].x},${pad.t+ih} L${pts[0].x},${pad.t+ih} Z`
              const lineColor = rateColor(r.current)
              const labelStep = Math.max(1, Math.floor(n / 4))
              return (
                <div key={r.symbol} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '14px 18px', marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
                    <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase' }}>{r.label} — 1-Year History</div>
                    <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 600, color: lineColor }}>{r.current?.toFixed(2)}%</div>
                  </div>
                  <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: 'block' }}>
                    {[0, 0.5, 1].map(frac => {
                      const y = pad.t + ih * (1 - frac)
                      const val = (minV + frac * range).toFixed(2)
                      return (
                        <g key={frac}>
                          <line x1={pad.l} y1={y} x2={w - pad.r} y2={y} stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
                          <text x={pad.l - 4} y={y + 3} textAnchor="end" fontSize={8} fill="rgba(255,255,255,0.3)" fontFamily={mono}>{val}%</text>
                        </g>
                      )
                    })}
                    <path d={areaD} fill={lineColor} opacity={0.08} />
                    <path d={pathD} fill="none" stroke={lineColor} strokeWidth={1.5} />
                    {pts.filter((_: any, i: number) => i % labelStep === 0 || i === n - 1).map((p: any) => (
                      <text key={p.t} x={p.x} y={h - 4} textAnchor="middle" fontSize={8} fill="rgba(255,255,255,0.3)" fontFamily={mono}>
                        {new Date(p.t).toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
                      </text>
                    ))}
                  </svg>
                </div>
              )
            })}

            <div style={{ padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, fontSize: 11, color: 'var(--text3)', fontFamily: mono }}>
              Data: US Treasury yields via Yahoo Finance · Updated hourly · Weekly intervals shown
            </div>
          </>
        )}
      </main>

      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </>
  )
}
