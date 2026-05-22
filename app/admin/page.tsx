'use client'

import { useEffect, useState } from 'react'

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
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [actionLoading, setActionLoading] = useState<string | null>(null)
  const [addCreditsModal, setAddCreditsModal] = useState<{ userId: string; name: string } | null>(null)
  const [creditsAmount, setCreditsAmount] = useState('')

  const fetchUsers = async () => {
    const res = await fetch('/api/admin/users')
    if (!res.ok) { setError('אין גישה — נדרשת הרשאת מנהל'); setLoading(false); return }
    const data = await res.json()
    setUsers(data.users ?? [])
    setLoading(false)
  }

  useEffect(() => { fetchUsers() }, [])

  const handleAction = async (userId: string, action: string, amount?: number) => {
    setActionLoading(userId + action)
    await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_id: userId, action, amount }),
    })
    await fetchUsers()
    setActionLoading(null)
    setAddCreditsModal(null)
    setCreditsAmount('')
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric' })

  if (loading) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-slate-500" dir="rtl">טוען...</div>
  if (error) return <div className="min-h-screen bg-slate-50 flex items-center justify-center text-red-600 font-medium" dir="rtl">{error}</div>

  return (
    <main className="min-h-screen bg-slate-50" dir="rtl">
      <div className="max-w-6xl mx-auto px-6 py-10 space-y-8">

        <div>
          <h1 className="text-2xl font-bold text-slate-800">ניהול משתמשים</h1>
          <p className="text-slate-500 text-sm mt-0.5">{users.length} משתמשים רשומים</p>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm text-right">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-xs">
                <th className="px-4 py-3">שם / אימייל</th>
                <th className="px-4 py-3 text-center">תפקיד</th>
                <th className="px-4 py-3 text-center">קרדיטים</th>
                <th className="px-4 py-3">תאריך הצטרפות</th>
                <th className="px-4 py-3 text-center">סטטוס</th>
                <th className="px-4 py-3 text-center">פעולות</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {users.map(user => (
                <tr key={user.id} className={`hover:bg-slate-50 transition-colors ${user.is_blocked ? 'opacity-60' : ''}`}>
                  <td className="px-4 py-3">
                    <p className="font-semibold text-slate-800">{user.name || '—'}</p>
                    <p className="text-slate-400 text-xs">{user.email || user.clerk_id}</p>
                  </td>
                  <td className="px-4 py-3 text-center">
                    {user.role === 'admin' ? (
                      <span className="bg-purple-50 text-purple-700 text-xs font-bold px-2 py-0.5 rounded-full">מנהל</span>
                    ) : (
                      <span className="bg-slate-100 text-slate-500 text-xs font-medium px-2 py-0.5 rounded-full">משתמש</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="font-bold text-slate-700">{user.credits_remaining}</span>
                  </td>
                  <td className="px-4 py-3 text-slate-500">{formatDate(user.created_at)}</td>
                  <td className="px-4 py-3 text-center">
                    {user.is_blocked ? (
                      <span className="bg-red-50 text-red-600 text-xs font-bold px-2 py-0.5 rounded-full">חסום</span>
                    ) : (
                      <span className="bg-green-50 text-green-700 text-xs font-bold px-2 py-0.5 rounded-full">פעיל</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-center gap-2">
                      <button
                        onClick={() => setAddCreditsModal({ userId: user.id, name: user.name || user.email || '' })}
                        className="text-xs px-2.5 py-1 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 transition-colors font-medium"
                      >
                        + קרדיטים
                      </button>
                      {user.is_blocked ? (
                        <button
                          onClick={() => handleAction(user.id, 'unblock')}
                          disabled={actionLoading === user.id + 'unblock'}
                          className="text-xs px-2.5 py-1 border border-green-300 text-green-700 rounded-lg hover:bg-green-50 transition-colors font-medium disabled:opacity-50"
                        >
                          {actionLoading === user.id + 'unblock' ? '...' : 'בטל חסימה'}
                        </button>
                      ) : (
                        <button
                          onClick={() => handleAction(user.id, 'block')}
                          disabled={actionLoading === user.id + 'block'}
                          className="text-xs px-2.5 py-1 border border-red-300 text-red-600 rounded-lg hover:bg-red-50 transition-colors font-medium disabled:opacity-50"
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

      </div>

      {/* Add credits modal */}
      {addCreditsModal && (
        <div className="fixed inset-0 bg-slate-900/50 flex items-center justify-center z-50 p-4" dir="rtl">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full shadow-xl border border-slate-200 space-y-4">
            <h3 className="font-bold text-slate-800">הוסף קרדיטים ל-{addCreditsModal.name}</h3>
            <input
              type="number"
              value={creditsAmount}
              onChange={e => setCreditsAmount(e.target.value)}
              placeholder="מספר קרדיטים"
              min="1"
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-slate-700 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300"
            />
            <div className="flex gap-2">
              <button
                onClick={() => handleAction(addCreditsModal.userId, 'add_credits', Number(creditsAmount))}
                disabled={!creditsAmount || Number(creditsAmount) <= 0}
                className="flex-1 py-2 bg-blue-700 text-white font-bold text-sm rounded-lg hover:bg-blue-800 disabled:opacity-50 transition-colors"
              >
                הוסף
              </button>
              <button
                onClick={() => { setAddCreditsModal(null); setCreditsAmount('') }}
                className="flex-1 py-2 border border-slate-200 text-slate-600 font-semibold text-sm rounded-lg hover:bg-slate-50 transition-colors"
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
