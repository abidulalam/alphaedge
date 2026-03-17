# AlphaEdge — AI Equity Research Platform

A Bloomberg-terminal-style stock research app powered by AI scoring and live Finnhub data.
Built with Next.js 14, TypeScript, and Recharts.

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up your API keys
```bash
cp .env.local.example .env.local
```
Then open `.env.local` and add your keys:
```
FINNHUB_API_KEY=your_key_here
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```
Get a free Finnhub key at https://finnhub.io (free tier covers everything used here).
Get Supabase credentials from your project dashboard at https://supabase.com.

### 3. Run locally
```bash
npm run dev
```
Open http://localhost:3000

---

## Deploy to Vercel (drag & drop)

1. Run `npm run build` to verify it builds cleanly
2. Zip the entire project folder (excluding `node_modules` and `.next`)
3. Go to https://vercel.com → "Add New Project" → drag & drop the zip
4. In Vercel's Environment Variables settings, add:
   - `FINNHUB_API_KEY` — your Finnhub API key
   - `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — your Supabase anon key
5. Click Deploy — done!

Alternatively, push to GitHub and connect the repo to Vercel for automatic deploys.

---

## Project Structure

```
src/
  app/
    page.tsx              # Landing page
    layout.tsx            # Root layout + metadata
    globals.css           # Global dark theme variables
    api/
      quote/route.ts      # GET /api/quote?ticker=NVDA
      search/route.ts     # GET /api/search?q=apple
      ticker/route.ts     # GET /api/ticker  (ticker tape)
    auth/
      callback/route.ts   # Supabase OAuth callback
      error/page.tsx      # Auth error page
    dashboard/
      page.tsx            # Main research dashboard
    screener/
      page.tsx            # Stock screener
    compare/
      page.tsx            # Side-by-side stock comparison
  components/
    Navbar.tsx            # Sticky top nav with search + auth
    SearchBar.tsx         # Autocomplete search
    TickerTape.tsx        # Live scrolling ticker
    StockChart.tsx        # 1Y area chart (Recharts)
    ScoreBar.tsx          # Moat/growth score bars
    AuthModal.tsx         # Sign in / sign up modal
  lib/
    finnhub.ts            # Finnhub API client + quant signal computation
    supabase-browser.ts   # Supabase client for use client components
    supabase-server.ts    # Supabase client for server components
  middleware.ts           # Auth guard — redirects unauthenticated users
```

## Customisation

- **Branding**: Search for "AlphaEdge" / "ALPHAEDGE" across files to rename
- **Watchlist**: Edit `DEFAULT_WATCHLIST` in `src/app/dashboard/page.tsx`
- **Scoring**: Adjust `computeMoatScore` / `computeGrowthScore` in `src/lib/finnhub.ts`
- **Colors**: All theme variables live in `src/app/globals.css`
- **Features/Pricing**: Edit the features and plans arrays in `src/app/page.tsx`
