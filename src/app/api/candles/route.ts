import { NextRequest, NextResponse } from 'next/server'

const BASE = 'https://finnhub.io/api/v1'
const KEY  = process.env.FINNHUB_API_KEY || ''

interface Bar { time: number; open: number; high: number; low: number; close: number; volume: number }

async function finnhubCandles(ticker: string, resolution: string, from: number, to: number): Promise<Bar[]> {
  const url = `${BASE}/stock/candle?symbol=${ticker}&resolution=${resolution}&from=${from}&to=${to}&token=${KEY}`
  const res = await fetch(url, { next: { revalidate: 0 }, headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`Finnhub ${res.status}`)
  const cd = await res.json()
  if (cd?.s !== 'ok' || !Array.isArray(cd.t) || cd.t.length === 0) return []
  return cd.t.map((ts: number, i: number) => ({
    time:   ts,
    open:   cd.o?.[i] ?? cd.c?.[i] ?? 0,
    high:   cd.h?.[i] ?? cd.c?.[i] ?? 0,
    low:    cd.l?.[i] ?? cd.c?.[i] ?? 0,
    close:  cd.c?.[i] ?? 0,
    volume: cd.v?.[i] ?? 0,
  })).filter((b: Bar) => b.close > 0)
}

// Yahoo Finance — free, no key, reliable server-side
const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Accept': 'application/json',
}

async function yahooCandles(ticker: string, range: string, interval: string): Promise<Bar[]> {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=${range}&interval=${interval}&includePrePost=false`
  const res = await fetch(url, { headers: YAHOO_HEADERS, next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`Yahoo ${res.status}`)
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) throw new Error('No Yahoo result')
  const ts    = result.timestamp ?? []
  const quote = result.indicators?.quote?.[0] ?? {}
  return ts.map((t: number, i: number) => ({
    time:   t,
    open:   quote.open?.[i]   ?? quote.close?.[i] ?? 0,
    high:   quote.high?.[i]   ?? quote.close?.[i] ?? 0,
    low:    quote.low?.[i]    ?? quote.close?.[i] ?? 0,
    close:  quote.close?.[i]  ?? 0,
    volume: quote.volume?.[i] ?? 0,
  })).filter((b: Bar) => b.close > 0)
}

const TIMEFRAMES: Record<string, { resolution: string; days: number; yahooRange: string; yahooInterval: string }> = {
  '1D':  { resolution: '5',  days: 1,    yahooRange: '1d',  yahooInterval: '5m'  },
  '5D':  { resolution: '15', days: 5,    yahooRange: '5d',  yahooInterval: '15m' },
  '1M':  { resolution: '60', days: 35,   yahooRange: '1mo', yahooInterval: '60m' },
  '3M':  { resolution: 'D',  days: 95,   yahooRange: '3mo', yahooInterval: '1d'  },
  '6M':  { resolution: 'D',  days: 185,  yahooRange: '6mo', yahooInterval: '1d'  },
  '1Y':  { resolution: 'D',  days: 370,  yahooRange: '1y',  yahooInterval: '1d'  },
  '2Y':  { resolution: 'W',  days: 740,  yahooRange: '2y',  yahooInterval: '1wk' },
  '5Y':  { resolution: 'W',  days: 1830, yahooRange: '5y',  yahooInterval: '1wk' },
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')
  const tf     = req.nextUrl.searchParams.get('tf') || '1Y'
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  const t   = ticker.toUpperCase()
  const cfg = TIMEFRAMES[tf] ?? TIMEFRAMES['1Y']
  const to  = Math.floor(Date.now() / 1000)
  const from = to - cfg.days * 24 * 60 * 60

  let bars: Bar[] = []
  let source = 'none'

  // Try Finnhub first
  try {
    bars = await finnhubCandles(t, cfg.resolution, from, to)
    if (bars.length > 0) source = 'finnhub'
  } catch (e: any) {
    console.log(`[candles/${t}] Finnhub failed: ${e.message}`)
  }

  // Yahoo Finance fallback
  if (bars.length === 0) {
    try {
      bars = await yahooCandles(t, cfg.yahooRange, cfg.yahooInterval)
      if (bars.length > 0) source = 'yahoo'
    } catch (e: any) {
      console.log(`[candles/${t}] Yahoo failed: ${e.message}`)
    }
  }

  return NextResponse.json({ bars, tf, resolution: cfg.resolution, source })
}
