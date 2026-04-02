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
FMP_API_KEY                   # Required for analyst consensus data — financialmodelingprep.com (must be set in Vercel)
```

All env vars must also be added in **Vercel Dashboard → Settings → Environment Variables** for production.

## Branching & Deployment

- `develop` is the active development branch — all work goes here
- `main` deploys to Vercel production — merge `develop → main` to deploy
- Vercel auto-deploys on push to `main`

## Architecture

### Stack
- **Next.js 15 App Router**, TypeScript, all pages in `src/app/`
- **Supabase** for auth (OAuth) and database (`alerts`, `portfolio`, `profiles` tables with RLS)
- **Finnhub** as primary market data source; Yahoo Finance + Stooq as candle fallbacks
- **Groq API** (OpenAI-compatible) for AI chatbot — `llama-3.1-8b-instant` model
- **SnapTrade** (`snaptrade-typescript-sdk`) for external broker integration (22+ brokerages via OAuth)
- **FMP** (Financial Modeling Prep) for analyst consensus, price targets, and grades
- **SEC EDGAR** (free public API) for filing screener and institutional 13F holdings

### Data Flow
All market data is fetched server-side through Next.js API routes — never directly from client to external APIs:

| Route | Purpose |
|---|---|
| `/api/quote` | Main stock data: Finnhub quote/profile/metrics/signals + Yahoo Finance candles + optional FMP for EV/EBITDA |
| `/api/markets` | Indices, sectors, commodities (Finnhub), FX (Frankfurter/ECB), crypto |
| `/api/chat` | Injects stock/filing/portfolio context as system prompt → Groq LLM. Detects context type automatically |
| `/api/search` | Finnhub symbol search for autocomplete |
| `/api/candles` | Raw OHLCV data |
| `/api/calendar` | Earnings calendar |
| `/api/fed-rates` | US Treasury yields via Yahoo Finance (3-Mo, 5-Yr, 10-Yr, 30-Yr) with 1-year history |
| `/api/analyst` | FMP analyst consensus: price target range, grades summary, recent ratings. Cached 1hr (`revalidate: 3600`) |
| `/api/research/earnings` | Finnhub earnings calendar — `range` param: `week` / `nextweek` / `month` |
| `/api/research/ipos` | Finnhub IPO calendar — 90-day window |
| `/api/research/edgar` | SEC EDGAR full-text search — `q`, `form`, `startdt`, `enddt` params. Results sorted latest-first |
| `/api/research/edgar-company` | SEC EDGAR submissions by CIK — parses parallel arrays from `data.sec.gov` |
| `/api/research/holdings` | 13F-HR XML parser — searches EDGAR for fund CIK, fetches submissions, parses XML holdings |
| `/api/snaptrade/register` | POST — registers Supabase user with SnapTrade, stores `userSecret` in `profiles` table (idempotent) |
| `/api/snaptrade/connect` | POST — generates SnapTrade OAuth portal URL; body: `{ broker?: string }` |
| `/api/snaptrade/holdings` | GET — fetches all holdings from connected broker accounts |
| `/api/snaptrade/disconnect` | DELETE — removes a connected broker account; body: `{ accountId }` |

### Pages

| Page | Route | Auth |
|---|---|---|
| Landing | `/` | Public |
| Markets | `/markets` | Public |
| Dashboard | `/dashboard` | Protected |
| Screener | `/screener` | Public |
| Compare | `/compare` | Protected |
| Calendar | `/calendar` | Public |
| Fed Rates | `/fed-rates` | Public |
| Portfolio | `/portfolio` | Protected |
| Alerts | `/alerts` | Protected |
| Research → Earnings | `/research/earnings` | Protected |
| Research → IPOs | `/research/ipos` | Protected |
| Research → EDGAR | `/research/edgar` | Protected |
| Research → Holdings | `/research/holdings` | Protected |

### Auth
- Supabase OAuth → `/auth/callback` → cookie-based session
- `src/middleware.ts` protects `/dashboard`, `/compare`, and `/research` (all sub-routes), redirecting unauthenticated users to `/?auth=signin`
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

### ChatBot (`src/components/ChatBot.tsx`)
Floating AI chat bubble used across Dashboard, Portfolio, EDGAR, and Holdings pages.
- Accepts `stockContext` prop — automatically detects context type (stock vs. filing vs. portfolio) and adjusts system prompt
- **Stock context**: passes price, valuation, signals, scores to Groq
- **Filing context**: set via "Ask AI" button per EDGAR row — passes entity name, form type, filing date, SEC link
- **Portfolio context** (Holdings page): passes fund name, total value, top 5 holdings, position count
- Expand button in header toggles full-screen mode
- `onAskAI` callback prop allows parent to programmatically open the chat with a pre-filled question

### Navbar (`src/components/Navbar.tsx`)
- Desktop: standard links + **Research dropdown** (hover to open, 200ms close delay to prevent accidental dismiss)
- Mobile: hamburger menu with Research links expanded inline
- Research dropdown links: Earnings, IPOs, EDGAR, Holdings
- Nav links order: Markets, Dashboard, Screener, Compare, Calendar, Fed Rates, Portfolio, Alerts

### Research Section
All pages under `/research/` are protected and share a common "Research" breadcrumb header style.

**EDGAR Filing Screener** (`/research/edgar`):
- Keyword full-text search via `efts.sec.gov/LATEST/search-index` (proxied server-side with `User-Agent: AlphaEdge research@alphaedge.app`)
- Filters: form type (10-K, 10-Q, 8-K, S-1, etc.), date range
- Results sorted by filing date descending (latest first)
- "Ask AI" button per row sets filing as ChatBot context
- EDGAR field mapping: `adsh` = accession number, `ciks[]` = CIK array, `display_names[]` = company name, `file_date` = filing date, `form` = form type

**Investor Holdings** (`/research/holdings`):
- Search by fund/institution name → EDGAR CIK lookup → submissions JSON → latest 13F-HR XML → parsed holdings
- XML parsing splits on `'infoTable>'` (no leading `<`) to handle namespace variants like `<ns1:infoTable>`
- All string ops use ES5-safe methods (`indexOf`, `substring`) — tsconfig targets ES5
- Values are in thousands USD (as reported in 13F)
- ChatBot auto-activates with portfolio context once a fund is loaded

### SnapTrade Broker Integration
`src/lib/snaptrade.ts` wraps the `snaptrade-typescript-sdk`. Key notes:
- All SDK calls use a single flat params object — `loginSnapTradeUser({ userId, userSecret, broker? })` not two separate args
- SnapTrade's `pos.symbol` is a nested object — extract ticker as `sym?.symbol?.ticker ?? sym?.symbol?.symbol ?? sym?.ticker ?? sym?.raw_symbol`
- The OAuth flow: register (idempotent) → get portal URL → open in `window.open` popup → poll `popup.closed` → reload holdings
- `userSecret` is stored per-user in the `profiles` table and required for every SnapTrade API call
- Holdings are fetched on-demand from SnapTrade (not cached in DB) — SnapTrade is the source of truth for external positions
- `redirectURI` from SnapTrade is validated to be `https://` before returning — never fetched server-side

### Analyst Consensus (Dashboard → Overview tab)
- 3 FMP endpoints fetched in parallel: `/price-target-consensus`, `/grades-summary`, `/price-target`
- Displays: price target range bar with current price marker, analyst rating distribution, recent ratings table (firm, rating, target, date, source link)
- All cached 1hr (`revalidate: 3600`) to stay within FMP free tier (250 req/day)

### Fed Rates (`/fed-rates`)
Standalone page (also available as a tab in Dashboard → Fed Rates):
- Fetches 4 Treasury yields via Yahoo Finance: 3-Mo T-Bill, 5-Yr, 10-Yr, 30-Yr
- Displays: rate cards grid, yield curve bar chart, inverted curve warning, 1-year SVG line charts per instrument
- Yield curve inversion detected when 3-Mo > 10-Yr

### Database
`supabase/schema.sql` contains the full schema (`alerts`, `portfolio`, `profiles` tables with RLS policies). This file must be manually run in the **Supabase Dashboard → SQL Editor** — it is not auto-applied.

The `profiles` table stores the SnapTrade `userSecret` per user — required before any broker connection can be made.

### Security
- `package.json` `overrides` forces `axios>=1.14.0` to resolve DoS vulnerabilities in `snaptrade-typescript-sdk`'s transitive dependency
- All external API calls are proxied through Next.js API routes — no client-side calls to third-party APIs
- EDGAR requires `User-Agent` header on all requests to `efts.sec.gov` and `data.sec.gov`

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
