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

// Compute quant signals from candle data
export function computeQuantSignals(candles: { t: number; c: number; h?: number; l?: number; v?: number }[]) {
  if (!candles || candles.length < 20) return null
  const closes = candles.map(c => c.c).filter(v => v > 0)
  if (closes.length < 20) return null
  const vols   = candles.map(c => c.v ?? 0)
  const n      = closes.length
  const last   = closes[n - 1]

  // Simple Moving Averages
  const sma = (arr: number[], period: number) => {
    if (arr.length < period) return null
    return arr.slice(-period).reduce((a, b) => a + b, 0) / period
  }

  const sma20  = sma(closes, 20)
  const sma50  = sma(closes, 50)
  const sma200 = sma(closes, 200)

  // RSI (14-period)
  const rsiPeriod = 14
  let gains = 0, losses = 0
  for (let i = n - rsiPeriod; i < n; i++) {
    const diff = closes[i] - closes[i - 1]
    if (diff > 0) gains += diff
    else losses -= diff
  }
  const avgGain = gains / rsiPeriod
  const avgLoss = losses / rsiPeriod
  const rs  = avgLoss === 0 ? 100 : avgGain / avgLoss
  const rsi = 100 - (100 / (1 + rs))

  // MACD (12, 26, 9)
  const ema = (arr: number[], period: number) => {
    const k = 2 / (period + 1)
    let e = arr[0]
    for (let i = 1; i < arr.length; i++) e = arr[i] * k + e * (1 - k)
    return e
  }
  // Compute per-bar MACD values, then 9-period EMA of those for the signal line
  const macdSeries = closes.map((_, i, arr) => {
    if (i < 25) return null
    return ema(arr.slice(0, i + 1), 12) - ema(arr.slice(0, i + 1), 26)
  }).filter((v): v is number => v !== null)
  const macd   = macdSeries[macdSeries.length - 1]
  const signal = ema(macdSeries, 9)

  // Bollinger Bands (20, 2)
  const mean = sma20!
  const stdDev = Math.sqrt(closes.slice(-20).reduce((a, b) => a + Math.pow(b - mean, 2), 0) / 20)
  const bbUpper = mean + 2 * stdDev
  const bbLower = mean - 2 * stdDev
  const bbPos   = (last - bbLower) / (bbUpper - bbLower) // 0=at lower, 1=at upper

  // Volume trend (20d avg vs 5d avg)
  const vol20 = sma(vols, 20) ?? 1
  const vol5  = sma(vols, 5)  ?? 1
  const volTrend = (vol5 / vol20 - 1) * 100

  // 52W positioning
  const high52 = Math.max(...closes.slice(-252))
  const low52  = Math.min(...closes.slice(-252))
  const pos52w = (last - low52) / (high52 - low52) * 100

  // Mean reversion z-score (20d)
  const zScore = (last - mean) / stdDev

  // Momentum scores
  const mom1m  = closes.length >= 21  ? (last / closes[n - 21]  - 1) * 100 : null
  const mom3m  = closes.length >= 63  ? (last / closes[n - 63]  - 1) * 100 : null
  const mom6m  = closes.length >= 126 ? (last / closes[n - 126] - 1) * 100 : null
  const mom1y  = closes.length >= 252 ? (last / closes[n - 252] - 1) * 100 : null

  // Trend signal
  let trend: 'STRONG BUY' | 'BUY' | 'NEUTRAL' | 'SELL' | 'STRONG SELL' = 'NEUTRAL'
  let trendScore = 0
  if (sma20 && last > sma20) trendScore++
  if (sma50 && last > sma50) trendScore++
  if (sma200 && last > sma200) trendScore++
  if (rsi > 50) trendScore++
  if (macd > 0) trendScore++
  if (trendScore >= 5) trend = 'STRONG BUY'
  else if (trendScore >= 4) trend = 'BUY'
  else if (trendScore >= 3) trend = 'NEUTRAL'
  else if (trendScore >= 2) trend = 'SELL'
  else trend = 'STRONG SELL'

  return {
    sma20: sma20 ? +sma20.toFixed(2) : null,
    sma50: sma50 ? +sma50.toFixed(2) : null,
    sma200: sma200 ? +sma200.toFixed(2) : null,
    rsi: +rsi.toFixed(1),
    macd: +macd.toFixed(3),
    macdSignal: +signal.toFixed(3),
    bbUpper: +bbUpper.toFixed(2),
    bbLower: +bbLower.toFixed(2),
    bbPosition: +bbPos.toFixed(3),
    volumeTrend: +volTrend.toFixed(1),
    pos52w: +pos52w.toFixed(1),
    zScore: +zScore.toFixed(2),
    momentum: { m1: mom1m, m3: mom3m, m6: mom6m, m1y: mom1y },
    trend,
    trendScore,
  }
}
