import { NextRequest, NextResponse } from 'next/server'
import {
  getQuote, getProfile, getMetrics, getCandles, getNews,
  getRecommendations, getEarnings, getInsiders, getPeers,
  computeMoatScore, computeGrowthScore, computeQuantSignals
} from '@/lib/finnhub'

// Small delay helper to stagger requests and avoid rate limits
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

const YAHOO_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36',
  'Accept': 'application/json',
}

// Yahoo Finance v7 quote — no crumb needed, returns valuation ratios reliably
async function yahooFundamentals(ticker: string) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(ticker)}&formatted=false`
  const res = await fetch(url, { headers: YAHOO_HEADERS, next: { revalidate: 3600 } })
  if (!res.ok) throw new Error(`Yahoo v7 ${res.status}`)
  const json = await res.json()
  const r = json?.quoteResponse?.result?.[0]
  if (!r) throw new Error('No Yahoo v7 result')
  return {
    evToEbitda:    r.enterpriseToEbitda ?? null,
    pegRatio:      r.pegRatio           ?? null,
    priceToBook:   r.priceToBook        ?? null,
    beta:          r.beta               ?? null,
    profitMargins: r.profitMargins      ?? null,
    revenueGrowth: r.revenueGrowth      ?? null,
  }
}

// Yahoo Finance quoteSummary financialData — for free cash flow
async function yahooFreeCashflow(ticker: string): Promise<number | null> {
  const url = `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=financialData`
  const res = await fetch(url, { headers: YAHOO_HEADERS, next: { revalidate: 3600 } })
  if (!res.ok) return null
  const json = await res.json()
  const fd = json?.quoteSummary?.result?.[0]?.financialData ?? {}
  return fd.freeCashflow?.raw ?? null
}

// Yahoo Finance fallback for daily candle data (free, no key, reliable server-side)
async function yahooDailyCandles(ticker: string) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?range=1y&interval=1d&includePrePost=false`
  const res = await fetch(url, {
    headers: YAHOO_HEADERS,
    next: { revalidate: 3600 },
  })
  if (!res.ok) throw new Error(`Yahoo ${res.status}`)
  const json   = await res.json()
  const result = json?.chart?.result?.[0]
  if (!result) throw new Error('No Yahoo result')
  const ts    = result.timestamp ?? []
  const quote = result.indicators?.quote?.[0] ?? {}
  const bars = ts.map((t: number, i: number) => {
    const c = quote.close?.[i] ?? 0
    if (!c || c <= 0) return null
    return {
      t: t * 1000,
      c,
      o: quote.open?.[i]   ?? c,
      h: quote.high?.[i]   ?? c,
      l: quote.low?.[i]    ?? c,
      v: quote.volume?.[i] ?? 0,
    }
  }).filter(Boolean) as { t: number; c: number; o: number; h: number; l: number; v: number }[]
  return bars
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })
  const t = ticker.toUpperCase()

  try {
    // Batch 1: core data (price, profile, metrics) — fire together
    const [quoteR, profileR, metricsR] = await Promise.allSettled([
      getQuote(t), getProfile(t), getMetrics(t),
    ])

    // Small stagger before batch 2 to avoid rate limit
    await delay(150)

    // Batch 2: candles + Yahoo fundamentals + free cash flow in parallel
    const [candlesR, yahooFundR, freeCashflow] = await Promise.all([
      getCandles(t, 400).then(v => ({ status: 'fulfilled' as const, value: v })).catch(e => ({ status: 'rejected' as const, reason: e })),
      yahooFundamentals(t).catch(() => null),
      yahooFreeCashflow(t).catch(() => null),
    ])

    await delay(150)

    // Batch 3: enrichment data
    const [newsR, recsR, earningsR, insidersR, peersR] = await Promise.allSettled([
      getNews(t), getRecommendations(t), getEarnings(t), getInsiders(t), getPeers(t),
    ])

    const q   = quoteR.status    === 'fulfilled' ? quoteR.value    : null
    const p   = profileR.status  === 'fulfilled' ? profileR.value  : null
    const m   = metricsR.status  === 'fulfilled' ? metricsR.value?.metric : null
    const cd  = candlesR.status  === 'fulfilled' ? candlesR.value  : null
    const n   = newsR.status     === 'fulfilled' ? newsR.value     : []
    const rc  = recsR.status     === 'fulfilled' ? recsR.value     : []
    const ea  = earningsR.status === 'fulfilled' ? earningsR.value : []
    const ins = insidersR.status === 'fulfilled' ? insidersR.value?.data ?? [] : []
    const peers = peersR.status  === 'fulfilled' ? peersR.value    : []

    if (!q || q.c === 0) return NextResponse.json({ error: `No data for ${t}` }, { status: 404 })

    // Build candle data — try Finnhub first, fall back to Stooq
    let candleData: { t: number; c: number; o: number; h: number; l: number; v: number }[] = []
    if (cd?.s === 'ok' && Array.isArray(cd.t) && cd.t.length > 0) {
      candleData = cd.t.map((ts: number, i: number) => ({
        t: ts * 1000,
        o: cd.o?.[i] ?? cd.c?.[i] ?? 0,
        c: cd.c?.[i] ?? 0,
        h: cd.h?.[i] ?? cd.c?.[i] ?? 0,
        l: cd.l?.[i] ?? cd.c?.[i] ?? 0,
        v: cd.v?.[i] ?? 0,
      })).filter((d: any) => d.c > 0)
      console.log(`[${t}] Finnhub candles: ${candleData.length} bars`)
    }
    if (candleData.length === 0) {
      try {
        candleData = await yahooDailyCandles(t)
        console.log(`[${t}] Yahoo candles: ${candleData.length} bars`)
      } catch (e: any) {
        console.log(`[${t}] Yahoo failed: ${e.message}`)
      }
    }

    const chartData = candleData.map(d => ({ t: d.t, c: d.c }))
    // Full OHLCV in unix seconds
    const ohlcv = candleData.map(d => ({
      time:   Math.floor(d.t / 1000),
      open:   d.o,
      high:   d.h,
      low:    d.l,
      close:  d.c,
      volume: d.v,
    }))
    const quantSignals = computeQuantSignals(candleData)
    console.log(`[${t}] quantSignals computed: ${quantSignals ? quantSignals.trend : 'null (insufficient data)'}`)

    const price     = q.c  ?? null
    const prevClose = q.pc ?? null
    const change    = q.d  ?? null
    const changePct = q.dp ?? null
    const marketCap = p?.marketCapitalization ? p.marketCapitalization * 1e6 : null
    const profitMar = m?.netProfitMarginTTM ?? null
    const revGrowth = m?.revenueGrowthTTMYoy ?? null

    // Insider transaction code mapping
    const TX: Record<string, { label: string; type: 'buy'|'sell'|'neutral' }> = {
      P: { label: 'Purchase',        type: 'buy'     },
      S: { label: 'Sale',            type: 'sell'    },
      A: { label: 'Award',           type: 'buy'     },
      G: { label: 'Gift',            type: 'neutral' },
      M: { label: 'Option Exercise', type: 'buy'     },
      X: { label: 'Option Exercise', type: 'buy'     },
      C: { label: 'Conversion',      type: 'neutral' },
      D: { label: 'Disposition',     type: 'sell'    },
      F: { label: 'Tax Withholding', type: 'sell'    },
      W: { label: 'Inheritance',     type: 'neutral' },
      J: { label: 'Other',           type: 'neutral' },
      Z: { label: 'Trust',           type: 'neutral' },
    }

    const insiderTx = (Array.isArray(ins) ? ins : []).slice(0, 15).map((i: any) => {
      const code   = i.transactionCode ?? '?'
      const mapped = TX[code] ?? { label: code, type: 'neutral' }
      return {
        name:       i.name,
        role:       i.position ?? null,
        action:     mapped.label,
        actionType: mapped.type,
        code,
        shares:     i.share,
        value:      i.value,
        date:       i.transactionDate,
      }
    })

    return NextResponse.json({
      ticker: t,
      name:   p?.name ?? t,
      price, prevClose, change, changePct,
      volume:  q.v  ?? null,
      marketCap,
      exchange:    p?.exchange    ?? null,
      marketState: price ? 'REGULAR' : 'CLOSED',
      sector:      p?.finnhubIndustry ?? null,
      industry:    p?.finnhubIndustry ?? null,
      employees:   p?.employeeTotal   ?? null,
      website:     p?.weburl          ?? null,
      logo:        p?.logo            ?? null,
      ipoDate:     p?.ipo             ?? null,
      country:     p?.country         ?? null,
      currency:    p?.currency        ?? 'USD',
      pe:               m?.peTTM                          ?? null,
      eps:              m?.epsTTM                         ?? null,
      revenueGrowth:    revGrowth ? revGrowth / 100 : null,
      profitMargins:    profitMar ? profitMar / 100 : null,
      beta:             m?.beta                           ?? yahooFundR?.beta ?? null,
      dividendYield:    m?.dividendYieldIndicatedAnnual   ?? null,
      fiftyTwoWeekHigh: m?.['52WeekHigh']                 ?? null,
      fiftyTwoWeekLow:  m?.['52WeekLow']                  ?? null,
      evToEbitda:       m?.['enterpriseValueEbitdaTTM'] ?? m?.['evToEbitdaTTM'] ?? m?.['entEV_EBITDACurrent'] ?? yahooFundR?.evToEbitda ?? null,
      priceToBook:      m?.['pbAnnual']                   ?? yahooFundR?.priceToBook  ?? null,
      priceToSales:     m?.['psTTM']                      ?? null,
      pegRatio:         m?.['pegRatio']                   ?? yahooFundR?.pegRatio     ?? null,
      roeTTM:           m?.roeTTM                         ?? null,
      roaTTM:           m?.roaTTM                         ?? null,
      debtToEquity:     m?.['totalDebt/totalEquityAnnual'] ?? null,
      currentRatio:     m?.currentRatioAnnual             ?? null,
      revenuePerShare:  m?.revenuePerShareTTM             ?? null,
      freeCashflow:     freeCashflow,
      moatScore:        computeMoatScore(marketCap, profitMar),
      growthScore:      computeGrowthScore(revGrowth, quantSignals?.momentum?.m1y ?? null),
      quantSignals,
      recommendations:    Array.isArray(rc) && rc.length > 0 ? rc[0] : null,
      allRecommendations: (Array.isArray(rc) ? rc : []).slice(0, 6),
      earningsHistory:    (Array.isArray(ea) ? ea : []).slice(0, 8).map((e: any) => ({
        period: e.period, actual: e.actual, estimate: e.estimate,
        surprise: e.surprise, surprisePct: e.surprisePercent,
      })),
      insiderTransactions: insiderTx,
      peers: (Array.isArray(peers) ? peers : []).slice(0, 8),
      chartData,
      ohlcv,
      news: (Array.isArray(n) ? n : []).slice(0, 8).map((item: any) => ({
        title:     item.headline,
        url:       item.url,
        source:    item.source,
        published: item.datetime ? new Date(item.datetime * 1000).toISOString() : null,
        sentiment: item.sentiment,
      })),
    })
  } catch (err: any) {
    console.error(`[${t}] Error:`, err.message)
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
