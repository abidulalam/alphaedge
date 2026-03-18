import { NextResponse } from 'next/server'
import { getMultiQuotes } from '@/lib/finnhub'

const BASE = 'https://finnhub.io/api/v1'
const KEY  = process.env.FINNHUB_API_KEY || ''
async function get(path: string) {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${BASE}${path}${sep}token=${KEY}`, {
    next: { revalidate: 60 },
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Finnhub ${res.status}`)
  return res.json()
}

const INDICES: { sym: string; name: string }[] = [
  { sym: 'SPY',  name: 'S&P 500' },
  { sym: 'QQQ',  name: 'Nasdaq 100' },
  { sym: 'DIA',  name: 'Dow Jones' },
  { sym: 'IWM',  name: 'Russell 2000' },
  { sym: 'VIX',  name: 'VIX' },
]

const SECTORS: { sym: string; name: string }[] = [
  { sym: 'XLK',  name: 'Technology' },
  { sym: 'XLF',  name: 'Financials' },
  { sym: 'XLE',  name: 'Energy' },
  { sym: 'XLV',  name: 'Healthcare' },
  { sym: 'XLY',  name: 'Cons. Disc.' },
  { sym: 'XLP',  name: 'Cons. Staples' },
  { sym: 'XLI',  name: 'Industrials' },
  { sym: 'XLB',  name: 'Materials' },
  { sym: 'XLU',  name: 'Utilities' },
  { sym: 'XLRE', name: 'Real Estate' },
  { sym: 'XLC',  name: 'Comm. Services' },
]

const COMMODITIES: { sym: string; name: string }[] = [
  { sym: 'GLD',  name: 'Gold' },
  { sym: 'USO',  name: 'Crude Oil' },
  { sym: 'SLV',  name: 'Silver' },
  { sym: 'UNG',  name: 'Nat. Gas' },
  { sym: 'PDBC', name: 'Commodities' },
]

const MOVERS = [
  'NVDA','AAPL','MSFT','TSLA','META','GOOGL','AMZN',
  'AMD','NFLX','JPM','V','ORCL','AVGO','LLY','UNH','XOM',
]

const FX_PAIRS: { sym: string; label: string; base: string; quote: string }[] = [
  { sym: 'OANDA:EUR_USD', label: 'EUR/USD', base: 'EUR', quote: 'USD' },
  { sym: 'OANDA:GBP_USD', label: 'GBP/USD', base: 'GBP', quote: 'USD' },
  { sym: 'OANDA:USD_JPY', label: 'USD/JPY', base: 'USD', quote: 'JPY' },
  { sym: 'OANDA:USD_CHF', label: 'USD/CHF', base: 'USD', quote: 'CHF' },
  { sym: 'OANDA:AUD_USD', label: 'AUD/USD', base: 'AUD', quote: 'USD' },
  { sym: 'OANDA:USD_CAD', label: 'USD/CAD', base: 'USD', quote: 'CAD' },
]

export async function GET() {
  try {
    const [indicesQ, sectorsQ, commoditiesQ, moversQ] = await Promise.all([
      getMultiQuotes(INDICES.map(i => i.sym)),
      getMultiQuotes(SECTORS.map(s => s.sym)),
      getMultiQuotes(COMMODITIES.map(c => c.sym)),
      getMultiQuotes(MOVERS),
    ])

    // FX — fetch each pair quote
    const fxResults = await Promise.allSettled(
      FX_PAIRS.map(p => get(`/quote?symbol=${p.sym}`).then(q => ({
        label:     p.label,
        price:     q.c ?? null,
        changePct: q.dp ?? null,
        change:    q.d  ?? null,
      })))
    )
    const fx = fxResults
      .filter(r => r.status === 'fulfilled')
      .map((r: any) => r.value)
      .filter(f => f.price)

    const enrich = (quotes: { sym: string; price: number; changePct: number }[], meta: { sym: string; name: string }[]) =>
      quotes.map(q => ({ ...q, name: meta.find(m => m.sym === q.sym)?.name ?? q.sym }))

    const sortedMovers = [...moversQ].sort((a, b) => Math.abs(b.changePct) - Math.abs(a.changePct))

    return NextResponse.json({
      indices:     enrich(indicesQ, INDICES),
      sectors:     enrich(sectorsQ, SECTORS),
      commodities: enrich(commoditiesQ, COMMODITIES),
      fx,
      gainers: sortedMovers.filter(m => m.changePct > 0).slice(0, 6),
      losers:  sortedMovers.filter(m => m.changePct < 0).slice(0, 6),
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
