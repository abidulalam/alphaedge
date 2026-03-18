'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

const mono = 'IBM Plex Mono, monospace'
const TIMEFRAMES = ['1D', '5D', '1M', '3M', '6M', '1Y', '2Y', '5Y']
const GREEN = '#00d97e'
const RED   = '#ff4d4d'

interface Bar { time: number; open: number; high: number; low: number; close: number; volume: number }
interface Props { ticker: string; initialBars?: Bar[] }

interface DrawOpts {
  chartType: string
  showSMA20: boolean; showSMA50: boolean; showSMA200: boolean
  showBB: boolean; showVolume: boolean
  tf: string
  hoverIdx: number | null
}

// ── Indicator helpers ──────────────────────────────────────────────────────
function smaArr(arr: number[], p: number): (number | null)[] {
  return arr.map((_, i) =>
    i < p - 1 ? null : arr.slice(i - p + 1, i + 1).reduce((a, b) => a + b, 0) / p
  )
}
function bbArr(arr: number[], p = 20, k = 2) {
  return arr.map((_, i) => {
    if (i < p - 1) return null
    const sl = arr.slice(i - p + 1, i + 1)
    const m  = sl.reduce((a, b) => a + b, 0) / p
    const sd = Math.sqrt(sl.reduce((a, b) => a + (b - m) ** 2, 0) / p)
    return { u: m + k * sd, m, l: m - k * sd }
  })
}

// ── Core draw function (runs on canvas) ──────────────────────────────────
function drawChart(canvas: HTMLCanvasElement, bars: Bar[], opts: DrawOpts) {
  if (!bars.length) return
  const dpr = window.devicePixelRatio || 1
  const W = canvas.clientWidth
  const H = canvas.clientHeight
  if (W <= 0 || H <= 0) return

  if (canvas.width !== Math.round(W * dpr) || canvas.height !== Math.round(H * dpr)) {
    canvas.width  = Math.round(W * dpr)
    canvas.height = Math.round(H * dpr)
  }

  const ctx = canvas.getContext('2d')!
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
  ctx.clearRect(0, 0, W, H)

  const { chartType, showSMA20, showSMA50, showSMA200, showBB, showVolume, tf, hoverIdx } = opts

  // Layout
  const padL = 8, padR = 70, padT = 12, padB = 26
  const hasVol = showVolume && bars.some(b => b.volume > 0)
  const volH   = hasVol ? 52 : 0
  const mainH  = H - padT - padB - (hasVol ? volH + 6 : 0)
  const chartW = W - padL - padR
  const n      = bars.length

  const closes = bars.map(b => b.close)
  const highs  = bars.map(b => b.high)
  const lows   = bars.map(b => b.low)

  // Price range
  let minP = Math.min(...(chartType === 'candlestick' ? lows  : closes))
  let maxP = Math.max(...(chartType === 'candlestick' ? highs : closes))
  if (minP === maxP) { minP -= 1; maxP += 1 }
  const pPad  = (maxP - minP) * 0.06
  const pMin  = minP - pPad
  const pMax  = maxP + pPad
  const pRange = pMax - pMin

  const toY = (p: number) => padT + mainH - ((p - pMin) / pRange) * mainH
  const toX = (i: number) => padL + (n === 1 ? chartW / 2 : (i / (n - 1)) * chartW)
  const barW = Math.max(1, Math.min(14, Math.floor(chartW / n) - 1))

  // ── Grid ──
  const gridCount = 5
  ctx.strokeStyle = 'rgba(255,255,255,0.04)'
  ctx.lineWidth = 1
  for (let g = 0; g <= gridCount; g++) {
    const y = padT + (mainH / gridCount) * g
    ctx.beginPath(); ctx.moveTo(padL, y); ctx.lineTo(W - padR, y); ctx.stroke()
  }

  // ── Price axis labels ──
  ctx.fillStyle = '#505060'
  ctx.font = `10px ${mono}`
  ctx.textAlign = 'left'
  for (let g = 0; g <= gridCount; g++) {
    const price = pMax - (pRange / gridCount) * g
    const y     = padT + (mainH / gridCount) * g
    const lbl   = price >= 1000 ? price.toFixed(0) : price >= 10 ? price.toFixed(1) : price.toFixed(2)
    ctx.fillText(lbl, W - padR + 6, y + 4)
  }

  // ── Overlays (drawn behind price bars) ──
  const sma20  = smaArr(closes, 20)
  const sma50  = smaArr(closes, 50)
  const sma200 = smaArr(closes, 200)
  const bb     = bbArr(closes)

  const drawLine = (vals: (number | null)[], color: string, dash: number[] = [], lw = 1) => {
    ctx.strokeStyle = color; ctx.lineWidth = lw; ctx.setLineDash(dash)
    ctx.beginPath(); let moved = false
    for (let i = 0; i < vals.length; i++) {
      if (vals[i] == null) { moved = false; continue }
      const x = toX(i), y = toY(vals[i]!)
      if (!moved) { ctx.moveTo(x, y); moved = true } else ctx.lineTo(x, y)
    }
    ctx.stroke(); ctx.setLineDash([])
  }

  if (showBB) {
    const bbU = bb.map(b => b?.u ?? null)
    const bbM = bb.map(b => b?.m ?? null)
    const bbL = bb.map(b => b?.l ?? null)
    // shaded band
    ctx.fillStyle = 'rgba(91,141,239,0.06)'
    const firstValid = bb.findIndex(b => b != null)
    if (firstValid >= 0) {
      ctx.beginPath()
      for (let i = firstValid; i < n; i++) if (bb[i]) ctx.lineTo(toX(i), toY(bb[i]!.u))
      for (let i = n - 1; i >= firstValid; i--) if (bb[i]) ctx.lineTo(toX(i), toY(bb[i]!.l))
      ctx.closePath(); ctx.fill()
    }
    drawLine(bbU, 'rgba(91,141,239,0.5)', [4, 3])
    drawLine(bbM, 'rgba(91,141,239,0.3)', [3, 3])
    drawLine(bbL, 'rgba(91,141,239,0.5)', [4, 3])
  }
  if (showSMA200) drawLine(sma200, '#BF5AF2')
  if (showSMA50)  drawLine(sma50,  '#5B8DEF')
  if (showSMA20)  drawLine(sma20,  '#F5A623')

  // ── Main series ──
  const isUp = (b: Bar) => b.close >= b.open

  if (chartType === 'candlestick') {
    for (let i = 0; i < n; i++) {
      const b = bars[i]
      const x = toX(i)
      const color = isUp(b) ? GREEN : RED
      // Wick
      ctx.strokeStyle = color; ctx.lineWidth = 1
      ctx.beginPath(); ctx.moveTo(x, toY(b.high)); ctx.lineTo(x, toY(b.low)); ctx.stroke()
      // Body
      const yO = toY(b.open), yC = toY(b.close)
      ctx.fillStyle = color
      ctx.fillRect(x - barW / 2, Math.min(yO, yC), barW, Math.max(1, Math.abs(yO - yC)))
    }
  } else {
    const pos   = closes[n - 1] >= closes[0]
    const lc    = pos ? GREEN : RED

    if (chartType === 'area') {
      // Gradient fill
      const grad = ctx.createLinearGradient(0, padT, 0, padT + mainH)
      grad.addColorStop(0, lc + '50')
      grad.addColorStop(1, lc + '00')
      ctx.beginPath()
      ctx.moveTo(toX(0), padT + mainH)
      ctx.lineTo(toX(0), toY(closes[0]))
      for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toY(closes[i]))
      ctx.lineTo(toX(n - 1), padT + mainH)
      ctx.closePath(); ctx.fillStyle = grad; ctx.fill()
    }

    ctx.strokeStyle = lc; ctx.lineWidth = 2
    ctx.beginPath(); ctx.moveTo(toX(0), toY(closes[0]))
    for (let i = 1; i < n; i++) ctx.lineTo(toX(i), toY(closes[i]))
    ctx.stroke()
  }

  // ── Volume bars ──
  if (hasVol) {
    const volTop = padT + mainH + 6
    const maxVol = Math.max(...bars.map(b => b.volume), 1)
    for (let i = 0; i < n; i++) {
      const b = bars[i]
      if (!b.volume) continue
      const x  = toX(i)
      const vh = (b.volume / maxVol) * volH
      ctx.fillStyle = isUp(b) ? 'rgba(0,217,126,0.28)' : 'rgba(255,77,77,0.28)'
      ctx.fillRect(x - barW / 2, volTop + volH - vh, Math.max(1, barW), vh)
    }
  }

  // ── Time axis labels ──
  ctx.fillStyle = '#505060'; ctx.font = `10px ${mono}`; ctx.textAlign = 'center'
  const step = Math.max(1, Math.ceil(n / 7))
  const showTime = tf === '1D' || tf === '5D'
  for (let i = 0; i < n; i += step) {
    const d = new Date(bars[i].time * 1000)
    const lbl = showTime
      ? `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`
      : `${d.getMonth() + 1}/${d.getDate()}`
    ctx.fillText(lbl, toX(i), H - 7)
  }

  // ── Crosshair ──
  if (hoverIdx !== null && hoverIdx >= 0 && hoverIdx < n) {
    const xh = toX(hoverIdx)
    const b  = bars[hoverIdx]
    const yh = toY(b.close)

    ctx.strokeStyle = 'rgba(255,85,0,0.55)'; ctx.lineWidth = 1; ctx.setLineDash([4, 3])
    ctx.beginPath(); ctx.moveTo(xh, padT); ctx.lineTo(xh, H - padB); ctx.stroke()
    ctx.beginPath(); ctx.moveTo(padL, yh); ctx.lineTo(W - padR, yh); ctx.stroke()
    ctx.setLineDash([])

    // Price tag on axis
    const pLabel = b.close >= 100 ? b.close.toFixed(1) : b.close.toFixed(2)
    ctx.fillStyle = '#FF5500'
    ctx.fillRect(W - padR + 2, yh - 9, padR - 4, 18)
    ctx.fillStyle = '#fff'; ctx.font = `bold 10px ${mono}`; ctx.textAlign = 'left'
    ctx.fillText(pLabel, W - padR + 6, yh + 4)
  }
}

// ── Component ─────────────────────────────────────────────────────────────
export default function AdvancedChart({ ticker, initialBars }: Props) {
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Mutable refs for draw function (avoid stale closures in event handlers)
  const barsRef    = useRef<Bar[]>([])
  const optsRef    = useRef<DrawOpts>({
    chartType: 'candlestick',
    showSMA20: true, showSMA50: true, showSMA200: false,
    showBB: false, showVolume: true,
    tf: '1Y', hoverIdx: null,
  })

  const [bars, setBars]           = useState<Bar[]>(() =>
    (initialBars ?? []).filter(b => b.close > 0).sort((a, b) => a.time - b.time)
  )
  const [tf, setTf]               = useState('1Y')
  const [chartType, setChartType] = useState('candlestick')
  const [loading, setLoading]     = useState(!initialBars?.length)
  const [error, setError]         = useState<string | null>(null)
  const [showSMA20, setShowSMA20]   = useState(true)
  const [showSMA50, setShowSMA50]   = useState(true)
  const [showSMA200, setShowSMA200] = useState(false)
  const [showBB, setShowBB]         = useState(false)
  const [showVolume, setShowVolume] = useState(true)
  const [hoverBar, setHoverBar]     = useState<Bar | null>(null)

  // ── Redraw helper ──
  const redraw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    if (barsRef.current.length === 0) {
      const ctx = canvas.getContext('2d')
      if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
      return
    }
    drawChart(canvas, barsRef.current, optsRef.current)
  }, [])

  // ── Sync refs → redraw whenever state changes ──
  useEffect(() => {
    barsRef.current = bars
    optsRef.current = { ...optsRef.current }
    redraw()
  }, [bars, redraw])

  useEffect(() => {
    optsRef.current = { ...optsRef.current, chartType, showSMA20, showSMA50, showSMA200, showBB, showVolume, tf }
    redraw()
  }, [chartType, showSMA20, showSMA50, showSMA200, showBB, showVolume, tf, redraw])

  // ── Fetch ──
  const fetchBars = useCallback(async (timeframe: string) => {
    if (!ticker) return
    setLoading(true); setError(null)
    try {
      const res  = await fetch(`/api/candles?ticker=${encodeURIComponent(ticker)}&tf=${timeframe}`)
      const json = await res.json()
      if (json.bars && json.bars.length > 0) {
        const sorted = (json.bars as Bar[]).filter(b => b.close > 0).sort((a, b) => a.time - b.time)
        setBars(sorted)
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

  // On mount: use initialBars if available, else fetch. On tf/ticker change: always fetch.
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      if (initialBars && initialBars.length > 0) {
        // seed bars from initial, still allow tf changes to fetch
        return
      }
    }
    fetchBars(tf)
  }, [tf, ticker]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Resize observer ──
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => redraw())
    ro.observe(el)
    // Initial size
    setTimeout(() => redraw(), 50)
    return () => ro.disconnect()
  }, [redraw])

  // ── Mouse move — crosshair ──
  const rafId = useRef(0)
  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas || barsRef.current.length === 0) return
    const rect   = canvas.getBoundingClientRect()
    const mx     = e.clientX - rect.left
    const W      = canvas.clientWidth
    const padL   = 8, padR = 70
    const chartW = W - padL - padR
    const n      = barsRef.current.length
    const rawI   = ((mx - padL) / chartW) * (n - 1)
    const idx    = Math.max(0, Math.min(n - 1, Math.round(rawI)))
    optsRef.current = { ...optsRef.current, hoverIdx: idx }
    setHoverBar(barsRef.current[idx])
    cancelAnimationFrame(rafId.current)
    rafId.current = requestAnimationFrame(redraw)
  }, [redraw])

  const handleMouseLeave = useCallback(() => {
    optsRef.current = { ...optsRef.current, hoverIdx: null }
    setHoverBar(null)
    redraw()
  }, [redraw])

  // ── Derived display info ──
  const sorted  = bars
  const last    = sorted.length ? sorted[sorted.length - 1] : null
  const first   = sorted.length ? sorted[0] : null
  const display = hoverBar ?? last
  const periodChange    = last && first ? last.close - first.open : null
  const periodChangePct = periodChange != null && first?.open ? (periodChange / first.open) * 100 : null
  const isUp = display ? display.close >= display.open : true

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 8px', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ display: 'flex', gap: 2 }}>
          {TIMEFRAMES.map(t => (
            <button key={t} onClick={() => setTf(t)} style={{
              padding: '3px 9px', fontFamily: mono, fontSize: 11, letterSpacing: 1,
              background: t === tf ? 'var(--accent)' : 'transparent',
              color:      t === tf ? '#000' : 'var(--text3)',
              border: 'none', borderRadius: 3, cursor: 'pointer', fontWeight: t === tf ? 700 : 400,
            }}>{t}</button>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', border: '1px solid var(--border2)', borderRadius: 4, overflow: 'hidden' }}>
            {[{ key: 'candlestick', label: 'Candle' }, { key: 'line', label: 'Line' }, { key: 'area', label: 'Area' }].map(ct => (
              <button key={ct.key} onClick={() => setChartType(ct.key)} style={{
                padding: '3px 10px', fontFamily: mono, fontSize: 10, letterSpacing: 1,
                background: ct.key === chartType ? 'var(--bg3)' : 'transparent',
                color:      ct.key === chartType ? 'var(--text)' : 'var(--text3)',
                border: 'none', cursor: 'pointer',
              }}>{ct.label}</button>
            ))}
          </div>
          {([
            { label: 'SMA20',  active: showSMA20,   color: '#F5A623',        toggle: () => setShowSMA20(v => !v)  },
            { label: 'SMA50',  active: showSMA50,   color: '#5B8DEF',        toggle: () => setShowSMA50(v => !v)  },
            { label: 'SMA200', active: showSMA200,  color: '#BF5AF2',        toggle: () => setShowSMA200(v => !v) },
            { label: 'BB',     active: showBB,      color: '#5B8DEF',        toggle: () => setShowBB(v => !v)     },
            { label: 'VOL',    active: showVolume,  color: 'var(--text3)',   toggle: () => setShowVolume(v => !v) },
          ] as const).map(ind => (
            <button key={ind.label} onClick={ind.toggle} style={{
              padding: '3px 9px', fontFamily: mono, fontSize: 10, letterSpacing: 1,
              background: ind.active ? 'rgba(255,255,255,0.06)' : 'transparent',
              color:      ind.active ? ind.color : 'var(--text4)',
              border:     `1px solid ${ind.active ? ind.color + '55' : 'var(--border)'}`,
              borderRadius: 3, cursor: 'pointer',
            }}>{ind.label}</button>
          ))}
        </div>
      </div>

      {/* OHLCV info bar */}
      {display && (
        <div style={{ display: 'flex', gap: 16, padding: '2px 0 8px', fontFamily: mono, fontSize: 11, color: 'var(--text3)', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text2)', fontWeight: 700 }}>{ticker}</span>
          {chartType === 'candlestick' && (
            <>
              <span>O <span style={{ color: 'var(--text)' }}>${display.open.toFixed(2)}</span></span>
              <span>H <span style={{ color: 'var(--green)' }}>${display.high.toFixed(2)}</span></span>
              <span>L <span style={{ color: 'var(--red)' }}>${display.low.toFixed(2)}</span></span>
            </>
          )}
          <span>C <span style={{ color: isUp ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>${display.close.toFixed(2)}</span></span>
          {display.volume > 0 && <span>V <span style={{ color: 'var(--text2)' }}>{(display.volume / 1e6).toFixed(2)}M</span></span>}
          {!hoverBar && periodChange != null && (
            <span style={{ marginLeft: 'auto', color: periodChange >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
              {periodChange >= 0 ? '+' : ''}{periodChange.toFixed(2)} ({periodChangePct! >= 0 ? '+' : ''}{periodChangePct!.toFixed(2)}%) {tf}
            </span>
          )}
        </div>
      )}

      {/* Canvas */}
      <div ref={containerRef} style={{ position: 'relative', height: 420, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)', background: 'var(--bg2)' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, fontFamily: mono, fontSize: 12, color: 'var(--text3)', letterSpacing: 2 }}>
            LOADING CHART…
          </div>
        )}
        {error && !loading && bars.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 10, fontFamily: mono, fontSize: 12, color: 'var(--text3)' }}>
            {error}
          </div>
        )}
        <canvas
          ref={canvasRef}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
          style={{ display: 'block', width: '100%', height: '100%', cursor: 'crosshair' }}
        />
      </div>

      {/* Legend */}
      {bars.length > 0 && (
        <div style={{ display: 'flex', gap: 16, padding: '6px 0 0', fontFamily: mono, fontSize: 10, color: 'var(--text3)' }}>
          {showSMA20  && <span><span style={{ color: '#F5A623' }}>━</span> SMA 20</span>}
          {showSMA50  && <span><span style={{ color: '#5B8DEF' }}>━</span> SMA 50</span>}
          {showSMA200 && <span><span style={{ color: '#BF5AF2' }}>━</span> SMA 200</span>}
          {showBB     && <span><span style={{ color: '#5B8DEF' }}>╌</span> Bollinger Bands (20,2)</span>}
          {showVolume && <span>▬ Volume</span>}
          {bars.length > 0 && <span style={{ marginLeft: 'auto' }}>{bars.length} bars</span>}
        </div>
      )}
    </div>
  )
}
