'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase-browser'
import SearchBar from './SearchBar'
import AuthModal from './AuthModal'
import type { User } from '@supabase/supabase-js'
import { useIsMobile } from '@/hooks/useIsMobile'

const NAV_LINKS = [
  ['Markets', '/markets'],
  ['Dashboard', '/dashboard'],
  ['Screener', '/screener'],
  ['Compare', '/compare'],
  ['Calendar', '/calendar'],
  ['Portfolio', '/portfolio'],
  ['Alerts', '/alerts'],
]

export default function Navbar() {
  const [user, setUser]       = useState<User | null>(null)
  const [modal, setModal]     = useState<'signin' | 'signup' | null>(null)
  const [time, setTime]       = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const isMobile = useIsMobile()

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUser(data.user))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, session) => {
      setUser(session?.user ?? null)
    })
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
        padding: '0 16px', height: 52,
        borderBottom: '1px solid var(--border)',
        background: 'var(--bg)',
        position: 'sticky', top: 0, zIndex: 100,
        gap: 12,
      }}>
        {/* LOGO */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ color: 'var(--accent)', fontSize: 14, fontWeight: 700 }}>{'>'}_</span>
            <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 2, color: 'var(--text)', textTransform: 'uppercase' }}>AlphaEdge</span>
          </Link>
        </div>

        {/* CENTER NAV — hidden on mobile */}
        <div style={{ display: isMobile ? 'none' : 'flex', alignItems: 'center', gap: 24, fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }}>
          {NAV_LINKS.map(([label, href]) => (
            <Link key={label} href={href} style={{ color: 'var(--text2)', transition: 'color 0.1s' }}
              onMouseEnter={e => (e.currentTarget.style.color = 'var(--text)')}
              onMouseLeave={e => (e.currentTarget.style.color = 'var(--text2)')}
            >{label}</Link>
          ))}
        </div>

        {/* SEARCH */}
        <div style={{ flex: 1, maxWidth: isMobile ? 160 : 320 }}>
          <SearchBar compact />
        </div>

        {/* RIGHT */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          {!isMobile && time && (
            <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent)', letterSpacing: 1 }}>{time}</span>
          )}
          {!isMobile && <div style={{ width: 1, height: 20, background: 'var(--border2)' }} />}
          {!isMobile && (user ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: 1 }}>{user.email?.split('@')[0].toUpperCase()}</span>
              <button onClick={signOut} style={{ padding: '5px 12px', border: '1px solid var(--border2)', color: 'var(--text2)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', borderRadius: 2 }}>Sign Out</button>
            </div>
          ) : (
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => setModal('signin')} style={{ padding: '5px 12px', border: '1px solid var(--border2)', color: 'var(--text2)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', borderRadius: 2 }}>Log In</button>
              <button onClick={() => setModal('signup')} style={{ padding: '5px 12px', background: 'var(--accent)', color: '#000', fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', borderRadius: 2 }}>Join</button>
            </div>
          ))}
          {/* Hamburger — mobile only */}
          {isMobile && (
            <button onClick={() => setMenuOpen(o => !o)} style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '6px 4px', background: 'transparent', border: 'none', cursor: 'pointer' }}>
              <span style={{ display: 'block', width: 20, height: 2, background: menuOpen ? 'var(--accent)' : 'var(--text2)', borderRadius: 1 }} />
              <span style={{ display: 'block', width: 20, height: 2, background: menuOpen ? 'var(--accent)' : 'var(--text2)', borderRadius: 1 }} />
              <span style={{ display: 'block', width: 20, height: 2, background: menuOpen ? 'var(--accent)' : 'var(--text2)', borderRadius: 1 }} />
            </button>
          )}
        </div>
      </nav>

      {/* Mobile dropdown menu */}
      {menuOpen && (
        <div style={{
          position: 'fixed', top: 52, left: 0, right: 0,
          background: 'var(--bg2)', borderBottom: '1px solid var(--border)',
          zIndex: 99, display: 'flex', flexDirection: 'column',
        }}>
          {NAV_LINKS.map(([label, href]) => (
            <Link
              key={label} href={href}
              onClick={() => setMenuOpen(false)}
              style={{ padding: '14px 20px', fontSize: 13, color: 'var(--text2)', borderBottom: '1px solid var(--border)', letterSpacing: 1, textTransform: 'uppercase' }}
            >{label}</Link>
          ))}
        </div>
      )}

      {modal && <AuthModal mode={modal} onClose={() => setModal(null)} />}
    </>
  )
}
