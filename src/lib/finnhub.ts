const BASE = 'https://finnhub.io/api/v1'
const KEY  = process.env.FINNHUB_API_KEY || ''

async function get(path: string) {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${BASE}${path}${sep}token=${KEY}`, {
    next: { revalidate: 0 },
    headers: { 'Accept': 'application/json' },
  })
  if (!res.ok) throw new Error(`Finnhub ${res.status}: ${path}`)
  return res.json()
}

export async function getQuote(ticker: string) {
  // Real-time quote: c=current, pc=prev close, d=change, dp=change%
  return get(`/quote?symbol=${ticker.toUpperCase()}`)
}

export async function getProfile(ticker: string) {
  // Company profile: name, sector, industry, employees, market cap, logo, website
  return get(`/stock/profile2?symbol=${ticker.toUpperCase()}`)
}

export async function getMetrics(ticker: string) {
  // Key metrics: PE, EPS, revenue growth, profit margin, beta, 52w high/low, dividend yield
  return get(`/stock/metric?symbol=${ticker.toUpperCase()}&metric=all`)
}

export async function getCandles(ticker: string, days = 400) {
  const to   = Math.floor(Date.now() / 1000)
  const from = to - days * 24 * 60 * 60
  return get(`/stock/candle?symbol=${ticker.toUpperCase()}&resolution=D&from=${from}&to=${to}`)
}

export async function getNews(ticker: string) {
  const to   = new Date().toISOString().split('T')[0]
  const from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  return get(`/company-news?symbol=${ticker.toUpperCase()}&from=${from}&to=${to}`)
}

export async function searchTickers(query: string) {
  const data = await get(`/search?q=${encodeURIComponent(query)}`)
  return (data?.result ?? [])
    .filter((r: any) => r.type === 'Common Stock' || r.type === 'ETP')
    .slice(0, 8)
    .map((r: any) => ({
      ticker:   r.symbol,
      name:     r.description,
      exchange: r.primaryExchange ?? '',
      type:     r.type,
    }))
}

export async function getMultiQuotes(tickers: string[]) {
  const results = await Promise.allSettled(
    tickers.map(t => getQuote(t).then(q => ({ sym: t, ...q })))
  )
  return results
    .filter(r => r.status === 'fulfilled')
    .map((r: any) => ({
      sym:       r.value.sym,
      price:     r.value.c ?? 0,
      changePct: r.value.dp ?? 0,
    }))
}

export function computeMoatScore(marketCap: number|null, margin: number|null): number {
  let s = 50
  if (marketCap) {
    if (marketCap > 1e12)      s += 25
    else if (marketCap > 1e11) s += 15
    else if (marketCap > 1e10) s += 8
  }
  if (margin) {
    if (margin > 25)      s += 20
    else if (margin > 15) s += 12
    else if (margin > 5)  s += 5
    else if (margin < 0)  s -= 10
  }
  return Math.min(99, Math.max(10, s))
}

export function computeGrowthScore(revGrowth: number|null, mom1y: number|null): number {
  let s = 50
  // TTM revenue growth (from Finnhub metric, in percentage points e.g. 20 = 20%)
  if (revGrowth != null) {
    if (revGrowth > 30)      s += 25
    else if (revGrowth > 15) s += 15
    else if (revGrowth > 5)  s += 8
    else if (revGrowth < 0)  s -= 15
  }
  // 1-year price momentum (in percentage points e.g. 50 = +50%)
  if (mom1y != null) {
    if (mom1y > 100)      s += 20
    else if (mom1y > 50)  s += 12
    else if (mom1y > 20)  s += 6
    else if (mom1y < -20) s -= 12
    else if (mom1y < 0)   s -= 5
  }
  return Math.min(99, Math.max(10, s))
}

// ── Extended endpoints for quant terminal ───────────────────────────────────

export async function getRecommendations(ticker: string) {
  return get(`/stock/recommendation?symbol=${ticker.toUpperCase()}`)
}

export async function getEarnings(ticker: string) {
  return get(`/stock/earnings?symbol=${ticker.toUpperCase()}&limit=8`)
}

export async function getInsiders(ticker: string) {
  return get(`/stock/insider-transactions?symbol=${ticker.toUpperCase()}`)
}

export async function getPeers(ticker: string) {
  return get(`/stock/peers?symbol=${ticker.toUpperCase()}`)
}

export async function getEarningsCalendar(ticker: string) {
  const from = new Date().toISOString().split('T')[0]
  const to   = new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
  return get(`/calendar/earnings?symbol=${ticker.toUpperCase()}&from=${from}&to=${to}`)
}

// ── Hedge-fund grade quant signals ─────────────────────────────────────────
export function computeQuantSignals(candles: { t: number; c: number; o?: number; h?: number; l?: number; v?: number }[]) {
  if (!candles || candles.length < 20) return null
  const closes = candles.map(c => c.c).filter(v => v > 0)
  if (closes.length < 20) return null

  const highs = candles.map(c => c.h ?? c.c)
  const lows  = candles.map(c => c.l ?? c.c)
  const vols  = candles.map(c => c.v ?? 0)
  const n     = closes.length
  const last  = closes[n - 1]

  const smaLast = (arr: number[], p: number) => {
    if (arr.length < p) return null
    return arr.slice(-p).reduce((a, b) => a + b, 0) / p
  }
  const ema = (arr: number[], p: number) => {
    const k = 2 / (p + 1); let e = arr[0]
    for (let i = 1; i < arr.length; i++) e = arr[i] * k + e * (1 - k)
    return e
  }

  // ── Moving averages ──
  const sma20  = smaLast(closes, 20)
  const sma50  = smaLast(closes, 50)
  const sma200 = smaLast(closes, 200)
  const goldenCross = sma50 != null && sma200 != null && sma50 > sma200
  const deathCross  = sma50 != null && sma200 != null && sma50 < sma200

  // ── RSI (14) ──
  let gains = 0, losses = 0
  for (let i = n - 14; i < n; i++) {
    const d = closes[i] - closes[i - 1]
    if (d > 0) gains += d; else losses -= d
  }
  const rsi = 100 - (100 / (1 + (losses === 0 ? 100 : gains / losses)))

  // ── MACD (12,26,9) ──
  const macdSeries = closes.map((_, i, arr) => {
    if (i < 25) return null
    return ema(arr.slice(0, i + 1), 12) - ema(arr.slice(0, i + 1), 26)
  }).filter((v): v is number => v !== null)
  const macd       = macdSeries[macdSeries.length - 1]
  const macdSignal = ema(macdSeries, 9)
  const macdHist   = macd - macdSignal
  const macdCrossBull = macdSeries.length >= 2 && macdSeries[macdSeries.length - 2] < macdSignal && macd > macdSignal
  const macdCrossBear = macdSeries.length >= 2 && macdSeries[macdSeries.length - 2] > macdSignal && macd < macdSignal

  // ── Bollinger Bands (20, 2) ──
  const bbMean   = sma20!
  const bbStd    = Math.sqrt(closes.slice(-20).reduce((a, b) => a + (b - bbMean) ** 2, 0) / 20)
  const bbUpper  = bbMean + 2 * bbStd
  const bbLower  = bbMean - 2 * bbStd
  const bbPos    = bbUpper !== bbLower ? (last - bbLower) / (bbUpper - bbLower) : 0.5
  const bbWidth  = (bbUpper - bbLower) / bbMean * 100   // squeeze: low = tight

  // ── Stochastic %K/%D (14-period) ──
  const stochHigh = Math.max(...highs.slice(-14))
  const stochLow  = Math.min(...lows.slice(-14))
  const stochK    = stochHigh !== stochLow ? (last - stochLow) / (stochHigh - stochLow) * 100 : 50
  const kArr = [-2, -1, 0].map(off => {
    const idx = n - 1 + off
    if (idx < 13) return 50
    const sh = Math.max(...highs.slice(idx - 13, idx + 1))
    const sl = Math.min(...lows.slice(idx - 13, idx + 1))
    return sh !== sl ? (closes[idx] - sl) / (sh - sl) * 100 : 50
  })
  const stochD = kArr.reduce((a, b) => a + b, 0) / 3

  // ── ATR (14-period) ──
  const trArr: number[] = []
  for (let i = Math.max(1, n - 14); i < n; i++) {
    trArr.push(Math.max(highs[i] - lows[i], Math.abs(highs[i] - closes[i-1]), Math.abs(lows[i] - closes[i-1])))
  }
  const atr14 = trArr.reduce((a, b) => a + b, 0) / trArr.length
  const atrPct = (atr14 / last) * 100

  // ── Historical Volatility (20d annualized) ──
  const logRet: number[] = []
  for (let i = Math.max(1, n - 20); i < n; i++) logRet.push(Math.log(closes[i] / closes[i - 1]))
  const meanR = logRet.reduce((a, b) => a + b, 0) / logRet.length
  const hv20  = Math.sqrt(logRet.reduce((a, b) => a + (b - meanR) ** 2, 0) / logRet.length * 252) * 100

  // ── Max Drawdown (252d) ──
  const w252 = closes.slice(-252)
  let peak = w252[0], maxDD = 0
  for (const p of w252) { if (p > peak) peak = p; const d = (peak - p) / peak * 100; if (d > maxDD) maxDD = d }

  // ── OBV trend (20d net vs prior 20d) ──
  let obv20 = 0, obvPrev = 0
  for (let i = Math.max(1, n - 20); i < n; i++) {
    if (closes[i] > closes[i-1]) obv20 += vols[i]; else if (closes[i] < closes[i-1]) obv20 -= vols[i]
  }
  for (let i = Math.max(1, n - 40); i < n - 20; i++) {
    if (closes[i] > closes[i-1]) obvPrev += vols[i]; else if (closes[i] < closes[i-1]) obvPrev -= vols[i]
  }
  const obvTrend = obv20 > obvPrev ? 'bullish' : obv20 < obvPrev ? 'bearish' : 'neutral'

  // ── Volume trend ──
  const vol5avg  = smaLast(vols, 5)  ?? 1
  const vol20avg = smaLast(vols, 20) ?? 1
  const volTrend = (vol5avg / vol20avg - 1) * 100

  // ── 52-week range ──
  const high52 = Math.max(...closes.slice(-252))
  const low52  = Math.min(...closes.slice(-252))
  const pos52w = high52 !== low52 ? (last - low52) / (high52 - low52) * 100 : 50

  // ── Z-score (20d) ──
  const zScore = bbStd !== 0 ? (last - bbMean) / bbStd : 0

  // ── Momentum ──
  const mom1w  = n >= 6   ? (last / closes[n - 6]   - 1) * 100 : null
  const mom1m  = n >= 21  ? (last / closes[n - 21]  - 1) * 100 : null
  const mom3m  = n >= 63  ? (last / closes[n - 63]  - 1) * 100 : null
  const mom6m  = n >= 126 ? (last / closes[n - 126] - 1) * 100 : null
  const mom1y  = n >= 252 ? (last / closes[n - 252] - 1) * 100 : null

  // ── Composite Scores (0–100) ──
  // Trend Score: price vs SMAs + golden/death cross + MACD
  let trendScore = 0
  if (sma20 && last > sma20)  trendScore += 20
  if (sma50 && last > sma50)  trendScore += 20
  if (sma200 && last > sma200) trendScore += 20
  if (goldenCross)             trendScore += 20
  if (macd > 0)                trendScore += 20

  // Momentum Score
  let momScore = 50
  if (mom1m != null)  momScore += mom1m > 5 ? 10 : mom1m > 0 ? 5 : mom1m < -5 ? -10 : -5
  if (mom3m != null)  momScore += mom3m > 10 ? 15 : mom3m > 0 ? 8 : mom3m < -10 ? -15 : -8
  if (mom6m != null)  momScore += mom6m > 20 ? 15 : mom6m > 0 ? 8 : mom6m < -20 ? -15 : -8
  if (mom1y != null)  momScore += mom1y > 30 ? 15 : mom1y > 0 ? 8 : mom1y < -30 ? -15 : -8
  momScore = Math.min(100, Math.max(0, momScore))

  // Mean Reversion Score (high = oversold = opportunity)
  let mrScore = 50
  mrScore += rsi < 30 ? 25 : rsi < 40 ? 12 : rsi > 70 ? -25 : rsi > 60 ? -12 : 0
  mrScore += stochK < 20 ? 15 : stochK < 40 ? 8 : stochK > 80 ? -15 : stochK > 60 ? -8 : 0
  mrScore += bbPos < 0.2 ? 10 : bbPos > 0.8 ? -10 : 0
  mrScore = Math.min(100, Math.max(0, mrScore))

  // Risk Score (high = lower risk)
  let riskScore = 50
  riskScore += hv20 < 15 ? 20 : hv20 < 25 ? 10 : hv20 < 40 ? 0 : hv20 < 60 ? -15 : -25
  riskScore += maxDD < 10 ? 20 : maxDD < 20 ? 10 : maxDD < 35 ? 0 : maxDD < 50 ? -15 : -25
  riskScore = Math.min(100, Math.max(0, riskScore))

  // Overall signal
  const overallScore = (trendScore * 0.4 + momScore * 0.4 + mrScore * 0.1 + riskScore * 0.1)
  let trend: 'STRONG BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG SELL' = 'NEUTRAL'
  if (overallScore >= 75)      trend = 'STRONG BUY'
  else if (overallScore >= 58) trend = 'BUY'
  else if (overallScore >= 42) trend = 'NEUTRAL'
  else if (overallScore >= 28) trend = 'SELL'
  else                          trend = 'STRONG SELL'

  return {
    trend, trendScore,
    sma20:  sma20  ? +sma20.toFixed(2)  : null,
    sma50:  sma50  ? +sma50.toFixed(2)  : null,
    sma200: sma200 ? +sma200.toFixed(2) : null,
    goldenCross, deathCross,
    rsi: +rsi.toFixed(1),
    stochK: +stochK.toFixed(1), stochD: +stochD.toFixed(1),
    macd: +macd.toFixed(3), macdSignal: +macdSignal.toFixed(3),
    macdHist: +macdHist.toFixed(3), macdCrossBull, macdCrossBear,
    bbUpper: +bbUpper.toFixed(2), bbLower: +bbLower.toFixed(2),
    bbPosition: +bbPos.toFixed(3), bbWidth: +bbWidth.toFixed(2),
    hv20: +hv20.toFixed(1), atr14: +atr14.toFixed(2), atrPct: +atrPct.toFixed(2),
    maxDrawdown252: +maxDD.toFixed(1),
    volumeTrend: +volTrend.toFixed(1), obvTrend,
    pos52w: +pos52w.toFixed(1),
    zScore: +zScore.toFixed(2),
    momentum: { m1w: mom1w, m1: mom1m, m3: mom3m, m6: mom6m, m1y: mom1y },
    scores: {
      trend: trendScore,
      momentum: +momScore.toFixed(0),
      meanReversion: +mrScore.toFixed(0),
      risk: +riskScore.toFixed(0),
    },
  }
}
