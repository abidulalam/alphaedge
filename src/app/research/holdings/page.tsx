'use client'
import { useState } from 'react'
import Navbar from '@/components/Navbar'
import ChatBot from '@/components/ChatBot'
import { useIsMobile } from '@/hooks/useIsMobile'

const mono = 'IBM Plex Mono, monospace'

function fmtValue(n: number) {
  // Values are in thousands USD
  const usd = n * 1000
  if (usd >= 1e9) return '$' + (usd / 1e9).toFixed(2) + 'B'
  if (usd >= 1e6) return '$' + (usd / 1e6).toFixed(2) + 'M'
  if (usd >= 1e3) return '$' + (usd / 1e3).toFixed(1) + 'K'
  return '$' + usd.toLocaleString()
}

function fmtShares(n: number) {
  if (n >= 1e6) return (n / 1e6).toFixed(2) + 'M'
  if (n >= 1e3) return (n / 1e3).toFixed(0) + 'K'
  return n.toLocaleString()
}

const SUGGESTIONS = ['Berkshire Hathaway', 'Renaissance Technologies', 'Vanguard', 'BlackRock', 'ARK Investment', 'Bridgewater Associates']

export default function HoldingsPage() {
  const [query, setQuery]     = useState('')
  const [result, setResult]   = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const isMobile = useIsMobile()

  async function search(company: string) {
    if (!company.trim()) return
    setLoading(true); setError(null); setResult(null)
    try {
      const res = await fetch('/api/research/holdings?company=' + encodeURIComponent(company))
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResult(data)
    } catch (err: any) {
      setError(err.message ?? 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    search(query)
  }

  // Build chatbot context from 13F result
  const chatContext = result ? {
    ticker: result.entityName,
    name: result.entityName,
    // Pass portfolio summary via sector field
    sector: '13F-HR institutional filing · Period: ' + result.periodOfReport + ' · Filed: ' + result.filingDate,
    marketCap: result.totalValue * 1000, // convert thousands to dollars
    // Top 5 holdings summary as a custom field
    top5Holdings: result.holdings.slice(0, 5).map((h: any) => h.nameOfIssuer + ' (' + h.pctOfPortfolio.toFixed(1) + '%)').join(', '),
    holdingsCount: result.holdings.length,
  } as any : undefined

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 1000, margin: '0 auto', padding: isMobile ? '20px 12px' : '32px 24px' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--accent)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Research</div>
          <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)' }}>Investor Holdings</h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>View institutional 13F holdings from SEC EDGAR. Data reported quarterly with up to 45-day lag.</p>
        </div>

        {/* Search */}
        <form onSubmit={handleSubmit} style={{ marginBottom: 16 }}>
          <div style={{ display: 'flex', gap: 10 }}>
            <input
              value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Enter fund or institution name…"
              style={{ flex: 1, padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: mono }}
            />
            <button type="submit" disabled={loading || !query.trim()} style={{
              padding: '10px 20px', background: 'var(--accent)', color: '#000',
              fontFamily: mono, fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
              border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, whiteSpace: 'nowrap',
            }}>{loading ? 'Loading…' : 'Search'}</button>
          </div>
        </form>

        {/* Suggestions */}
        {!result && !loading && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 32 }}>
            {SUGGESTIONS.map(s => (
              <button key={s} onClick={() => { setQuery(s); search(s) }} style={{
                padding: '5px 12px', fontSize: 11, fontFamily: mono, letterSpacing: 1,
                border: '1px solid var(--border)', borderRadius: 20, background: 'transparent',
                color: 'var(--text2)', cursor: 'pointer',
              }}>{s}</button>
            ))}
          </div>
        )}

        {error && (
          <div style={{ padding: 14, background: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.3)', borderRadius: 6, color: '#ff4d4d', fontFamily: mono, fontSize: 12, marginBottom: 20 }}>{error}</div>
        )}

        {loading && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '40px 0' }}>
            <div style={{ width: 18, height: 18, border: '2px solid var(--border2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
            <span style={{ fontFamily: mono, fontSize: 13, color: 'var(--text3)' }}>Fetching 13F filing from SEC EDGAR…</span>
          </div>
        )}

        {result && (
          <>
            {/* Fund summary */}
            <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: isMobile ? 14 : 20, marginBottom: 24 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                <div>
                  <div style={{ fontSize: isMobile ? 16 : 20, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>{result.entityName}</div>
                  <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--text3)' }}>
                    13F-HR · Period: {result.periodOfReport} · Filed: {result.filingDate}
                  </div>
                  <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text3)', fontFamily: mono }}>
                    Use the AI chat button below to ask questions about this portfolio ↘
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontFamily: mono, fontSize: 20, fontWeight: 700, color: 'var(--accent)' }}>{fmtValue(result.totalValue)}</div>
                  <div style={{ fontSize: 11, color: 'var(--text3)', marginBottom: 6 }}>Total Portfolio (13F)</div>
                  <a href={result.secLink} target="_blank" rel="noopener noreferrer"
                    style={{ fontSize: 11, fontFamily: mono, color: 'var(--accent)', textDecoration: 'none' }}>View SEC Filing ↗</a>
                </div>
              </div>
            </div>

            {/* Holdings table */}
            <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>
              Top Holdings — {result.holdings.length} positions
            </div>
            <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '28px 1fr auto auto' : '28px 1fr 80px auto auto auto', background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                {['#', 'Issuer', ...(isMobile ? [] : ['CUSIP']), 'Value', 'Shares', '% Port.'].map((h, i) => (
                  <div key={h} style={{ padding: '9px 10px', fontSize: 10, color: 'var(--text3)', fontFamily: mono, letterSpacing: 1, textTransform: 'uppercase', textAlign: i > 1 ? 'right' : 'left' }}>{h}</div>
                ))}
              </div>
              {result.holdings.slice(0, 50).map((h: any, i: number) => (
                <div key={i} style={{ display: 'grid', gridTemplateColumns: isMobile ? '28px 1fr auto auto' : '28px 1fr 80px auto auto auto', borderBottom: '1px solid var(--border)', background: i % 2 === 0 ? 'var(--bg2)' : 'var(--bg)', alignItems: 'center' }}>
                  <div style={{ padding: '9px 10px', fontFamily: mono, fontSize: 11, color: 'var(--text3)' }}>{i + 1}</div>
                  <div style={{ padding: '9px 10px' }}>
                    <div style={{ fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{h.nameOfIssuer}</div>
                    {isMobile && <div style={{ fontSize: 10, color: 'var(--text3)', fontFamily: mono }}>{h.cusip}</div>}
                  </div>
                  {!isMobile && <div style={{ padding: '9px 10px', fontFamily: mono, fontSize: 10, color: 'var(--text3)' }}>{h.cusip}</div>}
                  <div style={{ padding: '9px 10px', fontFamily: mono, fontSize: 12, color: 'var(--text)', textAlign: 'right' }}>{fmtValue(h.value)}</div>
                  <div style={{ padding: '9px 10px', fontFamily: mono, fontSize: 12, color: 'var(--text2)', textAlign: 'right' }}>{fmtShares(h.shares)}</div>
                  <div style={{ padding: '9px 10px', textAlign: 'right' }}>
                    <span style={{ fontFamily: mono, fontSize: 12, color: h.pctOfPortfolio > 5 ? 'var(--accent)' : 'var(--text2)' }}>{h.pctOfPortfolio.toFixed(2)}%</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12, fontSize: 11, color: 'var(--text3)', fontFamily: mono }}>
              Source: SEC EDGAR 13F-HR · Values in thousands USD · Data may be delayed up to 45 days after quarter end
            </div>
          </>
        )}

        {!result && !loading && !error && (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ fontFamily: mono, fontSize: 13, marginBottom: 8 }}>Search any institutional investor</div>
            <div style={{ fontSize: 12 }}>Enter a fund name to view their latest 13F portfolio holdings from SEC EDGAR</div>
          </div>
        )}
      </main>

      <ChatBot stockContext={chatContext} />
    </>
  )
}
