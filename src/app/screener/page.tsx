'use client'
import { useState } from 'react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'

const STOCKS = [
  { ticker:'AAPL', name:'Apple Inc',             sector:'Technology',     moat:91,growth:72,cap:2980,pe:28.4,chg: 1.24 },
  { ticker:'MSFT', name:'Microsoft Corp',         sector:'Technology',     moat:95,growth:78,cap:3110,pe:34.1,chg: 0.87 },
  { ticker:'GOOGL',name:'Alphabet Inc',           sector:'Technology',     moat:88,growth:65,cap:2100,pe:22.8,chg:-0.34 },
  { ticker:'NVDA', name:'NVIDIA Corp',            sector:'Semiconductors', moat:92,growth:96,cap:2160,pe:64.2,chg: 2.11 },
  { ticker:'META', name:'Meta Platforms',         sector:'Technology',     moat:84,growth:81,cap:1290,pe:26.7,chg: 1.56 },
  { ticker:'AMZN', name:'Amazon.com Inc',         sector:'Consumer',       moat:89,growth:74,cap:1980,pe:43.5,chg:-0.19 },
  { ticker:'TSLA', name:'Tesla Inc',              sector:'Automotive',     moat:62,growth:44,cap: 552,pe:49.1,chg:-3.82 },
  { ticker:'JPM',  name:'JPMorgan Chase',         sector:'Financials',     moat:78,growth:62,cap: 680,pe:12.4,chg: 0.62 },
  { ticker:'V',    name:'Visa Inc',               sector:'Financials',     moat:93,growth:67,cap: 568,pe:30.8,chg: 0.33 },
  { ticker:'MA',   name:'Mastercard Inc',         sector:'Financials',     moat:92,growth:69,cap: 432,pe:33.2,chg: 0.51 },
  { ticker:'LLY',  name:'Eli Lilly',              sector:'Healthcare',     moat:86,growth:88,cap: 730,pe:58.9,chg: 1.08 },
  { ticker:'UNH',  name:'UnitedHealth Group',     sector:'Healthcare',     moat:79,growth:63,cap: 490,pe:20.3,chg:-0.44 },
  { ticker:'PG',   name:'Procter & Gamble',       sector:'Consumer',       moat:85,growth:44,cap: 370,pe:24.6,chg: 0.18 },
  { ticker:'KO',   name:'Coca-Cola Co',           sector:'Consumer',       moat:88,growth:38,cap: 258,pe:22.9,chg: 0.09 },
  { ticker:'COST', name:'Costco Wholesale',       sector:'Consumer',       moat:83,growth:66,cap: 390,pe:51.4,chg: 0.74 },
  { ticker:'AMD',  name:'Advanced Micro Devices', sector:'Semiconductors', moat:74,growth:82,cap: 246,pe:44.8,chg: 1.33 },
  { ticker:'AVGO', name:'Broadcom Inc',           sector:'Semiconductors', moat:81,growth:79,cap: 860,pe:35.6,chg: 0.98 },
  { ticker:'NFLX', name:'Netflix Inc',            sector:'Technology',     moat:71,growth:73,cap: 280,pe:41.2,chg: 0.61 },
  { ticker:'SPGI', name:'S&P Global Inc',         sector:'Financials',     moat:90,growth:64,cap: 148,pe:41.3,chg: 0.44 },
  { ticker:'ABBV', name:'AbbVie Inc',             sector:'Healthcare',     moat:74,growth:58,cap: 312,pe:16.4,chg: 0.37 },
]
const SECTORS = ['All', ...Array.from(new Set(STOCKS.map(s => s.sector))).sort()]
const mc = (n:number) => n>=1000?`$${(n/1000).toFixed(1)}T`:`$${n}B`
const cc = (s:number) => s>=70?'#00d97e':s>=45?'#f5a623':'#ff4d4d'

export default function Screener() {
  const [sector, setSector] = useState('All')
  const [sort, setSort]     = useState('moat')
  const [minMoat, setMinMoat]   = useState(0)
  const [minGrowth, setMinGrowth] = useState(0)
  const [q, setQ]           = useState('')

  const filtered = STOCKS
    .filter(s => sector==='All' || s.sector===sector)
    .filter(s => s.moat>=minMoat && s.growth>=minGrowth)
    .filter(s => !q || s.ticker.toLowerCase().includes(q.toLowerCase()) || s.name.toLowerCase().includes(q.toLowerCase()))
    .sort((a,b) => sort==='pe' ? a.pe-b.pe : (b as any)[sort]-(a as any)[sort])

  const mono: React.CSSProperties = { fontFamily: 'var(--mono)' }

  return (
    <>
      <Navbar />
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '48px 48px 80px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 36 }}>
          <div>
            <div style={{ ...mono, fontSize: 11, color: 'var(--accent)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ display: 'block', width: 20, height: 1, background: 'var(--accent)' }} />Stock Screener
            </div>
            <h1 style={{ fontSize: 34, fontWeight: 600, letterSpacing: -0.8, marginBottom: 8 }}>Find stocks with an edge.</h1>
            <p style={{ fontSize: 15, color: 'var(--text2)', fontWeight: 300 }}>Filter {STOCKS.length} equities by moat, growth, sector, and valuation.</p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ ...mono, fontSize: 40, fontWeight: 600, color: 'var(--accent)', lineHeight: 1 }}>{filtered.length}</div>
            <div style={{ ...mono, fontSize: 11, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>results</div>
          </div>
        </div>

        {/* FILTERS */}
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'flex-end', gap: 20, background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 8, padding: '18px 20px', marginBottom: 24 }}>
          <input placeholder="Search name or ticker…" value={q} onChange={e=>setQ(e.target.value)} style={{ minWidth: 200, flex: 1 }} />
          {[
            { label:'Sector', node: <select value={sector} onChange={e=>setSector(e.target.value)}>{SECTORS.map(s=><option key={s}>{s}</option>)}</select> },
            { label:'Sort by', node: <select value={sort} onChange={e=>setSort(e.target.value)}><option value="moat">Moat Score</option><option value="growth">Growth Score</option><option value="cap">Market Cap</option><option value="pe">P/E Ratio</option><option value="chg">Today's Change</option></select> },
          ].map(f=>(
            <div key={f.label}>
              <div style={{ ...mono, fontSize: 10, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{f.label}</div>
              {f.node}
            </div>
          ))}
          {[{label:`Min moat: ${minMoat}`,val:minMoat,set:setMinMoat},{label:`Min growth: ${minGrowth}`,val:minGrowth,set:setMinGrowth}].map(f=>(
            <div key={f.label}>
              <div style={{ ...mono, fontSize: 10, color: 'var(--text3)', letterSpacing: 1, textTransform: 'uppercase', marginBottom: 6 }}>{f.label}</div>
              <input type="range" min={0} max={90} step={5} value={f.val} onChange={e=>f.set(Number(e.target.value))} style={{ width: 120, accentColor: 'var(--accent)' }} />
            </div>
          ))}
          <button onClick={()=>{setSector('All');setSort('moat');setMinMoat(0);setMinGrowth(0);setQ('')}} style={{ padding:'8px 16px', border:'1px solid var(--border2)', color:'var(--text3)', fontSize:12, ...mono, borderRadius:5, alignSelf:'flex-end' }}>Reset</button>
        </div>

        {/* TABLE */}
        <div style={{ border: '1px solid var(--border)', borderRadius: 8, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: 'var(--bg3)', borderBottom: '1px solid var(--border)' }}>
                {['Ticker','Company','Sector','Moat','Growth','Mkt Cap','P/E','Today',''].map(h=>(
                  <th key={h} style={{ padding:'10px 14px', ...mono, fontSize:10, color:'var(--text3)', textTransform:'uppercase', letterSpacing:1, textAlign:'left', whiteSpace:'nowrap' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map(s=>(
                <tr key={s.ticker} style={{ borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'12px 14px' }}><span style={{ ...mono, fontSize:13, fontWeight:500 }}>{s.ticker}</span></td>
                  <td style={{ padding:'12px 14px', fontSize:13, color:'var(--text2)', whiteSpace:'nowrap' }}>{s.name}</td>
                  <td style={{ padding:'12px 14px', fontSize:12, color:'var(--text3)', whiteSpace:'nowrap' }}>{s.sector}</td>
                  <td style={{ padding:'12px 14px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:52, height:4, background:'var(--border2)', borderRadius:2, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${s.moat}%`, background:cc(s.moat), borderRadius:2 }} />
                      </div>
                      <span style={{ ...mono, fontSize:13, fontWeight:500, color:cc(s.moat) }}>{s.moat}</span>
                    </div>
                  </td>
                  <td style={{ padding:'12px 14px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:52, height:4, background:'var(--border2)', borderRadius:2, overflow:'hidden' }}>
                        <div style={{ height:'100%', width:`${s.growth}%`, background:cc(s.growth), borderRadius:2 }} />
                      </div>
                      <span style={{ ...mono, fontSize:13, fontWeight:500, color:cc(s.growth) }}>{s.growth}</span>
                    </div>
                  </td>
                  <td style={{ padding:'12px 14px', ...mono, fontSize:13, whiteSpace:'nowrap' }}>{mc(s.cap)}</td>
                  <td style={{ padding:'12px 14px', ...mono, fontSize:13 }}>{s.pe}x</td>
                  <td style={{ padding:'12px 14px', ...mono, fontSize:13, color:s.chg>=0?'var(--accent)':'var(--red)', whiteSpace:'nowrap' }}>{s.chg>=0?'▲':'▼'} {Math.abs(s.chg).toFixed(2)}%</td>
                  <td style={{ padding:'12px 14px' }}>
                    <Link href={`/dashboard?ticker=${s.ticker}`} style={{ padding:'5px 12px', border:'1px solid var(--border2)', color:'var(--text2)', ...mono, fontSize:12, borderRadius:3, whiteSpace:'nowrap' }}>Analyze →</Link>
                  </td>
                </tr>
              ))}
              {filtered.length===0 && <tr><td colSpan={9} style={{ padding:40, textAlign:'center', color:'var(--text3)', fontSize:14 }}>No stocks match your filters.</td></tr>}
            </tbody>
          </table>
        </div>
      </div>
    </>
  )
}
