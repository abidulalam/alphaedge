import { NextResponse } from 'next/server'

export async function GET() {
  const KEY = process.env.FINNHUB_API_KEY ?? ''

  const today = new Date()
  const from = today.toISOString().split('T')[0]
  const toDate = new Date(today.getTime() + 90 * 24 * 60 * 60 * 1000)
  const to = toDate.toISOString().split('T')[0]

  const res = await fetch(
    `https://finnhub.io/api/v1/calendar/ipo?from=${from}&to=${to}&token=${KEY}`,
    { next: { revalidate: 3600 }, headers: { 'Accept': 'application/json' } }
  )
  if (!res.ok) return NextResponse.json({ error: `Finnhub ${res.status}` }, { status: 502 })
  const json = await res.json()

  const ipos = (json?.ipoCalendar ?? []).map((e: any) => ({
    date:            e.date            ?? '',
    name:            e.name            ?? '',
    symbol:          e.symbol          ?? '',
    exchange:        e.exchange        ?? '',
    numberOfShares:  e.numberOfShares  != null ? Number(e.numberOfShares)  : null,
    price:           e.price           ?? null,   // string range e.g. "14.00-16.00"
    status:          e.status          ?? '',
    totalSharesValue: e.totalSharesValue != null ? Number(e.totalSharesValue) : null,
  }))

  return NextResponse.json({ ipos, from, to })
}
