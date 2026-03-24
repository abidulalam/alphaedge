import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { messages, stockContext } = body

  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json({ error: 'messages required' }, { status: 400 })
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'Gemini API key not configured' }, { status: 500 })
  }

  const systemPrompt = stockContext
    ? `You are AlphaEdge AI, a financial analyst assistant embedded in the AlphaEdge stock research platform. You are knowledgeable, concise, and data-driven.

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

  // Build Gemini-format contents array (no system role — prepend as first user/model turn)
  const geminiContents = [
    { role: 'user', parts: [{ text: systemPrompt + '\n\nUnderstood. I am ready to assist.' }] },
    { role: 'model', parts: [{ text: 'Understood. I am AlphaEdge AI, ready to help you analyze ' + (stockContext?.ticker ?? 'stocks') + '. What would you like to know?' }] },
    ...messages.map((m: { role: string; content: string }) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    })),
  ]

  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: geminiContents,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 512,
      },
    }),
  })

  if (!res.ok) {
    const err = await res.text()
    console.error('[chat] Gemini error:', err)
    return NextResponse.json({ error: 'Gemini API error' }, { status: 500 })
  }

  const json = await res.json()
  const text = json?.candidates?.[0]?.content?.parts?.[0]?.text ?? 'No response generated.'

  return NextResponse.json({ reply: text })
}
