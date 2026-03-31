import { NextRequest, NextResponse } from 'next/server'

export async function GET(req: NextRequest) {
  const range = req.nextUrl.searchParams.get('range') ?? 'week'
  const KEY = process.env.FINNHUB_API_KEY ?? ''

  const today = new Date()
  const from = today.toISOString().split('T')[0]

  const days = range === 'month' ? 30 : range === 'nextweek' ? 14 : 7
  const toDate = new Date(today.getTime() + days * 24 * 60 * 60 * 1000)
  const to = toDate.toISOString().split('T')[0]

  const res = await fetch(
    `https://finnhub.io/api/v1/calendar/earnings?from=${from}&to=${to}&token=${KEY}`,
    { next: { revalidate: 3600 }, headers: { 'Accept': 'application/json' } }
  )
  if (!res.ok) return NextResponse.json({ error: `Finnhub ${res.status}` }, { status: 502 })
  const json = await res.json()

  const earnings = (json?.earningsCalendar ?? []).map((e: any) => ({
    date:            e.date     ?? '',
    ticker:          e.symbol   ?? '',
    name:            e.name     ?? e.symbol ?? '',
    epsEstimate:     e.epsEstimate     != null ? Number(e.epsEstimate)     : null,
    revenueEstimate: e.revenueEstimate != null ? Number(e.revenueEstimate) : null,
    hour:            e.hour ?? null,
  }))

  return NextResponse.json({ earnings, from, to })
}
