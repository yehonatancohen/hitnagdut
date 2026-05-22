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

  // Don't show navbar on auth pages
  if (pathname.startsWith('/sign-in') || pathname.startsWith('/sign-up')) return null

  useEffect(() => {
    if (!isSignedIn) return
    fetch('/api/credits')
      .then(r => r.json())
      .then(d => setCredits(d.credits ?? 0))
    fetch('/api/admin/users')
      .then(r => { if (r.ok) setIsAdmin(true) })
      .catch(() => {})
  }, [isSignedIn])

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">

        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 bg-blue-700 rounded-lg flex items-center justify-center flex-shrink-0">
            <svg className="w-4.5 h-4.5 text-white w-[18px] h-[18px]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <span className="font-bold text-slate-800 text-sm leading-tight">מערכת ניתוח<br className="hidden sm:block" /> התנגדויות</span>
        </Link>

        {/* Nav right */}
        <div className="flex items-center gap-3">
          {isLoaded && isSignedIn ? (
            <>
              {/* Credits chip */}
              <Link href="/dashboard" className="hidden sm:flex items-center gap-1.5 bg-blue-50 text-blue-700 text-xs font-bold px-3 py-1.5 rounded-full border border-blue-100 hover:bg-blue-100 transition-colors">
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                {credits === null ? '...' : `${credits} קרדיטים`}
              </Link>

              {isAdmin && (
                <Link href="/admin" className="hidden sm:block text-xs font-semibold text-slate-500 hover:text-slate-800 transition-colors">
                  ניהול
                </Link>
              )}

              {/* User menu */}
              <div className="relative">
                <button
                  onClick={() => setMenuOpen(v => !v)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors text-sm font-medium text-slate-700"
                >
                  <div className="w-7 h-7 rounded-full bg-blue-700 text-white flex items-center justify-center text-xs font-bold flex-shrink-0">
                    {user.firstName?.[0] || user.emailAddresses[0]?.emailAddress[0] || '?'}
                  </div>
                  <span className="hidden sm:block">{user.firstName || user.emailAddresses[0]?.emailAddress}</span>
                  <svg className="w-3.5 h-3.5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                {menuOpen && (
                  <>
                    <div className="fixed inset-0 z-10" onClick={() => setMenuOpen(false)} />
                    <div className="absolute left-0 mt-1 w-48 bg-white border border-slate-200 rounded-xl shadow-lg z-20 overflow-hidden text-sm">
                      <div className="px-4 py-3 border-b border-slate-100">
                        <p className="font-semibold text-slate-800 truncate">{user.fullName || '—'}</p>
                        <p className="text-slate-400 text-xs truncate">{user.emailAddresses[0]?.emailAddress}</p>
                      </div>
                      <Link href="/dashboard" onClick={() => setMenuOpen(false)}
                        className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 text-slate-700 font-medium transition-colors">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                        </svg>
                        דשבורד
                      </Link>
                      <div className="sm:hidden flex items-center gap-2 px-4 py-2.5 text-slate-600">
                        <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                        </svg>
                        {credits === null ? '...' : `${credits} קרדיטים`}
                      </div>
                      {isAdmin && (
                        <Link href="/admin" onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2 px-4 py-2.5 hover:bg-slate-50 text-slate-700 font-medium transition-colors">
                          <svg className="w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          ניהול משתמשים
                        </Link>
                      )}
                      <div className="border-t border-slate-100">
                        <button onClick={() => { setMenuOpen(false); signOut() }}
                          className="flex items-center gap-2 w-full px-4 py-2.5 hover:bg-red-50 text-red-600 font-medium transition-colors text-right">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                          </svg>
                          התנתק
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </>
          ) : isLoaded ? (
            <div className="flex items-center gap-2">
              <Link href="/sign-in" className="text-sm font-semibold text-slate-600 hover:text-slate-800 transition-colors px-3 py-1.5">
                כניסה
              </Link>
              <Link href="/sign-up" className="text-sm font-semibold bg-blue-700 hover:bg-blue-800 text-white px-4 py-1.5 rounded-lg transition-colors">
                הרשמה
              </Link>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  )
}
