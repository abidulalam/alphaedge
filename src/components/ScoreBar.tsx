function color(s: number) {
  return s >= 70 ? 'var(--green)' : s >= 45 ? 'var(--amber)' : 'var(--red)'
}
function label(s: number) {
  return s >= 80 ? 'Wide' : s >= 60 ? 'Moderate' : 'Narrow'
}

export default function ScoreBar({ lbl, score }: { lbl: string; score: number }) {
  const c = color(score)
  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, alignItems: 'center' }}>
        <span style={{ fontSize: 10, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: 1 }}>{lbl}</span>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <span style={{ fontSize: 10, color: c, fontWeight: 600 }}>{label(score)}</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: c }}>{score}</span>
        </div>
      </div>
      <div style={{ height: 3, background: 'var(--border2)', borderRadius: 1, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: score + '%', background: c, transition: 'width .5s ease' }} />
      </div>
    </div>
  )
}
