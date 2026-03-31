import { NextRequest, NextResponse } from 'next/server'

const EDGAR_HEADERS = {
  'User-Agent': 'AlphaEdge research@alphaedge.app',
  'Accept': 'application/json',
}

function extract(block: string, tag: string): string {
  const open  = '<' + tag + '>'
  const close = '</' + tag + '>'
  const start = block.indexOf(open)
  const end   = block.indexOf(close)
  if (start === -1 || end === -1) return ''
  return block.substring(start + open.length, end).trim()
}

function parseHoldingsXML(xml: string): any[] {
  // Split on 'infoTable>' (without '<') to handle namespace prefixes like <ns1:infoTable>
  const blocks = xml.split('infoTable>')
  const holdings: any[] = []
  for (let i = 1; i < blocks.length; i++) {
    const b = blocks[i]
    const nameOfIssuer = extract(b, 'nameOfIssuer')
    if (!nameOfIssuer) continue
    const value  = parseInt(extract(b, 'value'),      10) || 0
    const shares = parseInt(extract(b, 'sshPrnamt'),  10) || 0
    holdings.push({
      nameOfIssuer,
      titleOfClass: extract(b, 'titleOfClass'),
      cusip:        extract(b, 'cusip'),
      value,
      shares,
    })
  }
  holdings.sort((a, b) => b.value - a.value)
  return holdings.slice(0, 100)
}

async function searchCIK(company: string): Promise<{ cik: string; name: string } | null> {
  const params = new URLSearchParams({ q: '"' + company + '"', forms: '13F-HR' })
  const res = await fetch(
    'https://efts.sec.gov/LATEST/search-index?' + params.toString(),
    { headers: EDGAR_HEADERS }
  )
  if (!res.ok) return null
  const json = await res.json()
  const hit = json?.hits?.hits?.[0]?._source
  if (!hit) return null
  return { cik: String(hit.entity_id ?? ''), name: hit.entity_name ?? company }
}

export async function GET(req: NextRequest) {
  const company = req.nextUrl.searchParams.get('company') ?? ''
  const cikParam = req.nextUrl.searchParams.get('cik') ?? ''

  if (!company && !cikParam) {
    return NextResponse.json({ error: 'company or cik required' }, { status: 400 })
  }

  let cik = cikParam
  let entityName = company

  if (!cik) {
    const found = await searchCIK(company)
    if (!found) return NextResponse.json({ error: 'Company not found in EDGAR' }, { status: 404 })
    cik = found.cik
    entityName = found.name
  }

  // Fetch submissions to find latest 13F-HR
  const paddedCIK = String(cik).padStart(10, '0')
  const subRes = await fetch(
    'https://data.sec.gov/submissions/CIK' + paddedCIK + '.json',
    { headers: EDGAR_HEADERS, next: { revalidate: 3600 } }
  )
  if (!subRes.ok) return NextResponse.json({ error: 'Could not fetch submissions' }, { status: 502 })
  const subJson = await subRes.json()

  if (!entityName || entityName === company) entityName = subJson?.name ?? entityName

  const recent = subJson?.filings?.recent ?? {}
  const forms:       string[] = recent.form            ?? []
  const accNos:      string[] = recent.accessionNumber ?? []
  const primaryDocs: string[] = recent.primaryDocument ?? []
  const filingDates: string[] = recent.filingDate      ?? []
  const periods:     string[] = recent.periodOfReport  ?? []

  let thirteenFIndex = -1
  for (let i = 0; i < forms.length; i++) {
    if (forms[i] === '13F-HR') { thirteenFIndex = i; break }
  }

  if (thirteenFIndex === -1) {
    return NextResponse.json({ error: 'No 13F-HR filing found for this entity' }, { status: 404 })
  }

  const accNo       = accNos[thirteenFIndex]
  const primaryDoc  = primaryDocs[thirteenFIndex]
  const filingDate  = filingDates[thirteenFIndex] ?? ''
  const periodOfReport = periods[thirteenFIndex] ?? ''

  const accNoDashes = accNo.replace(/-/g, '')
  const docUrl = 'https://www.sec.gov/Archives/edgar/data/' + cik + '/' + accNoDashes + '/' + primaryDoc

  const docRes = await fetch(docUrl, { headers: { 'User-Agent': 'AlphaEdge research@alphaedge.app' } })
  if (!docRes.ok) {
    return NextResponse.json({ error: 'Could not fetch 13F document' }, { status: 502 })
  }
  const xml = await docRes.text()
  const holdings = parseHoldingsXML(xml)

  const totalValue = holdings.reduce((s, h) => s + h.value, 0)

  return NextResponse.json({
    cik,
    entityName,
    filingDate,
    periodOfReport,
    totalValue,
    secLink: 'https://www.sec.gov/Archives/edgar/data/' + cik + '/' + accNoDashes + '/',
    holdings: holdings.map(h => ({
      ...h,
      pctOfPortfolio: totalValue > 0 ? parseFloat(((h.value / totalValue) * 100).toFixed(2)) : 0,
    })),
  })
}
