import { NextRequest, NextResponse } from 'next/server'
import {
  getQuote, getProfile, getMetrics, getCandles, getNews,
  getRecommendations, getEarnings, getInsiders, getPeers,
  computeMoatScore, computeGrowthScore, computeQuantSignals
} from '@/lib/finnhub'

// Small delay helper to stagger requests and avoid rate limits
const delay = (ms: number) => new Promise(r => setTimeout(r, ms))

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

    // Batch 2: candles first, alone — most important for quant signals
    const candlesR = await getCandles(t, 400).then(v => ({ status: 'fulfilled' as const, value: v })).catch(e => ({ status: 'rejected' as const, reason: e }))

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

    // Build candle data — defensive parsing
    const candleData = (() => {
      if (!cd || cd.s !== 'ok' || !cd.t || !Array.isArray(cd.t) || cd.t.length === 0) {
        console.log(`[${t}] No candle data: s=${cd?.s}, count=${cd?.t?.length ?? 0}`)
        return []
      }
      const bars = cd.t.map((ts: number, i: number) => ({
        t: ts * 1000,
        c: cd.c?.[i] ?? null,
        h: cd.h?.[i] ?? cd.c?.[i] ?? null,
        l: cd.l?.[i] ?? cd.c?.[i] ?? null,
        v: cd.v?.[i] ?? 0,
      })).filter((d: any) => d.c !== null && d.c > 0)
      console.log(`[${t}] Candles: ${bars.length} bars`)
      return bars
    })()

    const chartData    = candleData.map((d: any) => ({ t: d.t, c: d.c }))
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
      beta:             m?.beta                           ?? null,
      dividendYield:    m?.dividendYieldIndicatedAnnual   ?? null,
      fiftyTwoWeekHigh: m?.['52WeekHigh']                 ?? null,
      fiftyTwoWeekLow:  m?.['52WeekLow']                  ?? null,
      evToEbitda:       m?.['enterpriseValueEbitdaTTM']    ?? null,
      priceToBook:      m?.['pbAnnual']                   ?? null,
      priceToSales:     m?.['psTTM']                      ?? null,
      pegRatio:         m?.['pegRatio']                   ?? null,
      roeTTM:           m?.roeTTM                         ?? null,
      roaTTM:           m?.roaTTM                         ?? null,
      debtToEquity:     m?.['totalDebt/totalEquityAnnual'] ?? null,
      currentRatio:     m?.currentRatioAnnual             ?? null,
      revenuePerShare:  m?.revenuePerShareTTM             ?? null,
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
