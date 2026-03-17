'use client'
import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'

interface Result { ticker: string; name: string; exchange: string }
const POPULAR = ['AAPL','MSFT','NVDA','GOOGL','META','AMZN','TSLA','JPM','V']

export default function SearchBar({ compact = false }: { compact?: boolean }) {
  const [query, setQuery]   = useState('')
  const [results, setResults] = useState<Result[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen]     = useState(false)
  const router  = useRouter()
  const ref     = useRef<HTMLDivElement>(null)
  const timer   = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  function onChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value
    setQuery(val)
    clearTimeout(timer.current)
    if (!val) { setResults([]); setOpen(true); return }
    setOpen(true)
    timer.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(val)}`)
        const data = await res.json()
        setResults(data.results || [])
      } finally { setLoading(false) }
    }, 280)
  }

  function goTo(ticker: string) {
    setQuery(''); setOpen(false); setResults([])
    router.push(`/dashboard?ticker=${ticker}`)
  }

  return (
    <div ref={ref} style={{ position: 'relative', width: '100%' }}>
      <div style={{ position: 'relative' }}>
        <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--text3)', pointerEvents: 'none' }}>⌕</span>
        <input
          value={query} onChange={onChange}
          onKeyDown={e => e.key === 'Enter' && query && goTo(query.toUpperCase())}
          onFocus={() => setOpen(true)}
          placeholder={compact ? 'Search ticker…' : 'Search any stock — AAPL, Tesla, NVDA…'}
          style={{ paddingLeft: 34, height: compact ? 36 : 48, fontSize: compact ? 13 : 15 }}
        />
        {loading && <span style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, border: '2px solid var(--border2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin .6s linear infinite', display: 'block' }} />}
      </div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>

      {open && (
        <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, right: 0, background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 8, overflow: 'hidden', zIndex: 300, boxShadow: '0 8px 32px rgba(0,0,0,0.5)' }}>
          {!query && (
            <div style={{ padding: '8px 12px 10px' }}>
              <div style={{ fontSize: 10, fontFamily: 'var(--mono)', color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8, padding: '4px 4px 0' }}>Popular</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {POPULAR.map(t => (
                  <button key={t} onClick={() => goTo(t)} style={{ padding: '4px 10px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--text2)', fontFamily: 'var(--mono)', fontSize: 12, borderRadius: 3 }}>{t}</button>
                ))}
              </div>
            </div>
          )}
          {loading && <div style={{ padding: '12px 16px', fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text3)' }}>Searching…</div>}
          {!loading && query && results.length === 0 && (
            <button onClick={() => goTo(query.toUpperCase())} style={{ width: '100%', padding: '12px 16px', display: 'flex', gap: 12, alignItems: 'center', borderBottom: '1px solid var(--border)' }}>
              <span style={{ fontFamily: 'var(--mono)', fontSize: 13, color: 'var(--accent)', fontWeight: 600 }}>{query.toUpperCase()}</span>
              <span style={{ fontSize: 12, color: 'var(--text3)' }}>Search this ticker →</span>
            </button>
          )}
          {results.map(r => (
            <button key={r.ticker} onClick={() => goTo(r.ticker)} style={{ width: '100%', padding: '10px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', textAlign: 'left' }}>
              <div>
                <span style={{ fontFamily: 'var(--mono)', fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{r.ticker}</span>
                <span style={{ fontSize: 12, color: 'var(--text2)', marginLeft: 10 }}>{r.name}</span>
              </div>
              <span style={{ fontSize: 11, color: 'var(--text3)', fontFamily: 'var(--mono)' }}>{r.exchange}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
