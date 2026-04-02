import { NextRequest, NextResponse } from 'next/server'

const FMP_BASE = 'https://financialmodelingprep.com/stable'

async function fmpFetch(path: string) {
  const key = process.env.FMP_API_KEY
  if (!key) throw new Error('FMP_API_KEY not configured')
  const res = await fetch(`${FMP_BASE}${path}&apikey=${key}`, {
    next: { revalidate: 3600 },
    headers: { 'Accept': 'application/json' },
  })
  if (!res.ok) throw new Error(`FMP ${res.status}: ${path}`)
  return res.json()
}

export async function GET(req: NextRequest) {
  const ticker = req.nextUrl.searchParams.get('ticker')
  if (!ticker) return NextResponse.json({ error: 'ticker required' }, { status: 400 })
  const t = ticker.toUpperCase()

  const [consensusR, gradesR, targetsR] = await Promise.allSettled([
    fmpFetch(`/price-target-consensus?symbol=${t}`),
    fmpFetch(`/grades-summary?symbol=${t}`),
    fmpFetch(`/price-target?symbol=${t}`),
  ])

  const consensusRaw = consensusR.status === 'fulfilled' ? consensusR.value : null
  const consensus = Array.isArray(consensusRaw)
    ? (consensusRaw[0] ?? null)
    : (consensusRaw ?? null)

  const gradesSummary = gradesR.status === 'fulfilled' && Array.isArray(gradesR.value)
    ? gradesR.value.slice(0, 20).map((g: any) => ({
        date:           g.date           ?? null,
        gradingCompany: g.gradingCompany ?? '',
        consensus:      g.consensus      ?? '',
        strongBuy:      g.strongBuy      ?? 0,
        buy:            g.buy            ?? 0,
        hold:           g.hold           ?? 0,
        sell:           g.sell           ?? 0,
        strongSell:     g.strongSell     ?? 0,
      }))
    : []

  const recentRatings = targetsR.status === 'fulfilled' && Array.isArray(targetsR.value)
    ? targetsR.value.slice(0, 20).map((r: any) => ({
        publishedDate:   r.publishedDate   ?? null,
        analystName:     r.analystName     ?? '',
        analystCompany:  r.analystCompany  ?? '',
        newsGrade:       r.newsGrade       ?? '',
        priceTarget:     r.priceTarget     ?? null,
        newsURL:         r.newsURL         ?? null,
        newsTitle:       r.newsTitle       ?? '',
      }))
    : []

  return NextResponse.json({
    ticker: t,
    priceTargetConsensus: consensus ? {
      targetHigh:      consensus.targetHigh      ?? null,
      targetLow:       consensus.targetLow       ?? null,
      targetMedian:    consensus.targetMedian    ?? null,
      targetConsensus: consensus.targetConsensus ?? null,
      lastUpdated:     consensus.lastUpdated     ?? null,
    } : null,
    gradesSummary,
    recentRatings,
  })
}
