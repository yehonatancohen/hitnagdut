'use client'

import { useEffect, useState } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'
import ReferralSection from '../components/ReferralSection'

interface Job {
  id: string
  created_at: string
  file_names: string[]
  file_count: number
  clause_count: number
  status: string
}

const PLANS = [
  { key: 'single',     label: 'עבודה בודדת',            credits: 1,  price: '29 ₪',        badge: null },
  { key: 'bundle_10',  label: '10 עבודות',               credits: 10, price: '199 ₪',       badge: 'חיסכון 20%' },
  { key: 'monthly_50', label: 'מנוי חודשי – 50 עבודות', credits: 50, price: '399 ₪/חודש',  badge: 'משתלם ביותר' },
]

export default function DashboardPage() {
  const { user } = useUser()
  const [credits, setCredits] = useState<number | null>(null)
  const [jobs, setJobs] = useState<Job[]>([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    fetch('/api/dashboard').then(r => r.ok ? r.json() : null).then(d => {
      setCredits(d?.credits ?? 0)
      setJobs(d?.jobs ?? [])
      setLoading(false)
    }).catch(() => setLoading(false))
  }, [])

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('he-IL', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

  return (
    <main style={{ minHeight: '100vh', background: 'var(--parchment)', padding: '40px 0' }} dir="rtl">
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '0 24px', display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--navy)', margin: 0, letterSpacing: '-0.5px' }}>דשבורד</h1>
            <p style={{ color: 'var(--muted)', fontSize: 14, marginTop: 4 }}>
              {user?.fullName || user?.emailAddresses[0]?.emailAddress}
            </p>
          </div>
          <Link href="/" style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'var(--navy)', color: '#fff',
            fontSize: 14, fontWeight: 700, padding: '9px 18px',
            borderRadius: 4, textDecoration: 'none', transition: 'opacity 0.15s',
          }}>
            <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            עבודה חדשה
          </Link>
        </div>

        {/* Credits card */}
        <div style={{
          background: '#fff', border: '1px solid var(--border-warm)', borderRadius: 4,
          padding: '24px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <p style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 600, marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              קרדיטים זמינים
            </p>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 48, fontWeight: 800, color: 'var(--navy)', lineHeight: 1 }}>
                {loading ? '—' : credits}
              </span>
              <span style={{ fontSize: 16, color: 'var(--muted)', fontWeight: 500 }}>עבודות</span>
            </div>
          </div>
          <div style={{
            width: 56, height: 56, borderRadius: 4,
            background: 'rgba(180,140,50,0.1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <svg width="26" height="26" fill="none" stroke="var(--brass)" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
        </div>

        {/* Plans */}
        <section>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy)', marginBottom: 16 }}>רכישת קרדיטים</h2>

          <div className="plans-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16 }}>
            {PLANS.map(plan => (
              <div key={plan.key} style={{
                background: '#fff', border: '1px solid var(--border-warm)', borderRadius: 4,
                padding: 20, display: 'flex', flexDirection: 'column', gap: 16, position: 'relative',
                opacity: 0.7,
              }}>
                {plan.badge && (
                  <span style={{
                    position: 'absolute', top: 12, left: 12,
                    background: 'var(--navy)', color: '#fff',
                    fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 4,
                  }}>
                    {plan.badge}
                  </span>
                )}
                <div>
                  <p style={{ fontWeight: 700, color: 'var(--navy)', fontSize: 15, marginBottom: 6 }}>{plan.label}</p>
                  <p style={{ fontSize: 26, fontWeight: 800, color: 'var(--brass)', lineHeight: 1 }}>{plan.price}</p>
                  <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 6 }}>{plan.credits} קרדיטים</p>
                </div>
                <button
                  disabled
                  style={{
                    width: '100%', padding: '10px 0',
                    background: 'var(--muted)',
                    color: '#fff', fontWeight: 700, fontSize: 14,
                    borderRadius: 4, border: 'none', cursor: 'not-allowed',
                  }}
                >
                  בקרוב
                </button>
              </div>
            ))}
          </div>

          <p style={{ fontSize: 12, color: 'var(--muted)', marginTop: 12 }}>
            * רכישת קרדיטים תתאפשר בקרוב, לאחר חיבור ספק תשלומים. בינתיים ניתן לצבור קרדיטים בעזרת הזמנת חברים למטה.
          </p>
        </section>

        {/* Invite a friend */}
        <ReferralSection />

        {/* Job history */}
        <section>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy)', marginBottom: 16 }}>היסטוריית עבודות</h2>

          {loading ? (
            <div style={{
              background: '#fff', border: '1px solid var(--border-warm)', borderRadius: 4,
              padding: 32, textAlign: 'center', color: 'var(--muted)', fontSize: 14,
            }}>
              טוען...
            </div>
          ) : jobs.length === 0 ? (
            <div style={{
              background: '#fff', border: '1px solid var(--border-warm)', borderRadius: 4,
              padding: 40, textAlign: 'center',
            }}>
              <p style={{ color: 'var(--muted)', fontSize: 14, marginBottom: 12 }}>עדיין לא בוצעו עבודות.</p>
              <Link href="/" style={{
                display: 'inline-block', background: 'var(--navy)', color: '#fff',
                fontSize: 14, fontWeight: 700, padding: '8px 20px', borderRadius: 4, textDecoration: 'none',
              }}>
                התחל עכשיו
              </Link>
            </div>
          ) : (
            <div style={{ background: '#fff', border: '1px solid var(--border-warm)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{
                background: 'var(--excel-green)', padding: '6px 16px',
                display: 'flex', alignItems: 'center',
              }}>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.9)', letterSpacing: '0.3px' }}>
                  היסטוריית עבודות
                </span>
              </div>
              <div className="table-scroll">
              <table style={{ width: '100%', minWidth: 500, fontSize: 13, textAlign: 'right', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-warm)' }}>
                    {['תאריך', 'קבצים', 'סעיפים', 'סטטוס', 'הורדה'].map((h, i) => (
                      <th key={h} style={{
                        padding: '10px 16px', fontSize: 11, fontWeight: 700,
                        color: '#fff', letterSpacing: '0.5px', textTransform: 'uppercase',
                        background: i === 0 ? 'var(--navy)' : 'var(--excel-blue)',
                        textAlign: i >= 2 ? 'center' : 'right',
                      }}>
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {jobs.map((job, idx) => (
                    <tr key={job.id} style={{
                      borderBottom: '1px solid var(--border-warm)',
                      background: idx % 2 === 1 ? 'rgba(245,240,232,0.4)' : '#fff',
                    }}>
                      <td style={{ padding: '10px 16px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>{formatDate(job.created_at)}</td>
                      <td style={{ padding: '10px 16px', color: 'var(--navy)', fontWeight: 600 }}>
                        {job.file_names.slice(0, 2).join(', ')}
                        {job.file_names.length > 2 && (
                          <span style={{ color: 'var(--muted)', fontWeight: 400 }}> +{job.file_names.length - 2}</span>
                        )}
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'center', color: 'var(--navy)', fontWeight: 700 }}>{job.clause_count}</td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <span style={{
                          display: 'inline-block', fontSize: 11, fontWeight: 700, padding: '3px 10px', borderRadius: 4,
                          background: 'rgba(29,111,66,0.1)', color: 'var(--excel-green-text)',
                          border: '1px solid rgba(29,111,66,0.2)',
                        }}>
                          הושלם
                        </span>
                      </td>
                      <td style={{ padding: '10px 16px', textAlign: 'center' }}>
                        <a href={`/api/jobs/${job.id}/download`} style={{
                          display: 'inline-flex', alignItems: 'center', gap: 4,
                          fontSize: 12, fontWeight: 700, color: 'var(--excel-green-text)',
                          textDecoration: 'none', padding: '4px 10px', borderRadius: 4,
                          border: '1px solid rgba(29,111,66,0.25)',
                        }}>
                          <svg width="11" height="11" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v12m0 0l-4-4m4 4l4-4M5 20h14" />
                          </svg>
                          הורד
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
              <div style={{
                padding: '6px 16px', background: 'var(--excel-green)', display: 'flex', alignItems: 'center', gap: 16,
              }}>
                <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.75)', fontWeight: 500 }}>
                  סה"כ {jobs.length} עבודות | {jobs.reduce((s, j) => s + j.clause_count, 0)} סעיפים עובדו
                </span>
              </div>
            </div>
          )}
        </section>

      </div>
    </main>
  )
}
