'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import Navbar from '@/components/Navbar'
import ScoreBar from '@/components/ScoreBar'

const StockChart = dynamic(() => import('@/components/StockChart'), { ssr: false })

interface Stock {
  ticker: string; name: string; price: number|null; changePct: number|null
  marketCap: number|null; pe: number|null; eps: number|null
  revenueGrowth: number|null; employees: number|null; sector: string|null
  moatScore: number|null; growthScore: number|null
  chartData: {t:number;c:number}[]
}

function fmt(n: number|null) {
  if (n==null) return '—'
  if (n>=1e12) return `$${(n/1e12).toFixed(1)}T`
  if (n>=1e9)  return `$${(n/1e9).toFixed(1)}B`
  if (n>=1e6)  return `$${(n/1e6).toFixed(1)}M`
  return `$${n.toLocaleString()}`
}

export default function Compare() {
  const params = useSearchParams()
  const [tickerA, setTickerA] = useState(params.get('a') || 'AAPL')
  const [tickerB, setTickerB] = useState(params.get('b') || 'MSFT')
  const [dataA, setDataA]     = useState<Stock|null>(null)
  const [dataB, setDataB]     = useState<Stock|null>(null)
  const [loadA, setLoadA]     = useState(false)
  const [loadB, setLoadB]     = useState(false)

  const fetch_ = useCallback(async (t: string, setData: (d:Stock)=>void, setLoad: (b:boolean)=>void) => {
    if (!t) return
    setLoad(true)
    try {
      const res = await fetch(`/api/quote?ticker=${t}`)
      const d = await res.json()
      if (!d.error) setData(d)
    } finally { setLoad(false) }
  }, [])

  useEffect(() => { fetch_(tickerA, setDataA, setLoadA) }, [tickerA, fetch_])
  useEffect(() => { fetch_(tickerB, setDataB, setLoadB) }, [tickerB, fetch_])

  const mono: React.CSSProperties = { fontFamily: 'var(--mono)' }

  const metrics = dataA && dataB ? [
    { label: 'Price',          a: dataA.price ? `$${dataA.price.toFixed(2)}` : '—',  b: dataB.price ? `$${dataB.price.toFixed(2)}` : '—',  ra: dataA.price,          rb: dataB.price,          higher: 'neutral' },
    { label: 'Market Cap',     a: fmt(dataA.marketCap),     b: fmt(dataB.marketCap),     ra: dataA.marketCap,      rb: dataB.marketCap,      higher: 'neutral' },
    { label: 'Change (1d)',    a: dataA.changePct!=null?`${dataA.changePct.toFixed(2)}%`:'—', b: dataB.changePct!=null?`${dataB.changePct.toFixed(2)}%`:'—', ra: dataA.changePct, rb: dataB.changePct, higher: 'good' },
    { label: 'Moat Score',     a: dataA.moatScore?`${dataA.moatScore}/100`:'—',   b: dataB.moatScore?`${dataB.moatScore}/100`:'—',   ra: dataA.moatScore,      rb: dataB.moatScore,      higher: 'good' },
    { label: 'Growth Score',   a: dataA.growthScore?`${dataA.growthScore}/100`:'—', b: dataB.growthScore?`${dataB.growthScore}/100`:'—', ra: dataA.growthScore,    rb: dataB.growthScore,    higher: 'good' },
    { label: 'P/E Ratio',      a: dataA.pe?.toFixed(1)??'—', b: dataB.pe?.toFixed(1)??'—', ra: dataA.pe,             rb: dataB.pe,             higher: 'lower' },
    { label: 'EPS',            a: dataA.eps?`$${dataA.eps.toFixed(2)}`:'—', b: dataB.eps?`$${dataB.eps.toFixed(2)}`:'—', ra: dataA.eps,  rb: dataB.eps,            higher: 'good' },
    { label: 'Rev Growth',     a: dataA.revenueGrowth?`${(dataA.revenueGrowth*100).toFixed(1)}%`:'—', b: dataB.revenueGrowth?`${(dataB.revenueGrowth*100).toFixed(1)}%`:'—', ra: dataA.revenueGrowth, rb: dataB.revenueGrowth, higher: 'good' },
    { label: 'Employees',      a: dataA.employees?.toLocaleString()??'—', b: dataB.employees?.toLocaleString()??'—', ra: dataA.employees, rb: dataB.employees, higher: 'neutral' },
    { label: 'Sector',         a: dataA.sector??'—', b: dataB.sector??'—', ra: null, rb: null, higher: 'neutral' },
  ] : []

  function winner(m: typeof metrics[0]) {
    if (!m.ra || !m.rb || m.higher==='neutral') return null
    if (m.higher==='good')  return m.ra > m.rb ? 'a' : 'b'
    if (m.higher==='lower') return m.ra < m.rb ? 'a' : 'b'
    return null
  }

  const verdict = dataA && dataB ? (() => {
    const sa = (dataA.moatScore??0) + (dataA.growthScore??0)
    const sb = (dataB.moatScore??0) + (dataB.growthScore??0)
    if (sa===sb) return `${dataA.ticker} and ${dataB.ticker} are evenly matched on combined moat + growth. The decision comes down to valuation, sector tailwinds, and your time horizon.`
    const w = sa>sb ? dataA : dataB
    const l = sa>sb ? dataB : dataA
    const ws = sa>sb ? sa : sb, ls = sa>sb ? sb : sa
    return `${w.ticker} edges out ${l.ticker} on combined moat + growth (${ws} vs ${ls}). ${w.name} shows stronger competitive positioning — the higher-conviction pick at equivalent valuations. Always verify with your own analysis before investing.`
  })() : null

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '48px 48px 80px' }}>

        <div style={{ marginBottom: 40 }}>
          <div style={{ ...mono, fontSize: 11, color: 'var(--accent)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ display:'block', width:20, height:1, background:'var(--accent)' }} />Compare
          </div>
          <h1 style={{ fontSize: 34, fontWeight: 600, letterSpacing: -0.8, marginBottom: 8 }}>Side-by-side analysis.</h1>
          <p style={{ fontSize: 15, color: 'var(--text2)', fontWeight: 300 }}>Compare any two stocks across moat, growth, valuation, and AI scores.</p>
        </div>

        {/* PICKERS */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 32 }}>
          {[{label:'Stock A', val:tickerA, set:setTickerA, loading:loadA, data:dataA},
            {label:'Stock B', val:tickerB, set:setTickerB, loading:loadB, data:dataB}].map((s,i) => (
            <div key={i} style={{ flex:1, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:8, padding:20 }}>
              <div style={{ ...mono, fontSize:10, color:'var(--text3)', letterSpacing:2, textTransform:'uppercase', marginBottom:10 }}>{s.label}</div>
              <input
                value={s.val}
                onChange={e => s.set(e.target.value.toUpperCase())}
                maxLength={6}
                style={{ ...mono, fontSize:22, fontWeight:600, letterSpacing:2, textTransform:'uppercase', marginBottom:8 }}
              />
              {s.loading && <div style={{ fontSize:12, color:'var(--text3)', ...mono }}>Loading…</div>}
              {s.data && !s.loading && <div style={{ fontSize:13, color:'var(--text2)' }}>{s.data.name}</div>}
            </div>
          ))}
          <div style={{ ...mono, fontSize:18, fontWeight:600, color:'var(--text3)', flexShrink:0 }}>VS</div>
        </div>

        {dataA && dataB && (
          <>
            {/* PRICE HEADERS */}
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:24, paddingBottom:20, borderBottom:'1px solid var(--border)' }}>
              {[dataA, dataB].map((d,i) => (
                <div key={i} style={{ textAlign: i===1 ? 'right' : 'left' }}>
                  <div style={{ ...mono, fontSize:13, color:'var(--text3)', marginBottom:4, letterSpacing:1 }}>{d.ticker}</div>
                  <div style={{ ...mono, fontSize:32, fontWeight:600, color:(d.changePct??0)>=0?'var(--accent)':'var(--red)' }}>{d.price?`$${d.price.toFixed(2)}`:'—'}</div>
                  {d.changePct!=null && <div style={{ ...mono, fontSize:12, color:(d.changePct)>=0?'var(--accent)':'var(--red)', marginTop:4 }}>{(d.changePct)>=0?'▲':'▼'} {Math.abs(d.changePct).toFixed(2)}% today</div>}
                </div>
              ))}
            </div>

            {/* CHARTS */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 }}>
              {[{d:dataA,up:(dataA.changePct??0)>=0},{d:dataB,up:(dataB.changePct??0)>=0}].map(({d,up},i) => (
                <div key={i} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, padding:'16px 12px 10px' }}>
                  <div style={{ ...mono, fontSize:11, color:'var(--text3)', marginBottom:12 }}>{d.ticker} — 1 Year</div>
                  {d.chartData.length>0
                    ? <StockChart data={d.chartData} positive={up} />
                    : <div style={{ height:140, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--text3)', fontSize:13 }}>No chart data</div>}
                </div>
              ))}
            </div>

            {/* SCORES */}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16, marginBottom:24 }}>
              {[dataA, dataB].map(d => (
                <div key={d.ticker} style={{ background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:6, padding:16 }}>
                  <div style={{ ...mono, fontSize:11, color:'var(--accent)', letterSpacing:1, textTransform:'uppercase', marginBottom:14 }}>{d.ticker} scores</div>
                  {d.moatScore!=null   && <ScoreBar lbl="Moat score"   score={d.moatScore} />}
                  {d.growthScore!=null && <ScoreBar lbl="Growth score" score={d.growthScore} />}
                </div>
              ))}
            </div>

            {/* METRICS TABLE */}
            <div style={{ border:'1px solid var(--border)', borderRadius:8, overflow:'hidden', marginBottom:24 }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', padding:'10px 16px', background:'var(--bg3)', borderBottom:'1px solid var(--border)', ...mono, fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1 }}>
                <span />
                <span>{dataA.ticker}</span>
                <span>{dataB.ticker}</span>
              </div>
              {metrics.map((m,i) => {
                const w = winner(m)
                return (
                  <div key={m.label} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', padding:'12px 16px', borderBottom:'1px solid var(--border)', background: i%2===0?'var(--bg2)':'var(--bg3)' }}>
                    <span style={{ fontSize:13, color:'var(--text2)' }}>{m.label}</span>
                    <span style={{ ...mono, fontSize:13, color: w==='a'?'var(--accent)':'var(--text)', fontWeight: w==='a'?500:400 }}>{m.a}{w==='a' && ' ✓'}</span>
                    <span style={{ ...mono, fontSize:13, color: w==='b'?'var(--accent)':'var(--text)', fontWeight: w==='b'?500:400 }}>{m.b}{w==='b' && ' ✓'}</span>
                  </div>
                )
              })}
            </div>

            {/* VERDICT */}
            <div style={{ background:'rgba(0,217,126,.04)', border:'1px solid rgba(0,217,126,.2)', borderRadius:8, padding:'20px 22px' }}>
              <div style={{ ...mono, fontSize:10, color:'var(--accent)', background:'rgba(0,217,126,.1)', border:'1px solid rgba(0,217,126,.2)', padding:'2px 10px', borderRadius:3, display:'inline-block', marginBottom:12, letterSpacing:1, textTransform:'uppercase' }}>AI VERDICT</div>
              <p style={{ fontSize:14, color:'var(--text2)', lineHeight:1.75 }}>{verdict}</p>
            </div>
          </>
        )}

        {(!dataA || !dataB) && !loadA && !loadB && (
          <div style={{ padding:'80px 0', textAlign:'center', color:'var(--text3)', ...mono, fontSize:14 }}>
            Enter two tickers above to begin your comparison.
          </div>
        )}
      </div>
    </>
  )
}
