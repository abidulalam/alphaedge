'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'

const COMMANDS: { cmd: string; desc: string; route: string }[] = [
  { cmd: 'MKT',  desc: 'Market Overview',  route: '/markets'   },
  { cmd: 'MKTS', desc: 'Market Overview',  route: '/markets'   },
  { cmd: 'SCRN', desc: 'Stock Screener',   route: '/screener'  },
  { cmd: 'CMP',  desc: 'Compare Stocks',   route: '/compare'   },
  { cmd: 'HOME', desc: 'Home',             route: '/'          },
  { cmd: 'DASH', desc: 'Dashboard',        route: '/dashboard' },
]

interface Suggestion {
  type: 'command' | 'ticker'
  label: string
  desc: string
  route: string
}

export default function CommandBar() {
  const router = useRouter()
  const [open, setOpen]         = useState(false)
  const [query, setQuery]       = useState('')
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [selected, setSelected] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounce  = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Open on Cmd+K or /
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement).tagName
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA'
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault(); setOpen(o => !o)
      }
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) { setTimeout(() => inputRef.current?.focus(), 30); setQuery(''); setSuggestions([]) }
  }, [open])

  const search = useCallback((q: string) => {
    const upper = q.toUpperCase().trim()
    if (!upper) { setSuggestions([]); return }

    // Match built-in commands
    const cmds: Suggestion[] = COMMANDS
      .filter(c => c.cmd.startsWith(upper))
      .map(c => ({ type: 'command', label: c.cmd, desc: c.desc, route: c.route }))

    setSuggestions(cmds)
    setSelected(0)

    // Search tickers via API (debounced)
    if (debounce.current) clearTimeout(debounce.current)
    debounce.current = setTimeout(async () => {
      try {
        const res  = await fetch(`/api/search?q=${encodeURIComponent(q)}`)
        const json = await res.json()
        const tickers: Suggestion[] = (json.results || []).slice(0, 6).map((r: any) => ({
          type:  'ticker',
          label: r.ticker,
          desc:  r.name,
          route: `/dashboard?ticker=${r.ticker}`,
        }))
        setSuggestions(prev => {
          const cmdLabels = new Set(prev.filter(s => s.type === 'command').map(s => s.label))
          return [...prev.filter(s => s.type === 'command'), ...tickers.filter(t => !cmdLabels.has(t.label))]
        })
      } catch {}
    }, 200)
  }, [])

  useEffect(() => { search(query) }, [query, search])

  function execute(s?: Suggestion) {
    const target = s ?? suggestions[selected]
    if (target) {
      router.push(target.route); setOpen(false); return
    }
    // Fallback: treat raw input as ticker
    const t = query.trim().toUpperCase()
    if (t) router.push(`/dashboard?ticker=${t}`)
    setOpen(false)
  }

  function onKey(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelected(s => Math.min(s + 1, suggestions.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setSelected(s => Math.max(s - 1, 0)) }
    if (e.key === 'Enter')     { e.preventDefault(); execute() }
    if (e.key === 'Escape')    { setOpen(false) }
  }

  const mono = 'IBM Plex Mono, monospace'

  if (!open) return (
    <button
      onClick={() => setOpen(true)}
      title="Command Bar (⌘K)"
      style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 12px', border: '1px solid var(--border2)', borderRadius: 4, background: 'var(--bg2)', color: 'var(--text3)', fontFamily: mono, fontSize: 12, cursor: 'pointer', letterSpacing: 1 }}
    >
      <span style={{ color: 'var(--accent)', fontSize: 13 }}>{'>'}_</span>
      <span>COMMAND</span>
      <span style={{ marginLeft: 4, padding: '1px 5px', border: '1px solid var(--border3)', borderRadius: 3, fontSize: 10 }}>⌘K</span>
    </button>
  )

  return (
    <div onClick={() => setOpen(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 200, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', paddingTop: 120 }}>
      <div onClick={e => e.stopPropagation()} style={{ width: '100%', maxWidth: 580, background: 'var(--bg2)', border: '1px solid var(--accent)', borderRadius: 6, overflow: 'hidden', boxShadow: '0 0 40px rgba(255,85,0,.15)' }}>

        {/* Input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderBottom: suggestions.length > 0 ? '1px solid var(--border)' : 'none' }}>
          <span style={{ color: 'var(--accent)', fontFamily: mono, fontSize: 16, fontWeight: 700, flexShrink: 0 }}>{'>'}</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={onKey}
            placeholder="Enter ticker or command  (e.g. AAPL, MKT, SCRN, CMP)"
            style={{ flex: 1, background: 'transparent', border: 'none', outline: 'none', fontFamily: mono, fontSize: 15, color: 'var(--text)', letterSpacing: 1, padding: 0, width: '100%' }}
          />
          <span onClick={() => setOpen(false)} style={{ color: 'var(--text3)', cursor: 'pointer', fontSize: 16, flexShrink: 0 }}>✕</span>
        </div>

        {/* Suggestions */}
        {suggestions.length > 0 && (
          <div>
            {suggestions.map((s, i) => (
              <div
                key={s.label + s.type}
                onClick={() => execute(s)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '10px 16px', background: i === selected ? 'rgba(255,85,0,.08)' : 'transparent', borderLeft: i === selected ? '2px solid var(--accent)' : '2px solid transparent', cursor: 'pointer' }}
              >
                <span style={{ width: 20, height: 20, borderRadius: 4, background: s.type === 'command' ? 'rgba(255,85,0,.15)' : 'rgba(0,200,100,.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, color: s.type === 'command' ? 'var(--accent)' : 'var(--green)', fontFamily: mono, fontWeight: 700, flexShrink: 0 }}>
                  {s.type === 'command' ? 'CMD' : 'EQ'}
                </span>
                <span style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: 'var(--text)', minWidth: 80 }}>{s.label}</span>
                <span style={{ fontSize: 12, color: 'var(--text3)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.desc}</span>
                <span style={{ fontSize: 11, color: 'var(--text3)' }}>↵</span>
              </div>
            ))}
          </div>
        )}

        {/* Footer hints */}
        <div style={{ padding: '8px 16px', borderTop: '1px solid var(--border)', display: 'flex', gap: 20, fontSize: 11, color: 'var(--text3)', fontFamily: mono }}>
          {[['↑↓', 'navigate'], ['↵', 'select'], ['esc', 'close'], ['⌘K', 'toggle']].map(([k, v]) => (
            <span key={k}><span style={{ color: 'var(--accent)' }}>{k}</span> {v}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
