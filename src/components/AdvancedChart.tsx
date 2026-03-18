'use client'
import { useEffect, useRef, useState, useCallback } from 'react'

const mono = 'IBM Plex Mono, monospace'

const TIMEFRAMES = ['1D', '5D', '1M', '3M', '6M', '1Y', '2Y', '5Y']
const CHART_TYPES = [
  { key: 'candlestick', label: 'Candle' },
  { key: 'line',        label: 'Line'   },
  { key: 'area',        label: 'Area'   },
]

interface Bar {
  time: number
  open: number
  high: number
  low: number
  close: number
  volume: number
}

interface Props {
  ticker: string
  initialBars?: Bar[]
}

function sma(data: number[], period: number): (number | null)[] {
  return data.map((_, i) => {
    if (i < period - 1) return null
    const slice = data.slice(i - period + 1, i + 1)
    return slice.reduce((a, b) => a + b, 0) / period
  })
}

function ema(data: number[], period: number): number[] {
  const k = 2 / (period + 1)
  const result: number[] = []
  data.forEach((v, i) => {
    if (i === 0) { result.push(v); return }
    result.push(v * k + result[i - 1] * (1 - k))
  })
  return result
}

function bollingerBands(closes: number[], period = 20, stdDev = 2) {
  return closes.map((_, i) => {
    if (i < period - 1) return null
    const slice = closes.slice(i - period + 1, i + 1)
    const mean  = slice.reduce((a, b) => a + b, 0) / period
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / period
    const sd = Math.sqrt(variance)
    return { upper: mean + stdDev * sd, middle: mean, lower: mean - stdDev * sd }
  })
}

export default function AdvancedChart({ ticker, initialBars }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const chartRef     = useRef<any>(null)
  const seriesRef    = useRef<any>(null)
  const volumeRef    = useRef<any>(null)
  const indicatorRefs = useRef<any[]>([])

  const [bars, setBars]         = useState<Bar[]>(initialBars ?? [])
  const [tf, setTf]             = useState('6M')
  const [chartType, setChartType] = useState('candlestick')
  const [loading, setLoading]   = useState(!initialBars || initialBars.length === 0)
  const [error, setError]       = useState<string | null>(null)
  const [showSMA20, setShowSMA20] = useState(true)
  const [showSMA50, setShowSMA50] = useState(true)
  const [showSMA200, setShowSMA200] = useState(false)
  const [showBB, setShowBB]     = useState(false)
  const [showVolume, setShowVolume] = useState(true)
  const [hovered, setHovered]   = useState<Bar & { sma20?: number; sma50?: number } | null>(null)

  const fetchBars = useCallback(async (timeframe: string) => {
    setLoading(true); setError(null)
    try {
      const res = await fetch(`/api/candles?ticker=${ticker}&tf=${timeframe}`)
      const json = await res.json()
      if (json.bars && json.bars.length > 0) {
        setBars(json.bars)
      } else {
        setError('No candle data available for this timeframe')
      }
    } catch {
      setError('Failed to load chart data')
    } finally {
      setLoading(false)
    }
  }, [ticker])

  // Load on mount if no initial bars, or when tf changes
  useEffect(() => {
    if (!initialBars || initialBars.length === 0) {
      fetchBars(tf)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    fetchBars(tf)
  }, [tf, ticker, fetchBars])

  // Build and render chart whenever bars/settings change
  useEffect(() => {
    if (bars.length === 0 || !containerRef.current) return

    let chart: any = null

    async function initChart() {
      const { createChart, CrosshairMode, LineStyle, PriceScaleMode } = await import('lightweight-charts')

      const el = containerRef.current!
      const h  = Math.max(380, el.clientHeight || 400)

      // Destroy previous chart
      if (chartRef.current) {
        chartRef.current.remove()
        chartRef.current = null
        seriesRef.current = null
        volumeRef.current = null
        indicatorRefs.current = []
      }

      chart = createChart(el, {
        width:  el.clientWidth,
        height: h,
        layout: {
          background:    { color: 'transparent' },
          textColor:     '#888888',
          fontFamily:    mono,
          fontSize:      11,
        },
        grid: {
          vertLines:   { color: 'rgba(255,255,255,0.04)' },
          horzLines:   { color: 'rgba(255,255,255,0.04)' },
        },
        crosshair: {
          mode: CrosshairMode.Normal,
          vertLine: {
            color: 'rgba(255,85,0,0.5)',
            width: 1,
            style: LineStyle.Dashed,
            labelBackgroundColor: '#FF5500',
          },
          horzLine: {
            color: 'rgba(255,85,0,0.5)',
            width: 1,
            style: LineStyle.Dashed,
            labelBackgroundColor: '#FF5500',
          },
        },
        rightPriceScale: {
          borderColor: '#1e2d42',
          scaleMargins: { top: 0.08, bottom: showVolume ? 0.22 : 0.06 },
        },
        timeScale: {
          borderColor:       '#1e2d42',
          timeVisible:       tf === '1D' || tf === '5D',
          secondsVisible:    false,
          rightOffset:       8,
          barSpacing:        bars.length > 200 ? 4 : bars.length > 60 ? 6 : 8,
          fixLeftEdge:       true,
          fixRightEdge:      true,
        },
      })

      chartRef.current = chart

      const positive = bars[bars.length - 1].close >= bars[0].close

      // ── Main series ──────────────────────────────────────────────────────
      let mainSeries: any

      if (chartType === 'candlestick') {
        mainSeries = chart.addCandlestickSeries({
          upColor:          '#00d97e',
          downColor:        '#ff4d4d',
          borderUpColor:    '#00d97e',
          borderDownColor:  '#ff4d4d',
          wickUpColor:      '#00d97e',
          wickDownColor:    '#ff4d4d',
        })
        mainSeries.setData(bars.map(b => ({
          time:  b.time,
          open:  b.open,
          high:  b.high,
          low:   b.low,
          close: b.close,
        })))
      } else if (chartType === 'area') {
        const color = positive ? '#00d97e' : '#ff4d4d'
        mainSeries = chart.addAreaSeries({
          lineColor:       color,
          topColor:        color + '33',
          bottomColor:     color + '00',
          lineWidth:       2,
          priceLineVisible: false,
        })
        mainSeries.setData(bars.map(b => ({ time: b.time, value: b.close })))
      } else {
        mainSeries = chart.addLineSeries({
          color:     positive ? '#00d97e' : '#ff4d4d',
          lineWidth: 2,
          priceLineVisible: false,
        })
        mainSeries.setData(bars.map(b => ({ time: b.time, value: b.close })))
      }
      seriesRef.current = mainSeries

      // ── Volume histogram ────────────────────────────────────────────────
      if (showVolume) {
        const volSeries = chart.addHistogramSeries({
          priceFormat:     { type: 'volume' },
          priceScaleId:    'volume',
          color:           '#253650',
        })
        volSeries.priceScale().applyOptions({
          scaleMargins: { top: 0.80, bottom: 0 },
        })
        volSeries.setData(bars.map(b => ({
          time:  b.time,
          value: b.volume,
          color: b.close >= b.open ? 'rgba(0,217,126,0.3)' : 'rgba(255,77,77,0.3)',
        })))
        volumeRef.current = volSeries
      }

      // ── Technical indicators ─────────────────────────────────────────────
      const closes = bars.map(b => b.close)
      const times  = bars.map(b => b.time)
      const indicators: any[] = []

      if (showSMA20) {
        const values = sma(closes, 20)
        const s = chart.addLineSeries({
          color: '#F5A623', lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
        })
        s.setData(values.map((v, i) => v != null ? { time: times[i], value: v } : null).filter(Boolean))
        indicators.push(s)
      }

      if (showSMA50) {
        const values = sma(closes, 50)
        const s = chart.addLineSeries({
          color: '#5B8DEF', lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
        })
        s.setData(values.map((v, i) => v != null ? { time: times[i], value: v } : null).filter(Boolean))
        indicators.push(s)
      }

      if (showSMA200) {
        const values = sma(closes, 200)
        const s = chart.addLineSeries({
          color: '#BF5AF2', lineWidth: 1, priceLineVisible: false, lastValueVisible: false,
        })
        s.setData(values.map((v, i) => v != null ? { time: times[i], value: v } : null).filter(Boolean))
        indicators.push(s)
      }

      if (showBB) {
        const bands = bollingerBands(closes)
        const upper = chart.addLineSeries({ color: 'rgba(91,141,239,0.5)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, lineStyle: 2 })
        const mid   = chart.addLineSeries({ color: 'rgba(91,141,239,0.3)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, lineStyle: 2 })
        const lower = chart.addLineSeries({ color: 'rgba(91,141,239,0.5)', lineWidth: 1, priceLineVisible: false, lastValueVisible: false, lineStyle: 2 })
        const validBands = bands.map((b, i) => b ? { time: times[i], upper: b.upper, middle: b.middle, lower: b.lower } : null).filter(Boolean) as any[]
        upper.setData(validBands.map(b => ({ time: b.time, value: b.upper })))
        mid.setData(validBands.map(b   => ({ time: b.time, value: b.middle })))
        lower.setData(validBands.map(b => ({ time: b.time, value: b.lower })))
        indicators.push(upper, mid, lower)
      }

      indicatorRefs.current = indicators

      // ── Crosshair OHLCV hover tooltip ────────────────────────────────────
      chart.subscribeCrosshairMove((param: any) => {
        if (!param || !param.time || !param.point) {
          setHovered(null); return
        }
        const idx = bars.findIndex(b => b.time === param.time)
        if (idx === -1) { setHovered(null); return }
        const bar = bars[idx]
        const closes20 = idx >= 19 ? closes.slice(idx - 19, idx + 1) : null
        const closes50 = idx >= 49 ? closes.slice(idx - 49, idx + 1) : null
        setHovered({
          ...bar,
          sma20: closes20 ? closes20.reduce((a, b) => a + b, 0) / 20 : undefined,
          sma50: closes50 ? closes50.reduce((a, b) => a + b, 0) / 50 : undefined,
        })
      })

      // Fit content
      chart.timeScale().fitContent()

      // Resize observer
      const ro = new ResizeObserver(entries => {
        const { width } = entries[0].contentRect
        chart.applyOptions({ width })
      })
      ro.observe(el)

      return () => { ro.disconnect() }
    }

    const cleanup = initChart()
    return () => { cleanup.then(fn => fn?.()) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [bars, chartType, showSMA20, showSMA50, showSMA200, showBB, showVolume, tf])

  const last = bars.length > 0 ? bars[bars.length - 1] : null
  const first = bars.length > 0 ? bars[0] : null
  const periodChange = last && first ? last.close - first.open : null
  const periodChangePct = periodChange && first ? (periodChange / first.open) * 100 : null

  const display = hovered ?? last
  const isUp = display ? display.close >= display.open : true

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* ── Toolbar ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 0 8px', flexWrap: 'wrap', gap: 8 }}>

        {/* Timeframe selector */}
        <div style={{ display: 'flex', gap: 2 }}>
          {TIMEFRAMES.map(t => (
            <button
              key={t}
              onClick={() => setTf(t)}
              style={{
                padding: '3px 9px', fontFamily: mono, fontSize: 11, letterSpacing: 1,
                background:  t === tf ? 'var(--accent)' : 'transparent',
                color:       t === tf ? '#000' : 'var(--text3)',
                border:      t === tf ? 'none' : '1px solid transparent',
                borderRadius: 3, cursor: 'pointer', fontWeight: t === tf ? 700 : 400,
              }}
            >{t}</button>
          ))}
        </div>

        {/* Chart type + indicator toggles */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
          {/* Chart type */}
          <div style={{ display: 'flex', border: '1px solid var(--border2)', borderRadius: 4, overflow: 'hidden' }}>
            {CHART_TYPES.map(ct => (
              <button
                key={ct.key}
                onClick={() => setChartType(ct.key)}
                style={{
                  padding: '3px 10px', fontFamily: mono, fontSize: 10, letterSpacing: 1,
                  background: ct.key === chartType ? 'var(--bg3)' : 'transparent',
                  color:      ct.key === chartType ? 'var(--text)' : 'var(--text3)',
                  border: 'none', cursor: 'pointer',
                }}
              >{ct.label}</button>
            ))}
          </div>

          {/* Indicator toggles */}
          {[
            { label: 'SMA20', active: showSMA20, color: '#F5A623', toggle: () => setShowSMA20(v => !v) },
            { label: 'SMA50', active: showSMA50, color: '#5B8DEF', toggle: () => setShowSMA50(v => !v) },
            { label: 'SMA200', active: showSMA200, color: '#BF5AF2', toggle: () => setShowSMA200(v => !v) },
            { label: 'BB',    active: showBB,   color: '#5B8DEF', toggle: () => setShowBB(v => !v) },
            { label: 'VOL',   active: showVolume, color: 'var(--text3)', toggle: () => setShowVolume(v => !v) },
          ].map(ind => (
            <button
              key={ind.label}
              onClick={ind.toggle}
              style={{
                padding: '3px 9px', fontFamily: mono, fontSize: 10, letterSpacing: 1,
                background:  ind.active ? 'rgba(255,255,255,0.06)' : 'transparent',
                color:       ind.active ? ind.color : 'var(--text4)',
                border:      `1px solid ${ind.active ? ind.color + '55' : 'var(--border)'}`,
                borderRadius: 3, cursor: 'pointer',
              }}
            >{ind.label}</button>
          ))}
        </div>
      </div>

      {/* ── OHLCV info bar ─────────────────────────────────────────────── */}
      {display && (
        <div style={{ display: 'flex', gap: 16, padding: '4px 0 8px', fontFamily: mono, fontSize: 11, color: 'var(--text3)', flexWrap: 'wrap' }}>
          <span style={{ color: 'var(--text2)', fontWeight: 700 }}>{ticker}</span>
          {chartType === 'candlestick' && (
            <>
              <span>O <span style={{ color: 'var(--text)' }}>${display.open?.toFixed(2)}</span></span>
              <span>H <span style={{ color: 'var(--green)' }}>${display.high?.toFixed(2)}</span></span>
              <span>L <span style={{ color: 'var(--red)' }}>${display.low?.toFixed(2)}</span></span>
            </>
          )}
          <span>C <span style={{ color: isUp ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>${display.close?.toFixed(2)}</span></span>
          {display.volume > 0 && <span>V <span style={{ color: 'var(--text2)' }}>{(display.volume / 1e6).toFixed(2)}M</span></span>}
          {showSMA20 && hovered?.sma20 && <span style={{ color: '#F5A623' }}>SMA20 ${hovered.sma20.toFixed(2)}</span>}
          {showSMA50 && hovered?.sma50 && <span style={{ color: '#5B8DEF' }}>SMA50 ${hovered.sma50.toFixed(2)}</span>}
          {!hovered && periodChange != null && (
            <span style={{ marginLeft: 'auto', color: periodChange >= 0 ? 'var(--green)' : 'var(--red)', fontWeight: 700 }}>
              {periodChange >= 0 ? '+' : ''}{periodChange.toFixed(2)} ({periodChangePct! >= 0 ? '+' : ''}{periodChangePct!.toFixed(2)}%) {tf}
            </span>
          )}
        </div>
      )}

      {/* ── Chart canvas ───────────────────────────────────────────────── */}
      <div style={{ position: 'relative', height: 400, borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border)' }}>
        {loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg2)', zIndex: 10, fontFamily: mono, fontSize: 12, color: 'var(--text3)', letterSpacing: 2 }}>
            LOADING CHART…
          </div>
        )}
        {error && !loading && (
          <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg2)', zIndex: 10, fontFamily: mono, fontSize: 12, color: 'var(--text3)' }}>
            {error}
          </div>
        )}
        <div ref={containerRef} style={{ width: '100%', height: '100%', background: 'var(--bg2)' }} />
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 16, padding: '6px 0 0', fontFamily: mono, fontSize: 10, color: 'var(--text3)' }}>
        {showSMA20  && <span><span style={{ color: '#F5A623' }}>━</span> SMA 20</span>}
        {showSMA50  && <span><span style={{ color: '#5B8DEF' }}>━</span> SMA 50</span>}
        {showSMA200 && <span><span style={{ color: '#BF5AF2' }}>━</span> SMA 200</span>}
        {showBB     && <span><span style={{ color: '#5B8DEF' }}>╌</span> Bollinger Bands (20, 2)</span>}
        {showVolume && <span>▬ Volume</span>}
      </div>
    </div>
  )
}
