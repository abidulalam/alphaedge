'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import {
  ResponsiveContainer, ComposedChart, Area, Line,
  XAxis, YAxis, CartesianGrid, Tooltip,
} from 'recharts'

const mono = 'IBM Plex Mono, monospace'
const TIMEFRAMES = ['1D', '5D', '1M', '3M', '6M', '1Y', '2Y', '5Y']
const GREEN = '#00d97e'
const RED   = '#ff4d4d'

interface Bar { time: number; open: number; high: number; low: number; close: number; volume: number }
interface Props { ticker: string; initialBars?: Bar[] }

function computeSMA(data: number[], p: number): (number | undefined)[] {
  return data.map((_, i) =>
    i < p - 1 ? undefined : data.slice(i - p + 1, i + 1).reduce((a, b) => a + b, 0) / p
  )
}
function computeBB(data: number[], p = 20, k = 2) {
  return data.map((_, i) => {
    if (i < p - 1) return null
    const sl = data.slice(i - p + 1, i + 1)
    const m  = sl.reduce((a, b) => a + b, 0) / p
    const sd = Math.sqrt(sl.reduce((a, b) => a + (b - m) ** 2, 0) / p)
    return { bbU: m + k * sd, bbL: m - k * sd }
  })
}

// ── Pure SVG Candlestick chart ─────────────────────────────────────────────
function CandleSVG({
  bars, width, height, showSMA20, showSMA50, showSMA200, showBB, showVolume,
  hoverIdx, onHover, tf,
}: {
  bars: Bar[]; width: number; height: number
  showSMA20: boolean; showSMA50: boolean; showSMA200: boolean
  showBB: boolean; showVolume: boolean
  hoverIdx: number | null; onHover: (i: number | null) => void
  tf: string
}) {
  const n = bars.length
  if (!n || width < 10) return null

  const padL = 8, padR = 68, padT = 12, padB = 26
  const hasVol = showVolume && bars.some(b => b.volume > 0)
  const volH   = hasVol ? 52 : 0
  const mainH  = height - padT - padB - (hasVol ? volH + 6 : 0)
  const cw     = width - padL - padR

  const allH  = bars.map(b => b.high)
  const allL  = bars.map(b => b.low)
  let minP = Math.min(...allL), maxP = Math.max(...allH)
  if (minP === maxP) { minP -= 1; maxP += 1 }
  const pp = (maxP - minP) * 0.05
  const pMin = minP - pp, pMax = maxP + pp, pRange = pMax - pMin

  const toX = (i: number) => padL + (n === 1 ? cw / 2 : (i / (n - 1)) * cw)
  const toY = (p: number) => padT + mainH - ((p - pMin) / pRange) * mainH
  const bw = Math.max(1, Math.min(14, Math.floor(cw / n) - 1))

  const closes  = bars.map(b => b.close)
  const sma20   = showSMA20  ? computeSMA(closes, 20)  : []
  const sma50   = showSMA50  ? computeSMA(closes, 50)  : []
  const sma200  = showSMA200 ? computeSMA(closes, 200) : []
  const bbVals  = showBB     ? computeBB(closes)        : []

  function path(vals: (number | undefined | null)[]): string {
    let d = '', open = true
    for (let i = 0; i < vals.length; i++) {
      const v = vals[i]
      if (v == null) { open = true; continue }
      d += open ? `M${toX(i).toFixed(1)},${toY(v).toFixed(1)}` : `L${toX(i).toFixed(1)},${toY(v).toFixed(1)}`
      open = false
    }
    return d
  }

  const gridCount = 5
  const gridLines = Array.from({ length: gridCount + 1 }, (_, g) => g)

  const showTime = tf === '1D' || tf === '5D'
  const step = Math.max(1, Math.ceil(n / 7))

  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement>) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx   = e.clientX - rect.left
    const rawI = ((mx - padL) / cw) * (n - 1)
    onHover(Math.max(0, Math.min(n - 1, Math.round(rawI))))
  }

  const hb = hoverIdx !== null ? bars[hoverIdx] : null

  return (
    <svg
      width={width} height={height}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => onHover(null)}
      style={{ display: 'block', cursor: 'crosshair', overflow: 'visible' }}
    >
      {/* Grid */}
      {gridLines.map(g => (
        <line key={g}
          x1={padL} y1={padT + mainH * g / gridCount}
          x2={width - padR} y2={padT + mainH * g / gridCount}
          stroke="rgba(255,255,255,0.05)" strokeWidth={1}
        />
      ))}

      {/* Price labels */}
      {gridLines.map(g => {
        const price = pMax - pRange * g / gridCount
        const y     = padT + mainH * g / gridCount
        const lbl   = price >= 1000 ? price.toFixed(0) : price >= 10 ? price.toFixed(1) : price.toFixed(2)
        return <text key={g} x={width - padR + 6} y={y + 4} fill="#505060" fontSize={10} fontFamily={mono}>{lbl}</text>
      })}

      {/* BB band */}
      {showBB && (() => {
        const fi = bbVals.findIndex(b => b != null)
        if (fi < 0) return null
        let top = '', bot = ''
        for (let i = fi; i < n; i++) { if (bbVals[i]) top += `${top ? 'L' : 'M'}${toX(i).toFixed(1)},${toY(bbVals[i]!.bbU).toFixed(1)}` }
        for (let i = n - 1; i >= fi; i--) { if (bbVals[i]) bot += `L${toX(i).toFixed(1)},${toY(bbVals[i]!.bbL).toFixed(1)}` }
        return (
          <g>
            <path d={top + bot + 'Z'} fill="rgba(91,141,239,0.07)" />
            <path d={path(bbVals.map(b => b?.bbU))} stroke="rgba(91,141,239,0.5)" strokeWidth={1} fill="none" strokeDasharray="4,3" />
            <path d={path(bbVals.map(b => b?.bbL))} stroke="rgba(91,141,239,0.5)" strokeWidth={1} fill="none" strokeDasharray="4,3" />
          </g>
        )
      })()}

      {/* SMA overlays */}
      {showSMA200 && <path d={path(sma200)} stroke="#BF5AF2" strokeWidth={1} fill="none" />}
      {showSMA50  && <path d={path(sma50)}  stroke="#5B8DEF" strokeWidth={1} fill="none" />}
      {showSMA20  && <path d={path(sma20)}  stroke="#F5A623" strokeWidth={1} fill="none" />}

      {/* Candlesticks */}
      {bars.map((b, i) => {
        const x  = toX(i), isUp = b.close >= b.open
        const col = isUp ? GREEN : RED
        const yH = toY(b.high), yL = toY(b.low)
        const yO = toY(b.open), yC = toY(b.close)
        const bodyT = Math.min(yO, yC)
        const bodyH = Math.max(1, Math.abs(yO - yC))
        return (
          <g key={i}>
            <line x1={x} y1={yH} x2={x} y2={yL} stroke={col} strokeWidth={1} />
            <rect x={x - bw / 2} y={bodyT} width={bw} height={bodyH} fill={col} />
          </g>
        )
      })}

      {/* Volume */}
      {hasVol && (() => {
        const volTop = padT + mainH + 6
        const maxVol = Math.max(...bars.map(b => b.volume), 1)
        return bars.map((b, i) => {
          if (!b.volume) return null
          const x = toX(i), vh = (b.volume / maxVol) * volH
          return (
            <rect key={i}
              x={x - bw / 2} y={volTop + volH - vh}
              width={Math.max(1, bw)} height={vh}
              fill={b.close >= b.open ? 'rgba(0,217,126,0.28)' : 'rgba(255,77,77,0.28)'}
            />
          )
        })
      })()}

      {/* Time labels */}
      {Array.from({ length: Math.ceil(n / step) }, (_, k) => {
        const i = Math.min(k * step, n - 1)
        const d = new Date(bars[i].time * 1000)
        const lbl = showTime
          ? `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
          : `${d.getMonth() + 1}/${d.getDate()}`
        return <text key={i} x={toX(i)} y={height - 7} fill="#505060" fontSize={10} fontFamily={mono} textAnchor="middle">{lbl}</text>
      })}

      {/* Crosshair */}
      {hb && hoverIdx !== null && (() => {
        const xh = toX(hoverIdx)
        const yh = toY(hb.close)
        const pl = hb.close >= 100 ? hb.close.toFixed(1) : hb.close.toFixed(2)
        return (
          <g>
            <line x1={xh} y1={padT} x2={xh} y2={height - padB} stroke="rgba(255,85,0,0.5)" strokeWidth={1} strokeDasharray="4,3" />
            <line x1={padL} y1={yh} x2={width - padR} y2={yh} stroke="rgba(255,85,0,0.5)" strokeWidth={1} strokeDasharray="4,3" />
            <rect x={width - padR + 2} y={yh - 9} width={padR - 4} height={18} fill="#FF5500" />
            <text x={width - padR + 6} y={yh + 4} fill="white" fontSize={10} fontFamily={mono} fontWeight="bold">{pl}</text>
          </g>
        )
      })()}
    </svg>
  )
}

// ── Custom recharts tooltip ────────────────────────────────────────────────
function ChartTooltip({ active, payload }: any) {
  if (!active || !payload?.length) return null
  const d = payload[0]?.payload
  if (!d) return null
  const dt = new Date(d.time * 1000)
  return (
    <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 4, padding: '8px 12px', fontFamily: mono, fontSize: 11 }}>
      <div style={{ color: 'var(--text3)', marginBottom: 4 }}>{dt.toLocaleDateString()}</div>
      <div style={{ color: 'var(--text)', fontWeight: 700 }}>${d.close?.toFixed(2)}</div>
      {d.sma20  != null && <div style={{ color: '#F5A623' }}>SMA20: ${d.sma20.toFixed(2)}</div>}
      {d.sma50  != null && <div style={{ color: '#5B8DEF' }}>SMA50: ${d.sma50.toFixed(2)}</div>}
      {d.sma200 != null && <div style={{ color: '#BF5AF2' }}>SMA200: ${d.sma200.toFixed(2)}</div>}
    </div>
  )
}

// ── Main Component ─────────────────────────────────────────────────────────
export default function AdvancedChart({ ticker, initialBars }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [svgWidth, setSvgWidth] = useState(900)

  const [bars,       setBars]       = useState<Bar[]>(() =>
    (initialBars ?? []).filter(b => b.close > 0).sort((a, b) => a.time - b.time)
  )
  const [tf,         setTf]         = useState('1Y')
  const [chartType,  setChartType]  = useState('candlestick')
  const [loading,    setLoading]    = useState(!initialBars?.length)
  const [error,      setError]      = useState<string | null>(null)
  const [showSMA20,  setShowSMA20]  = useState(true)
  const [showSMA50,  setShowSMA50]  = useState(true)
  const [showSMA200, setShowSMA200] = useState(false)
  const [showBB,     setShowBB]     = useState(false)
  const [showVolume, setShowVolume] = useState(true)
  const [hoverIdx,   setHoverIdx]   = useState<number | null>(null)

  // Measure container width for SVG mode
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    setSvgWidth(el.offsetWidth || 900)
    const ro = new ResizeObserver(entries => setSvgWidth(entries[0].contentRect.width || 900))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const fetchBars = useCallback(async (timeframe: string) => {
    if (!ticker) return
    setLoading(true); setError(null)
    try {
      const res  = await fetch(`/api/candles?ticker=${encodeURIComponent(ticker)}&tf=${timeframe}`)
      const json = await res.json()
      if (json.bars?.length > 0) {
        setBars((json.bars as Bar[]).filter(b => b.close > 0).sort((a, b) => a.time - b.time))
      } else {
        setError('No price data available')
        setBars([])
      }
    } catch {
      setError('Failed to load chart data')
      setBars([])
    } finally {
      setLoading(false)
    }
  }, [ticker])

  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      if (initialBars && initialBars.length > 0) return
    }
    fetchBars(tf)
  }, [tf, ticker]) // eslint-disable-line react-hooks/exhaustive-deps

  // Recharts data with computed overlays
  const chartData = useMemo(() => {
    const closes  = bars.map(b => b.close)
    const sma20v  = showSMA20  ? computeSMA(closes, 20)  : []
    const sma50v  = showSMA50  ? computeSMA(closes, 50)  : []
    const sma200v = showSMA200 ? computeSMA(closes, 200) : []
    const bbv     = showBB     ? computeBB(closes)        : []
    return bars.map((b, i) => ({
      ...b,
      sma20:   sma20v[i],
      sma50:   sma50v[i],
      sma200:  sma200v[i],
      bbU:     bbv[i]?.bbU,
      bbL:     bbv[i]?.bbL,
    }))
  }, [bars, showSMA20, showSMA50, showSMA200, showBB])

  // Price / period info
  const last   = bars.length ? bars[bars.length - 1] : null
  const first  = bars.length ? bars[0] : null
  const display = (hoverIdx != null ? bars[hoverIdx] : null) ?? last
  const periodChg    = last && first ? last.close - first.open : null
  const periodChgPct = periodChg != null && first?.open ? (periodChg / first.open) * 100 : null
  const isUp = display ? display.close >= display.open : true

  // Recharts domain
  const closes  = bars.map(b => b.close)
  const domainMin = closes.length ? Math.min(...closes) * 0.97 : 0
  const domainMax = closes.length ? Math.max(...closes) * 1.03 : 100

  const SVG_H = 400

  const xTickFormatter = (val: number) => {
    const d = new Date(val * 1000)
    return tf === '1D' || tf === '5D'
      ? `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
      : `${d.getMonth() + 1}/${d.getDate()}`
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Toolbar ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 8px', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 2 }}>
          {TIMEFRAMES.map(t => (
            <button key={t} onClick={() => setTf(t)} style={{
              padding: '3px 9px', fontFamily: mono, fontSize: 11, letterSpacing: 1,
              background: t === tf ? 'var(--accent)' : 'transparent',
              color: t === tf ? '#000' : 'var(--text3)',
              border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: t === tf ? 700 : 400,
            }}>{t}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', border: '1px solid var(--border2)', borderRadius: 4, overflow: 'hidden' }}>
            {[{ k: 'candlestick', l: 'Candle' }, { k: 'line', l: 'Line' }, { k: 'area', l: 'Area' }].map(ct => (
              <button key={ct.k} onClick={() => setChartType(ct.k)} style={{
                padding: '3px 10px', fontFamily: mono, fontSize: 10, letterSpacing: 1,
                background: ct.k === chartType ? 'var(--bg3)' : 'transparent',
                color: ct.k === chartType ? 'var(--text)' : 'var(--text3)',
                border: 'none', cursor: 'pointer',
              }}>{ct.l}</button>
            ))}
          </div>
          {([
            { l: 'SMA20',  a: showSMA20,  c: '#F5A623', fn: () => setShowSMA20(v  => !v) },
            { l: 'SMA50',  a: showSMA50,  c: '#5B8DEF', fn: () => setShowSMA50(v  => !v) },
            { l: 'SMA200', a: showSMA200, c: '#BF5AF2', fn: () => setShowSMA200(v => !v) },
            { l: 'BB',     a: showBB,     c: '#5B8DEF', fn: () => setShowBB(v     => !v) },
            { l: 'VOL',    a: showVolume, c: '#aaa',    fn: () => setShowVolume(v  => !v) },
          ]).map(ind => (
            <button key={ind.l} onClick={ind.fn} style={{
              padding: '3px 9px', fontFamily: mono, fontSize: 10, letterSpacing: 1,
              background: ind.a ? 'rgba(255,255,255,0.06)' : 'transparent',
              color:      ind.a ? ind.c : 'var(--text4)',
              border:     `1px solid ${ind.a ? ind.c + '55' : 'var(--border)'}`,
              borderRadius: 3, cursor: 'pointer',
            }}>{ind.l}</button>
          ))}
        </div>
      </div>

      {/* ── OHLCV info bar ── */}
      {display && (
        <div style={{ display: 'flex', gap: 16, padding: '2px 0 8px', fontFamily: mono, fontSize: 11, color: 'var(--text3)', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text2)', fontWeight: 700 }}>{ticker}</span>
          {chartType === 'candlestick' && (
            <>
              <span>O <span style={{ color: 'var(--text)' }}>${display.open.toFixed(2)}</span></span>
              <span>H <span style={{ color: GREEN }}>${display.high.toFixed(2)}</span></span>
              <span>L <span style={{ color: RED }}>${display.low.toFixed(2)}</span></span>
            </>
          )}
          <span>C <span style={{ color: isUp ? GREEN : RED, fontWeight: 700 }}>${display.close.toFixed(2)}</span></span>
          {display.volume > 0 && <span>V <span style={{ color: 'var(--text2)' }}>{(display.volume / 1e6).toFixed(2)}M</span></span>}
          {hoverIdx == null && periodChg != null && (
            <span style={{ marginLeft: 'auto', color: periodChg >= 0 ? GREEN : RED, fontWeight: 700 }}>
              {periodChg >= 0 ? '+' : ''}{periodChg.toFixed(2)} ({periodChgPct! >= 0 ? '+' : ''}{periodChgPct!.toFixed(2)}%) {tf}
            </span>
          )}
        </div>
      )}

      {/* ── Chart area ── */}
      <div ref={containerRef} style={{ position: 'relative', height: SVG_H, borderRadius: 6, border: '1px solid var(--border)', background: 'var(--bg2)', overflow: 'hidden' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, fontFamily: mono, fontSize: 12, color: 'var(--text3)', letterSpacing: 2 }}>
            LOADING…
          </div>
        )}
        {!loading && bars.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 5, fontFamily: mono, fontSize: 12, color: 'var(--text3)' }}>
            {error || 'No data'}
          </div>
        )}

        {/* Candlestick mode — pure SVG */}
        {!loading && bars.length > 0 && chartType === 'candlestick' && (
          <CandleSVG
            bars={bars} width={svgWidth} height={SVG_H}
            showSMA20={showSMA20} showSMA50={showSMA50} showSMA200={showSMA200}
            showBB={showBB} showVolume={showVolume}
            hoverIdx={hoverIdx} onHover={setHoverIdx} tf={tf}
          />
        )}

        {/* Line / Area mode — recharts */}
        {!loading && bars.length > 0 && chartType !== 'candlestick' && (
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 70, bottom: 20, left: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
              <XAxis dataKey="time" type="number" scale="time" domain={['auto', 'auto']} tickFormatter={xTickFormatter} tick={{ fontFamily: mono, fontSize: 10, fill: '#505060' }} tickLine={false} axisLine={false} tickCount={7} />
              <YAxis domain={[domainMin, domainMax]} orientation="right" tick={{ fontFamily: mono, fontSize: 10, fill: '#505060' }} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2)} width={65} />
              <Tooltip content={<ChartTooltip />} />

              {/* SMA / BB overlays */}
              {showSMA200 && <Line dataKey="sma200" stroke="#BF5AF2" strokeWidth={1} dot={false} connectNulls activeDot={false} />}
              {showSMA50  && <Line dataKey="sma50"  stroke="#5B8DEF" strokeWidth={1} dot={false} connectNulls activeDot={false} />}
              {showSMA20  && <Line dataKey="sma20"  stroke="#F5A623" strokeWidth={1} dot={false} connectNulls activeDot={false} />}
              {showBB     && <Line dataKey="bbU" stroke="rgba(91,141,239,0.5)" strokeWidth={1} strokeDasharray="4 3" dot={false} connectNulls activeDot={false} />}
              {showBB     && <Line dataKey="bbL" stroke="rgba(91,141,239,0.5)" strokeWidth={1} strokeDasharray="4 3" dot={false} connectNulls activeDot={false} />}

              {/* Main series */}
              {chartType === 'area'
                ? <Area dataKey="close" stroke={bars.length && bars[bars.length-1].close >= bars[0].close ? GREEN : RED} strokeWidth={2} fill={bars.length && bars[bars.length-1].close >= bars[0].close ? GREEN+'30' : RED+'30'} dot={false} activeDot={{ r: 3 }} />
                : <Line dataKey="close" stroke={bars.length && bars[bars.length-1].close >= bars[0].close ? GREEN : RED} strokeWidth={2} dot={false} activeDot={{ r: 3 }} />
              }
            </ComposedChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* ── Legend ── */}
      {bars.length > 0 && (
        <div style={{ display: 'flex', gap: 16, padding: '6px 0 0', fontFamily: mono, fontSize: 10, color: 'var(--text3)' }}>
          {showSMA20  && <span><span style={{ color: '#F5A623' }}>━</span> SMA 20</span>}
          {showSMA50  && <span><span style={{ color: '#5B8DEF' }}>━</span> SMA 50</span>}
          {showSMA200 && <span><span style={{ color: '#BF5AF2' }}>━</span> SMA 200</span>}
          {showBB     && <span><span style={{ color: '#5B8DEF' }}>╌</span> BB (20,2)</span>}
          <span style={{ marginLeft: 'auto' }}>{bars.length} bars</span>
        </div>
      )}
    </div>
  )
}
