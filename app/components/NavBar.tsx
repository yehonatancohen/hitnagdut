'use client'

import { useEffect, useState } from 'react'
import { useUser, useClerk } from '@clerk/nextjs'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

export default function NavBar() {
  const { user, isLoaded, isSignedIn } = useUser()
  const { signOut } = useClerk()
  const pathname = usePathname()
  const [credits, setCredits] = useState<number | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)
  const [isAdmin, setIsAdmin] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  const isAuthPage = pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')

  useEffect(() => {
    if (!isSignedIn) return
    fetch('/api/credits')
      .then(r => r.ok ? r.json() : null)
      .then(d => setCredits(d?.credits ?? 0))
    fetch('/api/admin/users')
      .then(r => { if (r.ok) setIsAdmin(true) })
      .catch(() => {})
  }, [isSignedIn])

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48)
    window.addEventListener('scroll', onScroll)
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  if (isAuthPage) return null

  return (
    <nav
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 200,
        height: 64,
        display: 'flex',
        alignItems: 'center',
        padding: '0 24px',
        justifyContent: 'space-between',
        background: scrolled
          ? 'rgba(245,240,232,0.96)'
          : 'var(--parchment)',
        backdropFilter: scrolled ? 'blur(14px)' : 'none',
        borderBottom: '1px solid var(--border-warm)',
        transition: 'background 0.3s',
      }}
    >
      {/* Logo */}
      <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: 10, textDecoration: 'none' }}>
        <div style={{
          width: 32, height: 32, background: 'var(--brass)', borderRadius: 4,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontWeight: 900, fontSize: 17, color: '#fff', flexShrink: 0,
          letterSpacing: '-1px',
        }}>נ</div>
        <span style={{ fontWeight: 800, fontSize: 18, color: 'var(--navy)', letterSpacing: '-0.5px' }}>נוסח</span>
      </Link>

      {/* Right side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        {isLoaded && isSignedIn ? (
          <>
            {/* Credits chip */}
            <Link href="/dashboard" style={{
              display: 'flex', alignItems: 'center', gap: 6,
              background: 'rgba(180,140,50,0.1)', color: 'var(--brass)',
              fontSize: 12, fontWeight: 700, padding: '5px 12px',
              borderRadius: 4, border: '1px solid rgba(180,140,50,0.2)',
              textDecoration: 'none', transition: 'background 0.2s',
            }}>
              <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {credits === null ? '...' : `${credits} קרדיטים`}
            </Link>

            {isAdmin && (
              <Link href="/admin" style={{
                fontSize: 13, fontWeight: 600, color: 'var(--navy)',
                opacity: 0.6, textDecoration: 'none',
              }}>
                ניהול
              </Link>
            )}

            {/* User menu */}
            <div style={{ position: 'relative' }}>
              <button
                onClick={() => setMenuOpen(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '6px 10px', borderRadius: 4,
                  border: '1px solid var(--border-warm)',
                  background: 'transparent', cursor: 'pointer',
                  transition: 'background 0.15s',
                }}
              >
                <div style={{
                  width: 26, height: 26, borderRadius: '50%',
                  background: 'var(--navy)', color: '#fff',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 12, fontWeight: 700, flexShrink: 0,
                }}>
                  {user?.firstName?.[0] || user?.emailAddresses[0]?.emailAddress[0] || '?'}
                </div>
                <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>
                  {user?.firstName || user?.emailAddresses[0]?.emailAddress}
                </span>
                <svg width="12" height="12" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ color: 'var(--muted)' }}>
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {menuOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 10 }} onClick={() => setMenuOpen(false)} />
                  <div style={{
                    position: 'absolute', left: 0, top: 'calc(100% + 6px)',
                    width: 200, background: '#fff',
                    border: '1px solid var(--border-warm)', borderRadius: 6,
                    boxShadow: '0 8px 24px rgba(10,22,60,0.12)', zIndex: 20,
                    overflow: 'hidden', fontSize: 13,
                  }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border-warm)' }}>
                      <p style={{ fontWeight: 700, color: 'var(--navy)' }}>{user?.fullName || '—'}</p>
                      <p style={{ color: 'var(--muted)', fontSize: 12, marginTop: 2 }}>{user?.emailAddresses[0]?.emailAddress}</p>
                    </div>
                    <Link href="/dashboard" onClick={() => setMenuOpen(false)} style={{
                      display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                      color: 'var(--navy)', fontWeight: 500, textDecoration: 'none',
                      transition: 'background 0.15s',
                    }}>
                      דשבורד
                    </Link>
                    {isAdmin && (
                      <Link href="/admin" onClick={() => setMenuOpen(false)} style={{
                        display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px',
                        color: 'var(--navy)', fontWeight: 500, textDecoration: 'none',
                      }}>
                        ניהול משתמשים
                      </Link>
                    )}
                    <div style={{ borderTop: '1px solid var(--border-warm)' }}>
                      <button onClick={() => { setMenuOpen(false); signOut() }} style={{
                        display: 'flex', alignItems: 'center', gap: 10, width: '100%',
                        padding: '10px 16px', color: '#DC2626', fontWeight: 600,
                        background: 'transparent', border: 'none', cursor: 'pointer',
                        fontSize: 13, textAlign: 'right', transition: 'background 0.15s',
                      }}>
                        התנתק
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </>
        ) : isLoaded ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Link href="/sign-in" style={{
              fontSize: 14, fontWeight: 600, color: 'var(--navy)', opacity: 0.7,
              textDecoration: 'none', padding: '7px 14px',
            }}>
              כניסה
            </Link>
            <Link href="/sign-up" style={{
              fontSize: 14, fontWeight: 700, background: 'var(--navy)', color: '#fff',
              padding: '7px 16px', borderRadius: 4, textDecoration: 'none',
              transition: 'opacity 0.15s',
            }}>
              הרשמה
            </Link>
          </div>
        ) : null}
      </div>
    </nav>
  )
}
