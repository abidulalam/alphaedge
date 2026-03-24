'use client'
import React, { useState, useRef, useEffect } from 'react'

const mono = 'IBM Plex Mono, monospace'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

interface StockContext {
  ticker?: string
  name?: string
  price?: number | null
  changePct?: number | null
  marketCap?: number | null
  sector?: string | null
  pe?: number | null
  eps?: number | null
  pegRatio?: number | null
  evToEbitda?: number | null
  revenueGrowth?: number | null
  profitMargins?: number | null
  freeCashflow?: number | null
  beta?: number | null
  roeTTM?: number | null
  debtToEquity?: number | null
  fiftyTwoWeekHigh?: number | null
  fiftyTwoWeekLow?: number | null
  moatScore?: number | null
  growthScore?: number | null
  quantSignals?: { trend?: string } | null
}

const SUGGESTIONS = [
  'Is this stock overvalued?',
  'Summarize the key risks',
  'What does the PEG ratio tell us?',
  'How is the cash flow?',
]

export default function ChatBot({ stockContext }: { stockContext?: StockContext }) {
  const [open, setOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (open) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
      inputRef.current?.focus()
    }
  }, [open, messages])

  async function send(text?: string) {
    const content = (text ?? input).trim()
    if (!content || loading) return
    setInput('')

    const newMessages: Message[] = [...messages, { role: 'user', content }]
    setMessages(newMessages)
    setLoading(true)

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: newMessages, stockContext }),
      })
      const data = await res.json()
      setMessages(prev => [...prev, { role: 'assistant', content: data.reply ?? 'Sorry, no response.' }])
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Error contacting AI. Please try again.' }])
    } finally {
      setLoading(false)
    }
  }

  function handleKey(e: React.KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  const ticker = stockContext?.ticker ?? 'Stock'

  return (
    <>
      {/* Floating bubble */}
      <button
        onClick={() => setOpen(o => !o)}
        title="Ask AlphaEdge AI"
        style={{
          position: 'fixed',
          bottom: 28,
          right: 28,
          width: 52,
          height: 52,
          borderRadius: '50%',
          background: 'var(--accent)',
          border: 'none',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 4px 20px rgba(0,0,0,0.4)',
          zIndex: 1000,
          transition: 'transform 0.2s',
          transform: open ? 'rotate(45deg)' : 'none',
        }}
      >
        {open ? (
          <svg width="20" height="20" viewBox="0 0 20 20" fill="white">
            <line x1="4" y1="4" x2="16" y2="16" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
            <line x1="16" y1="4" x2="4" y2="16" stroke="white" strokeWidth="2.5" strokeLinecap="round" />
          </svg>
        ) : (
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>

      {/* Chat window */}
      {open && (
        <div style={{
          position: 'fixed',
          bottom: 92,
          right: 28,
          width: 360,
          maxHeight: 520,
          background: 'var(--bg)',
          border: '1px solid var(--border)',
          borderRadius: 12,
          display: 'flex',
          flexDirection: 'column',
          zIndex: 999,
          boxShadow: '0 8px 40px rgba(0,0,0,0.5)',
          overflow: 'hidden',
        }}>
          {/* Header */}
          <div style={{
            padding: '12px 16px',
            background: 'var(--bg2)',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: 'var(--accent)', flexShrink: 0,
            }} />
            <div>
              <div style={{ fontFamily: mono, fontSize: 12, color: 'var(--accent)', letterSpacing: 1 }}>
                ALPHAEDGE AI
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 1 }}>
                {stockContext?.ticker ? `Analyzing ${ticker}` : 'Financial Assistant'}
              </div>
            </div>
          </div>

          {/* Messages */}
          <div style={{
            flex: 1,
            overflowY: 'auto',
            padding: '14px 14px 0',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            minHeight: 0,
          }}>
            {messages.length === 0 && (
              <div>
                <div style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 12, lineHeight: 1.6 }}>
                  Ask me anything about <strong style={{ color: 'var(--accent)' }}>{ticker}</strong> — valuation, risks, financials, or signals.
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {SUGGESTIONS.map(s => (
                    <button
                      key={s}
                      onClick={() => send(s)}
                      style={{
                        background: 'var(--bg2)',
                        border: '1px solid var(--border)',
                        borderRadius: 6,
                        padding: '7px 10px',
                        fontSize: 12,
                        color: 'var(--text2)',
                        cursor: 'pointer',
                        textAlign: 'left',
                        fontFamily: 'inherit',
                      }}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => (
              <div key={i} style={{
                display: 'flex',
                justifyContent: m.role === 'user' ? 'flex-end' : 'flex-start',
              }}>
                <div style={{
                  maxWidth: '85%',
                  padding: '8px 12px',
                  borderRadius: m.role === 'user' ? '12px 12px 2px 12px' : '12px 12px 12px 2px',
                  background: m.role === 'user' ? 'var(--accent)' : 'var(--bg2)',
                  border: m.role === 'user' ? 'none' : '1px solid var(--border)',
                  fontSize: 13,
                  color: m.role === 'user' ? '#fff' : 'var(--text)',
                  lineHeight: 1.55,
                  whiteSpace: 'pre-wrap',
                }}>
                  {m.content}
                </div>
              </div>
            ))}

            {loading && (
              <div style={{ display: 'flex', justifyContent: 'flex-start' }}>
                <div style={{
                  padding: '8px 14px',
                  borderRadius: '12px 12px 12px 2px',
                  background: 'var(--bg2)',
                  border: '1px solid var(--border)',
                  display: 'flex',
                  gap: 5,
                  alignItems: 'center',
                }}>
                  {[0, 1, 2].map(i => (
                    <div key={i} style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: 'var(--accent)',
                      animation: 'bounce 1.2s infinite',
                      animationDelay: `${i * 0.2}s`,
                    }} />
                  ))}
                </div>
              </div>
            )}
            <div ref={bottomRef} style={{ height: 14 }} />
          </div>

          {/* Input */}
          <div style={{
            padding: '10px 12px',
            borderTop: '1px solid var(--border)',
            background: 'var(--bg2)',
            display: 'flex',
            gap: 8,
            alignItems: 'flex-end',
          }}>
            <textarea
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Ask about this stock…"
              rows={1}
              style={{
                flex: 1,
                background: 'var(--bg)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '8px 10px',
                fontSize: 13,
                color: 'var(--text)',
                fontFamily: 'inherit',
                resize: 'none',
                outline: 'none',
                lineHeight: 1.5,
                maxHeight: 90,
                overflowY: 'auto',
              }}
            />
            <button
              onClick={() => send()}
              disabled={!input.trim() || loading}
              style={{
                background: input.trim() && !loading ? 'var(--accent)' : 'var(--bg3)',
                border: 'none',
                borderRadius: 8,
                width: 36,
                height: 36,
                cursor: input.trim() && !loading ? 'pointer' : 'not-allowed',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                flexShrink: 0,
                transition: 'background 0.15s',
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <line x1="22" y1="2" x2="11" y2="13" stroke="white" strokeWidth="2" strokeLinecap="round" />
                <polygon points="22 2 15 22 11 13 2 9 22 2" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
              </svg>
            </button>
          </div>
        </div>
      )}

      <style>{`
        @keyframes bounce {
          0%, 80%, 100% { transform: scale(0.6); opacity: 0.4; }
          40% { transform: scale(1); opacity: 1; }
        }
      `}</style>
    </>
  )
}
