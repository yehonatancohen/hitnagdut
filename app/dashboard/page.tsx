'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

interface Job {
  id: string
  created_at: string
  file_names: string[]
  file_count: number
  clause_count: number
  status: string
}

const PLANS = [
  { key: 'single',     label: 'עבודה בודדת',          credits: 1,  price: '29 ₪' },
  { key: 'bundle_10',  label: '10 עבודות',             credits: 10, price: '199 ₪',  badge: 'חיסכון 20%' },
  { key: 'monthly_50', label: 'מנוי חודשי – 50 עבודות', credits: 50, price: '399 ₪/חודש', badge: 'משתלם ביותר' },
]

export default function DashboardPage() {
  const { user } = useUser()
  const [credits, setCredits] = useState<number | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  const [purchasing, setPurchasing] = useState<string | null>(null)
  const [purchaseMsg, setPurchaseMsg] = useState('')

  useEffect(() => {
    Promise.all([
      fetch('/api/credits').then(r => r.json()),
      fetch('/api/jobs').then(r => r.json()),
    ]).then(([cData, jData]) => {
      setCredits(cData.credits ?? 0)
      setJobs(jData.jobs ?? [])
      setLoading(false)
    })
  }, [])

  const handlePurchase = async (planKey: string) => {
    setPurchasing(planKey)
    setPurchaseMsg('')
    try {
      const res = await fetch('/api/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan: planKey }),
      })
      const data = await res.json()
      if (data.ok) {
        setCredits(prev => (prev ?? 0) + data.credits_added)
        setPurchaseMsg(`נוספו ${data.credits_added} קרדיטים לחשבונך`)
      }
    } finally {
      setPurchasing(null)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <main className="min-h-screen bg-slate-50" dir="rtl">
      <div className="max-w-4xl mx-auto px-6 py-10 space-y-10">

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">דשבורד</h1>
            <p className="text-slate-500 text-sm mt-0.5">{user?.fullName || user?.emailAddresses[0]?.emailAddress}</p>
          </div>
          <Link href="/" className="px-4 py-2 bg-blue-700 text-white text-sm font-semibold rounded-lg hover:bg-blue-800 transition-colors">
            + עבודה חדשה
          </Link>
        </div>

        {/* Credits summary */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 flex items-center justify-between">
          <div>
            <p className="text-sm text-slate-500 font-medium mb-1">קרדיטים זמינים</p>
            <p className="text-4xl font-bold text-slate-800">
              {loading ? '—' : credits}
              <span className="text-base font-normal text-slate-400 mr-2">עבודות</span>
            </p>
          </div>
          <div className="w-16 h-16 bg-blue-50 rounded-xl flex items-center justify-center">
            <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
            </svg>
          </div>
        </div>

        {/* Plans */}
        <section>
          <h2 className="text-lg font-bold text-slate-700 mb-4">רכישת קרדיטים</h2>
          {purchaseMsg && (
            <div className="mb-4 bg-green-50 border border-green-200 text-green-800 text-sm font-medium px-4 py-3 rounded-lg">{purchaseMsg}</div>
          )}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PLANS.map(plan => (
              <div key={plan.key} className="bg-white border border-slate-200 rounded-xl p-5 flex flex-col gap-4 relative">
                {plan.badge && (
                  <span className="absolute top-3 left-3 bg-blue-700 text-white text-[11px] font-bold px-2 py-0.5 rounded-full">{plan.badge}</span>
                )}
                <div>
                  <p className="font-bold text-slate-800 text-base">{plan.label}</p>
                  <p className="text-2xl font-bold text-blue-700 mt-1">{plan.price}</p>
                  <p className="text-xs text-slate-400 mt-1">{plan.credits} קרדיטים</p>
                </div>
                <button
                  onClick={() => handlePurchase(plan.key)}
                  disabled={purchasing === plan.key}
                  className="w-full py-2.5 bg-blue-700 hover:bg-blue-800 disabled:opacity-60 text-white font-bold text-sm rounded-lg transition-colors"
                >
                  {purchasing === plan.key ? 'מעבד...' : 'רכוש עכשיו'}
                </button>
              </div>
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-3">
            * שילוב עם ספק תשלומים ייקבע בהמשך. כרגע הרכישה מדמה הוספת קרדיטים ישירות.
          </p>
        </section>

        {/* Job history */}
        <section>
          <h2 className="text-lg font-bold text-slate-700 mb-4">היסטוריית עבודות</h2>
          {loading ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-sm">טוען...</div>
          ) : jobs.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-xl p-8 text-center text-slate-400 text-sm">
              עדיין לא בוצעו עבודות. <Link href="/" className="text-blue-600 hover:underline">התחל עכשיו</Link>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-xl overflow-hidden">
              <table className="w-full text-sm text-right">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-200 text-slate-500 font-semibold text-xs">
                    <th className="px-4 py-3">תאריך</th>
                    <th className="px-4 py-3">קבצים</th>
                    <th className="px-4 py-3 text-center">סעיפים</th>
                    <th className="px-4 py-3 text-center">סטטוס</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {jobs.map(job => (
                    <tr key={job.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{formatDate(job.created_at)}</td>
                      <td className="px-4 py-3 text-slate-700 font-medium">
                        {job.file_names.slice(0, 2).join(', ')}
                        {job.file_names.length > 2 && <span className="text-slate-400"> +{job.file_names.length - 2}</span>}
                      </td>
                      <td className="px-4 py-3 text-center text-slate-600">{job.clause_count}</td>
                      <td className="px-4 py-3 text-center">
                        <span className="inline-block bg-green-50 text-green-700 text-xs font-semibold px-2 py-0.5 rounded-full">הושלם</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

      </div>
    </main>
  )
}
