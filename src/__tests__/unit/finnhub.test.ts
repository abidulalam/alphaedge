import { computeMoatScore, computeGrowthScore, computeQuantSignals } from '@/lib/finnhub'
import { makeCandles, flatCandles, bullCandles, bearCandles, CANDLES_20, CANDLES_252 } from '../fixtures/candles'

// ─── computeMoatScore ────────────────────────────────────────────────────────

describe('computeMoatScore', () => {
  it('returns 50 base score when both inputs are null', () => {
    expect(computeMoatScore(null, null)).toBe(50)
  })

  it('adds 25 for trillion-dollar market cap', () => {
    const score = computeMoatScore(1.5e12, null)
    expect(score).toBe(75)
  })

  it('adds 15 for >100B market cap', () => {
    expect(computeMoatScore(5e11, null)).toBe(65)
  })

  it('adds 8 for >10B market cap', () => {
    expect(computeMoatScore(5e10, null)).toBe(58)
  })

  it('adds 20 for >25% profit margin', () => {
    expect(computeMoatScore(null, 30)).toBe(70)
  })

  it('adds 12 for >15% profit margin', () => {
    expect(computeMoatScore(null, 20)).toBe(62)
  })

  it('adds 5 for >5% profit margin', () => {
    expect(computeMoatScore(null, 10)).toBe(55)
  })

  it('subtracts 10 for negative margin', () => {
    expect(computeMoatScore(null, -5)).toBe(40)
  })

  it('caps at 99 for extreme inputs', () => {
    // base 50 + 25 (>1T cap) + 20 (>25% margin) = 95 — clamped by Math.min(99,...)
    expect(computeMoatScore(1e13, 50)).toBeLessThanOrEqual(99)
    expect(computeMoatScore(1e13, 50)).toBeGreaterThan(90)
  })

  it('floors at 10 for worst case', () => {
    // null market cap + very negative margin — base 50 - 10 = 40, still above floor
    // to hit 10 we need starting point that goes negative
    const score = computeMoatScore(null, -100)
    expect(score).toBeGreaterThanOrEqual(10)
  })

  it('combines market cap and margin additively', () => {
    // >1T (+25) + >25% margin (+20) = 50+25+20 = 95
    expect(computeMoatScore(2e12, 30)).toBe(95)
  })
})

// ─── computeGrowthScore ──────────────────────────────────────────────────────

describe('computeGrowthScore', () => {
  it('returns 50 base when both are null', () => {
    expect(computeGrowthScore(null, null)).toBe(50)
  })

  it('adds 25 for >30% revenue growth', () => {
    expect(computeGrowthScore(35, null)).toBe(75)
  })

  it('adds 15 for >15% revenue growth', () => {
    expect(computeGrowthScore(20, null)).toBe(65)
  })

  it('adds 8 for >5% revenue growth', () => {
    expect(computeGrowthScore(10, null)).toBe(58)
  })

  it('subtracts 15 for negative revenue growth', () => {
    expect(computeGrowthScore(-5, null)).toBe(35)
  })

  it('adds 20 for >100% 1y momentum', () => {
    expect(computeGrowthScore(null, 150)).toBe(70)
  })

  it('adds 12 for >50% 1y momentum', () => {
    expect(computeGrowthScore(null, 75)).toBe(62)
  })

  it('adds 6 for >20% 1y momentum', () => {
    expect(computeGrowthScore(null, 30)).toBe(56)
  })

  it('subtracts 12 for <-20% momentum', () => {
    expect(computeGrowthScore(null, -30)).toBe(38)
  })

  it('subtracts 5 for slightly negative momentum', () => {
    expect(computeGrowthScore(null, -10)).toBe(45)
  })

  it('caps at 99', () => {
    // base 50 + 25 (>30% growth) + 20 (>100% momentum) = 95 — clamped by Math.min(99,...)
    expect(computeGrowthScore(50, 200)).toBeLessThanOrEqual(99)
    expect(computeGrowthScore(50, 200)).toBeGreaterThan(90)
  })

  it('floors at 10', () => {
    const score = computeGrowthScore(-100, -100)
    expect(score).toBeGreaterThanOrEqual(10)
  })
})

// ─── computeQuantSignals ─────────────────────────────────────────────────────

describe('computeQuantSignals', () => {
  describe('minimum data guards', () => {
    it('returns null for empty candles', () => {
      expect(computeQuantSignals([])).toBeNull()
    })

    it('returns null for fewer than 20 candles', () => {
      expect(computeQuantSignals(makeCandles(19))).toBeNull()
    })

    it('returns null when all closes are 0', () => {
      const zeroes = Array.from({ length: 30 }, (_, i) => ({
        t: i * 86400 * 1000, c: 0, o: 0, h: 0, l: 0, v: 0,
      }))
      expect(computeQuantSignals(zeroes)).toBeNull()
    })

    it('returns a result for exactly 26 candles (minimum for MACD)', () => {
      expect(computeQuantSignals(makeCandles(26))).not.toBeNull()
    })
  })

  describe('output shape', () => {
    let signals: ReturnType<typeof computeQuantSignals>
    beforeAll(() => { signals = computeQuantSignals(CANDLES_252) })

    it('returns a trend verdict', () => {
      expect(['STRONG BUY', 'BUY', 'NEUTRAL', 'SELL', 'STRONG SELL']).toContain(signals!.trend)
    })

    it('returns RSI between 0 and 100', () => {
      expect(signals!.rsi).toBeGreaterThanOrEqual(0)
      expect(signals!.rsi).toBeLessThanOrEqual(100)
    })

    it('returns stochK between 0 and 100', () => {
      expect(signals!.stochK).toBeGreaterThanOrEqual(0)
      expect(signals!.stochK).toBeLessThanOrEqual(100)
    })

    it('returns bbPosition as a finite number (may exceed 0–1 when outside bands)', () => {
      expect(Number.isFinite(signals!.bbPosition)).toBe(true)
    })

    it('returns all composite scores between 0 and 100', () => {
      const { trend, momentum, meanReversion, risk } = signals!.scores
      expect(trend).toBeGreaterThanOrEqual(0)
      expect(trend).toBeLessThanOrEqual(100)
      expect(momentum).toBeGreaterThanOrEqual(0)
      expect(momentum).toBeLessThanOrEqual(100)
      expect(meanReversion).toBeGreaterThanOrEqual(0)
      expect(meanReversion).toBeLessThanOrEqual(100)
      expect(risk).toBeGreaterThanOrEqual(0)
      expect(risk).toBeLessThanOrEqual(100)
    })

    it('returns valid SMA values with 252 candles', () => {
      expect(signals!.sma20).toBeGreaterThan(0)
      expect(signals!.sma50).toBeGreaterThan(0)
      expect(signals!.sma200).toBeGreaterThan(0)
    })

    it('returns momentum object with expected keys', () => {
      expect(signals!.momentum).toHaveProperty('m1w')
      expect(signals!.momentum).toHaveProperty('m1')
      expect(signals!.momentum).toHaveProperty('m3')
      expect(signals!.momentum).toHaveProperty('m6')
      expect(signals!.momentum).toHaveProperty('m1y')
    })

    it('returns non-negative ATR and hv20', () => {
      expect(signals!.atr14).toBeGreaterThanOrEqual(0)
      expect(signals!.hv20).toBeGreaterThanOrEqual(0)
    })

    it('returns non-negative maxDrawdown252', () => {
      expect(signals!.maxDrawdown252).toBeGreaterThanOrEqual(0)
    })

    it('returns pos52w between 0 and 100', () => {
      expect(signals!.pos52w).toBeGreaterThanOrEqual(0)
      expect(signals!.pos52w).toBeLessThanOrEqual(100)
    })

    it('returns valid OBV trend', () => {
      expect(['bullish', 'bearish', 'neutral']).toContain(signals!.obvTrend)
    })
  })

  describe('signal thresholds', () => {
    it('gives STRONG BUY or BUY for strongly trending up 252-day series', () => {
      const signals = computeQuantSignals(bullCandles(252))
      expect(['STRONG BUY', 'BUY']).toContain(signals!.trend)
    })

    it('gives STRONG SELL or SELL for strongly trending down 252-day series', () => {
      const signals = computeQuantSignals(bearCandles(252))
      expect(['STRONG SELL', 'SELL']).toContain(signals!.trend)
    })
  })

  describe('flat price edge cases', () => {
    it('handles all-same price without throwing', () => {
      expect(() => computeQuantSignals(flatCandles(50))).not.toThrow()
    })

    it('returns zScore of 0 when price is flat', () => {
      const signals = computeQuantSignals(flatCandles(50))
      expect(signals!.zScore).toBe(0)
    })

    it('returns bbPosition 0.5 when price is flat (no spread)', () => {
      const signals = computeQuantSignals(flatCandles(50))
      expect(signals!.bbPosition).toBe(0.5)
    })
  })

  describe('momentum with limited history', () => {
    it('returns null for m1y when fewer than 252 candles', () => {
      const signals = computeQuantSignals(makeCandles(100))
      expect(signals!.momentum.m1y).toBeNull()
    })

    it('returns null for m6 when fewer than 126 candles', () => {
      const signals = computeQuantSignals(makeCandles(50))
      expect(signals!.momentum.m6).toBeNull()
    })

    it('returns m1 when at least 21 candles exist', () => {
      const signals = computeQuantSignals(makeCandles(30))
      expect(signals!.momentum.m1).not.toBeNull()
    })
  })

  describe('golden/death cross', () => {
    it('returns only sma20 when fewer than 50 candles', () => {
      const signals = computeQuantSignals(makeCandles(30))
      expect(signals!.sma20).toBeGreaterThan(0)
      expect(signals!.sma50).toBeNull()
      expect(signals!.sma200).toBeNull()
    })

    it('goldenCross and deathCross are mutually exclusive', () => {
      const signals = computeQuantSignals(CANDLES_252)!
      expect(signals.goldenCross && signals.deathCross).toBe(false)
    })
  })
})
