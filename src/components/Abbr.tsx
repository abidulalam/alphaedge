'use client'
import { useState } from 'react'

const mono = 'IBM Plex Mono, monospace'

export const GLOSSARY: Record<string, { full: string; desc: string }> = {
  'SMA':       { full: 'Simple Moving Average', desc: 'Average closing price over N periods. Smooths price action to reveal trend direction.' },
  'SMA 20':    { full: 'Simple Moving Average (20-day)', desc: 'Short-term trend indicator. Price above SMA 20 suggests near-term bullish momentum.' },
  'SMA 50':    { full: 'Simple Moving Average (50-day)', desc: 'Medium-term trend indicator. Widely watched by institutional traders.' },
  'SMA 200':   { full: 'Simple Moving Average (200-day)', desc: 'Key long-term trend benchmark. Price above SMA 200 = broad uptrend; below = downtrend.' },
  'EMA':       { full: 'Exponential Moving Average', desc: 'Like SMA but weights recent prices more heavily, making it more responsive to new data.' },
  'BB':        { full: 'Bollinger Bands (20, 2σ)', desc: 'Volatility bands set 2 standard deviations above/below a 20-day SMA. Price near upper band = overbought; lower band = oversold. Narrow bands = low volatility (squeeze).' },
  'VOL':       { full: 'Volume', desc: 'Number of shares traded in the period. High volume confirms price moves; low volume suggests weak conviction.' },
  'RSI':       { full: 'Relative Strength Index (14)', desc: 'Momentum oscillator (0–100) measuring the speed and magnitude of price changes. Above 70 = overbought; below 30 = oversold.' },
  'MACD':      { full: 'Moving Avg. Convergence Divergence (12,26,9)', desc: 'Trend-following momentum indicator. Positive MACD = upward momentum. A bullish crossover occurs when MACD crosses above its signal line.' },
  'ATR':       { full: 'Average True Range (14)', desc: 'Average daily price range over 14 periods, measuring volatility. Used for position sizing and setting stop-loss levels. Higher ATR = more volatile stock.' },
  'OBV':       { full: 'On-Balance Volume', desc: 'Cumulative volume indicator. Rising OBV with rising price confirms the trend; divergence can signal a reversal.' },
  'HV':        { full: 'Historical Volatility (20-day, annualized)', desc: 'Annualized standard deviation of daily log returns over 20 trading days. Higher = more price risk and opportunity.' },
  'EPS':       { full: 'Earnings Per Share', desc: 'Net income divided by shares outstanding. Core measure of company profitability on a per-share basis.' },
  'P/E':       { full: 'Price-to-Earnings Ratio', desc: 'Share price divided by EPS. Shows how much investors pay per dollar of earnings. High P/E = growth expectations; low P/E = value or slow growth.' },
  'P/B':       { full: 'Price-to-Book Ratio', desc: 'Share price divided by book value per share. Below 1 may indicate undervaluation. High values suggest investors expect strong future returns on equity.' },
  'P/S':       { full: 'Price-to-Sales Ratio', desc: 'Market cap divided by annual revenue. Useful for unprofitable companies. Lower = cheaper relative to sales.' },
  'PEG':       { full: 'Price/Earnings-to-Growth Ratio', desc: 'P/E ratio divided by the annual EPS growth rate. Below 1 = potentially undervalued; above 2 = expensive relative to growth.' },
  'ROE':       { full: 'Return on Equity', desc: 'Net income as a percentage of shareholder equity. Measures how efficiently management generates profit from equity capital. Above 15% is generally strong.' },
  'ROA':       { full: 'Return on Assets', desc: 'Net income as a percentage of total assets. Measures how efficiently assets generate profit. Above 5% is generally solid.' },
  'EV/EBITDA': { full: 'Enterprise Value / EBITDA', desc: "Company's total value (market cap + net debt) divided by operating earnings. A key valuation multiple in M&A. Lower = cheaper; typical range is 8–15x depending on sector." },
  'EBITDA':    { full: 'Earnings Before Interest, Taxes, Depreciation & Amortization', desc: 'Proxy for operating cash flow, widely used to compare companies across different capital structures and tax regimes.' },
  'TTM':       { full: 'Trailing Twelve Months', desc: 'Financial data from the most recent 12-month period, giving the most current view of performance rather than the last fiscal year.' },
  'YoY':       { full: 'Year-over-Year', desc: 'Compares a metric to the same period in the prior year, filtering out seasonality.' },
  'IPO':       { full: 'Initial Public Offering', desc: "The date a company first sold its shares on a public stock exchange." },
  'ETF':       { full: 'Exchange-Traded Fund', desc: 'A basket of securities that trades on an exchange throughout the day, like a stock.' },
  'ETP':       { full: 'Exchange-Traded Product', desc: 'Umbrella term for ETFs, ETNs, and other exchange-listed investment vehicles.' },
  '%K':        { full: 'Stochastic %K (Fast)', desc: 'Current close position within the 14-period high-low range, expressed 0–100. Above 80 = overbought; below 20 = oversold.' },
  '%D':        { full: 'Stochastic %D (Slow Signal)', desc: '3-period SMA of %K. Smoother than %K. A %K crossing above %D is a bullish signal; below is bearish.' },
  'Stochastic %K': { full: 'Stochastic Oscillator %K (Fast)', desc: 'Current close position within the 14-period high-low range, expressed 0–100. Above 80 = overbought; below 20 = oversold.' },
  'Stochastic %D': { full: 'Stochastic Oscillator %D (Slow Signal)', desc: '3-period SMA of %K. Smoother signal line. %K crossing above %D is bullish.' },
  'BB Upper':  { full: 'Bollinger Band Upper', desc: '20-day SMA + 2 standard deviations. Price touching the upper band suggests overbought conditions.' },
  'BB Lower':  { full: 'Bollinger Band Lower', desc: '20-day SMA − 2 standard deviations. Price touching the lower band suggests oversold conditions.' },
  'BB %B':     { full: 'Bollinger Band %B (Position)', desc: 'Where price sits within the Bollinger Bands. 0% = at lower band; 50% = at midline; 100% = at upper band.' },
  'BB Width':  { full: 'Bollinger Band Width (Squeeze Indicator)', desc: '(Upper − Lower) / Middle × 100. Low values indicate a volatility squeeze — often a precursor to a sharp directional move.' },
  'OBV Trend': { full: 'On-Balance Volume Trend', desc: 'Compares recent 20-day net OBV to the prior 20-day net OBV. Bullish when volume is flowing into the stock, bearish when flowing out.' },
  'Max Drawdown': { full: 'Maximum Drawdown', desc: 'The largest peak-to-trough decline over the measurement period. Indicates the worst-case loss an investor could have experienced.' },
  'Z-Score':   { full: 'Z-Score (20-day)', desc: 'Number of standard deviations the current price is from its 20-day mean. Extreme positive values suggest overbought; extreme negative values suggest oversold.' },
  'TREND':     { full: 'Trend Score', desc: 'Composite score (0–100) based on price vs SMA 20/50/200, golden/death cross status, and MACD direction.' },
  'MOMENTUM':  { full: 'Momentum Score', desc: 'Composite score (0–100) based on 1-week, 1-month, 3-month, 6-month, and 12-month price returns.' },
  'MEAN REV.': { full: 'Mean Reversion Score', desc: 'Composite score (0–100) based on RSI, Stochastic, and Bollinger Band position. High score = oversold / potential bounce.' },
  'RISK':      { full: 'Risk Score', desc: 'Composite score (0–100) based on historical volatility and maximum drawdown. Higher = lower risk profile.' },
}

interface AbbrProps {
  term: string
  children?: React.ReactNode
  /** Override tooltip width (default 240) */
  width?: number
  /** Force tooltip to appear below instead of above */
  below?: boolean
}

export default function Abbr({ term, children, width = 240, below = false }: AbbrProps) {
  const [visible, setVisible] = useState(false)
  const entry = GLOSSARY[term]
  if (!entry) return <>{children ?? term}</>

  return (
    <span
      style={{ position: 'relative', display: 'inline-block', cursor: 'help' }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      <span style={{ borderBottom: '1px dotted rgba(255,255,255,0.35)' }}>
        {children ?? term}
      </span>
      {visible && (
        <div style={{
          position: 'absolute',
          ...(below
            ? { top: 'calc(100% + 6px)' }
            : { bottom: 'calc(100% + 6px)' }
          ),
          left: '50%',
          transform: 'translateX(-50%)',
          width,
          background: '#111120',
          border: '1px solid rgba(255,255,255,0.12)',
          borderRadius: 6,
          padding: '8px 12px',
          zIndex: 9999,
          pointerEvents: 'none',
          boxShadow: '0 6px 24px rgba(0,0,0,0.6)',
          whiteSpace: 'normal',
          textAlign: 'left',
        }}>
          <div style={{ fontFamily: mono, fontSize: 10, color: '#FF6B00', fontWeight: 700, marginBottom: 5, letterSpacing: 0.5 }}>
            {entry.full}
          </div>
          <div style={{ fontFamily: mono, fontSize: 10, color: 'rgba(255,255,255,0.6)', lineHeight: 1.55 }}>
            {entry.desc}
          </div>
        </div>
      )}
    </span>
  )
}
