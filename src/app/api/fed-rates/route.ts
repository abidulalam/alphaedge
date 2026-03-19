import { NextResponse } from 'next/server'

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Accept': 'application/json',
}

// Yahoo Finance tickers for US interest rates
const RATE_TICKERS = [
  { symbol: '^IRX', label: '3-Mo T-Bill',  desc: 'Closest proxy to the Fed Funds target rate' },
  { symbol: '^FVX', label: '5-Yr Treasury', desc: '5-year US Treasury note yield' },
  { symbol: '^TNX', label: '10-Yr Treasury', desc: '10-year US Treasury note yield (benchmark)' },
  { symbol: '^TYX', label: '30-Yr Treasury', desc: '30-year US Treasury bond yield' },
]

async function fetchYahooRate(symbol: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?range=1y&interval=1wk&includePrePost=false`
  const res = await fetch(url, { headers: YAHOO_HEADERS, next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`Yahoo ${res.status} for ${symbol}`)
  const json = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) throw new Error(`No data for ${symbol}`)
  const ts    = result.timestamp ?? []
  const quote = result.indicators?.quote?.[0] ?? {}
  const meta  = result.meta ?? {}

  const bars = ts.map((t: number, i: number) => {
    const c = quote.close?.[i]
    if (c == null || c <= 0) return null
    return { t: t * 1000, v: parseFloat(c.toFixed(3)) }
  }).filter(Boolean) as { t: number; v: number }[]

  return {
    symbol,
    current: meta.regularMarketPrice ?? bars[bars.length - 1]?.v ?? null,
    history: bars,
  }
}

export async function GET() {
  try {
    const results = await Promise.allSettled(
      RATE_TICKERS.map(r => fetchYahooRate(r.symbol))
    )

    const rates = RATE_TICKERS.map((info, i) => {
      const r = results[i]
      const data = r.status === 'fulfilled' ? r.value : null
      return {
        symbol:  info.symbol,
        label:   info.label,
        desc:    info.desc,
        current: data?.current ?? null,
        history: data?.history ?? [],
      }
    })

    return NextResponse.json({ rates })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
