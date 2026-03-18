import { NextResponse } from 'next/server'

const BASE = 'https://finnhub.io/api/v1'
const KEY  = process.env.FINNHUB_API_KEY || ''

async function get(path: string) {
  const sep = path.includes('?') ? '&' : '?'
  const res = await fetch(`${BASE}${path}${sep}token=${KEY}`, {
    next: { revalidate: 3600 },
    headers: { Accept: 'application/json' },
  })
  if (!res.ok) throw new Error(`Finnhub ${res.status}`)
  return res.json()
}

export async function GET() {
  try {
    const today = new Date()
    const from  = today.toISOString().split('T')[0]
    const to    = new Date(today.getTime() + 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    const [economic, earnings] = await Promise.allSettled([
      get(`/calendar/economic?from=${from}&to=${to}`),
      get(`/calendar/earnings?from=${from}&to=${to}`),
    ])

    const econ = economic.status === 'fulfilled'
      ? (economic.value?.economicCalendar ?? [])
          .filter((e: any) => e.impact === 'high' || e.impact === 'medium')
          .slice(0, 40)
          .map((e: any) => ({
            date:     e.time ?? e.date,
            country:  e.country,
            event:    e.event,
            impact:   e.impact,
            actual:   e.actual   ?? null,
            estimate: e.estimate ?? null,
            previous: e.prev     ?? null,
            unit:     e.unit     ?? '',
          }))
      : []

    const earn = earnings.status === 'fulfilled'
      ? (earnings.value?.earningsCalendar ?? [])
          .slice(0, 40)
          .map((e: any) => ({
            date:     e.date,
            ticker:   e.symbol,
            name:     e.name ?? e.symbol,
            epsEst:   e.epsEstimate ?? null,
            revEst:   e.revenueEstimate ?? null,
            hour:     e.hour ?? null, // 'bmo' before open, 'amc' after close
          }))
      : []

    return NextResponse.json({ economic: econ, earnings: earn })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
