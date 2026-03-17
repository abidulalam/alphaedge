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

  async function handleGoogle() {
    setLoading(true); setError(null)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${location.origin}/auth/callback` },
    })
    if (error) {
      if (error.message?.includes('provider is not enabled') || error.message?.includes('Unsupported provider')) {
        setError('Google sign-in is not yet enabled. Please enable the Google provider in your Supabase dashboard under Authentication → Providers, or sign in with email below.')
      } else {
        setError(error.message)
      }
      setLoading(false)
    }
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

        {/* Google */}
        <button onClick={handleGoogle} disabled={loading} style={{ width: '100%', padding: '11px 16px', background: 'var(--bg3)', border: '1px solid var(--border2)', borderRadius: 2, color: 'var(--text)', fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 16, transition: 'border-color .15s' }}>
          <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Continue with Google
        </button>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
          <span style={{ fontSize: 12, color: 'var(--text3)' }}>or</span>
          <div style={{ flex: 1, height: 1, background: 'var(--border)' }} />
        </div>

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
