'use client'
// AdvancedChart — lightweight-charts v5 (top-level import, ssr:false guaranteed by dynamic() in parent)
import { useEffect, useRef, useState, useCallback } from 'react'
import {
  createChart, CrosshairMode, LineStyle,
  CandlestickSeries, LineSeries, AreaSeries, HistogramSeries,
} from 'lightweight-charts'

const mono = 'IBM Plex Mono, monospace'
const TIMEFRAMES = ['1D', '5D', '1M', '3M', '6M', '1Y', '2Y', '5Y']
const CHART_TYPES = [{ key: 'candlestick', label: 'Candle' }, { key: 'line', label: 'Line' }, { key: 'area', label: 'Area' }]

interface Bar { time: number; open: number; high: number; low: number; close: number; volume: number }
interface Props { ticker: string; initialBars?: Bar[] }

function smaArr(data: number[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null
    return data.slice(i - period + 1, i + 1).reduce((a, b) => a + b, 0) / period
  })
}
function bbands(closes: number[], period = 20, k = 2) {
  return closes.map((_, i) => {
    if (i < period - 1) return null
    const sl = closes.slice(i - period + 1, i + 1)
    const m  = sl.reduce((a, b) => a + b, 0) / period
    const sd = Math.sqrt(sl.reduce((a, b) => a + (b - m) ** 2, 0) / period)
    return { upper: m + k * sd, middle: m, lower: m - k * sd }
  })
}

export default function AdvancedChart({ ticker, initialBars }: Props) {
  const containerRef  = useRef<HTMLDivElement>(null)
  const chartRef      = useRef<ReturnType<typeof createChart> | null>(null)

  const [bars, setBars]         = useState<Bar[]>(initialBars ?? [])
  const [tf, setTf]             = useState('1Y')
  const [chartType, setChartType] = useState('candlestick')
  const [loading, setLoading]   = useState(!initialBars || initialBars.length === 0)
  const [error, setError]       = useState<string | null>(null)
  const [showSMA20, setShowSMA20]   = useState(true)
  const [showSMA50, setShowSMA50]   = useState(true)
  const [showSMA200, setShowSMA200] = useState(false)
  const [showBB, setShowBB]         = useState(false)
  const [showVolume, setShowVolume] = useState(true)
  const [hovered, setHovered]       = useState<(Bar & { sma20?: number; sma50?: number }) | null>(null)

  const fetchBars = useCallback(async (timeframe: string) => {
    if (!ticker) return
    setLoading(true); setError(null)
    try {
      const res  = await fetch(`/api/candles?ticker=${encodeURIComponent(ticker)}&tf=${timeframe}`)
      const json = await res.json()
      if (json.bars && json.bars.length > 0) {
        setBars(json.bars)
      } else {
        setError('No price data available for this timeframe')
        setBars([])
      }
    } catch {
      setError('Failed to load chart data')
      setBars([])
    } finally {
      setLoading(false)
    }
  }, [ticker])

  // Mount: if no initial bars, fetch. Timeframe or ticker changes: always fetch.
  const mounted = useRef(false)
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      if (initialBars && initialBars.length > 0) return
    }
    fetchBars(tf)
  }, [tf, ticker]) // eslint-disable-line react-hooks/exhaustive-deps

  // Render chart whenever bars or display settings change
  useEffect(() => {
    const container = containerRef.current
    if (!container || bars.length === 0) return

    // Sort and deduplicate bars by time
    const sorted = [...bars]
      .sort((a, b) => a.time - b.time)
      .filter((b, i, arr) => i === 0 || b.time !== arr[i - 1].time)
      .filter(b => b.close > 0)

    if (sorted.length === 0) return

    // Destroy previous chart
    if (chartRef.current) {
      try { chartRef.current.remove() } catch {}
      chartRef.current = null
    }

    const chart = createChart(container, {
      width:  container.clientWidth || 900,
      height: 400,
      layout: {
        background:  { color: 'transparent' },
        textColor:   '#888888',
        fontFamily:  mono,
        fontSize:    11,
      },
      grid: {
        vertLines: { color: 'rgba(255,255,255,0.04)' },
        horzLines: { color: 'rgba(255,255,255,0.04)' },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: 'rgba(255,85,0,0.5)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#FF5500' },
        horzLine: { color: 'rgba(255,85,0,0.5)', width: 1, style: LineStyle.Dashed, labelBackgroundColor: '#FF5500' },
      },
      rightPriceScale: {
        borderColor:  '#1e2d42',
        scaleMargins: { top: 0.08, bottom: showVolume ? 0.22 : 0.06 },
      },
      timeScale: {
        borderColor:    '#1e2d42',
        timeVisible:    tf === '1D' || tf === '5D',
        secondsVisible: false,
        rightOffset:    8,
        fixLeftEdge:    true,
        fixRightEdge:   true,
      },
    })
    chartRef.current = chart

    const positive = sorted[sorted.length - 1].close >= sorted[0].close

    // Main series
    if (chartType === 'candlestick') {
      const s = chart.addSeries(CandlestickSeries, {
        upColor: '#00d97e', downColor: '#ff4d4d',
        borderUpColor: '#00d97e', borderDownColor: '#ff4d4d',
        wickUpColor: '#00d97e', wickDownColor: '#ff4d4d',
      })
      s.setData(sorted.map(b => ({ time: b.time as any, open: b.open, high: b.high, low: b.low, close: b.close })))
    } else {
      const color = positive ? '#00d97e' : '#ff4d4d'
      if (chartType === 'area') {
        const s = chart.addSeries(AreaSeries, { lineColor: color, topColor: color + '33', bottomColor: color + '00', lineWidth: 2, priceLineVisible: false })
        s.setData(sorted.map(b => ({ time: b.time as any, value: b.close })))
      } else {
        const s = chart.addSeries(LineSeries, { color, lineWidth: 2, priceLineVisible: false })
        s.setData(sorted.map(b => ({ time: b.time as any, value: b.close })))
      }
    }

    // Volume
    if (showVolume && sorted.some(b => b.volume > 0)) {
      const vs = chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' as const }, priceScaleId: 'volume', color: '#253650' })
      chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.80, bottom: 0 } })
      vs.setData(sorted.map(b => ({ time: b.time as any, value: b.volume, color: b.close >= b.open ? 'rgba(0,217,126,0.3)' : 'rgba(255,77,77,0.3)' })))
    }

    // Overlays
    const closes = sorted.map(b => b.close)
    const times  = sorted.map(b => b.time)

    const addLine = (vals: (number | null)[], color: string, style = 0) => {
      const s = chart.addSeries(LineSeries, { color, lineWidth: 1, priceLineVisible: false, lastValueVisible: false, lineStyle: style as any })
      s.setData(vals.map((v, i) => v != null ? { time: times[i] as any, value: v } : null).filter(Boolean) as any)
    }

    if (showSMA20)  addLine(smaArr(closes, 20),  '#F5A623')
    if (showSMA50)  addLine(smaArr(closes, 50),  '#5B8DEF')
    if (showSMA200) addLine(smaArr(closes, 200), '#BF5AF2')
    if (showBB) {
      const bands = bbands(closes)
      const valid = bands.map((b, i) => b ? { time: times[i], u: b.upper, m: b.middle, l: b.lower } : null).filter(Boolean) as any[]
      addLine(valid.map(b => b.u), 'rgba(91,141,239,0.6)', LineStyle.Dashed)
      addLine(valid.map(b => b.m), 'rgba(91,141,239,0.3)', LineStyle.Dashed)
      addLine(valid.map(b => b.l), 'rgba(91,141,239,0.6)', LineStyle.Dashed)
    }

    // Crosshair hover
    chart.subscribeCrosshairMove((param: any) => {
      if (!param?.time || !param?.point) { setHovered(null); return }
      const idx = sorted.findIndex(b => b.time === param.time)
      if (idx === -1) { setHovered(null); return }
      const bar = sorted[idx]
      const sma20v = idx >= 19 ? closes.slice(idx - 19, idx + 1).reduce((a, b) => a + b, 0) / 20 : undefined
      const sma50v = idx >= 49 ? closes.slice(idx - 49, idx + 1).reduce((a, b) => a + b, 0) / 50 : undefined
      setHovered({ ...bar, sma20: sma20v, sma50: sma50v })
    })

    chart.timeScale().fitContent()

    const ro = new ResizeObserver(entries => {
      if (chartRef.current) chartRef.current.applyOptions({ width: entries[0].contentRect.width })
    })
    ro.observe(container)

    return () => {
      ro.disconnect()
      if (chartRef.current) {
        try { chartRef.current.remove() } catch {}
        chartRef.current = null
      }
    }
  }, [bars, chartType, showSMA20, showSMA50, showSMA200, showBB, showVolume, tf]) // eslint-disable-line react-hooks/exhaustive-deps

  const sorted = [...bars].sort((a, b) => a.time - b.time)
  const last  = sorted.length > 0 ? sorted[sorted.length - 1] : null
  const first = sorted.length > 0 ? sorted[0] : null
  const periodChange    = last && first ? last.close - first.open : null
  const periodChangePct = periodChange != null && first ? (periodChange / first.open) * 100 : null
  const display = hovered ?? last
  const isUp    = display ? display.close >= display.open : true

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Toolbar */}
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
            {CHART_TYPES.map(ct => (
              <button key={ct.key} onClick={() => setChartType(ct.key)} style={{
                padding: '3px 10px', fontFamily: mono, fontSize: 10, letterSpacing: 1,
                background: ct.key === chartType ? 'var(--bg3)' : 'transparent',
                color: ct.key === chartType ? 'var(--text)' : 'var(--text3)',
                border: 'none', cursor: 'pointer',
              }}>{ct.label}</button>
            ))}
          </div>
          {([
            { label: 'SMA20',  active: showSMA20,   color: '#F5A623', toggle: () => setShowSMA20(v => !v)   },
            { label: 'SMA50',  active: showSMA50,   color: '#5B8DEF', toggle: () => setShowSMA50(v => !v)   },
            { label: 'SMA200', active: showSMA200,  color: '#BF5AF2', toggle: () => setShowSMA200(v => !v)  },
            { label: 'BB',     active: showBB,      color: '#5B8DEF', toggle: () => setShowBB(v => !v)      },
            { label: 'VOL',    active: showVolume,  color: 'var(--text3)', toggle: () => setShowVolume(v => !v) },
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
        <div style={{ display: 'flex', gap: 16, padding: '4px 0 8px', fontFamily: mono, fontSize: 11, color: 'var(--text3)', flexWrap: 'wrap' }}>
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
          {showSMA20 && hovered?.sma20 != null && <span style={{ color: '#F5A623' }}>SMA20 ${hovered.sma20.toFixed(2)}</span>}
          {showSMA50 && hovered?.sma50 != null && <span style={{ color: '#5B8DEF' }}>SMA50 ${hovered.sma50.toFixed(2)}</span>}
          {!hovered && periodChange != null && (
            <span style={{ marginLeft: 'auto', color: periodChange >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
              {periodChange >= 0 ? '+' : ''}{periodChange.toFixed(2)} ({periodChangePct! >= 0 ? '+' : ''}{periodChangePct!.toFixed(2)}%) {tf}
            </span>
          )}
        </div>
      )}

      {/* Chart canvas */}
      <div style={{ position: 'relative', height: 400, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg2)', zIndex: 10, fontFamily: mono, fontSize: 12, color: 'var(--text3)', letterSpacing: 2 }}>
            LOADING CHART…
          </div>
        )}
        {error && !loading && bars.length === 0 && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg2)', zIndex: 10, fontFamily: mono, fontSize: 12, color: 'var(--text3)' }}>
            {error}
          </div>
        )}
        <div ref={containerRef} style={{ width: '100%', height: '100%', background: 'var(--bg2)' }} />
      </div>

      {/* Legend */}
      {bars.length > 0 && (
        <div style={{ display: 'flex', gap: 16, padding: '6px 0 0', fontFamily: mono, fontSize: 10, color: 'var(--text3)' }}>
          {showSMA20  && <span><span style={{ color: '#F5A623' }}>━</span> SMA 20</span>}
          {showSMA50  && <span><span style={{ color: '#5B8DEF' }}>━</span> SMA 50</span>}
          {showSMA200 && <span><span style={{ color: '#BF5AF2' }}>━</span> SMA 200</span>}
          {showBB     && <span><span style={{ color: '#5B8DEF' }}>╌</span> Bollinger Bands (20,2)</span>}
          {showVolume && <span>▬ Volume</span>}
        </div>
      )}
    </div>
  )
}
