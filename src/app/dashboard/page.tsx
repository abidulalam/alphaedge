'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import dynamic from 'next/dynamic'
import ScoreBar from '@/components/ScoreBar'
import Navbar from '@/components/Navbar'

const StockChart = dynamic(() => import('@/components/StockChart'), { ssr: false })

const DEFAULT_WATCHLIST = ['NVDA', 'AAPL', 'MSFT', 'TSLA', 'META', 'GOOGL']
const TABS = ['Overview', 'Quant Signals', 'Financials', 'Earnings', 'Insiders', 'AI Report', 'News']
const WL_KEY = 'alphaedge_watchlist'

const mono = 'IBM Plex Mono, monospace'

function fmtNum(n: number | null) {
  if (n == null) return '—'
  const a = Math.abs(n)
  if (a >= 1e12) return '$' + (n / 1e12).toFixed(2) + 'T'
  if (a >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B'
  if (a >= 1e6) return '$' + (n / 1e6).toFixed(2) + 'M'
  return '$' + n.toLocaleString(undefined, { maximumFractionDigits: 2 })
}

function signalColor(s: string) {
  if (s === 'STRONG BUY') return '#00d97e'
  if (s === 'BUY') return '#4ade80'
  if (s === 'NEUTRAL') return '#f5a623'
  if (s === 'SELL') return '#f87171'
  return '#ff4d4d'
}

function MBox({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 5, padding: '10px 12px' }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: mono, marginBottom: 5 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 500, color: color || 'var(--text)', fontFamily: mono }}>{value}</div>
    </div>
  )
}

function SHead({ label }: { label: string }) {
  return (
    <div style={{ fontSize: 10, color: 'var(--accent)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 12, marginTop: 20, display: 'flex', alignItems: 'center', gap: 8, fontFamily: mono }}>
      <span style={{ display: 'block', width: 16, height: 1, background: 'var(--accent)', flexShrink: 0 }} />
      {label}
    </div>
  )
}

function SRow({ label, value, bar, barColor }: { label: string; value: string; bar?: number; barColor?: string }) {
  const bc = barColor || 'var(--accent)'
  const width = bar != null ? Math.min(100, Math.max(0, bar)) + '%' : '0%'
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '7px 0', borderBottom: '1px solid var(--border)' }}>
      <span style={{ fontSize: 12, color: 'var(--text2)', width: 140, flexShrink: 0 }}>{label}</span>
      {bar != null && (
        <div style={{ flex: 1, height: 3, background: 'var(--border2)', borderRadius: 2, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: width, background: bc, borderRadius: 2 }} />
        </div>
      )}
      <span style={{ fontSize: 13, fontWeight: 500, color: bc, flexShrink: 0, fontFamily: mono }}>{value}</span>
    </div>
  )
}

function THead({ cols }: { cols: string[] }) {
  return (
    <div style={{ display: 'flex', background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
      {cols.map((c, i) => (
        <div key={c} style={{ flex: 1, padding: '9px 14px', fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, fontFamily: mono, textAlign: i > 0 ? 'right' : 'left' }}>{c}</div>
      ))}
    </div>
  )
}

function TRow({ cells, highlight }: { cells: (string | null)[]; highlight?: boolean }) {
  const bg = highlight ? 'var(--bg3)' : 'var(--bg2)'
  return (
    <div style={{ display: 'flex', background: bg, borderBottom: '1px solid var(--border)' }}>
      {cells.map((c, i) => (
        <div key={i} style={{ flex: 1, padding: '10px 14px', fontSize: 13, fontFamily: mono, textAlign: i > 0 ? 'right' : 'left', color: 'var(--text)' }}>{c || '—'}</div>
      ))}
    </div>
  )
}

export default function Dashboard() {
  const params = useSearchParams()
  const router = useRouter()
  const [ticker, setTicker] = useState(params.get('ticker') || 'NVDA')
  const [tab, setTab] = useState('Overview')
  const [data, setData] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [watchlist, setWatchlist] = useState<string[]>(DEFAULT_WATCHLIST)
  const [watchData, setWatchData] = useState<Record<string, any>>({})
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null)
  const [addInput, setAddInput] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  useEffect(() => {
    try {
      const s = localStorage.getItem(WL_KEY)
      if (s) setWatchlist(JSON.parse(s))
    } catch (_e) {}
  }, [])

  useEffect(() => {
    try { localStorage.setItem(WL_KEY, JSON.stringify(watchlist)) } catch (_e) {}
  }, [watchlist])

  useEffect(() => {
    const t = params.get('ticker')
    if (t && t !== ticker) setTicker(t)
  }, [params])

  const loadStock = useCallback(async (t: string, silent = false) => {
    if (!silent) { setLoading(true); setError(null) }
    try {
      const res = await fetch('/api/quote?ticker=' + t)
      const d = await res.json()
      if (d.error) throw new Error(d.error)
      setData(d)
      setLastUpdated(new Date())
    } catch (e: any) {
      if (!silent) setError(e.message)
    } finally {
      if (!silent) setLoading(false)
    }
  }, [])

  const loadWatch = useCallback(async () => {
    const results = await Promise.allSettled(
      watchlist.map(t => fetch('/api/quote?ticker=' + t).then(r => r.json()))
    )
    const m: Record<string, any> = {}
    results.forEach((r, i) => {
      if (r.status === 'fulfilled' && !r.value.error) m[watchlist[i]] = r.value
    })
    setWatchData(m)
  }, [watchlist])

  useEffect(() => { loadStock(ticker) }, [ticker, loadStock])
  useEffect(() => { loadWatch() }, [loadWatch])
  useEffect(() => {
    const id = setInterval(() => { loadStock(ticker, true); loadWatch() }, 30000)
    return () => clearInterval(id)
  }, [ticker, loadStock, loadWatch])

  function selectTicker(sym: string) {
    setTicker(sym)
    setTab('Overview')
    router.push('/dashboard?ticker=' + sym, { scroll: false })
  }

  function addToWatchlist(sym: string) {
    const t = sym.toUpperCase().trim()
    if (t && !watchlist.includes(t)) setWatchlist(prev => [...prev, t])
    setAddInput('')
    setShowAdd(false)
  }

  const up = (data?.changePct ?? 0) >= 0
  const qs = data?.quantSignals

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      <Navbar />
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* SIDEBAR */}
        <aside style={{ width: 240, flexShrink: 0, background: 'var(--bg2)', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', fontFamily: mono, fontSize: 10, color: 'var(--text3)', letterSpacing: 2, textTransform: 'uppercase', borderBottom: '1px solid var(--border)' }}>
            <span>Watchlist ({watchlist.length})</span>
            <button onClick={() => setShowAdd(s => !s)} style={{ color: 'var(--accent)', fontSize: 18, lineHeight: 1 }}>+</button>
          </div>

          {showAdd && (
            <div style={{ padding: '8px 12px', borderBottom: '1px solid var(--border)', display: 'flex', gap: 6 }}>
              <input
                value={addInput}
                onChange={e => setAddInput(e.target.value.toUpperCase())}
                onKeyDown={e => e.key === 'Enter' && addToWatchlist(addInput)}
                placeholder="e.g. AMD"
                maxLength={8}
                autoFocus
                style={{ fontFamily: mono, fontSize: 13, height: 30, flex: 1 }}
              />
              <button onClick={() => addToWatchlist(addInput)} style={{ padding: '0 10px', background: 'var(--accent)', color: '#000', fontSize: 12, borderRadius: 4, fontWeight: 600 }}>Add</button>
            </div>
          )}

          <div style={{ flex: 1, overflowY: 'auto' }}>
            {watchlist.map(sym => {
              const w = watchData[sym]
              const pct = w?.changePct ?? null
              const px = w?.price ?? null
              const wup = (pct ?? 0) >= 0
              return (
                <div key={sym} style={{ display: 'flex', borderBottom: '1px solid var(--border)', borderLeft: '2px solid ' + (sym === ticker ? 'var(--accent)' : 'transparent'), background: sym === ticker ? 'rgba(255,85,0,.06)' : 'transparent' }}>
                  <button onClick={() => selectTicker(sym)} style={{ flex: 1, display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 10px 10px 12px', textAlign: 'left' }}>
                    <div>
                      <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 500 }}>{sym}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{String(w?.name ?? '…').slice(0, 18)}</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ fontFamily: mono, fontSize: 13, color: px ? (wup ? 'var(--green)' : 'var(--red)') : 'var(--text2)' }}>{px ? '$' + px.toFixed(2) : '—'}</div>
                      {pct != null && <div style={{ fontSize: 11, color: wup ? 'var(--green)' : 'var(--red)', marginTop: 2 }}>{wup ? '▲' : '▼'} {Math.abs(pct).toFixed(2)}%</div>}
                    </div>
                  </button>
                  <button onClick={() => setWatchlist(p => p.filter(t => t !== sym))} style={{ padding: '0 10px', color: 'var(--text3)', fontSize: 15, opacity: 0.4 }}>×</button>
                </div>
              )
            })}
          </div>
        </aside>

        {/* MAIN */}
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 20px', height: 44, borderBottom: '1px solid var(--border)', background: 'var(--bg2)', flexShrink: 0, overflowX: 'auto' }}>
            <div style={{ display: 'flex', height: '100%', flexShrink: 0 }}>
              {TABS.map(t => (
                <button key={t} onClick={() => setTab(t)} style={{ padding: '0 14px', fontSize: 12, whiteSpace: 'nowrap', color: t === tab ? 'var(--accent)' : 'var(--text3)', borderBottom: '2px solid ' + (t === tab ? 'var(--accent)' : 'transparent'), height: '100%', fontFamily: mono }}>
                  {t}
                </button>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              {lastUpdated && <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--text3)' }}>↻ {lastUpdated.toLocaleTimeString()}</span>}
              {data && <button onClick={() => addToWatchlist(ticker)} style={{ padding: '4px 10px', border: '1px solid var(--border2)', color: 'var(--accent)', fontSize: 11, fontFamily: mono, borderRadius: 3 }}>+ List</button>}
              <button onClick={() => { loadStock(ticker, true); loadWatch() }} style={{ padding: '4px 10px', border: '1px solid var(--border2)', color: 'var(--text2)', fontSize: 11, fontFamily: mono, borderRadius: 3 }}>↻</button>
            </div>
          </div>

          <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px' }}>
            {loading && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '60px 0' }}>
                <div style={{ width: 20, height: 20, border: '2px solid var(--border2)', borderTopColor: 'var(--accent)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
                <span style={{ fontFamily: mono, color: 'var(--text3)', fontSize: 13 }}>Fetching {ticker}…</span>
                <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
              </div>
            )}

            {error && !loading && (
              <div style={{ padding: '40px 0' }}>
                <div style={{ fontFamily: mono, fontSize: 15, color: 'var(--red)', marginBottom: 8 }}>Could not load {ticker}</div>
                <div style={{ fontSize: 13, color: 'var(--text2)' }}>{error}</div>
              </div>
            )}

            {!loading && !error && data && (
              <div>
                {/* STOCK HEADER */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    {data.logo && <img src={data.logo} alt="" style={{ width: 32, height: 32, borderRadius: 4, objectFit: 'contain', background: '#fff', padding: 2 }} />}
                    <div>
                      <div style={{ fontSize: 20, fontWeight: 600, letterSpacing: -0.4 }}>{data.name}</div>
                      <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontFamily: mono, fontSize: 11, color: 'var(--text3)', marginTop: 3, flexWrap: 'wrap' }}>
                        {[data.ticker, data.exchange, data.sector, data.country].filter(Boolean).map((v: string, i: number, a: string[]) => (
                          <span key={v}>{v}{i < a.length - 1 ? <span style={{ margin: '0 2px', opacity: 0.4 }}>·</span> : null}</span>
                        ))}
                        <span style={{ padding: '1px 6px', borderRadius: 3, background: data.marketState === 'REGULAR' ? 'rgba(255,85,0,.12)' : 'rgba(74,85,104,.15)', color: data.marketState === 'REGULAR' ? 'var(--accent)' : 'var(--text3)', fontSize: 10 }}>
                          {data.marketState === 'REGULAR' ? '● LIVE' : '○ CLOSED'}
                        </span>
                        {qs && <span style={{ padding: '1px 8px', borderRadius: 3, background: signalColor(qs.trend) + '22', color: signalColor(qs.trend), fontSize: 10, fontWeight: 600 }}>{qs.trend}</span>}
                      </div>
                    </div>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <div style={{ fontFamily: mono, fontSize: 26, fontWeight: 600, color: up ? 'var(--green)' : 'var(--red)' }}>{data.price ? '$' + data.price.toFixed(2) : '—'}</div>
                    {data.changePct != null && (
                      <div style={{ fontFamily: mono, fontSize: 12, color: up ? 'var(--green)' : 'var(--red)', marginTop: 3 }}>
                        {up ? '▲' : '▼'} ${Math.abs(data.change ?? 0).toFixed(2)} ({Math.abs(data.changePct).toFixed(2)}%)
                      </div>
                    )}
                    <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--text3)', marginTop: 3 }}>{fmtNum(data.marketCap)} mkt cap</div>
                  </div>
                </div>

                {/* OVERVIEW */}
                {tab === 'Overview' && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: 16 }}>
                    <div>
                      {data.chartData && data.chartData.length > 0 && (
                        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '12px 10px 6px', marginBottom: 12 }}>
                          <StockChart data={data.chartData} positive={up} />
                        </div>
                      )}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8, marginBottom: 12 }}>
                        <MBox label="P/E (TTM)" value={data.pe ? data.pe.toFixed(1) : '—'} />
                        <MBox label="EPS (TTM)" value={data.eps ? '$' + data.eps.toFixed(2) : '—'} />
                        <MBox label="EV/EBITDA" value={data.evToEbitda ? data.evToEbitda.toFixed(1) : '—'} />
                        <MBox label="P/S (TTM)" value={data.priceToSales ? data.priceToSales.toFixed(2) : '—'} />
                        <MBox label="P/B" value={data.priceToBook ? data.priceToBook.toFixed(2) : '—'} />
                        <MBox label="PEG Ratio" value={data.pegRatio ? data.pegRatio.toFixed(2) : '—'} />
                        <MBox label="ROE (TTM)" value={data.roeTTM ? data.roeTTM.toFixed(1) + '%' : '—'} color={data.roeTTM && data.roeTTM > 15 ? 'var(--accent)' : undefined} />
                        <MBox label="ROA (TTM)" value={data.roaTTM ? data.roaTTM.toFixed(1) + '%' : '—'} />
                        <MBox label="52W High" value={data.fiftyTwoWeekHigh ? '$' + data.fiftyTwoWeekHigh.toFixed(2) : '—'} />
                        <MBox label="52W Low" value={data.fiftyTwoWeekLow ? '$' + data.fiftyTwoWeekLow.toFixed(2) : '—'} />
                        <MBox label="Beta" value={data.beta ? data.beta.toFixed(2) : '—'} />
                        <MBox label="Div Yield" value={data.dividendYield ? data.dividendYield.toFixed(2) + '%' : '—'} />
                      </div>
                      {data.peers && data.peers.length > 0 && (
                        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '12px 14px' }}>
                          <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Peer Group</div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                            {data.peers.map((p: string) => (
                              <button key={p} onClick={() => selectTicker(p)} style={{ padding: '4px 10px', border: '1px solid var(--border2)', background: 'transparent', color: 'var(--text2)', fontFamily: mono, fontSize: 12, borderRadius: 3 }}>{p}</button>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: 14 }}>
                        <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--accent)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 12 }}>AI Scores</div>
                        {data.moatScore != null && <ScoreBar lbl="Moat" score={data.moatScore} />}
                        {data.growthScore != null && <ScoreBar lbl="Growth" score={data.growthScore} />}
                      </div>

                      {qs && (
                        <div style={{ background: 'var(--bg2)', border: '1px solid ' + signalColor(qs.trend) + '44', borderRadius: 6, padding: 14 }}>
                          <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Trend Signal</div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                            <span style={{ fontSize: 18, fontWeight: 600, color: signalColor(qs.trend) }}>{qs.trend}</span>
                            <span style={{ fontFamily: mono, fontSize: 12, color: 'var(--text2)' }}>{qs.trendScore}/5</span>
                          </div>
                          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                            {[
                              { l: 'RSI (14)', v: qs.rsi.toFixed(1), c: qs.rsi > 70 ? 'var(--red)' : qs.rsi < 30 ? 'var(--accent)' : 'var(--text)' },
                              { l: 'MACD', v: (qs.macd >= 0 ? '+' : '') + qs.macd.toFixed(3), c: qs.macd > 0 ? 'var(--green)' : 'var(--red)' },
                              { l: 'Z-Score', v: qs.zScore.toFixed(2), c: Math.abs(qs.zScore) > 2 ? 'var(--amber)' : 'var(--text)' },
                              { l: '52W Pos', v: qs.pos52w.toFixed(0) + '%', c: 'var(--text)' },
                            ].map(r => (
                              <div key={r.l} style={{ background: 'var(--bg3)', borderRadius: 4, padding: '8px 10px' }}>
                                <div style={{ fontSize: 10, color: 'var(--text3)', marginBottom: 3 }}>{r.l}</div>
                                <div style={{ fontFamily: mono, fontSize: 14, fontWeight: 500, color: r.c }}>{r.v}</div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {data.recommendations && (
                        <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: 14 }}>
                          <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 10 }}>Analyst Consensus</div>
                          {(() => {
                            const r = data.recommendations
                            const total = (r.strongBuy + r.buy + r.hold + r.sell + r.strongSell) || 1
                            return (
                              <div>
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: 4, marginBottom: 8 }}>
                                  {[
                                    { l: 'Str Buy', v: r.strongBuy, c: '#00d97e' },
                                    { l: 'Buy', v: r.buy, c: '#4ade80' },
                                    { l: 'Hold', v: r.hold, c: '#f5a623' },
                                    { l: 'Sell', v: r.sell, c: '#f87171' },
                                    { l: 'Str Sell', v: r.strongSell, c: '#ff4d4d' },
                                  ].map(x => (
                                    <div key={x.l} style={{ textAlign: 'center' }}>
                                      <div style={{ fontFamily: mono, fontSize: 16, fontWeight: 600, color: x.c }}>{x.v}</div>
                                      <div style={{ fontSize: 9, color: 'var(--text3)', marginTop: 2 }}>{x.l}</div>
                                    </div>
                                  ))}
                                </div>
                                <div style={{ display: 'flex', height: 6, borderRadius: 3, overflow: 'hidden', gap: 1 }}>
                                  {[
                                    { v: r.strongBuy, c: '#00d97e' },
                                    { v: r.buy, c: '#4ade80' },
                                    { v: r.hold, c: '#f5a623' },
                                    { v: r.sell, c: '#f87171' },
                                    { v: r.strongSell, c: '#ff4d4d' },
                                  ].filter(x => x.v > 0).map((x, i) => (
                                    <div key={i} style={{ flex: x.v / total, background: x.c }} />
                                  ))}
                                </div>
                              </div>
                            )
                          })()}
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* QUANT SIGNALS */}
                {tab === 'Quant Signals' && !qs && (
                  <div style={{ padding: '40px 0', color: 'var(--text3)', fontSize: 14 }}>Insufficient price history to compute signals (need 20+ trading days).</div>
                )}
                {tab === 'Quant Signals' && qs && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div>
                      <SHead label="Trend & Moving Averages" />
                      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 14px 8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 0', borderBottom: '1px solid var(--border)' }}>
                          <span style={{ fontSize: 14, fontWeight: 600 }}>Overall Signal</span>
                          <span style={{ fontSize: 18, fontWeight: 700, color: signalColor(qs.trend) }}>{qs.trend}</span>
                        </div>
                        {[
                          { label: 'SMA 20', value: qs.sma20 ? '$' + qs.sma20 : '—', above: data.price && qs.sma20 ? data.price > qs.sma20 : null },
                          { label: 'SMA 50', value: qs.sma50 ? '$' + qs.sma50 : '—', above: data.price && qs.sma50 ? data.price > qs.sma50 : null },
                          { label: 'SMA 200', value: qs.sma200 ? '$' + qs.sma200 : '—', above: data.price && qs.sma200 ? data.price > qs.sma200 : null },
                        ].map(s => (
                          <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
                            <span style={{ fontSize: 13, color: 'var(--text2)' }}>{s.label}</span>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                              <span style={{ fontFamily: mono, fontSize: 13 }}>{s.value}</span>
                              {s.above != null && (
                                <span style={{ fontSize: 11, padding: '1px 7px', borderRadius: 3, background: s.above ? 'rgba(255,85,0,.12)' : 'rgba(255,77,77,.12)', color: s.above ? 'var(--green)' : 'var(--red)' }}>
                                  {s.above ? 'ABOVE' : 'BELOW'}
                                </span>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      <SHead label="Momentum" />
                      <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                        {[
                          { l: '1 Month', v: qs.momentum.m1 },
                          { l: '3 Month', v: qs.momentum.m3 },
                          { l: '6 Month', v: qs.momentum.m6 },
                          { l: '1 Year', v: qs.momentum.m1y },
                        ].map((m, i) => (
                          <div key={m.l} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: i < 3 ? '1px solid var(--border)' : 'none', background: i % 2 === 0 ? 'var(--bg2)' : 'var(--bg3)' }}>
                            <span style={{ fontSize: 13, color: 'var(--text2)' }}>{m.l}</span>
                            <span style={{ fontFamily: mono, fontSize: 14, fontWeight: 500, color: m.v == null ? 'var(--text3)' : m.v >= 0 ? 'var(--green)' : 'var(--red)' }}>
                              {m.v == null ? '—' : (m.v >= 0 ? '+' : '') + m.v.toFixed(2) + '%'}
                            </span>
                          </div>
                        ))}
                      </div>

                      <SHead label="Volume" />
                      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 14px 8px' }}>
                        <SRow label="Vol Trend (5d/20d)" value={(qs.volumeTrend >= 0 ? '+' : '') + qs.volumeTrend.toFixed(1) + '%'} bar={50 + qs.volumeTrend} barColor={qs.volumeTrend > 20 ? 'var(--accent)' : qs.volumeTrend < -20 ? 'var(--red)' : 'var(--amber)'} />
                        <SRow label="Volume" value={data.volume ? (data.volume / 1e6).toFixed(1) + 'M' : '—'} />
                      </div>
                    </div>

                    <div>
                      <SHead label="Oscillators" />
                      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 14px 8px' }}>
                        <SRow label="RSI (14)" value={qs.rsi.toFixed(1)} bar={qs.rsi} barColor={qs.rsi > 70 ? 'var(--red)' : qs.rsi < 30 ? 'var(--accent)' : 'var(--amber)'} />
                        <SRow label="MACD" value={(qs.macd >= 0 ? '+' : '') + qs.macd.toFixed(3)} barColor={qs.macd >= 0 ? 'var(--green)' : 'var(--red)'} />
                        <SRow label="MACD Signal" value={(qs.macdSignal >= 0 ? '+' : '') + qs.macdSignal.toFixed(3)} />
                      </div>

                      <SHead label="Bollinger Bands" />
                      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 14px 8px' }}>
                        <SRow label="Upper Band" value={'$' + qs.bbUpper.toFixed(2)} />
                        <SRow label="Middle (SMA20)" value={qs.sma20 ? '$' + qs.sma20.toFixed(2) : '—'} />
                        <SRow label="Lower Band" value={'$' + qs.bbLower.toFixed(2)} />
                        <SRow label="BB Position" value={(qs.bbPosition * 100).toFixed(0) + '%'} bar={qs.bbPosition * 100} barColor={qs.bbPosition > 0.8 ? 'var(--red)' : qs.bbPosition < 0.2 ? 'var(--accent)' : 'var(--amber)'} />
                      </div>

                      <SHead label="Mean Reversion" />
                      <div style={{ background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6, padding: '4px 14px 8px' }}>
                        <SRow label="Z-Score (20d)" value={qs.zScore.toFixed(2)} barColor={Math.abs(qs.zScore) > 2 ? 'var(--red)' : 'var(--accent)'} />
                        <SRow label="52W Position" value={qs.pos52w.toFixed(1) + '%'} bar={qs.pos52w} barColor="var(--accent2)" />
                        <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 8, lineHeight: 1.6 }}>
                          {Math.abs(qs.zScore) > 2
                            ? 'Z-score of ' + qs.zScore.toFixed(2) + ' indicates ' + (qs.zScore > 0 ? 'overbought — mean reversion likely.' : 'oversold — potential bounce candidate.')
                            : 'Z-score within normal range — no extreme deviation from 20-day mean.'}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* FINANCIALS */}
                {tab === 'Financials' && (
                  <div style={{ maxWidth: 700 }}>
                    <SHead label="Valuation Multiples" />
                    <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 4 }}>
                      <THead cols={['Metric', 'Value', 'Interpretation']} />
                      {[
                        { l: 'P/E Ratio (TTM)', v: data.pe ? data.pe.toFixed(1) : null, i: data.pe ? (data.pe < 15 ? 'Value territory' : data.pe < 25 ? 'Fair value' : data.pe < 40 ? 'Growth premium' : 'Elevated') : null },
                        { l: 'EV / EBITDA', v: data.evToEbitda ? data.evToEbitda.toFixed(1) : null, i: data.evToEbitda ? (data.evToEbitda < 10 ? 'Cheap' : data.evToEbitda < 20 ? 'Fair' : 'Expensive') : null },
                        { l: 'Price / Sales', v: data.priceToSales ? data.priceToSales.toFixed(2) : null, i: data.priceToSales ? (data.priceToSales < 2 ? 'Low' : data.priceToSales < 5 ? 'Moderate' : 'High') : null },
                        { l: 'Price / Book', v: data.priceToBook ? data.priceToBook.toFixed(2) : null, i: data.priceToBook ? (data.priceToBook < 1 ? 'Below book value' : data.priceToBook < 3 ? 'Moderate' : 'Premium') : null },
                        { l: 'PEG Ratio', v: data.pegRatio ? data.pegRatio.toFixed(2) : null, i: data.pegRatio ? (data.pegRatio < 1 ? 'Undervalued vs growth' : data.pegRatio < 2 ? 'Fair' : 'Expensive vs growth') : null },
                        { l: 'EPS (TTM)', v: data.eps ? '$' + data.eps.toFixed(2) : null, i: null },
                      ].map((r, i) => <TRow key={r.l} cells={[r.l, r.v, r.i]} highlight={i % 2 === 1} />)}
                    </div>

                    <SHead label="Profitability & Returns" />
                    <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden', marginBottom: 4 }}>
                      <THead cols={['Metric', 'Value', 'Signal']} />
                      {[
                        { l: 'Net Profit Margin', v: data.profitMargins ? (data.profitMargins * 100).toFixed(1) + '%' : null, c: data.profitMargins ? (data.profitMargins > 0.2 ? '↑ High' : data.profitMargins > 0.08 ? '→ Average' : '↓ Low') : null },
                        { l: 'ROE (TTM)', v: data.roeTTM ? data.roeTTM.toFixed(1) + '%' : null, c: data.roeTTM ? (data.roeTTM > 20 ? '↑ Strong' : data.roeTTM > 10 ? '→ Average' : '↓ Weak') : null },
                        { l: 'ROA (TTM)', v: data.roaTTM ? data.roaTTM.toFixed(1) + '%' : null, c: data.roaTTM ? (data.roaTTM > 10 ? '↑ Strong' : data.roaTTM > 5 ? '→ Average' : '↓ Weak') : null },
                        { l: 'Revenue Growth YoY', v: data.revenueGrowth ? (data.revenueGrowth * 100).toFixed(1) + '%' : null, c: data.revenueGrowth ? (data.revenueGrowth > 0.2 ? '↑ High' : data.revenueGrowth > 0.05 ? '→ Moderate' : '↓ Slow') : null },
                      ].map((r, i) => <TRow key={r.l} cells={[r.l, r.v, r.c]} highlight={i % 2 === 1} />)}
                    </div>

                    <SHead label="Financial Health" />
                    <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                      <THead cols={['Metric', 'Value', 'Signal']} />
                      {[
                        { l: 'Debt / Equity', v: data.debtToEquity ? data.debtToEquity.toFixed(2) : null, c: data.debtToEquity ? (data.debtToEquity < 0.5 ? '↑ Low leverage' : data.debtToEquity < 1.5 ? '→ Moderate' : '↓ High') : null },
                        { l: 'Current Ratio', v: data.currentRatio ? data.currentRatio.toFixed(2) : null, c: data.currentRatio ? (data.currentRatio > 2 ? '↑ Strong' : data.currentRatio > 1 ? '→ Adequate' : '↓ Tight') : null },
                        { l: 'Beta', v: data.beta ? data.beta.toFixed(2) : null, c: data.beta ? (data.beta < 0.8 ? '↓ Low vol' : data.beta < 1.2 ? '→ Market-like' : '↑ High vol') : null },
                        { l: 'Dividend Yield', v: data.dividendYield ? data.dividendYield.toFixed(2) + '%' : 'None', c: null },
                        { l: 'Market Cap', v: fmtNum(data.marketCap), c: null },
                        { l: 'Employees', v: data.employees ? data.employees.toLocaleString() : null, c: null },
                      ].map((r, i) => <TRow key={r.l} cells={[r.l, r.v, r.c]} highlight={i % 2 === 1} />)}
                    </div>
                  </div>
                )}

                {/* EARNINGS */}
                {tab === 'Earnings' && (
                  <div style={{ maxWidth: 700 }}>
                    <SHead label="EPS Surprise History" />
                    {!data.earningsHistory || data.earningsHistory.length === 0
                      ? <div style={{ color: 'var(--text3)', fontSize: 14 }}>No earnings data available.</div>
                      : (
                        <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                          <THead cols={['Quarter', 'Estimate', 'Actual', 'Surprise %', 'Result']} />
                          {data.earningsHistory.map((e: any, i: number) => {
                            const beat = e.surprise >= 0
                            return (
                              <div key={e.period} style={{ display: 'flex', background: i % 2 === 0 ? 'var(--bg2)' : 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                                <div style={{ flex: 1, padding: '10px 14px', fontFamily: mono, fontSize: 13 }}>{e.period}</div>
                                <div style={{ flex: 1, padding: '10px 14px', fontFamily: mono, fontSize: 13, textAlign: 'right' }}>{e.estimate != null ? '$' + e.estimate.toFixed(2) : '—'}</div>
                                <div style={{ flex: 1, padding: '10px 14px', fontFamily: mono, fontSize: 13, fontWeight: 500, textAlign: 'right' }}>{e.actual != null ? '$' + e.actual.toFixed(2) : '—'}</div>
                                <div style={{ flex: 1, padding: '10px 14px', fontFamily: mono, fontSize: 13, color: beat ? 'var(--green)' : 'var(--red)', textAlign: 'right' }}>{e.surprisePct != null ? (beat ? '+' : '') + e.surprisePct.toFixed(1) + '%' : '—'}</div>
                                <div style={{ flex: 1, padding: '10px 14px', textAlign: 'right' }}>
                                  <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 3, background: beat ? 'rgba(255,85,0,.12)' : 'rgba(255,77,77,.12)', color: beat ? 'var(--green)' : 'var(--red)' }}>{beat ? 'BEAT' : 'MISS'}</span>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )
                    }

                    {data.allRecommendations && data.allRecommendations.length > 0 && (
                      <div>
                        <SHead label="Analyst Recommendation History" />
                        <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                          <THead cols={['Period', 'Str Buy', 'Buy', 'Hold', 'Sell', 'Str Sell']} />
                          {data.allRecommendations.map((r: any, i: number) => (
                            <div key={r.period} style={{ display: 'flex', background: i % 2 === 0 ? 'var(--bg2)' : 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                              {[r.period, r.strongBuy, r.buy, r.hold, r.sell, r.strongSell].map((v: any, j: number) => (
                                <div key={j} style={{ flex: 1, padding: '9px 14px', fontFamily: mono, fontSize: 13, textAlign: j > 0 ? 'right' : 'left', color: j === 1 || j === 2 ? 'var(--accent)' : j >= 4 ? 'var(--red)' : 'var(--text)' }}>{v}</div>
                              ))}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* INSIDERS */}
                {tab === 'Insiders' && (
                  <div style={{ maxWidth: 750 }}>
                    <SHead label="Insider Transactions" />
                    {!data.insiderTransactions || data.insiderTransactions.length === 0
                      ? <div style={{ color: 'var(--text3)', fontSize: 14 }}>No recent insider transactions.</div>
                      : (
                        <div>
                          <div style={{ border: '1px solid var(--border)', borderRadius: 6, overflow: 'hidden' }}>
                            <div style={{ display: 'flex', background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                              {['Name / Role', 'Transaction', 'Code', 'Shares', 'Value', 'Date'].map((h, i) => (
                                <div key={h} style={{ flex: i === 0 ? 2 : 1, padding: '9px 14px', fontFamily: mono, fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1, textAlign: i > 0 ? 'right' : 'left' }}>{h}</div>
                              ))}
                            </div>
                            {data.insiderTransactions.map((tx: any, i: number) => {
                              const isPos = tx.actionType === 'buy'
                              const isNeg = tx.actionType === 'sell'
                              return (
                                <div key={i} style={{ display: 'flex', background: i % 2 === 0 ? 'var(--bg2)' : 'var(--bg3)', borderBottom: '1px solid var(--border)', alignItems: 'center' }}>
                                  <div style={{ flex: 2, padding: '10px 14px' }}>
                                    <div style={{ fontSize: 13, color: 'var(--text)', fontWeight: 500 }}>{tx.name}</div>
                                    {tx.role && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{tx.role}</div>}
                                  </div>
                                  <div style={{ flex: 1, padding: '10px 14px', textAlign: 'right' }}>
                                    <span style={{ padding: '2px 8px', borderRadius: 3, fontSize: 11, fontWeight: 500, background: isPos ? 'rgba(255,85,0,.12)' : isNeg ? 'rgba(255,77,77,.12)' : 'rgba(74,85,104,.15)', color: isPos ? 'var(--accent)' : isNeg ? 'var(--red)' : 'var(--text3)' }}>{tx.action}</span>
                                  </div>
                                  <div style={{ flex: 1, padding: '10px 14px', fontFamily: mono, fontSize: 12, color: 'var(--text3)', textAlign: 'right' }}>{tx.code}</div>
                                  <div style={{ flex: 1, padding: '10px 14px', fontFamily: mono, fontSize: 13, textAlign: 'right' }}>{tx.shares ? tx.shares.toLocaleString() : '—'}</div>
                                  <div style={{ flex: 1, padding: '10px 14px', fontFamily: mono, fontSize: 13, textAlign: 'right' }}>{tx.value ? fmtNum(tx.value) : '—'}</div>
                                  <div style={{ flex: 1, padding: '10px 14px', fontFamily: mono, fontSize: 11, color: 'var(--text3)', textAlign: 'right' }}>{tx.date}</div>
                                </div>
                              )
                            })}
                          </div>
                          <div style={{ marginTop: 10, padding: '10px 14px', background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 6 }}>
                            <div style={{ fontFamily: mono, fontSize: 10, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 8 }}>Code Legend</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 20px', fontSize: 12, color: 'var(--text2)' }}>
                              {[['P', 'Purchase'], ['S', 'Sale'], ['A', 'Award'], ['M/X', 'Option Exercise'], ['G', 'Gift'], ['F', 'Tax Withholding'], ['D', 'Disposition'], ['W', 'Inheritance']].map(([c, l]) => (
                                <span key={c}><span style={{ fontFamily: mono, color: 'var(--accent)' }}>{c}</span> — {l}</span>
                              ))}
                            </div>
                          </div>
                        </div>
                      )
                    }
                  </div>
                )}

                {/* AI REPORT */}
                {tab === 'AI Report' && (
                  <div style={{ maxWidth: 680 }}>
                    <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 20, paddingBottom: 14, borderBottom: '1px solid var(--border)' }}>
                      <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--accent)', background: 'rgba(255,85,0,.08)', border: '1px solid rgba(0,217,126,.2)', padding: '2px 8px', borderRadius: 3, letterSpacing: 1, textTransform: 'uppercase' }}>AlphaEdge AI Report</span>
                      <span style={{ fontFamily: mono, fontSize: 10, color: 'var(--text3)' }}>{data.ticker} · {new Date().toLocaleDateString()}</span>
                      {qs && <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 3, background: signalColor(qs.trend) + '22', color: signalColor(qs.trend), fontWeight: 600 }}>{qs.trend}</span>}
                    </div>
                    {[
                      { h: 'Competitive Moat', b: data.name + ' (moat: ' + (data.moatScore ?? '—') + '/100) demonstrates ' + ((data.moatScore ?? 0) >= 80 ? 'an exceptionally wide moat with durable structural advantages' : (data.moatScore ?? 0) >= 60 ? 'a solid moat with meaningful competitive advantages' : 'a moderate-to-narrow competitive moat — faces real competitive threats') + '.' },
                      { h: 'Quantitative Assessment', b: qs ? 'Technical signal: ' + qs.trend + ' (' + qs.trendScore + '/5 indicators bullish). RSI at ' + qs.rsi.toFixed(1) + ' (' + (qs.rsi > 70 ? 'overbought' : qs.rsi < 30 ? 'oversold' : 'neutral') + '). Price is ' + qs.pos52w.toFixed(0) + '% through its 52-week range. Mean-reversion z-score of ' + qs.zScore.toFixed(2) + '. 3-month momentum: ' + (qs.momentum.m3 != null ? (qs.momentum.m3 >= 0 ? '+' : '') + qs.momentum.m3.toFixed(1) + '%.' : 'N/A.') : 'Insufficient price history for quantitative signal computation.' },
                      { h: 'Valuation', b: 'At ' + (data.pe ? data.pe.toFixed(1) + 'x P/E' : 'current multiples') + ', ' + data.name + ' is ' + (data.pe ? (data.pe < 15 ? 'trading in value territory' : data.pe < 25 ? 'fairly valued' : data.pe < 40 ? 'carrying a growth premium' : 'priced for exceptional growth — any guidance miss risks multiple compression') : 'priced at current levels') + '.' + (data.pegRatio ? ' PEG of ' + data.pegRatio.toFixed(2) + (data.pegRatio < 1 ? ' indicates undervaluation relative to growth.' : data.pegRatio < 2 ? ' is reasonable.' : ' implies growth priced in.') : '') },
                      { h: 'Profitability', b: 'Net margin of ' + (data.profitMargins ? (data.profitMargins * 100).toFixed(1) + '%' : 'N/A') + ' and ROE of ' + (data.roeTTM ? data.roeTTM.toFixed(1) + '%' : 'N/A') + '. Revenue growth: ' + (data.revenueGrowth ? (data.revenueGrowth * 100).toFixed(1) + '% YoY' : 'N/A') + '.' },
                      { h: 'Risk Factors', b: 'Beta of ' + (data.beta ? data.beta.toFixed(2) : 'N/A') + ' implies ' + ((data.beta ?? 1) > 1.5 ? 'high market sensitivity' : (data.beta ?? 1) < 0.7 ? 'defensive characteristics' : 'near-market correlation') + '. ' + ((data.debtToEquity ?? 0) > 1.5 ? 'Elevated D/E of ' + data.debtToEquity?.toFixed(2) + ' could constrain flexibility. ' : '') + 'Sector: ' + (data.sector ?? 'N/A') + '.' },
                      { h: 'Verdict', b: (data.moatScore ?? 0) >= 75 && (data.growthScore ?? 0) >= 65 ? data.ticker + ' is a high-conviction long candidate: wide moat, strong growth, positive momentum. Size for a multi-year hold.' : (data.moatScore ?? 0) >= 55 ? data.ticker + ' is a watchlist candidate. Wait for better entry or earnings catalyst.' : data.ticker + ' warrants caution. Narrow moat and limited pricing power — seek better risk-adjusted alternatives.' },
                    ].map(b => (
                      <div key={b.h} style={{ marginBottom: 22 }}>
                        <div style={{ fontFamily: mono, fontSize: 11, color: 'var(--accent)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 7 }}>{b.h}</div>
                        <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.8 }}>{b.b}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* NEWS */}
                {tab === 'News' && (
                  <div style={{ maxWidth: 700 }}>
                    {!data.news || data.news.length === 0
                      ? <div style={{ color: 'var(--text3)', fontSize: 14, paddingTop: 20 }}>No recent news for {data.ticker}.</div>
                      : data.news.map((n: any, i: number) => (
                        <a key={i} href={n.url} target="_blank" rel="noopener" style={{ display: 'block', padding: '14px 0', borderBottom: '1px solid var(--border)' }}>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 6 }}>
                            <span style={{ fontFamily: mono, fontSize: 11, color: 'var(--accent)' }}>{n.source}</span>
                            <span style={{ fontSize: 11, color: 'var(--text3)' }}>{n.published ? new Date(n.published).toLocaleDateString() : ''}</span>
                            {n.sentiment && (
                              <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 3, background: n.sentiment === 'positive' ? 'rgba(0,217,126,.1)' : n.sentiment === 'negative' ? 'rgba(255,77,77,.1)' : 'rgba(74,85,104,.1)', color: n.sentiment === 'positive' ? 'var(--accent)' : n.sentiment === 'negative' ? 'var(--red)' : 'var(--text3)' }}>
                                {n.sentiment.toUpperCase()}
                              </span>
                            )}
                          </div>
                          <div style={{ fontSize: 14, color: 'var(--text)', lineHeight: 1.5 }}>{n.title}</div>
                        </a>
                      ))
                    }
                  </div>
                )}

              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}
