import { NextResponse } from 'next/server'
import { getMultiQuotes } from '@/lib/finnhub'

const TICKERS = ['AAPL','MSFT','GOOGL','NVDA','META','AMZN','TSLA','JPM','V','NFLX','AMD','ORCL']

export async function GET() {
  try {
    const tickers = await getMultiQuotes(TICKERS)
    return NextResponse.json({ tickers: tickers.filter(t => t.price > 0) })
  } catch {
    return NextResponse.json({ tickers: [] })
  }
}
