'use client'
import { useState } from 'react'
import Navbar from '@/components/Navbar'
import ChatBot from '@/components/ChatBot'
import { useIsMobile } from '@/hooks/useIsMobile'

const mono = 'IBM Plex Mono, monospace'

const FORM_TYPES = ['10-K', '10-Q', '8-K', 'S-1', 'DEF 14A', '20-F', '13F-HR', 'SC 13G', 'SC 13D']

export default function EdgarPage() {
  const [query, setQuery]           = useState('')
  const [form, setForm]             = useState('10-K')
  const [startdt, setStartdt]       = useState('')
  const [enddt, setEnddt]           = useState('')
  const [results, setResults]       = useState<any>(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState<string | null>(null)
  const [selectedFiling, setSelectedFiling] = useState<any>(null)
  const isMobile = useIsMobile()

  async function search(e: React.FormEvent) {
    e.preventDefault()
    if (!query.trim()) return
    setLoading(true); setError(null); setResults(null); setSelectedFiling(null)
    try {
      const params = new URLSearchParams({ q: query, form })
      if (startdt) params.set('startdt', startdt)
      if (enddt)   params.set('enddt', enddt)
      const res = await fetch('/api/research/edgar?' + params.toString())
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      setResults(data)
    } catch (err: any) {
      setError(err.message ?? 'Search failed')
    } finally {
      setLoading(false)
    }
  }

  // Build chatbot context from selected filing
  const chatContext = selectedFiling ? {
    ticker: selectedFiling.entityName,
    name: selectedFiling.entityName,
    sector: selectedFiling.form + ' filing · Period: ' + (selectedFiling.periodOfReport || 'N/A') + ' · Filed: ' + selectedFiling.filingDate,
    // Reuse unused fields to pass filing info to system prompt
    filingType: selectedFiling.form,
    filingPeriod: selectedFiling.periodOfReport,
    filingDate: selectedFiling.filingDate,
    secLink: selectedFiling.secLink,
    searchQuery: query,
  } as any : undefined

  return (
    <>
      <Navbar />
      <main style={{ maxWidth: 1100, margin: '0 auto', padding: isMobile ? '20px 12px' : '32px 24px' }}>
        {/* Header */}
        <div style={{ marginBottom: 24 }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--accent)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 6 }}>Research</div>
          <h1 style={{ fontSize: isMobile ? 20 : 26, fontWeight: 700, margin: '0 0 4px', color: 'var(--text)' }}>EDGAR Filing Screener</h1>
          <p style={{ fontSize: 13, color: 'var(--text3)', margin: 0 }}>Search SEC EDGAR full-text filings by keyword, filing type, and date range.</p>
        </div>

        {/* Search form */}
        <form onSubmit={search} style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: isMobile ? 14 : 20, marginBottom: 24 }}>
          <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr auto auto auto', gap: 10, marginBottom: 10 }}>
            <input
              value={query} onChange={e => setQuery(e.target.value)}
              placeholder='Keyword or phrase, e.g. "artificial intelligence"'
              style={{ padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', fontSize: 13, outline: 'none', fontFamily: mono }}
            />
            <select value={form} onChange={e => setForm(e.target.value)}
              style={{ padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', fontSize: 12, fontFamily: mono, cursor: 'pointer' }}>
              {FORM_TYPES.map(f => <option key={f} value={f}>{f}</option>)}
            </select>
            <input type="date" value={startdt} onChange={e => setStartdt(e.target.value)} placeholder="From"
              style={{ padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', fontSize: 12, fontFamily: mono }} />
            <input type="date" value={enddt} onChange={e => setEnddt(e.target.value)} placeholder="To"
              style={{ padding: '10px 12px', background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, color: 'var(--text)', fontSize: 12, fontFamily: mono }} />
          </div>
          <button type="submit" disabled={loading || !query.trim()} style={{
            padding: '10px 24px', background: 'var(--accent)', color: '#000', fontFamily: mono,
            fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
            border: 'none', borderRadius: 4, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1,
          }}>{loading ? 'Searching…' : 'Search EDGAR'}</button>
        </form>

        {error && (
          <div style={{ padding: 14, background: 'rgba(255,77,77,0.08)', border: '1px solid rgba(255,77,77,0.3)', borderRadius: 6, color: '#ff4d4d', fontFamily: mono, fontSize: 12, marginBottom: 20 }}>{error}</div>
        )}

        {results && (
          <>
            {/* Result summary */}
            <div style={{ marginBottom: 16, fontFamily: mono, fontSize: 12, color: 'var(--text3)' }}>
              <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{results.total?.toLocaleString()}</span> results for &quot;{results.query}&quot; in {form}
            </div>

            {selectedFiling && (
              <div style={{ marginBottom: 16, padding: '10px 14px', background: 'rgba(255,85,0,0.08)', border: '1px solid rgba(255,85,0,0.3)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div style={{ fontSize: 12, color: 'var(--text2)', fontFamily: mono }}>
                  <span style={{ color: 'var(--accent)' }}>AI context set:</span>{' '}
                  {selectedFiling.entityName} · {selectedFiling.form} · {selectedFiling.filingDate}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: mono }}>Open AI chat ↘</span>
                  <button onClick={() => setSelectedFiling(null)} style={{ fontSize: 11, fontFamily: mono, color: 'var(--text3)', background: 'transparent', border: 'none', cursor: 'pointer' }}>✕ clear</button>
                </div>
              </div>
            )}

            {results.filings.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--text3)', fontFamily: mono, fontSize: 13 }}>No filings found.</div>
            ) : (
              <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : '2fr 1fr 80px 100px auto auto', background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                  {['Company', ...(isMobile ? [] : ['Period', 'Form', 'Filed', 'Ask AI']), 'SEC Link'].map((h, i) => (
                    <div key={h} style={{ padding: '9px 12px', fontSize: 10, color: 'var(--text3)', fontFamily: mono, letterSpacing: 1, textTransform: 'uppercase', textAlign: i > 0 ? 'right' : 'left' }}>{h}</div>
                  ))}
                </div>
                {results.filings.map((f: any, i: number) => (
                  <div key={i} style={{
                    display: 'grid', gridTemplateColumns: isMobile ? '1fr auto' : '2fr 1fr 80px 100px auto auto',
                    borderBottom: '1px solid var(--border)',
                    background: selectedFiling === f ? 'rgba(255,85,0,0.06)' : i % 2 === 0 ? 'var(--bg2)' : 'var(--bg)',
                    alignItems: 'center',
                  }}>
                    <div style={{ padding: '10px 12px', fontSize: 13, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{f.entityName}</div>
                    {!isMobile && (
                      <>
                        <div style={{ padding: '10px 12px', fontFamily: mono, fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>{f.periodOfReport || '—'}</div>
                        <div style={{ padding: '10px 12px', fontFamily: mono, fontSize: 11, color: 'var(--text2)', textAlign: 'right' }}>{f.form}</div>
                        <div style={{ padding: '10px 12px', fontFamily: mono, fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>{f.filingDate}</div>
                        <div style={{ padding: '10px 12px', textAlign: 'right' }}>
                          <button
                            onClick={() => setSelectedFiling(f === selectedFiling ? null : f)}
                            style={{
                              fontSize: 11, fontFamily: mono, padding: '4px 10px',
                              border: '1px solid', borderRadius: 3, cursor: 'pointer',
                              borderColor: selectedFiling === f ? 'var(--accent)' : 'var(--border)',
                              background: selectedFiling === f ? 'rgba(255,85,0,0.15)' : 'transparent',
                              color: selectedFiling === f ? 'var(--accent)' : 'var(--text3)',
                            }}
                          >{selectedFiling === f ? 'Selected' : 'Ask AI'}</button>
                        </div>
                      </>
                    )}
                    <div style={{ padding: '10px 12px', textAlign: 'right' }}>
                      {f.secLink
                        ? <a href={f.secLink} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--accent)', fontFamily: mono, fontSize: 11, textDecoration: 'none' }}>View ↗</a>
                        : <span style={{ color: 'var(--text3)', fontFamily: mono, fontSize: 11 }}>—</span>
                      }
                    </div>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {!results && !loading && (
          <div style={{ padding: '60px 0', textAlign: 'center', color: 'var(--text3)' }}>
            <div style={{ fontFamily: mono, fontSize: 13, marginBottom: 8 }}>Search SEC EDGAR filings</div>
            <div style={{ fontSize: 12 }}>Try: &quot;artificial intelligence&quot;, &quot;climate risk&quot;, &quot;supply chain&quot;</div>
          </div>
        )}
      </main>

      <ChatBot stockContext={chatContext} />
    </>
  )
}
