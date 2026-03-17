'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-browser'
import SearchBar from './SearchBar'
import AuthModal from './AuthModal'
import type { User } from '@supabase/supabase-js'

export default function Navbar() {
  const [user, setUser]   = useState<User | null>(null)
  const [modal, setModal] = useState<'signin' | 'signup' | null>(null)
  const [time, setTime]   = useState('')

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
    // Live clock
    const tick = () => {
      const now = new Date()
      setTime(now.toLocaleTimeString('en-US', { hour12: false, timeZone: 'America/New_York' }) + ' EST')
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => { subscription.unsubscribe(); clearInterval(id) }
  }, [])

  async function signOut() {
    await supabase.auth.signOut()
    location.href = '/'
  }

  return (
    <>
      <nav style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', height: 52,
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
        position: 'sticky', top: 0, zIndex: 100,
        gap: 20,
      }}>
        {/* LOGO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 700 }}>{'>'}_</span>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, color: 'var(--text)', textTransform: 'uppercase' }}>AlphaEdge</span>
          </Link>
          <div style={{ width: 1, height: 20, background: 'var(--border2)' }} />
          <span style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 2, textTransform: 'uppercase' }}>Terminal</span>
        </div>

        {/* CENTER NAV */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 28, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }}>
          {[['Dashboard', '/dashboard'], ['Screener', '/screener'], ['Compare', '/compare'], ['Pricing', '/#pricing']].map(([label, href]) => (
            <Link key={label} href={href} style={{ color: 'var(--text2)', transition: 'color 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
            >{label}</Link>
          ))}
        </div>

        {/* SEARCH */}
        <div style={{ flex: 1, maxWidth: 320 }}>
          <SearchBar compact />
        </div>

        {/* RIGHT */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexShrink: 0 }}>
          {time && (
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', letterSpacing: 1 }}>
              {time}
            </span>
          )}
          <div style={{ width: 1, height: 20, background: 'var(--border2)' }} />
          {user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1 }}>{user.email?.split('@')[0].toUpperCase()}</span>
              <button onClick={signOut} style={{ padding: '5px 14px', border: '1px solid var(--border2)', color: 'var(--text2)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', borderRadius: 2 }}>Sign Out</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setModal('signin')} style={{ padding: '5px 14px', border: '1px solid var(--border2)', color: 'var(--text2)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', borderRadius: 2 }}>Log In</button>
              <button onClick={() => setModal('signup')} style={{ padding: '6px 16px', background: 'var(--accent)', color: '#000', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', borderRadius: 2 }}>Get Access</button>
            </div>
          )}
        </div>
      </nav>
      {modal && <AuthModal mode={modal} onClose={() => setModal(null)} />}
    </>
  )
}
