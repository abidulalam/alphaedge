'use client'
import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
import Link from 'next/link'

const mono = 'IBM Plex Mono, monospace'

const IMPACT_COLOR: Record<string, string> = {
  high:   '#FF3333',
  medium: '#FFAA00',
  low:    '#888888',
}

function fmt(val: number | null, unit: string) {
  if (val == null) return '—'
  return val + (unit ? ' ' + unit : '')
}

function fmtDate(dateStr: string) {
  if (!dateStr) return '—'
  const d = new Date(dateStr)
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function fmtTime(dateStr: string) {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return dateStr
  return d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'America/New_York' }) + ' EST'
}

function groupByDate<T extends { date: string }>(items: T[]): Record<string, T[]> {
  return items.reduce((acc, item) => {
    const d = item.date?.split('T')[0] ?? item.date
    acc[d] = acc[d] ? [...acc[d], item] : [item]
    return acc
  }, {} as Record<string, T[]>)
}

export default function CalendarPage() {
  const [data, setData]     = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab]       = useState<'economic' | 'earnings'>('economic')

  useEffect(() => {
    fetch('/api/calendar').then(r => r.json()).then(setData).finally(() => setLoading(false))
  }, [])

  const econGroups  = data ? groupByDate(data.economic)  : {}
  const earnGroups  = data ? groupByDate(data.earnings)  : {}
  const activeGroups = tab === 'economic' ? econGroups : earnGroups

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <Navbar />

      {/* Header */}
      <div style={{ borderBottom: '1px solid var(--border)', padding: '16px 32px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <span style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: 3, textTransform: 'uppercase', fontFamily: mono }}>// CALS</span>
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase' }}>Economic Calendar</h1>
          <span style={{ fontSize: 12, color: 'var(--text3)', fontFamily: mono }}>Next 14 days</span>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4 }}>
          {(['economic', 'earnings'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)} style={{ padding: '6px 16px', fontFamily: mono, fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', border: '1px solid var(--border2)', borderRadius: 4, background: tab === t ? 'var(--accent)' : 'transparent', color: tab === t ? '#000' : 'var(--text2)', cursor: 'pointer', fontWeight: tab === t ? 700 : 400 }}>
              {t === 'economic' ? 'Economic' : 'Earnings'}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh', fontFamily: mono, fontSize: 13, color: 'var(--text3)', letterSpacing: 2 }}>
          LOADING CALENDAR…
        </div>
      )}

      {data && (
        <div style={{ maxWidth: 1000, margin: '0 auto', padding: '24px 32px' }}>
          {Object.keys(activeGroups).length === 0 && (
            <div style={{ color: 'var(--text3)', fontFamily: mono, fontSize: 13, paddingTop: 40, textAlign: 'center' }}>No events found for the next 14 days.</div>
          )}

          {Object.entries(activeGroups).sort(([a], [b]) => a.localeCompare(b)).map(([date, events]) => (
            <div key={date} style={{ marginBottom: 28 }}>
              {/* Date header */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 }}>
                <span style={{ fontFamily: mono, fontSize: 12, fontWeight: 700, color: 'var(--accent)', letterSpacing: 2, textTransform: 'uppercase' }}>{fmtDate(date)}</span>
                <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
              </div>

              {/* Economic events */}
              {tab === 'economic' && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '90px 30px 1fr 90px 90px 90px', background: 'var(--bg3)', borderBottom: '1px solid var(--border)', padding: '8px 14px', gap: 12 }}>
                    {['Time', '', 'Event', 'Actual', 'Estimate', 'Previous'].map((h, i) => (
                      <div key={i} style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: mono, textAlign: i > 2 ? 'right' : 'left' }}>{h}</div>
                    ))}
                  </div>
                  {(events as any[]).map((e, i) => (
                    <div key={i} style={{ display: 'grid', gridTemplateColumns: '90px 30px 1fr 90px 90px 90px', padding: '10px 14px', gap: 12, borderBottom: i < events.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'var(--bg2)' : 'transparent', alignItems: 'center' }}>
                      <div style={{ fontFamily: mono, fontSize: 12, color: 'var(--text3)' }}>{fmtTime(e.date)}</div>
                      <div title={e.impact} style={{ width: 8, height: 8, borderRadius: '50%', background: IMPACT_COLOR[e.impact] ?? '#666' }} />
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 500 }}>{e.event}</div>
                        <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2, fontFamily: mono }}>{e.country?.toUpperCase()}</div>
                      </div>
                      <div style={{ fontFamily: mono, fontSize: 13, textAlign: 'right', fontWeight: 600, color: e.actual != null ? 'var(--green)' : 'var(--text3)' }}>{fmt(e.actual, e.unit)}</div>
                      <div style={{ fontFamily: mono, fontSize: 13, textAlign: 'right', color: 'var(--text2)' }}>{fmt(e.estimate, e.unit)}</div>
                      <div style={{ fontFamily: mono, fontSize: 13, textAlign: 'right', color: 'var(--text3)' }}>{fmt(e.previous, e.unit)}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* Earnings events */}
              {tab === 'earnings' && (
                <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px 120px 120px', background: 'var(--bg3)', borderBottom: '1px solid var(--border)', padding: '8px 14px', gap: 12 }}>
                    {['Ticker', 'Company', 'When', 'EPS Est.', 'Rev. Est.'].map((h, i) => (
                      <div key={i} style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: mono, textAlign: i > 1 ? 'right' : 'left' }}>{h}</div>
                    ))}
                  </div>
                  {(events as any[]).map((e, i) => (
                    <Link key={i} href={`/dashboard?ticker=${e.ticker}`} style={{ display: 'grid', gridTemplateColumns: '80px 1fr 80px 120px 120px', padding: '10px 14px', gap: 12, borderBottom: i < events.length - 1 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'var(--bg2)' : 'transparent', alignItems: 'center', textDecoration: 'none', cursor: 'pointer' }}>
                      <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: 'var(--accent)' }}>{e.ticker}</div>
                      <div style={{ fontSize: 13, color: 'var(--text2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{e.name}</div>
                      <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>
                        {e.hour === 'bmo' ? 'Pre-mkt' : e.hour === 'amc' ? 'After-mkt' : '—'}
                      </div>
                      <div style={{ fontFamily: mono, fontSize: 13, textAlign: 'right', color: 'var(--text2)' }}>{e.epsEst != null ? '$' + e.epsEst.toFixed(2) : '—'}</div>
                      <div style={{ fontFamily: mono, fontSize: 13, textAlign: 'right', color: 'var(--text2)' }}>
                        {e.revEst != null ? (e.revEst >= 1e9 ? '$' + (e.revEst / 1e9).toFixed(1) + 'B' : '$' + (e.revEst / 1e6).toFixed(0) + 'M') : '—'}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          ))}

          {/* Legend */}
          {tab === 'economic' && (
            <div style={{ display: 'flex', gap: 20, marginTop: 8, fontSize: 11, color: 'var(--text3)', fontFamily: mono }}>
              {Object.entries(IMPACT_COLOR).map(([k, v]) => (
                <span key={k} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: v, display: 'inline-block' }} />
                  {k.toUpperCase()} IMPACT
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
