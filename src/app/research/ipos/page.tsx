'use client'
import { useEffect, useState } from 'react'
import Navbar from '@/components/Navbar'
import { useIsMobile } from '@/hooks/useIsMobile'

const mono = 'IBM Plex Mono, monospace'

function fmtDate(d: string) {
  if (!d) return '—'
  const dt = new Date(d + 'T12:00:00')
  return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtShares(n: number | null) {
  if (n == null) return '—'
  if (n >= 1e6) return (n / 1e6).toFixed(1) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'
  return String(n)
}

function StatusBadge({ status }: { status: string }) {
  const s = (status || '').toLowerCase()
  const color = s === 'priced' ? '#00d97e' : s === 'withdrawn' ? '#ff4d4d' : '#f5a623'
  return (
    <span style={{ fontSize: 10, fontFamily: mono, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color, border: `1px solid ${color}44`, borderRadius: 3, padding: '2px 6px' }}>
      {status || 'Expected'}
    </span>
  )
}

export default function IPOsPage() {
  const [ipos, setIpos]     = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const isMobile = useIsMobile()

  useEffect(() => {
    fetch('/api/research/ipos')
      .then(r => r.json())
      .then(d => { setIpos(d.ipos ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 960, margin: '0 auto', padding: isMobile ? '20px 12px' : '32px 24px' }}>
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--accent)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Research</div>
          <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)' }}>IPO Calendar</h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>Upcoming initial public offerings for the next 90 days.</p>
        </div>

        {loading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '40px 0' }}>
            <div style={{ width: 18, height: 18, border: '2px solid var(--border2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
            <span style={{ fontFamily: mono, fontSize: 13, color: 'var(--text3)' }}>Loading IPOs…</span>
          </div>
        ) : ipos.length === 0 ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text3)', fontFamily: mono, fontSize: 13 }}>No upcoming IPOs found.</div>
        ) : (
          <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 80px auto' : '1fr 80px 80px auto auto auto', background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
              {['Company', 'Ticker', ...(isMobile ? [] : ['Exchange', 'Shares', 'Price Range']), 'Date', 'Status'].map((h, i) => (
                <div key={h} style={{ padding: '9px 12px', fontSize: 10, color: 'var(--text3)', fontFamily: mono, letterSpacing: 1, textTransform: 'uppercase', textAlign: i > 0 ? 'right' : 'left' }}>{h}</div>
              ))}
            </div>
            {ipos.map((ipo: any, i: number) => (
              <div key={i} style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr 80px auto' : '1fr 80px 80px auto auto auto', borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--bg2)' : 'var(--bg)', alignItems: 'center' }}>
                <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{ipo.name}</div>
                <div style={{ padding: '10px 12px', fontFamily: mono, fontSize: 12, fontWeight: 700, color: ipo.symbol ? 'var(--accent)' : 'var(--text3)', textAlign: 'right' }}>{ipo.symbol || '—'}</div>
                {!isMobile && (
                  <>
                    <div style={{ padding: '10px 12px', fontSize: 11, color: 'var(--text2)', textAlign: 'right' }}>{ipo.exchange || '—'}</div>
                    <div style={{ padding: '10px 12px', fontFamily: mono, fontSize: 12, color: 'var(--text)', textAlign: 'right' }}>{fmtShares(ipo.numberOfShares)}</div>
                    <div style={{ padding: '10px 12px', fontFamily: mono, fontSize: 12, color: 'var(--text)', textAlign: 'right' }}>{ipo.price || '—'}</div>
                  </>
                )}
                <div style={{ padding: '10px 12px', fontFamily: mono, fontSize: 11, color: 'var(--text3)', textAlign: 'right', whiteSpace: 'nowrap' }}>{fmtDate(ipo.date)}</div>
                <div style={{ padding: '10px 12px', textAlign: 'right' }}><StatusBadge status={ipo.status} /></div>
              </div>
            ))}
          </div>
        )}
      </main>
    </>
  )
}
