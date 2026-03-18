import { NextRequest, NextResponse } from 'next/server'

const BASE = 'https://finnhub.io/api/v1'
const KEY  = process.env.FINNHUB_API_KEY || ''

async function finnhubGet(path: string) {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${BASE}${path}${sep}token=${KEY}`, {
    next: { revalidate: 0 },
    headers: { 'Accept': 'application/json' },
  })
  if (!res.ok) throw new Error(`Finnhub ${res.status}`)
  return res.json()
}

// Stooq fallback — free, no key, returns daily/weekly CSV for US stocks
async function stooqCandles(ticker: string, days: number, weekly = false): Promise<Bar[]> {
  const sym  = ticker.toLowerCase().replace(/[^a-z0-9]/g, '') + '.us'
  const to   = new Date()
  const from = new Date(Date.now() - days * 24 * 60 * 60 * 1000)
  const d1   = from.toISOString().split('T')[0].replace(/-/g, '')
  const d2   = to.toISOString().split('T')[0].replace(/-/g, '')
  const intv = weekly ? 'w' : 'd'
  const url  = `https://stooq.com/q/d/l/?s=${sym}&d1=${d1}&d2=${d2}&i=${intv}`

  const res = await fetch(url, { next: { revalidate: 3600 }, headers: { 'User-Agent': 'Mozilla/5.0' } })
  if (!res.ok) throw new Error(`Stooq ${res.status}`)
  const csv = await res.text()

  // CSV: Date,Open,High,Low,Close,Volume
  const lines = csv.trim().split('\n')
  if (lines.length < 2) return []

  const bars: Bar[] = []
  for (let i = 1; i < lines.length; i++) {
    const parts = lines[i].split(',')
    if (parts.length < 5) continue
    const [dateStr, open, high, low, close, vol] = parts
    const t  = Math.floor(new Date(dateStr).getTime() / 1000)
    const c  = parseFloat(close)
    if (!t || !c || c <= 0) continue
    bars.push({
      time:   t,
      open:   parseFloat(open)  || c,
      high:   parseFloat(high)  || c,
      low:    parseFloat(low)   || c,
      close:  c,
      volume: parseInt(vol ?? '0') || 0,
    })
  }
  // Stooq returns newest-first — reverse to chronological
  return bars.reverse()
}

interface Bar { time: number; open: number; high: number; low: number; close: number; volume: number }

// Timeframe config
const TIMEFRAMES: Record<string, { resolution: string; days: number; weekly?: boolean }> = {
  '1D':  { resolution: '5',  days: 1    },
  '5D':  { resolution: '15', days: 5    },
  '1M':  { resolution: '60', days: 35   },
  '3M':  { resolution: 'D',  days: 95   },
  '6M':  { resolution: 'D',  days: 185  },
  '1Y':  { resolution: 'D',  days: 370  },
  '2Y':  { resolution: 'W',  days: 740,  weekly: true },
  '5Y':  { resolution: 'W',  days: 1830, weekly: true },
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')
  const tf     = req.nextUrl.searchParams.get('tf') || '1Y'
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })

  const t   = ticker.toUpperCase()
  const cfg = TIMEFRAMES[tf] ?? TIMEFRAMES['1Y']
  const to  = Math.floor(Date.now() / 1000)
  const from = to - cfg.days * 24 * 60 * 60

  // For intraday timeframes (1D, 5D, 1M) Finnhub is the only option;
  // for daily/weekly also try Stooq as primary or fallback
  let bars: Bar[] = []

  try {
    const cd = await finnhubGet(
      `/stock/candle?symbol=${t}&resolution=${cfg.resolution}&from=${from}&to=${to}`
    )
    if (cd?.s === 'ok' && Array.isArray(cd.t) && cd.t.length > 0) {
      bars = cd.t.map((ts: number, i: number) => ({
        time:   ts,
        open:   cd.o?.[i] ?? cd.c?.[i] ?? 0,
        high:   cd.h?.[i] ?? cd.c?.[i] ?? 0,
        low:    cd.l?.[i] ?? cd.c?.[i] ?? 0,
        close:  cd.c?.[i] ?? 0,
        volume: cd.v?.[i] ?? 0,
      })).filter((b: Bar) => b.close > 0)
    }
  } catch {
    // Finnhub failed — fall through to Stooq
  }

  // Stooq fallback for daily/weekly timeframes
  if (bars.length === 0 && !['1D', '5D', '1M'].includes(tf)) {
    try {
      bars = await stooqCandles(t, cfg.days, cfg.weekly)
    } catch (e: any) {
      console.error(`[candles] Stooq failed for ${t}:`, e.message)
    }
  }

  return NextResponse.json({ bars, tf, resolution: cfg.resolution, source: bars.length ? 'ok' : 'empty' })
}
