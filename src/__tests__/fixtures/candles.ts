/** Generate synthetic OHLCV candles for testing. */
export function makeCandles(count: number, basePrice = 100, trend: 'up' | 'down' | 'flat' = 'up') {
  const candles = []
  let price = basePrice
  const now = Math.floor(Date.now() / 1000)
  for (let i = 0; i < count; i++) {
    const drift = trend === 'up' ? 0.3 : trend === 'down' ? -0.3 : 0
    const noise = (Math.random() - 0.5) * 2
    price = Math.max(1, price + drift + noise)
    const open  = price - Math.random()
    const high  = price + Math.random() * 2
    const low   = price - Math.random() * 2
    candles.push({
      t: (now - (count - i) * 86400) * 1000,
      c: parseFloat(price.toFixed(2)),
      o: parseFloat(open.toFixed(2)),
      h: parseFloat(high.toFixed(2)),
      l: parseFloat(Math.max(0.01, low).toFixed(2)),
      v: Math.floor(Math.random() * 10_000_000) + 1_000_000,
    })
  }
  return candles
}

/** Minimal 20-candle set — edge of the minimum threshold. */
export const CANDLES_20 = makeCandles(20)

/** Full 252-candle set (1 year) — enables all momentum periods. */
export const CANDLES_252 = makeCandles(252)

/** All-same price — tests divide-by-zero guards. */
export function flatCandles(count: number, price = 100) {
  const now = Math.floor(Date.now() / 1000)
  return Array.from({ length: count }, (_, i) => ({
    t: (now - (count - i) * 86400) * 1000,
    c: price, o: price, h: price, l: price, v: 1_000_000,
  }))
}

/** Strongly trending up — should score STRONG BUY. */
export function bullCandles(count = 252) {
  const candles = []
  const now = Math.floor(Date.now() / 1000)
  let price = 50
  for (let i = 0; i < count; i++) {
    price = price * 1.005 // +0.5% daily
    candles.push({
      t: (now - (count - i) * 86400) * 1000,
      c: parseFloat(price.toFixed(2)),
      o: parseFloat((price * 0.998).toFixed(2)),
      h: parseFloat((price * 1.01).toFixed(2)),
      l: parseFloat((price * 0.99).toFixed(2)),
      v: 5_000_000,
    })
  }
  return candles
}

/** Strongly trending down — should score STRONG SELL. */
export function bearCandles(count = 252) {
  const candles = []
  const now = Math.floor(Date.now() / 1000)
  let price = 200
  for (let i = 0; i < count; i++) {
    price = price * 0.995 // -0.5% daily
    candles.push({
      t: (now - (count - i) * 86400) * 1000,
      c: parseFloat(price.toFixed(2)),
      o: parseFloat((price * 1.002).toFixed(2)),
      h: parseFloat((price * 1.005).toFixed(2)),
      l: parseFloat((price * 0.99).toFixed(2)),
      v: 5_000_000,
    })
  }
  return candles
}
