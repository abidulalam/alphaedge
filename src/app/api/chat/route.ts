import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { messages, stockContext } = body

  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: 'messages required' }, { status: 400 })
  }

  const apiKey = process.env.GROQ_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Groq API key not configured' }, { status: 500 })
  }

  // Detect if this is a filing/portfolio context (from Research pages) vs stock context (from Dashboard)
  const isFilingContext = stockContext?.filingType || stockContext?.top5Holdings

  const systemPrompt = stockContext
    ? isFilingContext
      ? `You are AlphaEdge AI, a financial analyst assistant embedded in the AlphaEdge research platform. You are knowledgeable, concise, and data-driven.

${stockContext.top5Holdings
  ? `You are analyzing an institutional portfolio (13F filing):
- Institution: ${stockContext.name}
- Filing: ${stockContext.sector ?? '13F-HR'}
- Total Portfolio Value: ${stockContext.marketCap ? (stockContext.marketCap >= 1e12 ? '$' + (stockContext.marketCap / 1e12).toFixed(2) + 'T' : stockContext.marketCap >= 1e9 ? '$' + (stockContext.marketCap / 1e9).toFixed(2) + 'B' : '$' + (stockContext.marketCap / 1e6).toFixed(2) + 'M') : 'N/A'}
- Number of Positions: ${stockContext.holdingsCount ?? 'N/A'}
- Top 5 Holdings: ${stockContext.top5Holdings}

Answer questions about this institutional portfolio — investment strategy, concentration risk, sector exposure, notable positions, or what the holdings reveal about the manager's thesis. Be concise and analytical. Do not make up data beyond what is provided.`
  : `You are analyzing an SEC EDGAR filing:
- Company: ${stockContext.name}
- Filing: ${stockContext.sector ?? stockContext.filingType}
- SEC EDGAR Link: ${stockContext.secLink ?? 'N/A'}
- Search keyword that surfaced this filing: "${stockContext.searchQuery ?? ''}"

Help the user understand what this type of filing contains, what to look for, and what questions to ask about it. Answer questions about the company's disclosures, regulatory filings, and what the filing type (${stockContext.filingType ?? 'SEC filing'}) typically covers. Be concise and analytical.`}`
      : `You are AlphaEdge AI, a financial analyst assistant embedded in the AlphaEdge stock research platform. You are knowledgeable, concise, and data-driven.

Current stock context:
- Ticker: ${stockContext.ticker}
- Company: ${stockContext.name}
- Price: $${stockContext.price?.toFixed(2) ?? 'N/A'}
- Change: ${stockContext.changePct != null ? (stockContext.changePct >= 0 ? '+' : '') + stockContext.changePct.toFixed(2) + '%' : 'N/A'}
- Market Cap: ${stockContext.marketCap ? (stockContext.marketCap >= 1e12 ? '$' + (stockContext.marketCap / 1e12).toFixed(2) + 'T' : stockContext.marketCap >= 1e9 ? '$' + (stockContext.marketCap / 1e9).toFixed(2) + 'B' : '$' + (stockContext.marketCap / 1e6).toFixed(2) + 'M') : 'N/A'}
- Sector: ${stockContext.sector ?? 'N/A'}
- P/E Ratio: ${stockContext.pe?.toFixed(2) ?? 'N/A'}
- EPS: ${stockContext.eps?.toFixed(2) ?? 'N/A'}
- PEG Ratio: ${stockContext.pegRatio?.toFixed(2) ?? 'N/A'}
- EV/EBITDA: ${stockContext.evToEbitda?.toFixed(2) ?? 'N/A'}
- Revenue Growth (YoY): ${stockContext.revenueGrowth != null ? (stockContext.revenueGrowth * 100).toFixed(1) + '%' : 'N/A'}
- Profit Margin: ${stockContext.profitMargins != null ? (stockContext.profitMargins * 100).toFixed(1) + '%' : 'N/A'}
- Free Cash Flow: ${stockContext.freeCashflow ? (Math.abs(stockContext.freeCashflow) >= 1e9 ? '$' + (stockContext.freeCashflow / 1e9).toFixed(2) + 'B' : '$' + (stockContext.freeCashflow / 1e6).toFixed(2) + 'M') : 'N/A'}
- Beta: ${stockContext.beta?.toFixed(2) ?? 'N/A'}
- ROE: ${stockContext.roeTTM?.toFixed(1) ?? 'N/A'}%
- Debt/Equity: ${stockContext.debtToEquity?.toFixed(2) ?? 'N/A'}
- 52-Week High: $${stockContext.fiftyTwoWeekHigh?.toFixed(2) ?? 'N/A'}
- 52-Week Low: $${stockContext.fiftyTwoWeekLow?.toFixed(2) ?? 'N/A'}
- Moat Score: ${stockContext.moatScore ?? 'N/A'}/100
- Growth Score: ${stockContext.growthScore ?? 'N/A'}/100
- Quant Signal: ${stockContext.quantSignals?.trend ?? 'N/A'}

Answer questions about this stock using the data above. Be concise (2-4 sentences unless more detail is needed). When asked for a recommendation, give a balanced view with reasoning. Do not make up data — if something isn't in the context, say so.`
    : `You are AlphaEdge AI, a financial analyst assistant. Help users with stock research, financial concepts, and investment analysis. Be concise and data-driven.`

  const groqMessages = [
    { role: 'system', content: systemPrompt },
    ...messages.map((m: { role: string; content: string }) => ({
      role: m.role,
      content: m.content,
    })),
  ]

  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: 'llama-3.1-8b-instant',
      messages: groqMessages,
      temperature: 0.7,
      max_tokens: 512,
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[chat] Groq error:', err)
    return NextResponse.json({ error: 'AI API error' }, { status: 500 })
  }

  const json = await res.json()
  const text = json?.choices?.[0]?.message?.content ?? 'No response generated.'

  return NextResponse.json({ reply: text })
}
