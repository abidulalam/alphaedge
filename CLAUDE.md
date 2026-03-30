# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (localhost:3000)
npm run build    # Production build — runs TypeScript type-check + lint (run before deploying)
npm run lint     # ESLint only
npm run start    # Start production server
```

No test suite is configured.

## Environment Variables

```
FINNHUB_API_KEY               # Required — free key from finnhub.io
NEXT_PUBLIC_SUPABASE_URL      # Required — Supabase project URL
NEXT_PUBLIC_SUPABASE_ANON_KEY # Required — Supabase anon key
GROQ_API_KEY                  # Required for AI chatbot — free key from groq.com (confirmed added to Vercel)
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
- **Supabase** for auth (OAuth) and database (`alerts`, `portfolio` tables with RLS)
- **Finnhub** as primary market data source; Yahoo Finance + Stooq as candle fallbacks
- **Groq API** (OpenAI-compatible) for AI chatbot — `llama-3.1-8b-instant` model

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

### Database
`supabase/schema.sql` contains the full schema (`alerts`, `portfolio` tables with RLS policies). This file must be manually run in the **Supabase Dashboard → SQL Editor** — it is not auto-applied.
