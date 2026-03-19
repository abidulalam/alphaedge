'use client'
import { useState } from 'react'
import { supabase } from '@/lib/supabase-browser'

interface Props { mode: 'signin' | 'signup'; onClose: () => void }

export default function AuthModal({ mode: initialMode, onClose }: Props) {
  const [mode, setMode]       = useState(initialMode)
  const [email, setEmail]     = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true); setError(null); setSuccess(null)
    try {
      if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email, password,
          options: { emailRedirectTo: `${location.origin}/auth/callback` },
        })
        if (error) throw error
        setSuccess('Check your email to confirm your account, then sign in.')
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password })
        if (error) throw error
        onClose()
        location.href = '/dashboard'
      }
    } catch (err: any) {
      setError(err.message)
    } finally { setLoading(false) }
  }

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <div onClick={e => e.stopPropagation()} style={{ background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 2, padding: 32, width: '100%', maxWidth: 400, position: 'relative' }}>

        {/* Close */}
        <button onClick={onClose} style={{ position: 'absolute', top: 16, right: 16, color: 'var(--text3)', fontSize: 18, lineHeight: 1 }}>✕</button>

        {/* Header */}
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--accent)', letterSpacing: 2, textTransform: 'uppercase', marginBottom: 10 }}>AlphaEdge</div>
        <h2 style={{ fontSize: 22, fontWeight: 600, letterSpacing: -0.5, marginBottom: 6 }}>
          {mode === 'signup' ? 'Create your account' : 'Welcome back'}
        </h2>
        <p style={{ fontSize: 13, color: 'var(--text2)', marginBottom: 24 }}>
          {mode === 'signup' ? 'Start researching smarter, for free.' : 'Sign in to access your dashboard.'}
        </p>

        {/* Email form */}
        <form onSubmit={handleEmail}>
          <input type="email" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} required style={{ marginBottom: 10 }} />
          <input type="password" placeholder="Password" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} style={{ marginBottom: 16 }} />

          {error   && <div style={{ background: 'rgba(255,77,77,.1)', border: '1px solid rgba(255,77,77,.3)', borderRadius: 2, padding: '9px 12px', fontSize: 13, color: '#ff4d4d', marginBottom: 12 }}>{error}</div>}
          {success && <div style={{ background: 'rgba(0,217,126,.1)', border: '1px solid rgba(0,217,126,.3)', borderRadius: 2, padding: '9px 12px', fontSize: 13, color: '#00d97e', marginBottom: 12 }}>{success}</div>}

          <button type="submit" disabled={loading} style={{ width: '100%', padding: '11px 16px', background: 'var(--accent)', border: 'none', borderRadius: 2, color: '#000', fontSize: 14, fontWeight: 600, opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Loading…' : mode === 'signup' ? 'Create account' : 'Sign in'}
          </button>
        </form>

        {/* Toggle mode */}
        <p style={{ fontSize: 13, color: 'var(--text3)', textAlign: 'center', marginTop: 16 }}>
          {mode === 'signup' ? 'Already have an account? ' : "Don't have an account? "}
          <button onClick={() => { setMode(mode === 'signup' ? 'signin' : 'signup'); setError(null); setSuccess(null) }} style={{ color: 'var(--accent)', fontSize: 13 }}>
            {mode === 'signup' ? 'Sign in' : 'Sign up free'}
          </button>
        </p>
      </div>
    </div>
  )
}
