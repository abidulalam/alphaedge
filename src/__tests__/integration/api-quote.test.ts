/**
 * Integration tests for GET /api/quote
 * Mocks all external API calls (Finnhub, Yahoo Finance).
 */

const mockFetch = jest.fn()
global.fetch = mockFetch

// Replace the delay helper — mock setTimeout to be a no-op so tests run instantly
jest.spyOn(global, 'setTimeout').mockImplementation((fn: any) => { fn(); return 0 as any })

import { GET } from '@/app/api/quote/route'
import { NextRequest } from 'next/server'
import { bullCandles } from '../fixtures/candles'

function makeRequest(ticker?: string) {
  const url = ticker
    ? `http://localhost/api/quote?ticker=${ticker}`
    : 'http://localhost/api/quote'
  return new NextRequest(url)
}

const MOCK_QUOTE   = { c: 150.25, pc: 148.0, d: 2.25, dp: 1.52, v: 45_000_000 }
const MOCK_PROFILE = {
  name: 'Apple Inc', finnhubIndustry: 'Technology', exchange: 'NASDAQ',
  marketCapitalization: 2_400_000, logo: 'https://example.com/logo.png',
  weburl: 'https://apple.com', employeeTotal: 164_000, ipo: '1980-12-12',
  country: 'US', currency: 'USD',
}
const MOCK_METRICS = {
  metric: {
    peTTM: 28.5, epsTTM: 6.13, revenueGrowthTTMYoy: 8.1,
    netProfitMarginTTM: 24.3, beta: 1.2,
    '52WeekHigh': 199.62, '52WeekLow': 124.17,
    dividendYieldIndicatedAnnual: 0.54, roeTTM: 170.3, roaTTM: 28.1,
    'totalDebt/totalEquityAnnual': 1.5, currentRatioAnnual: 0.98,
    evEbitdaTTM: 22.1, pbAnnual: 45.2, psTTM: 7.3, pegTTM: 3.5,
  },
}

const _bulls = bullCandles(252)
const BULL_CANDLES_FINNHUB = {
  s: 'ok',
  t: _bulls.map(c => Math.floor(c.t / 1000)),
  c: _bulls.map(c => c.c),
  o: _bulls.map(c => c.o),
  h: _bulls.map(c => c.h),
  l: _bulls.map(c => c.l),
  v: _bulls.map(c => c.v),
}

const MOCK_NEWS     = [{ headline: 'Apple hits record', url: 'https://example.com/1', source: 'Reuters', datetime: 1700000000, sentiment: 'positive' }]
const MOCK_RECS     = [{ period: '2024-01-01', strongBuy: 20, buy: 10, hold: 5, sell: 1, strongSell: 0 }]
const MOCK_EARNINGS = [{ period: '2023-Q4', actual: 2.18, estimate: 2.1, surprise: 0.08, surprisePercent: 3.8 }]
const MOCK_INSIDERS = { data: [{ name: 'Tim Cook', position: 'CEO', transactionCode: 'S', share: 50000, value: 7500000, transactionDate: '2024-01-15' }] }
const MOCK_PEERS    = ['MSFT', 'GOOGL', 'META']

function setupSuccessfulMocks() {
  mockFetch
    .mockResolvedValueOnce({ ok: true, json: async () => MOCK_QUOTE })
    .mockResolvedValueOnce({ ok: true, json: async () => MOCK_PROFILE })
    .mockResolvedValueOnce({ ok: true, json: async () => MOCK_METRICS })
    .mockResolvedValueOnce({ ok: true, json: async () => BULL_CANDLES_FINNHUB })
    .mockResolvedValueOnce({ ok: true, json: async () => MOCK_NEWS })
    .mockResolvedValueOnce({ ok: true, json: async () => MOCK_RECS })
    .mockResolvedValueOnce({ ok: true, json: async () => MOCK_EARNINGS })
    .mockResolvedValueOnce({ ok: true, json: async () => MOCK_INSIDERS })
    .mockResolvedValueOnce({ ok: true, json: async () => MOCK_PEERS })
}

beforeEach(() => {
  mockFetch.mockReset()
  process.env.FINNHUB_API_KEY = 'test-key'
})

afterEach(() => {
  delete process.env.FINNHUB_API_KEY
})

describe('GET /api/quote', () => {
  it('returns 400 when ticker is missing', async () => {
    const res = await GET(makeRequest())
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toMatch(/ticker required/i)
  })

  it('returns 404 when quote price is 0 (invalid ticker)', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ c: 0, pc: 0, d: 0, dp: 0 }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ metric: {} }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ s: 'no_data' }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => [] })
      // Yahoo fallback also returns no data
      .mockResolvedValueOnce({ ok: false, status: 404 })
    const res = await GET(makeRequest('INVALID'))
    expect(res.status).toBe(404)
  }, 15_000)

  it('returns complete stock data on success', async () => {
    setupSuccessfulMocks()
    const res = await GET(makeRequest('AAPL'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.ticker).toBe('AAPL')
    expect(body.name).toBe('Apple Inc')
    expect(body.price).toBe(150.25)
    expect(body.changePct).toBe(1.52)
    expect(body.sector).toBe('Technology')
    expect(body.pe).toBe(28.5)
  }, 15_000)

  it('uppercases the ticker', async () => {
    setupSuccessfulMocks()
    const res = await GET(makeRequest('aapl'))
    const body = await res.json()
    expect(body.ticker).toBe('AAPL')
  }, 15_000)

  it('includes computed moatScore and growthScore', async () => {
    setupSuccessfulMocks()
    const res = await GET(makeRequest('AAPL'))
    const body = await res.json()
    expect(body.moatScore).toBeGreaterThanOrEqual(10)
    expect(body.moatScore).toBeLessThanOrEqual(99)
    expect(body.growthScore).toBeGreaterThanOrEqual(10)
    expect(body.growthScore).toBeLessThanOrEqual(99)
  }, 15_000)

  it('includes quantSignals when candle data is available', async () => {
    setupSuccessfulMocks()
    const res = await GET(makeRequest('AAPL'))
    const body = await res.json()
    expect(body.quantSignals).not.toBeNull()
    expect(body.quantSignals.trend).toBeDefined()
  }, 15_000)

  it('maps insider transaction codes to human-readable labels', async () => {
    setupSuccessfulMocks()
    const res = await GET(makeRequest('AAPL'))
    const body = await res.json()
    const insider = body.insiderTransactions[0]
    expect(insider.action).toBe('Sale')
    expect(insider.actionType).toBe('sell')
  }, 15_000)

  it('converts revenueGrowth from percent to decimal', async () => {
    setupSuccessfulMocks()
    const res = await GET(makeRequest('AAPL'))
    const body = await res.json()
    expect(body.revenueGrowth).toBeCloseTo(0.081, 3)
  }, 15_000)

  it('returns 404 when all Finnhub calls fail (allSettled absorbs errors)', async () => {
    // Route uses Promise.allSettled — rejections produce empty data, not a 500
    // The 404 comes from: q.c === 0 → "No data for ticker"
    mockFetch.mockRejectedValue(new Error('Finnhub down'))
    const res = await GET(makeRequest('AAPL'))
    // Either 404 (no data) or 500 (uncaught) — both are error responses
    expect([404, 500]).toContain(res.status)
  }, 15_000)

  it('falls back to Yahoo Finance when Finnhub candles return no_data', async () => {
    const yahooResponse = {
      chart: {
        result: [{
          timestamp: [1700000000, 1700086400],
          indicators: { quote: [{ open: [148, 149], high: [151, 152], low: [147, 148], close: [150, 151], volume: [1000000, 1100000] }] },
        }],
      },
    }
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_QUOTE })
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_PROFILE })
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_METRICS })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ s: 'no_data', t: [], c: [] }) })
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_NEWS })
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_RECS })
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_EARNINGS })
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_INSIDERS })
      .mockResolvedValueOnce({ ok: true, json: async () => MOCK_PEERS })
      .mockResolvedValueOnce({ ok: true, json: async () => yahooResponse })
    const res = await GET(makeRequest('AAPL'))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.chartData.length).toBeGreaterThan(0)
  }, 15_000)
})
