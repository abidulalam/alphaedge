# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev              # Start dev server (localhost:3000)
npm run build            # Production build — runs TypeScript type-check + lint (run before deploying)
npm run lint             # ESLint only
npm run start            # Start production server
npm test                 # All unit + integration tests (92 tests)
npm run test:unit        # Unit tests only (src/__tests__/unit/)
npm run test:integration # Integration tests only (src/__tests__/integration/)
npm run test:coverage    # Tests + HTML coverage report (coverage/)
npm run test:e2e         # Playwright E2E tests (requires dev server running)
npm run test:e2e:ui      # Playwright with interactive UI
```

## Environment Variables

```
FINNHUB_API_KEY               # Required — free key from finnhub.io
NEXT_PUBLIC_SUPABASE_URL      # Required — Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY # Required — Supabase anon key
GROQ_API_KEY                  # Required for AI chatbot — free key from groq.com (confirmed added to Vercel)
SNAPTRADE_CLIENT_ID           # Required for broker integration — from SnapTrade developer dashboard
SNAPTRADE_CONSUMER_KEY        # Required for broker integration — from SnapTrade developer dashboard
FMP_API_KEY                   # Optional — financialmodelingprep.com for EV/EBITDA metric
```

All env vars must also be added in **Vercel Dashboard → Settings → Environment Variables** for production.

## Branching & Deployment

- `develop` is the active development branch — all work goes here
- `main` deploys to Vercel production — merge `develop → main` to deploy
- Vercel auto-deploys on push to `main`

## Architecture

### Stack
- **Next.js 14 App Router**, TypeScript, all pages in `src/app/`
- **Supabase** for auth (OAuth) and database (`alerts`, `portfolio`, `profiles` tables with RLS)
- **Finnhub** as primary market data source; Yahoo Finance + Stooq as candle fallbacks
- **Groq API** (OpenAI-compatible) for AI chatbot — `llama-3.1-8b-instant` model
- **SnapTrade** (`snaptrade-typescript-sdk`) for external broker integration (22+ brokerages via OAuth)

### Data Flow
All market data is fetched server-side through Next.js API routes — never directly from client to external APIs:

| Route | Purpose |
|---|---|
| `/api/quote` | Main stock data: Finnhub quote/profile/metrics/signals + Yahoo Finance candles + optional FMP for EV/EBITDA |
| `/api/markets` | Indices, sectors, commodities (Finnhub), FX (Frankfurter/ECB), crypto |
| `/api/chat` | Injects full stock context as system prompt → Groq LLM |
| `/api/search` | Finnhub symbol search for autocomplete |
| `/api/candles` | Raw OHLCV data |
| `/api/calendar` | Earnings calendar |
| `/api/fed-rates` | Federal Reserve rate data |
| `/api/snaptrade/register` | POST — registers Supabase user with SnapTrade, stores `userSecret` in `profiles` table (idempotent) |
| `/api/snaptrade/connect` | POST — generates SnapTrade OAuth portal URL; body: `{ broker?: string }` |
| `/api/snaptrade/holdings` | GET — fetches all holdings from connected broker accounts |
| `/api/snaptrade/disconnect` | DELETE — removes a connected broker account; body: `{ accountId }` |

### Auth
- Supabase OAuth → `/auth/callback` → cookie-based session
- `src/middleware.ts` protects `/dashboard` and `/compare`, redirecting unauthenticated users to `/?auth=signin`
- Server components use `createSupabaseServerClient()` from `src/lib/supabase-server.ts` — this function is `async` and must be `await`ed (Next.js 15 async cookies API)
- Client components use `src/lib/supabase-browser.ts`

### Quant Signal Engine (`src/lib/finnhub.ts`)
`computeQuantSignals()` computes all technical indicators from raw OHLCV candles:
- Indicators: SMA (20/50/200), RSI (14), MACD (12,26,9), Bollinger Bands (20,2), Stochastic %K/%D, ATR, OBV, ADX
- Composite score formula: `trendScore×0.4 + momScore×0.4 + mrScore×0.1 + riskScore×0.1`
- Verdict thresholds: ≥75 STRONG BUY, ≥58 BUY, ≥42 NEUTRAL, ≥28 SELL, <28 STRONG SELL

### UI Patterns
- **Inline styles are used throughout** — CSS media query classes cannot reliably override them. Use the `useIsMobile` hook (`src/hooks/useIsMobile.ts`, breakpoint 768px) to conditionally set values directly in inline `style` props for responsive behavior.
- **Dynamic imports with `ssr: false`** are required for charting components (`lightweight-charts`-based `AdvancedChart`)
- **Command palette** (`CommandBar.tsx`) opens with Cmd+K / Ctrl+K; supports built-in commands (MKT, SCRN, CMP, etc.) and ticker autocomplete
- **Watchlist** is persisted to `localStorage` under the key `alphaedge_watchlist`
- Theme: dark navy, orange accent `#FF5500`, CSS variables in `globals.css`, IBM Plex Mono + Space Grotesk fonts

### SnapTrade Broker Integration
`src/lib/snaptrade.ts` wraps the `snaptrade-typescript-sdk`. Key notes:
- All SDK calls use a single flat params object — `loginSnapTradeUser({ userId, userSecret, broker? })` not two separate args
- SnapTrade's `pos.symbol` is a nested object `{id, symbol, ticker, raw_symbol, ...}` — extract ticker as `sym?.symbol?.ticker ?? sym?.raw_symbol`
- The OAuth flow: register (idempotent) → get portal URL → open in `window.open` popup → poll `popup.closed` → reload holdings
- `userSecret` is stored per-user in the `profiles` table and required for every SnapTrade API call
- Holdings are fetched on-demand from SnapTrade (not cached in DB) — SnapTrade is the source of truth for external positions

### Database
`supabase/schema.sql` contains the full schema (`alerts`, `portfolio`, `profiles` tables with RLS policies). This file must be manually run in the **Supabase Dashboard → SQL Editor** — it is not auto-applied.

The `profiles` table stores the SnapTrade `userSecret` per user — required before any broker connection can be made.

## Testing

### Structure
```
src/__tests__/
  fixtures/candles.ts       # Synthetic OHLCV data generators (makeCandles, bullCandles, bearCandles, flatCandles)
  setup.ts                  # @testing-library/jest-dom setup
  unit/
    finnhub.test.ts          # computeQuantSignals, computeMoatScore, computeGrowthScore
    useIsMobile.test.ts      # Hook resize/cleanup behaviour
    ScoreBar.test.tsx         # Component label/color/width logic
  integration/
    api-chat.test.ts          # POST /api/chat with mocked Groq API
    api-quote.test.ts         # GET /api/quote with mocked Finnhub + Yahoo fallback
    api-search.test.ts        # GET /api/search filtering and error handling
e2e/
  home.spec.ts               # Landing page, CTA, ticker tape
  auth.spec.ts               # Auth guard redirects, sign-in form
  markets.spec.ts            # Markets page public access
  calendar.spec.ts           # Default Earnings tab, tab switching
  mobile.spec.ts             # No horizontal scroll, touch targets (Pixel 5 viewport)
```

### Key patterns
- Integration tests mock `global.fetch` and `global.setTimeout` — import the route handler after setting up mocks
- `bullCandles(252)` / `bearCandles(252)` produce deterministic trend data for signal threshold tests
- E2E tests run against `localhost:3000` by default; set `PLAYWRIGHT_BASE_URL` to override for staging
