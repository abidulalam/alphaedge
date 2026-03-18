import { NextRequest, NextResponse } from 'next/server'

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

// Timeframe config: resolution + lookback days
const TIMEFRAMES: Record<string, { resolution: string; days: number }> = {
  '1D':  { resolution: '5',  days: 1   },   // 5-min bars, 1 day
  '5D':  { resolution: '15', days: 5   },   // 15-min bars, 5 days
  '1M':  { resolution: '60', days: 35  },   // 1-hour bars, 1 month
  '3M':  { resolution: 'D',  days: 95  },   // daily, 3 months
  '6M':  { resolution: 'D',  days: 185 },   // daily, 6 months
  '1Y':  { resolution: 'D',  days: 370 },   // daily, 1 year
  '2Y':  { resolution: 'W',  days: 740 },   // weekly, 2 years
  '5Y':  { resolution: 'W',  days: 1830 },  // weekly, 5 years
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')
  const tf     = req.nextUrl.searchParams.get('tf') || '6M'

  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  const cfg = TIMEFRAMES[tf] ?? TIMEFRAMES['6M']
  const to   = Math.floor(Date.now() / 1000)
  const from = to - cfg.days * 24 * 60 * 60

  try {
    const cd = await get(`/stock/candle?symbol=${ticker.toUpperCase()}&resolution=${cfg.resolution}&from=${from}&to=${to}`)

    if (!cd || cd.s !== 'ok' || !Array.isArray(cd.t) || cd.t.length === 0) {
      return NextResponse.json({ bars: [], tf })
    }

    const bars = cd.t.map((ts: number, i: number) => ({
      time:  ts,            // unix seconds (lightweight-charts expects seconds)
      open:  cd.o?.[i] ?? cd.c?.[i] ?? 0,
      high:  cd.h?.[i] ?? cd.c?.[i] ?? 0,
      low:   cd.l?.[i] ?? cd.c?.[i] ?? 0,
      close: cd.c?.[i] ?? 0,
      volume: cd.v?.[i] ?? 0,
    })).filter((b: any) => b.close > 0)

    return NextResponse.json({ bars, tf, resolution: cfg.resolution })
  } catch (e: any) {
    return NextResponse.json({ error: e.message, bars: [] }, { status: 500 })
  }
}
