import { NextRequest, NextResponse } from 'next/server'

const EDGAR_HEADERS = {
  'User-Agent': 'AlphaEdge research@alphaedge.app',
  'Accept': 'application/json',
}

export async function GET(req: NextRequest) {
  const cik  = req.nextUrl.searchParams.get('cik') ?? ''
  const form = req.nextUrl.searchParams.get('form') ?? '10-K'

  if (!cik) return NextResponse.json({ error: 'cik required' }, { status: 400 })

  const paddedCIK = String(cik).padStart(10, '0')
  const url = 'https://data.sec.gov/submissions/CIK' + paddedCIK + '.json'

  const res = await fetch(url, { headers: EDGAR_HEADERS, next: { revalidate: 3600 } })
  if (!res.ok) return NextResponse.json({ error: 'EDGAR company fetch failed: ' + res.status }, { status: 502 })

  const json = await res.json()
  const recent = json?.filings?.recent ?? {}
  const forms:      string[] = recent.form             ?? []
  const dates:      string[] = recent.filingDate       ?? []
  const accNos:     string[] = recent.accessionNumber  ?? []
  const primaryDocs:string[] = recent.primaryDocument  ?? []
  const descriptions:string[]= recent.description      ?? []

  const filings: any[] = []
  for (let i = 0; i < forms.length; i++) {
    if (forms[i] === form) {
      filings.push({
        filingDate:      dates[i]        ?? '',
        accessionNumber: accNos[i]       ?? '',
        primaryDocument: primaryDocs[i]  ?? '',
        description:     descriptions[i] ?? '',
        secLink: accNos[i]
          ? 'https://www.sec.gov/Archives/edgar/data/' + cik + '/' + accNos[i].replace(/-/g, '') + '/'
          : '',
      })
    }
    if (filings.length >= 20) break
  }

  return NextResponse.json({
    cik,
    entityName: json?.name ?? '',
    form,
    filings,
  })
}
