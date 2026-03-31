import { NextRequest, NextResponse } from 'next/server'

const EDGAR_HEADERS = {
  'User-Agent': 'AlphaEdge research@alphaedge.app',
  'Accept': 'application/json',
}

export async function GET(req: NextRequest) {
  const q       = req.nextUrl.searchParams.get('q') ?? ''
  const form    = req.nextUrl.searchParams.get('form') ?? '10-K'
  const startdt = req.nextUrl.searchParams.get('startdt') ?? ''
  const enddt   = req.nextUrl.searchParams.get('enddt') ?? ''

  if (!q.trim()) return NextResponse.json({ error: 'query required' }, { status: 400 })

  const params = new URLSearchParams({ q: '"' + q + '"', forms: form })
  if (startdt && enddt) {
    params.set('dateRange', 'custom')
    params.set('startdt', startdt)
    params.set('enddt', enddt)
  }

  const url = 'https://efts.sec.gov/LATEST/search-index?' + params.toString()
  const res = await fetch(url, { headers: EDGAR_HEADERS, next: { revalidate: 3600 } })
  if (!res.ok) return NextResponse.json({ error: 'EDGAR search failed: ' + res.status }, { status: 502 })

  const json = await res.json()
  const hits: any[] = json?.hits?.hits ?? []

  const filings = hits.slice(0, 50).map((h: any) => {
    const src = h._source ?? {}
    const accNo: string = src.accession_no ?? ''
    const entityId: string = src.entity_id ?? ''
    return {
      entityName:      src.entity_name     ?? '',
      cik:             entityId,
      filingDate:      src.file_date        ?? '',
      form:            src.form_type        ?? form,
      periodOfReport:  src.period_of_report ?? '',
      accessionNumber: accNo,
      secLink: accNo && entityId
        ? 'https://www.sec.gov/Archives/edgar/data/' + entityId + '/' + accNo.replace(/-/g, '') + '/'
        : '',
    }
  })

  // Filing Analysis: count mentions per company
  const companyCounts: Record<string, number> = {}
  filings.forEach(f => {
    if (f.entityName) {
      companyCounts[f.entityName] = (companyCounts[f.entityName] || 0) + 1
    }
  })
  const topCompanies = Object.entries(companyCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }))

  return NextResponse.json({
    filings,
    total: json?.hits?.total?.value ?? filings.length,
    query: q,
    topCompanies,
  })
}
