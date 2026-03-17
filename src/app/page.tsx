'use client'
import { useEffect, useState, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import TickerTape from '@/components/TickerTape'
import AuthModal from '@/components/AuthModal'

function AuthHandler({ onSignin }: { onSignin: () => void }) {
  const params = useSearchParams()
  useEffect(() => {
    if (params.get('auth') === 'signin') onSignin()
  }, [params, onSignin])
  return null
}

export default function Home() {
  const [modal, setModal] = useState<'signin' | 'signup' | null>(null)

  return (
    <>
      <Suspense fallback={null}>
        <AuthHandler onSignin={() => setModal('signin')} />
      </Suspense>
      <Navbar />
      <TickerTape />
      {modal && <AuthModal mode={modal} onClose={() => setModal(null)} />}

      {/* HERO */}
      <section style={{ maxWidth: 1280, margin: '0 auto', padding: '80px 48px 72px', display: 'grid', gridTemplateColumns: '1fr 480px', gap: 64, alignItems: 'center' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 28 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--green)', display: 'inline-block', animation: 'pulse 2s infinite' }} />
            <span style={{ fontSize: 11, color: 'var(--green)', letterSpacing: 3, textTransform: 'uppercase', fontWeight: 600 }}>Systems Online — All Markets Active</span>
          </div>

          <h1 style={{ fontSize: 88, fontWeight: 700, lineHeight: 0.95, letterSpacing: -2, marginBottom: 28, textTransform: 'uppercase' }}>
            <span style={{ color: 'var(--accent)', display: 'block' }}>Alpha</span>
            <span style={{ color: 'var(--text)', display: 'block' }}>Edge_</span>
          </h1>

          <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 40, maxWidth: 520, fontFamily: "'Space Grotesk', sans-serif" }}>
            Institutional-grade analytics, predictive intelligence, and real-time market data. Built for traders, quants, and portfolio managers who demand an edge.
          </p>

          <div style={{ display: 'flex', gap: 12, marginBottom: 48 }}>
            <Link href="/dashboard" style={{ padding: '14px 28px', background: 'var(--accent)', color: '#000', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', borderRadius: 2, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              Request Access →
            </Link>
            <Link href="/dashboard" style={{ padding: '14px 28px', border: '1px solid var(--border3)', color: 'var(--text2)', fontSize: 12, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', borderRadius: 2 }}>
              View Demo
            </Link>
          </div>

          <div style={{ display: 'flex', gap: 32, fontSize: 11, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase' }}>
            {['SOC 2 Compliant', '256-Bit Encryption', '99.99% Uptime'].map((t, i) => (
              <span key={t} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {i > 0 && <span style={{ color: 'var(--border2)' }}>|</span>}
                {t}
              </span>
            ))}
          </div>
        </div>

        {/* TERMINAL PANEL */}
        <div style={{ border: '1px solid var(--border2)', borderRadius: 4, overflow: 'hidden', background: 'var(--bg2)' }}>
          <div style={{ background: 'var(--bg3)', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--accent)' }}>~</span>
              <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>AlphaEdge Terminal</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--green)', display: 'inline-block' }} />
              <span style={{ fontSize: 10, color: 'var(--green)', letterSpacing: 1 }}>LIVE</span>
            </div>
          </div>
          <div style={{ padding: '20px 20px 24px', fontSize: 12, lineHeight: 2.2 }}>
            <div style={{ color: 'var(--text3)' }}>$ alphaedge --analyze --portfolio</div>
            <div style={{ color: 'var(--green)' }}>[OK] Connected to market data feed</div>
            <div style={{ color: 'var(--green)' }}>[OK] Loading portfolio: ALPHA-7</div>
            <div style={{ borderTop: '1px solid var(--border)', margin: '8px 0' }} />
            <div style={{ color: 'var(--accent)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 4 }}>Portfolio Summary — Alpha-7</div>
            <div style={{ borderTop: '1px solid var(--border)', marginBottom: 8 }} />
            {[
              { l: 'NAV',        v: '$847,231,492',           c: 'var(--text)' },
              { l: 'DAY P&L',   v: '+$12,847,291 (+1.54%)',  c: 'var(--green)' },
              { l: 'MTD RETURN', v: '+4.21%',                c: 'var(--green)' },
              { l: 'YTD RETURN', v: '+18.73%',               c: 'var(--green)' },
              { l: 'SHARPE',     v: '2.41',                  c: 'var(--text)' },
              { l: 'MAX DD',     v: '-3.12%',                c: 'var(--red)' },
            ].map(r => (
              <div key={r.l} style={{ display: 'flex', justifyContent: 'space-between', padding: '2px 0' }}>
                <span style={{ color: 'var(--text2)', fontSize: 11 }}>{r.l}</span>
                <span style={{ color: r.c, fontWeight: 600 }}>{r.v}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', margin: '10px 0 8px' }} />
            <div style={{ color: 'var(--accent)', fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>Top Signals</div>
            <div style={{ borderTop: '1px solid var(--border)', marginBottom: 8 }} />
            {[
              { dir: 'LONG',  sym: 'NVDA', conf: '94.2%', up: true },
              { dir: 'LONG',  sym: 'MSFT', conf: '91.7%', up: true },
              { dir: 'SHORT', sym: 'XOM',  conf: '87.3%', up: false },
            ].map(s => (
              <div key={s.sym} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '2px 0' }}>
                <span style={{ color: s.up ? 'var(--green)' : 'var(--red)', fontSize: 10 }}>{s.up ? '▲' : '▼'}</span>
                <span style={{ color: s.up ? 'var(--green)' : 'var(--red)', fontSize: 11, fontWeight: 700, width: 44 }}>{s.dir}</span>
                <span style={{ color: 'var(--text)', fontWeight: 600, flex: 1 }}>{s.sym}</span>
                <span style={{ color: 'var(--text3)', fontSize: 11 }}>CONF: {s.conf}</span>
              </div>
            ))}
            <div style={{ borderTop: '1px solid var(--border)', marginTop: 10, paddingTop: 8 }}>
              <span style={{ color: 'var(--text3)' }}>$ </span>
              <span style={{ animation: 'blink 1s step-end infinite' }}>_</span>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section id="features" style={{ borderTop: '1px solid var(--border)', padding: '72px 0' }}>
        <div style={{ maxWidth: 1280, margin: '0 auto', padding: '0 48px' }}>
          <div style={{ marginBottom: 48 }}>
            <div style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 12 }}>// Capabilities</div>
            <h2 style={{ fontSize: 42, fontWeight: 700, letterSpacing: -1, textTransform: 'uppercase' }}>Everything A Hedge<br />Fund Has. Built For You.</h2>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 1, background: 'var(--border)', border: '1px solid var(--border)', borderRadius: 4, overflow: 'hidden' }}>
            {[
              { tag: '// 01', title: 'Live Market Data', desc: 'Real-time prices via Finnhub. Quotes, charts, volume — refreshed every 30 seconds.' },
              { tag: '// 02', title: 'Quant Signals', desc: 'RSI, MACD, Bollinger Bands, SMA 20/50/200, momentum, mean-reversion z-score.' },
              { tag: '// 03', title: 'AI Research Reports', desc: 'Automated moat assessment, valuation analysis, risk factors, and conviction verdicts.' },
              { tag: '// 04', title: 'Earnings Intelligence', desc: 'EPS surprise history, beat/miss tracking, analyst recommendation history.' },
              { tag: '// 05', title: 'Insider Transactions', desc: 'SEC Form 4 filings with full transaction code mapping and signal interpretation.' },
              { tag: '// 06', title: 'Stock Screener', desc: 'Filter by moat score, growth, sector, P/E. Sort and analyze in real time.' },
            ].map(f => (
              <div key={f.tag} style={{ background: 'var(--bg2)', padding: '28px 24px' }}>
                <div style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: 2, marginBottom: 12, fontWeight: 600 }}>{f.tag}</div>
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.5 }}>{f.title}</div>
                <div style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.65, fontFamily: "'Space Grotesk', sans-serif" }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section style={{ borderTop: '1px solid var(--border)', background: 'var(--bg2)', padding: '72px 48px' }}>
        <div style={{ maxWidth: 600, margin: '0 auto', textAlign: 'center' }}>
          <div style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 16 }}>// Ready To Trade Smarter?</div>
          <h2 style={{ fontSize: 42, fontWeight: 700, letterSpacing: -1, textTransform: 'uppercase', marginBottom: 16 }}>Get Your Edge Today.</h2>
          <p style={{ fontSize: 14, color: 'var(--text2)', marginBottom: 32, fontFamily: "'Space Grotesk', sans-serif" }}>Join thousands of traders and quants using AI to find better opportunities, faster.</p>
          <Link href="/dashboard" style={{ display: 'inline-block', padding: '14px 36px', background: 'var(--accent)', color: '#000', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', borderRadius: 2 }}>
            Launch Terminal →
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{ borderTop: '1px solid var(--border)', padding: '24px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ color: 'var(--accent)', fontWeight: 700 }}>{'>'}_</span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase' }}>AlphaEdge</span>
        </div>
        <div style={{ display: 'flex', gap: 24 }}>
          {['Privacy', 'Terms', 'Docs', 'Status'].map(l => (
            <a key={l} href="#" style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase' }}>{l}</a>
          ))}
        </div>
        <div style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1 }}>© 2026 AlphaEdge Inc.</div>
      </footer>
    </>
  )
}
