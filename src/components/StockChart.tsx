'use client'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'

interface Props { data: { t: number; c: number }[]; positive: boolean }

const Tip = ({ active, payload }: any) => {
  if (!active || !payload?.length) return null
  const d = payload[0].payload
  return (
    <div style={{ background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 4, padding: '7px 11px', fontFamily: 'var(--mono)', fontSize: 12 }}>
      <div style={{ color: 'var(--text2)' }}>{new Date(d.t).toLocaleDateString()}</div>
      <div style={{ color: 'var(--accent)', fontWeight: 500 }}>${Number(d.c).toFixed(2)}</div>
    </div>
  )
}

export default function StockChart({ data, positive }: Props) {
  const color = positive ? '#00d97e' : '#ff4d4d'
  const step = Math.max(1, Math.floor(data.length / 6))
  const ticks = data.filter((_, i) => i % step === 0).map(d => d.t)
  const fmt = (ts: number) => { const d = new Date(ts); return `${d.toLocaleString('default', { month: 'short' })} '${d.getFullYear().toString().slice(2)}` }

  return (
    <ResponsiveContainer width="100%" height={140}>
      <AreaChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id="cg" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity={0.2} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis dataKey="t" ticks={ticks} tickFormatter={fmt} tick={{ fill: 'var(--text3)', fontSize: 10, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} />
        <YAxis domain={['auto', 'auto']} tick={{ fill: 'var(--text3)', fontSize: 10, fontFamily: 'var(--mono)' }} axisLine={false} tickLine={false} width={52} tickFormatter={v => `$${Number(v).toFixed(0)}`} />
        <Tooltip content={<Tip />} />
        <Area type="monotone" dataKey="c" stroke={color} strokeWidth={1.5} fill="url(#cg)" dot={false} activeDot={{ r: 3, fill: color }} />
      </AreaChart>
    </ResponsiveContainer>
  )
}
