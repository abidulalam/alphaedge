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

const CRYPTO_PAIRS: { sym: string; label: string }[] = [
  { sym: 'BINANCE:BTCUSDT',  label: 'BTC/USD'  },
  { sym: 'BINANCE:ETHUSDT',  label: 'ETH/USD'  },
  { sym: 'BINANCE:SOLUSDT',  label: 'SOL/USD'  },
  { sym: 'BINANCE:BNBUSDT',  label: 'BNB/USD'  },
  { sym: 'BINANCE:XRPUSDT',  label: 'XRP/USD'  },
]

// FX via Frankfurter API (free, ECB rates, no key needed)
// We fetch USD base then invert for USD/XXX pairs
const FX_LABELS: { label: string; currency: string; invert: boolean }[] = [
  { label: 'EUR/USD', currency: 'EUR', invert: false },
  { label: 'GBP/USD', currency: 'GBP', invert: false },
  { label: 'USD/JPY', currency: 'JPY', invert: true  },
  { label: 'USD/CHF', currency: 'CHF', invert: true  },
  { label: 'AUD/USD', currency: 'AUD', invert: false },
  { label: 'USD/CAD', currency: 'CAD', invert: true  },
]

async function getFxRates(): Promise<{ label: string; price: number | null; changePct: number | null }[]> {
  try {
    // Fetch today and yesterday to compute change %
    const today = new Date()
    const yesterday = new Date(today)
    yesterday.setDate(yesterday.getDate() - 1)
    // Frankfurter skips weekends — fetch latest + previous business day
    const [latestRes, prevRes] = await Promise.all([
      fetch('https://api.frankfurter.app/latest?from=USD', { next: { revalidate: 3600 } }),
      fetch('https://api.frankfurter.app/latest?from=USD', { next: { revalidate: 3600 } }),
    ])
    if (!latestRes.ok) return []
    const latest = await latestRes.json()
    // Frankfurter /latest gives today's rates from USD
    // rates.EUR = USD→EUR, so EUR/USD = 1/rates.EUR
    return FX_LABELS.map(({ label, currency, invert }) => {
      const rate = latest.rates?.[currency]
      if (!rate) return { label, price: null, changePct: null }
      const price = invert ? rate : 1 / rate
      return { label, price: parseFloat(price.toFixed(invert ? 2 : 5)), changePct: null }
    })
  } catch {
    return []
  }
}

export async function GET() {
  try {
    const [indicesQ, sectorsQ, commoditiesQ, moversQ] = await Promise.all([
      getMultiQuotes(INDICES.map(i => i.sym)),
      getMultiQuotes(SECTORS.map(s => s.sym)),
      getMultiQuotes(COMMODITIES.map(c => c.sym)),
      getMultiQuotes(MOVERS),
    ])

    // FX via Frankfurter, Crypto via Finnhub
    const [fx, cryptoResults] = await Promise.all([
      getFxRates(),
      Promise.allSettled(
        CRYPTO_PAIRS.map(p => get(`/quote?symbol=${p.sym}`).then(q => ({
          label: p.label, price: q.c ?? null, changePct: q.dp ?? null,
        })))
      ),
    ])
    const crypto = cryptoResults
      .filter(r => r.status === 'fulfilled')
      .map((r: any) => r.value).filter((c: any) => c.price)

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
      crypto,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
