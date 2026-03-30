/**
 * Integration tests for GET /api/search
 */

const mockFetch = jest.fn()
global.fetch = mockFetch

import { GET } from '@/app/api/search/route'
import { NextRequest } from 'next/server'

function makeRequest(q?: string) {
  const url = q
    ? `http://localhost/api/search?q=${encodeURIComponent(q)}`
    : 'http://localhost/api/search'
  return new NextRequest(url)
}

const FINNHUB_SEARCH_RESPONSE = {
  result: [
    { symbol: 'AAPL', description: 'Apple Inc', primaryExchange: 'NASDAQ', type: 'Common Stock' },
    { symbol: 'AAPLW', description: 'Apple Warrant', primaryExchange: 'NASDAQ', type: 'Warrant' },
    { symbol: 'QQQ', description: 'Invesco QQQ Trust', primaryExchange: 'NASDAQ', type: 'ETP' },
    { symbol: 'AAPL.SW', description: 'Apple Swiss', primaryExchange: 'SWX', type: 'Common Stock' },
  ],
}

beforeEach(() => {
  mockFetch.mockReset()
  process.env.FINNHUB_API_KEY = 'test-key'
})

describe('GET /api/search', () => {
  it('returns empty results when q param is missing', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toEqual([])
  })

  it('returns empty results for empty string query', async () => {
    const res = await GET(makeRequest(''))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toEqual([])
  })

  it('returns filtered results (Common Stock + ETP only)', async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => FINNHUB_SEARCH_RESPONSE,
    })
    const res = await GET(makeRequest('AAPL'))
    expect(res.status).toBe(200)
    const body = await res.json()
    // Warrant should be filtered out
    expect(body.results.every((r: any) => ['Common Stock', 'ETP'].includes(r.type))).toBe(true)
    expect(body.results.find((r: any) => r.ticker === 'AAPLW')).toBeUndefined()
  })

  it('maps Finnhub fields to expected shape', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => FINNHUB_SEARCH_RESPONSE })
    const res = await GET(makeRequest('AAPL'))
    const body = await res.json()
    const aapl = body.results.find((r: any) => r.ticker === 'AAPL')
    expect(aapl).toMatchObject({
      ticker: 'AAPL',
      name: 'Apple Inc',
      exchange: 'NASDAQ',
      type: 'Common Stock',
    })
  })

  it('limits results to 8 items', async () => {
    const manyResults = Array.from({ length: 20 }, (_, i) => ({
      symbol: `TICK${i}`, description: `Company ${i}`,
      primaryExchange: 'NYSE', type: 'Common Stock',
    }))
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ result: manyResults }) })
    const res = await GET(makeRequest('TICK'))
    const body = await res.json()
    expect(body.results.length).toBeLessThanOrEqual(8)
  })

  it('returns empty array when Finnhub throws', async () => {
    mockFetch.mockRejectedValueOnce(new Error('Network error'))
    const res = await GET(makeRequest('NVDA'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toEqual([])
  })

  it('returns empty array when Finnhub returns non-ok response', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 429 })
    const res = await GET(makeRequest('TSLA'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.results).toEqual([])
  })

  it('handles null result field gracefully', async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ result: null }) })
    const res = await GET(makeRequest('XYZ'))
    const body = await res.json()
    expect(body.results).toEqual([])
  })
})
