'use client'
import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
import Link from 'next/link'
import { useIsMobile } from '@/hooks/useIsMobile'

const mono = 'IBM Plex Mono, monospace'

function fmtDate(d: string) {
  if (!d) return '—'
  const dt = new Date(d + 'T12:00:00')
  return dt.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function fmtNum(n: number | null) {
  if (n == null) return '—'
  const a = Math.abs(n)
  if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
  return '$' + n.toFixed(2)
}

function groupByDate<T extends { date: string }>(items: T[]): Record<string, T[]> {
  return items.reduce((acc: Record<string, T[]>, item) => {
    const d = item.date
    if (!acc[d]) acc[d] = []
    acc[d].push(item)
    return acc
  }, {})
}

type Range = 'week' | 'nextweek' | 'month'

export default function EarningsResearchPage() {
  const [earnings, setEarnings] = useState<any[]>([])
  const [loading, setLoading]   = useState(true)
  const [range, setRange]       = useState<Range>('week')
  const isMobile = useIsMobile()

  useEffect(() => {
    setLoading(true)
    fetch('/api/research/earnings?range=' + range)
      .then(r => r.json())
      .then(d => { setEarnings(d.earnings ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [range])

  const groups = groupByDate(earnings)
  const dates = Object.keys(groups).sort()

  const rangeLabels: Record<Range, string> = { week: 'This Week', nextweek: 'Next 2 Weeks', month: 'This Month' }

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 960, margin: '0 auto', padding: isMobile ? '20px 12px' : '32px 24px' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--accent)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Research</div>
          <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)' }}>Earnings Calendar</h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>Upcoming earnings releases — click a ticker to view on the dashboard.</p>
        </div>

        {/* Range filter */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
          {(['week', 'nextweek', 'month'] as Range[]).map(r => (
            <button key={r} onClick={() => setRange(r)} style={{
              padding: '6px 14px', fontSize: 11, fontFamily: mono, letterSpacing: 1, textTransform: 'uppercase',
              border: '1px solid', borderRadius: 4, cursor: 'pointer',
              borderColor: range === r ? 'var(--accent)' : 'var(--border)',
              background: range === r ? 'rgba(255,85,0,0.1)' : 'transparent',
              color: range === r ? 'var(--accent)' : 'var(--text2)',
            }}>{rangeLabels[r]}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '40px 0' }}>
            <div style={{ width: 18, height: 18, border: '2px solid var(--border2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
            <span style={{ fontFamily: mono, fontSize: 13, color: 'var(--text3)' }}>Loading earnings…</span>
          </div>
        ) : dates.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text3)', fontFamily: mono, fontSize: 13 }}>No earnings scheduled for this period.</div>
        ) : (
          dates.map(date => (
            <div key={date} style={{ marginBottom: 28 }}>
              <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--accent)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ display: 'block', width: 16, height: 1, background: 'var(--accent)' }} />
                {fmtDate(date)}
              </div>
              <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                {/* Header */}
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '80px 1fr auto' : '80px 1fr auto auto auto', background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                  {['Ticker', 'Company', 'Time', ...(isMobile ? [] : ['EPS Est.', 'Rev. Est.'])].map((h, i) => (
                    <div key={h} style={{ padding: '8px 12px', fontSize: 10, color: 'var(--text3)', fontFamily: mono, letterSpacing: 1, textTransform: 'uppercase', textAlign: i > 1 ? 'right' : 'left' }}>{h}</div>
                  ))}
                </div>
                {groups[date].map((e: any, i: number) => (
                  <div key={i} style={{ display: 'grid', gridTemplateColumns: isMobile ? '80px 1fr auto' : '80px 1fr auto auto auto', borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--bg2)' : 'var(--bg)', alignItems: 'center' }}>
                    <div style={{ padding: '10px 12px' }}>
                      <Link href={'/dashboard?ticker=' + e.ticker} style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: 'var(--accent)', textDecoration: 'none' }}>{e.ticker}</Link>
                    </div>
                    <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                    <div style={{ padding: '10px 12px', fontSize: 11, fontFamily: mono, color: 'var(--text3)', textAlign: 'right', whiteSpace: 'nowrap' }}>
                      {e.hour === 'bmo' ? 'Pre-mkt' : e.hour === 'amc' ? 'After-hrs' : '—'}
                    </div>
                    {!isMobile && (
                      <>
                        <div style={{ padding: '10px 12px', fontSize: 12, fontFamily: mono, color: 'var(--text)', textAlign: 'right' }}>{e.epsEstimate != null ? '$' + e.epsEstimate.toFixed(2) : '—'}</div>
                        <div style={{ padding: '10px 12px', fontSize: 12, fontFamily: mono, color: 'var(--text)', textAlign: 'right' }}>{fmtNum(e.revenueEstimate)}</div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ))
        )}
      </main>
    </>
  )
}
