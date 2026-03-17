import Link from 'next/link'

export default function AuthError() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--mono)', textAlign: 'center', padding: 40 }}>
      <div style={{ fontSize: 11, color: 'var(--red)', letterSpacing: 3, textTransform: 'uppercase', marginBottom: 20 }}>Auth Error</div>
      <div style={{ fontSize: 48, fontWeight: 600, letterSpacing: -2, marginBottom: 16 }}>Sign-in failed.</div>
      <div style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7, maxWidth: 400, marginBottom: 36, fontFamily: 'var(--sans)' }}>
        Something went wrong during authentication. Please try again or contact support if the problem persists.
      </div>
      <div style={{ display: 'flex', gap: 12 }}>
        <Link href="/" style={{ padding: '10px 22px', background: 'var(--accent)', color: '#000', fontFamily: 'var(--sans)', fontWeight: 600, fontSize: 14, borderRadius: 5 }}>Go home</Link>
        <Link href="/dashboard" style={{ padding: '10px 22px', border: '1px solid var(--border2)', color: 'var(--text2)', fontFamily: 'var(--sans)', fontSize: 14, borderRadius: 5 }}>Try dashboard</Link>
      </div>
    </div>
  )
}
