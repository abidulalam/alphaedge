import Link from 'next/link'

export default function NotFound() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 11, color: 'var(--accent)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 20 }}>404 — Not Found</div>
      <div style={{ fontSize: 48, fontWeight: 600, letterSpacing: -2, marginBottom: 16 }}>Page not found.</div>
      <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7, maxWidth: 400, marginBottom: 36, fontFamily: 'var(--sans)' }}>
        The page you&apos;re looking for doesn&apos;t exist or was moved.
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <Link href="/"          style={{ padding: '10px 22px', background: 'var(--accent)', color: '#000', fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 14, borderRadius: 5 }}>Go home</Link>
        <Link href="/dashboard" style={{ padding: '10px 22px', border: '1px solid var(--border2)', color: 'var(--text2)', fontFamily: 'var(--sans)', fontSize: 14, borderRadius: 5 }}>Open dashboard</Link>
      </div>
    </div>
  )
}
