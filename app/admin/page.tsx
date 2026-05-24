'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'

interface AdminUser {
  id: string
  clerk_id: string
  email: string | null
  name: string | null
  role: string
  is_blocked: boolean
  created_at: string
  credits_remaining: number
}

export default function AdminPage() {
  const { user: clerkUser } = useUser()
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [addCreditsModal, setAddCreditsModal] = useState<{ userId: string; name: string } | null>(null)
  const [creditsAmount, setCreditsAmount] = useState('')
  const [creditsLoading, setCreditsLoading] = useState(false)

  const fetchUsers = async () => {
    const res = await fetch('/api/admin/users')
    if (!res.ok) { setError('אין גישה — נדרשת הרשאת מנהל'); setLoading(false); return }
    const data = await res.json()
    setUsers(data.users ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const handleAction = async (userId: string, action: string, amount?: number | string) => {
    setActionLoading(userId + action)
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, action, amount }),
    })
    await fetchUsers()
    setActionLoading(null)
  }

  const handleAddCredits = async () => {
    if (!addCreditsModal || !creditsAmount || Number(creditsAmount) <= 0) return
    setCreditsLoading(true)
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: addCreditsModal.userId, action: 'add_credits', amount: Number(creditsAmount) }),
    })
    await fetchUsers()
    setCreditsLoading(false)
    setAddCreditsModal(null)
    setCreditsAmount('')
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })

  if (loading) return (
    <div style={{ minHeight: '100vh', background: 'var(--parchment)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} dir="rtl">
      <div className="spinner-brass" />
    </div>
  )

  if (error) return (
    <div style={{ minHeight: '100vh', background: 'var(--parchment)', display: 'flex', alignItems: 'center', justifyContent: 'center' }} dir="rtl">
      <p style={{ color: '#DC2626', fontWeight: 600 }}>{error}</p>
    </div>
  )

  return (
    <main style={{ minHeight: '100vh', background: 'var(--parchment)', padding: '40px 0' }} dir="rtl">
      <div style={{ maxWidth: 1100, margin: '0 auto', padding: '0 16px', display: 'flex', flexDirection: 'column', gap: 28 }}>

        {/* Header */}
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--navy)', margin: 0, letterSpacing: '-0.5px' }}>ניהול משתמשים</h1>
          <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>{users.length} משתמשים רשומים</p>
        </div>

        {/* Users table */}
        <div style={{ background: '#fff', border: '1px solid var(--border-warm)', borderRadius: 4, overflow: 'hidden' }}>
          {/* Excel chrome header */}
          <div style={{ background: 'var(--excel-green)', padding: '5px 12px', display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#FF5F57' }} />
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#FEBC2E' }} />
            <div style={{ width: 11, height: 11, borderRadius: '50%', background: '#28C840' }} />
            <span style={{ marginRight: 8, fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.85)', letterSpacing: '0.3px' }}>
              רשימת משתמשים
            </span>
          </div>

          {/* Scrollable table wrapper for mobile */}
          <div className="table-scroll">
            <table style={{ width: '100%', minWidth: 700, fontSize: 13, textAlign: 'right', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-warm)' }}>
                  {[
                    { label: 'שם / אימייל', align: 'right' },
                    { label: 'תפקיד', align: 'center' },
                    { label: 'קרדיטים', align: 'center' },
                    { label: 'תאריך', align: 'right' },
                    { label: 'סטטוס', align: 'center' },
                    { label: 'פעולות', align: 'center' },
                  ].map((col, i) => (
                    <th key={col.label} style={{
                      padding: '10px 14px', fontSize: 11, fontWeight: 700,
                      color: '#fff', letterSpacing: '0.5px', textTransform: 'uppercase',
                      background: i === 0 ? 'var(--navy)' : 'var(--excel-blue)',
                      textAlign: col.align as any, whiteSpace: 'nowrap',
                    }}>
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {users.map((user, idx) => (
                  <tr
                    key={user.id}
                    style={{
                      borderBottom: '1px solid var(--border-warm)',
                      background: user.is_blocked
                        ? 'rgba(220,38,38,0.04)'
                        : idx % 2 === 1 ? 'rgba(245,240,232,0.4)' : '#fff',
                      opacity: user.is_blocked ? 0.7 : 1,
                    }}
                  >
                    <td style={{ padding: '10px 14px' }}>
                      <p style={{ fontWeight: 700, color: 'var(--navy)', margin: 0, whiteSpace: 'nowrap' }}>{user.name || '—'}</p>
                      <p style={{ color: 'var(--muted)', fontSize: 11, marginTop: 2 }}>{user.email || user.clerk_id}</p>
                    </td>

                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      {user.role === 'admin' ? (
                        <span style={{
                          display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 4,
                          background: 'rgba(124,58,237,0.1)', color: '#7c3aed', border: '1px solid rgba(124,58,237,0.2)',
                        }}>מנהל</span>
                      ) : (
                        <span style={{
                          display: 'inline-block', fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 4,
                          background: 'rgba(180,140,50,0.08)', color: 'var(--muted)', border: '1px solid var(--border-warm)',
                        }}>משתמש</span>
                      )}
                    </td>

                    <td style={{ padding: '10px 14px', textAlign: 'center', fontWeight: 700, color: 'var(--navy)' }}>
                      {user.credits_remaining}
                    </td>

                    <td style={{ padding: '10px 14px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{formatDate(user.created_at)}</td>

                    <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                      {user.is_blocked ? (
                        <span style={{
                          display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 4,
                          background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: '1px solid rgba(220,38,38,0.2)',
                        }}>חסום</span>
                      ) : (
                        <span style={{
                          display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 4,
                          background: 'rgba(29,111,66,0.1)', color: 'var(--excel-green-text)', border: '1px solid rgba(29,111,66,0.2)',
                        }}>פעיל</span>
                      )}
                    </td>

                    <td style={{ padding: '10px 14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          onClick={() => setAddCreditsModal({ userId: user.id, name: user.name || user.email || '' })}
                          style={btnStyle()}
                        >
                          + קרדיטים
                        </button>

                        {user.role === 'admin' ? (
                          <button
                            onClick={() => handleAction(user.id, 'set_role', 'user')}
                            disabled={actionLoading === user.id + 'set_role' || user.clerk_id === clerkUser?.id}
                            title={user.clerk_id === clerkUser?.id ? 'לא ניתן להסיר הרשאת מנהל מעצמך' : ''}
                            style={btnStyle('purple', (actionLoading === user.id + 'set_role' || user.clerk_id === clerkUser?.id) ? 0.4 : 1)}
                          >
                            {actionLoading === user.id + 'set_role' ? '...' : 'הסר מנהל'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAction(user.id, 'set_role', 'admin')}
                            disabled={actionLoading === user.id + 'set_role'}
                            style={btnStyle('purple', actionLoading === user.id + 'set_role' ? 0.4 : 1)}
                          >
                            {actionLoading === user.id + 'set_role' ? '...' : 'הפוך למנהל'}
                          </button>
                        )}

                        {user.is_blocked ? (
                          <button
                            onClick={() => handleAction(user.id, 'unblock')}
                            disabled={actionLoading === user.id + 'unblock'}
                            style={btnStyle('green', actionLoading === user.id + 'unblock' ? 0.5 : 1)}
                          >
                            {actionLoading === user.id + 'unblock' ? '...' : 'בטל חסימה'}
                          </button>
                        ) : (
                          <button
                            onClick={() => handleAction(user.id, 'block')}
                            disabled={actionLoading === user.id + 'block'}
                            style={btnStyle('red', actionLoading === user.id + 'block' ? 0.5 : 1)}
                          >
                            {actionLoading === user.id + 'block' ? '...' : 'חסום'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Excel status bar */}
          <div style={{ padding: '6px 16px', background: 'var(--excel-green)', display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>
              סה"כ {users.length} משתמשים | {users.filter(u => u.role === 'admin').length} מנהלים | {users.filter(u => u.is_blocked).length} חסומים
            </span>
          </div>
        </div>

      </div>

      {/* Add credits modal */}
      {addCreditsModal && (
        <div
          style={{
            position: 'fixed', inset: 0, background: 'rgba(10,22,60,0.5)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50, padding: 16,
          }}
          dir="rtl"
          onClick={e => { if (e.target === e.currentTarget && !creditsLoading) { setAddCreditsModal(null); setCreditsAmount('') } }}
        >
          <div style={{
            background: '#fff', borderRadius: 4, padding: 28,
            maxWidth: 360, width: '100%',
            boxShadow: '0 20px 48px rgba(10,22,60,0.2)',
            border: '1px solid var(--border-warm)',
            display: 'flex', flexDirection: 'column', gap: 16,
          }}>
            <h3 style={{ fontWeight: 800, color: 'var(--navy)', fontSize: 17, margin: 0 }}>
              הוסף קרדיטים ל-{addCreditsModal.name}
            </h3>
            <input
              type="number"
              value={creditsAmount}
              onChange={e => setCreditsAmount(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAddCredits()}
              placeholder="מספר קרדיטים"
              min="1"
              disabled={creditsLoading}
              autoFocus
              style={{
                width: '100%', padding: '10px 14px',
                border: '1px solid var(--border-warm)', borderRadius: 4,
                color: 'var(--navy)', fontSize: 14,
                outline: 'none', boxSizing: 'border-box',
                fontFamily: 'inherit', background: creditsLoading ? 'var(--parchment)' : '#fff',
              }}
            />
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                onClick={handleAddCredits}
                disabled={creditsLoading || !creditsAmount || Number(creditsAmount) <= 0}
                style={{
                  flex: 1, padding: '10px 0', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
                  background: 'var(--navy)', color: '#fff',
                  fontWeight: 700, fontSize: 14, borderRadius: 4,
                  border: 'none', cursor: creditsLoading ? 'default' : 'pointer',
                  opacity: (creditsLoading || !creditsAmount || Number(creditsAmount) <= 0) ? 0.6 : 1,
                  transition: 'opacity 0.15s',
                }}
              >
                {creditsLoading ? (
                  <>
                    <span style={{
                      width: 14, height: 14, border: '2px solid rgba(255,255,255,0.3)',
                      borderTopColor: '#fff', borderRadius: '50%',
                      animation: 'spin-brass 0.75s linear infinite', display: 'inline-block', flexShrink: 0,
                    }} />
                    מוסיף...
                  </>
                ) : 'הוסף'}
              </button>
              <button
                onClick={() => { if (!creditsLoading) { setAddCreditsModal(null); setCreditsAmount('') } }}
                disabled={creditsLoading}
                style={{
                  flex: 1, padding: '10px 0',
                  background: '#fff', color: 'var(--navy)',
                  fontWeight: 600, fontSize: 14, borderRadius: 4,
                  border: '1px solid var(--border-warm)', cursor: creditsLoading ? 'default' : 'pointer',
                  opacity: creditsLoading ? 0.5 : 1, transition: 'background 0.15s',
                }}
              >
                ביטול
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

function btnStyle(color?: 'purple' | 'green' | 'red', opacity = 1): React.CSSProperties {
  const colors = {
    purple: { border: 'rgba(124,58,237,0.3)', text: '#7c3aed' },
    green:  { border: 'rgba(29,111,66,0.3)',  text: 'var(--excel-green-text)' },
    red:    { border: 'rgba(220,38,38,0.3)',  text: '#DC2626' },
    default:{ border: 'var(--border-warm)',   text: 'var(--navy)' },
  }
  const c = colors[color ?? 'default']
  return {
    fontSize: 12, padding: '4px 10px', borderRadius: 4, cursor: 'pointer',
    border: `1px solid ${c.border}`, background: '#fff', color: c.text,
    fontWeight: 600, transition: 'background 0.15s', opacity, whiteSpace: 'nowrap',
  }
}
