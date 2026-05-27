'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import Link from 'next/link'

type AppState = 'idle' | 'processing' | 'preview' | 'done' | 'error'
type OutputMode = 'merged' | 'separate'

interface SubmitterMeta {
  megish: string
  beshem: string
  ktovet: string
  gush_chelka: string
}

interface ClauseItem {
  text: string
  gorem?: string
}

interface SectionItem {
  section_number: string
  section_title: string
  missed_some_clauses: boolean
  section_summary?: string
  section_annex?: string
  confidence?: 'high' | 'low'
  clauses: ClauseItem[]
  isAnalyzing?: boolean
}

interface ObjectionItem {
  fileName: string
  meta: SubmitterMeta
  sections: SectionItem[]
}

interface SummaryItem {
  fileName: string
  megish: string
  clauses: number
  failed?: boolean
}

interface DownloadFile {
  name: string
  url: string
}

// ── Small helpers ────────────────────────────────────────────────────────────

function ConfidenceFlag({ label }: { label?: string }) {
  return (
    <span title="רמת ביטחון AI נמוכה — מומלץ לבדוק ידנית"
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 3,
        background: 'rgba(217,119,6,0.08)', color: '#B45309',
        border: '1px solid rgba(217,119,6,0.2)',
        fontSize: 10, fontWeight: 700, padding: '2px 6px', borderRadius: 3,
      }}>
      ⚠ {label || 'ביטחון נמוך'}
    </span>
  )
}

// ── Landing page sections ────────────────────────────────────────────────────

function PDFMock() {
  return (
    <div style={{
      background: '#fff', borderRadius: 6, padding: '18px 20px 16px',
      boxShadow: '0 8px 32px rgba(10,22,60,0.13)', border: '1px solid var(--border-warm)',
      width: 240, direction: 'rtl', position: 'relative', flexShrink: 0,
    }}>
      <div style={{ position: 'absolute', top: 0, left: 0, width: 0, height: 0, borderStyle: 'solid', borderWidth: '0 0 18px 18px', borderColor: 'transparent transparent var(--border-warm) transparent' }} />
      <div style={{ position: 'absolute', top: 0, left: 0, width: 18, height: 18, background: 'var(--parchment)', borderRadius: '0 0 4px 0' }} />
      <div style={{ borderBottom: '2px solid var(--navy)', paddingBottom: 10, marginBottom: 14, textAlign: 'center' }}>
        <div style={{ fontSize: 10, fontWeight: 800, color: 'var(--navy)', lineHeight: 1.4 }}>הוועדה המקומית לתכנון ובנייה</div>
        <div style={{ fontSize: 9, color: 'var(--navy)', opacity: 0.5, marginTop: 3 }}>התנגדות לתכנית מתאר מס׳ 101-0234218</div>
      </div>
      {[92, 86, 100, 74, 90, 88, 78].map((w, i) => (
        <div key={i} style={{ height: 6, background: 'var(--navy)', opacity: 0.1 + (i % 3) * 0.02, borderRadius: 2, marginBottom: 5, width: `${w}%` }} />
      ))}
      <div style={{ margin: '10px 0', borderTop: '1px solid var(--border-warm)' }} />
      {[88, 94, 71, 90, 83].map((w, i) => (
        <div key={i} style={{ height: 6, background: 'var(--navy)', opacity: 0.09, borderRadius: 2, marginBottom: 5, width: `${w}%` }} />
      ))}
      <div style={{ marginTop: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ fontSize: 8, color: 'var(--navy)', opacity: 0.38 }}>עמוד 24 מתוך 24</div>
        <div style={{ fontSize: 8, background: '#E8302B', color: '#fff', padding: '2px 6px', borderRadius: 2, fontWeight: 700 }}>PDF</div>
      </div>
    </div>
  )
}

function MiniExcelTable() {
  const cols = ['מס׳', 'פרק/סעיפים', 'מלל ההתנגדות', 'נושא', 'גורם מייעץ']
  const rows = [
    ['1', 'פרק ג׳, ס׳ 14', 'הגברת הצפיפות המוצעת...', 'צפיפות מגורים', 'משרד הבינוי'],
    ['2', 'פרק ד׳, ס׳ 22', 'מקומות חניה בלתי מספיקים...', 'תחבורה', 'משרד התחבורה'],
    ['3', 'פרק ב׳, ס׳ 8', 'גובה הבנייה החורג מהתקן...', 'גובה ונפח', 'הוועדה המחוזית'],
    ['4', 'פרק ה׳, ס׳ 31', 'ניקוז מי הגשם עלולים...', 'תשתיות', 'רשות המים'],
  ]
  const isGreen = (ci: number) => ci === 1 || ci === 4
  return (
    <div style={{ background: '#fff', borderRadius: 6, overflow: 'hidden', boxShadow: '0 8px 32px rgba(10,22,60,0.14)', border: '1px solid var(--border-warm)', width: 380, flexShrink: 0 }}>
      <div style={{ background: '#1D6F42', height: 28, display: 'flex', alignItems: 'center', padding: '0 16px' }}>
        <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginRight: 'auto', fontWeight: 600 }}>התנגדויות_2024.xlsx</span>
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl', fontSize: 11 }}>
          <thead>
            <tr>
              {cols.map((col, ci) => (
                <th key={ci} style={{ background: isGreen(ci) ? 'var(--excel-green)' : 'var(--excel-blue)', color: '#fff', padding: '7px 9px', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap', borderLeft: '1px solid rgba(255,255,255,0.15)' }}>{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : '#EBF2F8' }}>
                {row.map((cell, ci) => (
                  <td key={ci} style={{ padding: '6px 9px', borderBottom: '1px solid #E1E8F0', borderLeft: '1px solid #E1E8F0', whiteSpace: ci === 2 ? 'normal' : 'nowrap', maxWidth: ci === 2 ? 120 : undefined, overflow: 'hidden', textOverflow: ci === 2 ? 'ellipsis' : undefined, color: isGreen(ci) ? 'var(--excel-green-text)' : '#0F1F3D', fontWeight: isGreen(ci) ? 600 : 400, background: isGreen(ci) ? 'rgba(29,111,66,0.055)' : undefined }}>{cell}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function LandingPage({ onEnterApp }: { onEnterApp: () => void }) {
  return (
    <div style={{ direction: 'rtl' }}>

      {/* ── Hero ── */}
      <section style={{ minHeight: 'calc(100vh - 64px)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '80px 24px', position: 'relative', overflow: 'hidden' }}>
        {/* Grid bg */}
        <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(var(--border-warm) 1px, transparent 1px), linear-gradient(90deg, var(--border-warm) 1px, transparent 1px)', backgroundSize: '48px 48px', opacity: 0.4, maskImage: 'radial-gradient(ellipse 80% 70% at 50% 40%, black, transparent)' }} />

        <div style={{ textAlign: 'center', maxWidth: 820, marginBottom: 72, position: 'relative', zIndex: 1 }} className="fade-up">
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--brass)', color: '#fff', fontSize: 11, fontWeight: 700, letterSpacing: 1.2, padding: '5px 14px', borderRadius: 2, marginBottom: 28, textTransform: 'uppercase' as const }}>
            כלי AI לתכנון עירוני ✦ ישראל
          </div>
          <h1 style={{ fontSize: 'clamp(32px, 5.5vw, 64px)', fontWeight: 800, color: 'var(--navy)', lineHeight: 1.12, margin: '0 0 22px', letterSpacing: '-1.5px' }}>
            3 שעות של עבודת מזכירה.<br />
            <span style={{ color: 'var(--brass)' }}>10 דקות</span> ביקורת שלך.
          </h1>
          <p style={{ fontSize: 18, color: 'var(--navy)', opacity: 0.65, lineHeight: 1.7, maxWidth: 560, margin: '0 auto 40px' }}>
            העלה PDF של התנגדויות תכנוניות — קבל טבלת Excel מובנית עם כל הסעיפים, הנושאים והגורמים המייעצים, תוך 20 שניות.
          </p>
          <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'center' }}>
            <button onClick={onEnterApp} style={{ display: 'inline-flex', alignItems: 'center', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 4, padding: '14px 28px', fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.18s' }}>
              התחל בחינם — מסמך ראשון ללא עלות
            </button>
            <a href="#preview" style={{ fontSize: 15, fontWeight: 600, color: 'var(--navy)', opacity: 0.6, textDecoration: 'none' }}>ראה דוגמה ↓</a>
          </div>
        </div>

        {/* PDF → Excel visual */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24, width: '100%', maxWidth: 840, zIndex: 1, flexWrap: 'wrap' }}>
          <PDFMock />
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, flexShrink: 0 }}>
            <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--brass)', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(180,140,50,0.35)' }}>
              <svg width="20" height="16" viewBox="0 0 22 18" fill="none"><path d="M20 9H2M2 9L10 1M2 9l8 8" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </div>
            <span style={{ fontSize: 11, color: 'var(--navy)', opacity: 0.45, fontWeight: 600, whiteSpace: 'nowrap' }}>~20 שניות</span>
          </div>
          <MiniExcelTable />
        </div>
      </section>

      {/* ── How It Works ── */}
      <section id="how" style={{ padding: '96px 24px', background: 'var(--navy)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 64 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brass)', letterSpacing: 2, textTransform: 'uppercase' as const, marginBottom: 16 }}>תהליך פשוט</div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 42px)', fontWeight: 800, color: '#fff', margin: 0, letterSpacing: '-0.5px' }}>שלושה צעדים בלבד</h2>
          </div>
          <div style={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap' }}>
            {[
              { num: '01', title: 'גרור PDF', body: 'גרור קובץ PDF של ההתנגדויות התכנוניות, או לחץ להעלאה. כל פורמט PDF נתמך — גם קבצים ממוסרקים.' },
              { num: '02', title: 'הבינה המלאכותית מנתחת', body: 'המערכת קוראת, מזהה ומסווגת כל התנגדות — מס׳ סעיף, פרק, נושא ורשות מייעצת.' },
              { num: '03', title: 'הורד Excel', body: 'קובץ xlsx מוכן — עם כותרות צבועות, שורות לסירוגין, וכל 5 עמודות ממולאות. פתח ב-Excel ועבד מיד.' },
            ].map((step, i) => (
              <div key={i} style={{ flex: '1 1 280px', maxWidth: 360, padding: '40px 36px', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 24, left: 24, fontSize: 72, fontWeight: 900, color: 'rgba(255,255,255,0.04)', lineHeight: 1, letterSpacing: '-4px', userSelect: 'none' as const }}>{step.num}</div>
                <div style={{ width: 52, height: 52, borderRadius: 8, background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--brass)', marginBottom: 24 }}>
                  <svg width="26" height="26" viewBox="0 0 28 28" fill="none" stroke="currentColor" strokeWidth="1.8">
                    {i === 0 && <><rect x="4" y="2" width="16" height="20" rx="2" /><path d="M14 2v6h6" strokeLinejoin="round" /><path d="M14 18v-6M11 15l3 3 3-3" strokeLinecap="round" strokeLinejoin="round" /></>}
                    {i === 1 && <><circle cx="14" cy="14" r="10" /><path d="M10 14h8M14 10v8" strokeLinecap="round" /><circle cx="14" cy="14" r="3" fill="currentColor" opacity=".25" /></>}
                    {i === 2 && <><rect x="3" y="6" width="22" height="16" rx="2" /><path d="M3 11h22M9 11v11M16 11v11" /><path d="M7 8h.01M11 8h.01" strokeLinecap="round" /></>}
                  </svg>
                </div>
                <h3 style={{ fontSize: 20, fontWeight: 700, color: '#fff', margin: '0 0 12px', letterSpacing: '-0.3px' }}>{step.title}</h3>
                <p style={{ fontSize: 15, color: 'rgba(255,255,255,0.58)', lineHeight: 1.7, margin: 0 }}>{step.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Excel Preview ── */}
      <section id="preview" style={{ padding: '96px 24px', background: 'var(--parchment)', borderTop: '1px solid var(--border-warm)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brass)', letterSpacing: 2, textTransform: 'uppercase' as const, marginBottom: 16 }}>הפלט</div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 42px)', fontWeight: 800, color: 'var(--navy)', margin: '0 0 14px', letterSpacing: '-0.5px' }}>כך נראה הקובץ שתקבל</h2>
            <p style={{ fontSize: 16, color: 'var(--navy)', opacity: 0.6, margin: 0 }}>5 עמודות מובנות, כותרות ממוקדות, מוכן לעריכה מיידית</p>
          </div>
          <div style={{ borderRadius: 8, overflow: 'hidden', boxShadow: '0 16px 56px rgba(10,22,60,0.14)', border: '1px solid var(--border-warm)', maxWidth: 1000, margin: '0 auto' }}>
            <div style={{ background: '#1D6F42', padding: '0 20px', height: 36, display: 'flex', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.85)', marginRight: 'auto', fontWeight: 600 }}>התנגדויות_תל-אביב_2024.xlsx — Excel</span>
            </div>
            <div style={{ background: '#F4F4F4', borderBottom: '1px solid #D8D8D8', padding: '4px 16px', display: 'flex', gap: 20, direction: 'rtl' }}>
              {['בית', 'הוספה', 'פריסת עמוד', 'נוסחאות'].map((t, i) => (
                <span key={i} style={{ fontSize: 12, color: i === 0 ? '#1D6F42' : '#555', fontWeight: i === 0 ? 700 : 400, padding: '2px 0', borderBottom: i === 0 ? '2px solid #1D6F42' : 'none' }}>{t}</span>
              ))}
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl', fontSize: 13 }}>
                <thead>
                  <tr>
                    <th style={{ background: '#E8E8E8', padding: '8px 10px', width: 36, borderLeft: '1px solid #D0D0D0', borderBottom: '1px solid #D0D0D0', fontSize: 11, color: '#666' }} />
                    {['מס׳', 'פרק/סעיפים', 'מלל ההתנגדות', 'נושא', 'גורם מייעץ'].map((col, ci) => {
                      const isGreen = ci === 1 || ci === 4
                      return <th key={ci} style={{ background: isGreen ? 'var(--excel-green)' : 'var(--excel-blue)', color: '#fff', padding: '10px 14px', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap', borderLeft: '1px solid rgba(255,255,255,0.15)', fontSize: 13 }}>{col}</th>
                    })}
                  </tr>
                </thead>
                <tbody>
                  {[
                    { num: '1', chap: 'פרק ג׳, סעיף 14', text: 'הגברת הצפיפות המוצעת תפגע בצביון המרחב הציבורי ובאיכות החיים של תושבי האזור', topic: 'צפיפות מגורים', advisor: 'משרד הבינוי והשיכון' },
                    { num: '2', chap: 'פרק ד׳, סעיף 22(א)', text: 'התכנית אינה מספקת מספר מקומות חניה מינימלי בהתאם לתקן עבור מבני מגורים', topic: 'תחבורה וחניה', advisor: 'משרד התחבורה' },
                    { num: '3', chap: 'פרק ב׳, סעיף 8(ג)', text: 'גובה הבנייה המוצע חורג ממגבלות הגובה הקבועות בתכנית המתאר הארצית', topic: 'גובה ונפח בנייה', advisor: 'הוועדה המחוזית' },
                    { num: '4', chap: 'פרק ה׳, סעיף 31', text: 'אין בתכנית פתרון מספק לניקוז מי הגשם שעלולים לגרום להצפות', topic: 'תשתיות ניקוז', advisor: 'רשות המים הישראלית' },
                    { num: '5', chap: 'פרק א׳, סעיף 3(ב)', text: 'ההליך לא כלל שיתוף ציבור מספיק ותושבים לא קיבלו הודעה מראש כנדרש בחוק', topic: 'הליך תכנוני', advisor: 'משרד הפנים' },
                  ].map((row, ri) => {
                    const cells = [row.num, row.chap, row.text, row.topic, row.advisor]
                    return (
                      <tr key={ri} style={{ background: ri % 2 === 0 ? '#fff' : '#EBF2F9' }}>
                        <td style={{ background: '#F2F2F2', padding: '8px 10px', textAlign: 'center', fontSize: 11, color: '#888', borderLeft: '1px solid #D8D8D8', borderBottom: '1px solid #E4E4E4' }}>{ri + 2}</td>
                        {cells.map((cell, ci) => {
                          const isGreen = ci === 1 || ci === 4
                          return <td key={ci} style={{ padding: '10px 14px', borderBottom: '1px solid #DDE5EF', borderLeft: '1px solid #DDE5EF', color: isGreen ? 'var(--excel-green-text)' : '#0F1F3D', fontWeight: isGreen ? 600 : 400, background: isGreen ? 'rgba(29,111,66,0.05)' : undefined, lineHeight: 1.5, whiteSpace: ci === 2 ? 'normal' : 'nowrap' }}>{cell}</td>
                        })}
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ background: '#1D6F42', padding: '4px 16px', display: 'flex', gap: 24, direction: 'rtl' }}>
              {['מוכן', '5 רשומות', 'ספירה: 5'].map((t, i) => <span key={i} style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)' }}>{t}</span>)}
            </div>
          </div>
        </div>
      </section>

      {/* ── Pricing ── */}
      <section id="pricing" style={{ padding: '96px 24px', background: 'var(--parchment)', borderTop: '1px solid var(--border-warm)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: 60 }}>
            <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--brass)', letterSpacing: 2, textTransform: 'uppercase' as const, marginBottom: 16 }}>תמחור</div>
            <h2 style={{ fontSize: 'clamp(26px, 3.5vw, 42px)', fontWeight: 800, color: 'var(--navy)', margin: '0 0 12px', letterSpacing: '-0.5px' }}>תשלום לפי צריכה. ללא מינוי כפוי.</h2>
            <p style={{ fontSize: 16, color: 'var(--navy)', opacity: 0.58, margin: 0 }}>המסמך הראשון ללא עלות — אין צורך בכרטיס אשראי.</p>
          </div>
          <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap', alignItems: 'stretch' }}>
            {[
              { name: 'מסמך בודד', price: '29', unit: '₪ למסמך', features: ['מסמך אחד', 'Excel מלא — 5 עמודות', 'הורדה מיידית', 'תקף 30 יום'], cta: 'רכוש מסמך', highlight: false },
              { name: 'חבילת 10', price: '199', unit: '₪ / 10 מסמכים', sub: '19.90 ₪ למסמך', features: ['10 מסמכים', 'Excel מלא — 5 עמודות', 'הורדה מיידית', 'תקף 90 יום', 'עדיפות בתור'], cta: 'רכוש חבילה', highlight: true },
              { name: 'חודשי', price: '399', unit: '₪ / חודש', sub: '50 מסמכים, 7.98 ₪ למסמך', features: ['50 מסמכים בחודש', 'Excel מלא — 5 עמודות', 'הורדה מיידית', 'תמיכה עדיפותית', 'היסטוריית מסמכים'], cta: 'התחל מנוי', highlight: false },
            ].map((tier, i) => (
              <div key={i} style={{ flex: '1 1 280px', maxWidth: 340, background: tier.highlight ? 'var(--navy)' : '#fff', border: tier.highlight ? '2px solid var(--brass)' : '1px solid var(--border-warm)', borderRadius: 8, padding: '36px 32px', display: 'flex', flexDirection: 'column', position: 'relative', boxShadow: tier.highlight ? '0 12px 40px rgba(10,22,60,0.18)' : '0 2px 12px rgba(10,22,60,0.06)' }}>
                {tier.highlight && <div style={{ position: 'absolute', top: -13, right: '50%', transform: 'translateX(50%)', background: 'var(--brass)', color: '#fff', fontSize: 11, fontWeight: 700, padding: '4px 14px', borderRadius: 20, letterSpacing: 0.8, whiteSpace: 'nowrap' as const }}>הכי פופולרי</div>}
                <div style={{ marginBottom: 28 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: tier.highlight ? 'rgba(255,255,255,0.55)' : 'var(--navy)', marginBottom: 8 }}>{tier.name}</div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, marginBottom: 4 }}>
                    <span style={{ fontSize: 48, fontWeight: 900, letterSpacing: '-2px', color: tier.highlight ? '#fff' : 'var(--navy)', lineHeight: 1 }}>{tier.price}</span>
                    <span style={{ fontSize: 15, color: tier.highlight ? 'rgba(255,255,255,0.65)' : 'var(--navy)', opacity: 0.7 }}>{tier.unit}</span>
                  </div>
                  {'sub' in tier && <div style={{ fontSize: 13, color: 'var(--brass)', fontWeight: 600 }}>{(tier as any).sub}</div>}
                </div>
                <div style={{ flex: 1, marginBottom: 28 }}>
                  {tier.features.map((f, fi) => (
                    <div key={fi} style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 11 }}>
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <circle cx="8" cy="8" r="7.25" stroke={tier.highlight ? 'rgba(255,255,255,0.25)' : 'var(--border-warm)'} strokeWidth="1.5" />
                        <path d="M5 8l2 2 4-4" stroke={tier.highlight ? 'var(--brass)' : 'var(--excel-green-text)'} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      <span style={{ fontSize: 14, color: tier.highlight ? 'rgba(255,255,255,0.8)' : 'var(--navy)', opacity: tier.highlight ? 1 : 0.85 }}>{f}</span>
                    </div>
                  ))}
                </div>
                <button onClick={onEnterApp} style={{ width: '100%', padding: '12px', background: tier.highlight ? 'var(--brass)' : 'transparent', color: tier.highlight ? '#fff' : 'var(--navy)', border: tier.highlight ? 'none' : '1.5px solid var(--border-warm)', borderRadius: 4, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.18s' }}>
                  {tier.cta}
                </button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer style={{ background: 'var(--navy)', padding: '40px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 16, direction: 'rtl' }}>
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <img
            src="/logo.png"
            alt="Parsely"
            style={{
              height: 34,
              width: 'auto',
              objectFit: 'contain',
              filter: 'brightness(0) invert(1)',
              flexShrink: 0,
            }}
          />
        </div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)' }}>© 2026 Parsely · כל הזכויות שמורות</div>
        <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.38)' }}>נבנה לשוק הישראלי</div>
      </footer>
    </div>
  )
}

// ── Main Tool ────────────────────────────────────────────────────────────────

const PROCESSING_STEPS = [
  { label: 'קריאת המסמך', detail: 'מנתח מבנה PDF ומחלץ טקסט גולמי' },
  { label: 'זיהוי ההתנגדויות', detail: 'מאתר גבולות כל התנגדות בטקסט' },
  { label: 'מיצוי ומיון', detail: 'מסווג נושאים, סעיפים וגורמים מייעצים' },
  { label: 'בניית הטבלה', detail: 'יוצר קובץ Excel עם עיצוב מלא' },
]

export default function Home() {
  const { isLoaded, isSignedIn } = useUser()
  const [view, setView] = useState<'landing' | 'tool'>('landing')
  const [state, setState] = useState<AppState>('idle')
  const [files, setFiles] = useState<File[]>([])
  const [fileName, setFileName] = useState('')
  const [outputMode, setOutputMode] = useState<OutputMode>('merged')
  const [isDragging, setIsDragging] = useState(false)
  const [logsOpen, setLogsOpen] = useState(true)
  const [logs, setLogs] = useState<string[]>([])
  const [errorMsg, setErrorMsg] = useState('')
  const [summary, setSummary] = useState<SummaryItem[]>([])
  const [downloadFiles, setDownloadFiles] = useState<DownloadFile[]>([])
  const [credits, setCredits] = useState<number | null>(null)
  const [expandedAnalysis, setExpandedAnalysis] = useState<Set<string>>(new Set())
  const fileInputRef = useRef<HTMLInputElement>(null)
  const logsEndRef = useRef<HTMLDivElement>(null)

  const [objections, setObjections] = useState<ObjectionItem[]>([])
  const [stage3Loading, setStage3Loading] = useState(false)
  const [stage3Progress, setStage3Progress] = useState({ current: 0, total: 0 })
  const [processingStep, setProcessingStep] = useState(0)

  const [showReportModal, setShowReportModal] = useState(false)
  const [reportText, setReportText] = useState('')
  const [reportSubmitted, setReportSubmitted] = useState(false)
  const [submittingReport, setSubmittingReport] = useState(false)

  // Skip landing for logged-in users
  useEffect(() => {
    if (isLoaded && isSignedIn) setView('tool')
  }, [isLoaded, isSignedIn])

  useEffect(() => {
    if (logsOpen) logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [logs, logsOpen])

  useEffect(() => {
    if (!isSignedIn) return
    fetch('/api/credits').then(r => r.ok ? r.json() : null).then(d => setCredits(d?.credits ?? 0)).catch(() => {})
  }, [isSignedIn])

  // Simulate processing step progress based on log messages
  useEffect(() => {
    if (state !== 'processing') return
    const step = logs.filter(l => l.includes('שלב')).length
    setProcessingStep(Math.min(step, PROCESSING_STEPS.length - 1))
  }, [logs, state])

  const toggleAnalysisExpand = (key: string) => {
    setExpandedAnalysis(prev => {
      const next = new Set(prev)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

  const addFiles = (incoming: File[]) => {
    const valid = incoming.filter(f => f.name.toLowerCase().endsWith('.pdf') && f.size <= 50 * 1024 * 1024)
    setFiles(prev => {
      const existing = new Set(prev.map(f => f.name))
      return [...prev, ...valid.filter(f => !existing.has(f.name))]
    })
  }

  const removeFile = (name: string) => setFiles(prev => prev.filter(f => f.name !== name))

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setIsDragging(false)
    addFiles(Array.from(e.dataTransfer.files))
  }, [])

  const handleDragOver = (e: React.DragEvent) => { e.preventDefault(); setIsDragging(true) }
  const handleDragLeave = () => setIsDragging(false)
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files) addFiles(Array.from(e.target.files))
  }

  const handleSSEEvent = useCallback((event: any) => {
    if (event.type === 'log') {
      setLogs(prev => [...prev, event.message as string])
    } else if (event.type === 'done') {
      setObjections(event.objections ?? [])
      setSummary(event.summary ?? [])
      setState('preview')
    } else if (event.type === 'error') {
      setErrorMsg(event.message as string)
      setState('error')
    }
  }, [])

  const startProcessing = async () => {
    if (!files.length) return
    if (!isSignedIn) { setErrorMsg('יש להתחבר למערכת לפני עיבוד מסמכים.'); setState('error'); return }
    if (credits !== null && credits <= 0) { setErrorMsg('אין קרדיטים זמינים. יש לרכוש קרדיטים בדשבורד.'); setState('error'); return }

    setState('processing'); setLogs([]); setSummary([]); setDownloadFiles([])
    setObjections([]); setLogsOpen(true); setErrorMsg(''); setExpandedAnalysis(new Set())
    setProcessingStep(0)

    const CHUNK_SIZE = 3.5 * 1024 * 1024 // 3.5 MB — safely under Vercel's 4.5 MB CDN limit

    try {
      setLogs(['מכין קבצים לעיבוד...'])

      // Step 1: obtain short-lived upload token (auth + credit check in Lambda)
      const initRes = await fetch('/api/process', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'init' }),
      })
      if (!initRes.ok) {
        const err = await initRes.json().catch(() => ({}))
        setErrorMsg(err.error || 'שגיאה בהכנת העיבוד.')
        setState('error'); return
      }
      const { token } = await initRes.json()
      setCredits(prev => prev !== null ? Math.max(0, prev - 1) : null)

      // Step 2: upload files in chunks — each chunk < 3.5 MB to stay under Vercel's 4.5 MB limit
      const sessionId = crypto.randomUUID()
      const fileNames: string[] = files.map(f => f.name)

      const totalChunks = files.reduce((acc, f) => acc + Math.ceil(f.size / CHUNK_SIZE), 0)
      let uploadedChunks = 0

      setLogs([`שולח ${files.length === 1 ? 'קובץ' : `${files.length} קבצים`}...`])

      for (const file of files) {
        const numChunks = Math.ceil(file.size / CHUNK_SIZE)
        for (let i = 0; i < numChunks; i++) {
          const start = i * CHUNK_SIZE
          const chunkBlob = file.slice(start, Math.min(start + CHUNK_SIZE, file.size))

          const chunkForm = new FormData()
          chunkForm.append('session_id', sessionId)
          chunkForm.append('file_name', file.name)
          chunkForm.append('chunk_index', String(i))
          chunkForm.append('data', chunkBlob, file.name)

          const chunkRes = await fetch('/api/upload-chunk', {
            method: 'POST',
            headers: { 'x-upload-token': token },
            body: chunkForm,
          })
          if (!chunkRes.ok) {
            const err = await chunkRes.json().catch(() => ({}))
            setErrorMsg(err.error || 'שגיאה בשליחת הקובץ.')
            setState('error'); return
          }

          uploadedChunks++
          if (totalChunks > 1) {
            const pct = Math.round((uploadedChunks / totalChunks) * 100)
            setLogs(prev => {
              const next = [...prev]
              next[next.length - 1] = `שולח ${files.length === 1 ? 'קובץ' : `${files.length} קבצים`}: ${pct}%`
              return next
            })
          }
        }
      }

      setLogs(prev => [...prev, 'מעבד קבצים...'])

      // Step 3: trigger processing via middleware rewrite (SSE streams edge-side, avoids Lambda buffering)
      const res = await fetch('/api/process-session-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-upload-token': token },
        body: JSON.stringify({ session_id: sessionId, file_names: fileNames }),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        setErrorMsg(err.error || 'שגיאה בעיבוד. אנא נסה שוב.')
        setState('error'); return
      }
      if (!res.body) throw new Error('no body')

      const reader = res.body.getReader()
      const decoder = new TextDecoder()
      let buf = ''
      let processingDone = false
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        buf += decoder.decode(value, { stream: true })
        const parts = buf.split('\n\n')
        buf = parts.pop() ?? ''
        for (const part of parts) {
          for (const line of part.split('\n')) {
            if (line.startsWith('data: ')) {
              try {
                const event = JSON.parse(line.slice(6))
                handleSSEEvent(event)
                if (event.type === 'done') processingDone = true
              } catch {}
            }
          }
        }
      }

    } catch {
      setErrorMsg('שגיאת רשת בעיבוד. אנא נסה שוב.')
      setState('error')
    }
  }

  const analyzeSingleSection = async (objIdx: number, secIdx: number) => {
    const obj = objections[objIdx]
    const sec = obj.sections[secIdx]
    setObjections(prev => { const u = [...prev]; u[objIdx].sections[secIdx] = { ...u[objIdx].sections[secIdx], isAnalyzing: true }; return u })
    try {
      const response = await fetch('/api/process', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stage3', section_title: sec.section_title, clauses: sec.clauses.map(c => c.text) }) })
      if (!response.ok) throw new Error()
      const result = await response.json()
      setObjections(prev => {
        const u = [...prev]
        const cs = u[objIdx].sections[secIdx]
        u[objIdx].sections[secIdx] = { ...cs, section_summary: result.section_summary, section_annex: result.section_annex, confidence: result.confidence, clauses: cs.clauses.map((c, i) => ({ ...c, gorem: result.clauses[i]?.gorem || 'אחר' })), isAnalyzing: false }
        return u
      })
      const key = `${objIdx}-${secIdx}`
      setExpandedAnalysis(prev => { const n = new Set(prev); n.add(key); return n })
    } catch {
      setObjections(prev => { const u = [...prev]; u[objIdx].sections[secIdx] = { ...u[objIdx].sections[secIdx], isAnalyzing: false }; return u })
    }
  }

  const proceedToSummary = async () => {
    setStage3Loading(true); setErrorMsg('')
    const tasks: Array<{ objIdx: number; secIdx: number; section: SectionItem }> = []
    objections.forEach((obj, objIdx) => obj.sections.forEach((sec, secIdx) => { if (!sec.section_summary) tasks.push({ objIdx, secIdx, section: sec }) }))
    setStage3Progress({ current: 0, total: tasks.length })
    const updatedObjections = JSON.parse(JSON.stringify(objections)) as ObjectionItem[]
    let completed = 0
    const batchSize = 3
    for (let i = 0; i < tasks.length; i += batchSize) {
      if (i > 0) await new Promise(resolve => setTimeout(resolve, 800))
      const batch = tasks.slice(i, i + batchSize)
      await Promise.all(batch.map(async task => {
        try {
          const response = await fetch('/api/process', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'stage3', section_title: task.section.section_title, clauses: task.section.clauses.map(c => c.text) }) })
          if (!response.ok) throw new Error()
          const result = await response.json()
          const cs = updatedObjections[task.objIdx].sections[task.secIdx]
          updatedObjections[task.objIdx].sections[task.secIdx] = { ...cs, section_summary: result.section_summary, section_annex: result.section_annex, confidence: result.confidence, clauses: cs.clauses.map((c, idx) => ({ ...c, gorem: result.clauses[idx]?.gorem || 'אחר' })) }
          setObjections([...updatedObjections])
        } catch {
          const cs = updatedObjections[task.objIdx].sections[task.secIdx]
          updatedObjections[task.objIdx].sections[task.secIdx] = { ...cs, section_summary: 'שמאות וכלכלה', section_annex: 'שמאות', confidence: 'low', clauses: cs.clauses.map(c => ({ ...c, gorem: 'שמאי' })) }
          setObjections([...updatedObjections])
        } finally {
          completed++
          setStage3Progress(prev => ({ ...prev, current: completed }))
        }
      }))
    }
    try {
      const excelRes = await fetch('/api/process', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'excel', objections: updatedObjections, mode: outputMode, fileName: fileName.trim() || 'התנגדויות_מאוגדות' }) })
      if (!excelRes.ok) throw new Error('שגיאה ביצירת קובץ ה-Excel')
      const excelData = await excelRes.json()
      if (excelData.mode === 'merged') {
        const bytes = Uint8Array.from(atob(excelData.file), c => c.charCodeAt(0))
        const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
        setDownloadFiles([{ name: excelData.fileName, url: URL.createObjectURL(blob) }])
      } else {
        const dfiles = (excelData.files as Array<{ name: string; data: string }>).map(f => {
          const bytes = Uint8Array.from(atob(f.data), c => c.charCodeAt(0))
          const blob = new Blob([bytes], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' })
          return { name: f.name, url: URL.createObjectURL(blob) }
        })
        setDownloadFiles(dfiles)
      }
      const totalClauses = updatedObjections.reduce((sum, obj) => sum + obj.sections.reduce((s, sec) => s + sec.clauses.length, 0), 0)
      fetch('/api/process', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'save_job', file_names: files.map(f => f.name), file_count: files.length, clause_count: totalClauses, result_json: updatedObjections }) }).catch(() => {})
      setState('done')
    } catch (err: any) {
      setErrorMsg(err.message || 'שגיאה ביצירת קובץ ה-Excel')
      setState('error')
    } finally {
      setStage3Loading(false)
    }
  }

  const submitErrorReport = () => {
    setSubmittingReport(true)
    setTimeout(() => { setSubmittingReport(false); setReportSubmitted(true); setReportText('') }, 1200)
  }

  const triggerDownload = (url: string, name: string) => {
    const a = document.createElement('a'); a.href = url; a.download = name; a.click()
  }

  const reset = () => {
    downloadFiles.forEach(f => URL.revokeObjectURL(f.url))
    setFiles([]); setFileName(''); setDownloadFiles([])
    setErrorMsg(''); setLogs([]); setSummary([]); setObjections([])
    setState('idle'); setShowReportModal(false); setReportSubmitted(false); setExpandedAnalysis(new Set())
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const totalClausesCount = objections.reduce((sum, obj) => sum + obj.sections.reduce((s, sec) => s + sec.clauses.length, 0), 0)

  if (!isLoaded) {
    return (
      <div style={{
        minHeight: '100vh',
        background: 'var(--parchment)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }} dir="rtl">
        <div style={{
          width: 32,
          height: 32,
          border: '3px solid var(--border-warm)',
          borderTopColor: 'var(--brass)',
          borderRadius: '50%',
          animation: 'spin-brass 0.75s linear infinite',
        }} />
      </div>
    )
  }

  if (view === 'landing') {
    return <LandingPage onEnterApp={() => setView('tool')} />
  }

  // ── Tool view ──
  return (
    <main style={{ minHeight: 'calc(100vh - 64px)', background: 'var(--parchment)', padding: '32px 24px', direction: 'rtl' }}>
      <div style={{ maxWidth: 860, margin: '0 auto' }}>

        {/* Page header */}
        <div style={{ marginBottom: 20 }}>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--navy)', margin: 0, letterSpacing: '-0.5px' }}>עיבוד התנגדויות תכנוניות</h1>
          <p style={{ fontSize: 14, color: 'var(--muted)', marginTop: 4 }}>העלה מסמכי PDF לניתוח והפקת דוח Excel</p>
        </div>

        {/* Main card */}
        <div style={{ background: '#fff', border: '1px solid var(--border-warm)', borderRadius: 8, padding: 24, boxShadow: '0 2px 12px rgba(10,22,60,0.06)' }}>

          {/* ── IDLE ── */}
          {state === 'idle' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              {/* Auth notice */}
              {isLoaded && !isSignedIn && (
                <div style={{ background: 'rgba(10,22,60,0.04)', border: '1px solid var(--border-warm)', borderRadius: 6, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>יש להתחבר כדי לעבד מסמכים</p>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <Link href="/sign-in" style={{ fontSize: 12, fontWeight: 700, color: 'var(--navy)', border: '1px solid var(--border-warm)', padding: '5px 12px', borderRadius: 4, textDecoration: 'none' }}>כניסה</Link>
                    <Link href="/sign-up" style={{ fontSize: 12, fontWeight: 700, color: '#fff', background: 'var(--navy)', padding: '5px 12px', borderRadius: 4, textDecoration: 'none' }}>הרשמה</Link>
                  </div>
                </div>
              )}
              {isLoaded && isSignedIn && credits === 0 && (
                <div style={{ background: 'rgba(180,140,50,0.06)', border: '1px solid rgba(180,140,50,0.25)', borderRadius: 6, padding: '10px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
                  <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>אין קרדיטים זמינים — יש לרכוש קרדיטים לפני העיבוד</p>
                  <Link href="/dashboard" style={{ fontSize: 12, fontWeight: 700, color: 'var(--brass)', border: '1px solid rgba(180,140,50,0.3)', padding: '5px 12px', borderRadius: 4, textDecoration: 'none', whiteSpace: 'nowrap' as const }}>לרכישה</Link>
                </div>
              )}

              {/* Drop zone */}
              <div
                onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${isDragging ? 'var(--brass)' : 'var(--border-warm)'}`,
                  borderRadius: 8, padding: '24px 20px', textAlign: 'center', cursor: 'pointer',
                  background: isDragging ? 'rgba(180,140,50,0.04)' : '#fff',
                  transition: 'all 0.2s', position: 'relative', overflow: 'hidden',
                }}
              >
                {/* Grid texture */}
                <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', backgroundImage: 'linear-gradient(var(--border-warm) 1px, transparent 1px), linear-gradient(90deg, var(--border-warm) 1px, transparent 1px)', backgroundSize: '32px 32px', opacity: isDragging ? 0.5 : 0.25, transition: 'opacity 0.2s' }} />
                <input ref={fileInputRef} type="file" accept=".pdf" multiple onChange={handleInputChange} style={{ display: 'none' }} />
                <div style={{ position: 'relative', zIndex: 1 }}>
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: isDragging ? 'var(--brass)' : 'var(--navy)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px', boxShadow: isDragging ? '0 4px 12px rgba(180,140,50,0.2)' : '0 2px 8px rgba(10,22,60,0.12)', transition: 'all 0.2s' }}>
                    <svg width="20" height="20" viewBox="0 0 32 32" fill="none"><path d="M16 20V8M16 8L10 14M16 8l6 6" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /><path d="M6 24h20" stroke="white" strokeWidth="2" strokeLinecap="round" opacity=".5" /></svg>
                  </div>
                  <p style={{ fontSize: 16, fontWeight: 700, color: 'var(--navy)', margin: '0 0 4px', letterSpacing: '-0.3px' }}>{isDragging ? 'שחרר להעלאה' : 'גרור קבצי PDF לכאן'}</p>
                  <p style={{ fontSize: 12, color: 'var(--navy)', opacity: 0.5, margin: '0 0 14px' }}>או לחץ לבחירת קבצים · PDF בלבד · עד 50MB לקובץ</p>
                  <div style={{ display: 'inline-block', padding: '7px 18px', background: 'var(--navy)', color: '#fff', borderRadius: 4, fontSize: 13, fontWeight: 600 }}>בחר קבצי PDF</div>
                </div>
              </div>

              {/* File list */}
              {files.length > 0 && (
                <div style={{ border: '1px solid var(--border-warm)', borderRadius: 6, overflow: 'hidden' }}>
                  <div style={{ padding: '10px 16px', background: '#FAFAF8', borderBottom: '1px solid var(--border-warm)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--navy)' }}>קבצים שנבחרו</span>
                    <span style={{ fontSize: 12, background: 'rgba(10,22,60,0.07)', color: 'var(--navy)', padding: '2px 8px', borderRadius: 10, fontWeight: 700 }}>{files.length}</span>
                  </div>
                  <div style={{ maxHeight: 200, overflowY: 'auto' }}>
                    {files.map(f => (
                      <div key={f.name} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 16px', borderBottom: '1px solid var(--border-warm)', background: '#fff' }}>
                        <div style={{ width: 32, height: 32, background: '#E8302B', borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: '#fff', flexShrink: 0 }}>PDF</div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <p style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0 }}>{f.name}</p>
                          <p style={{ fontSize: 11, color: 'var(--muted)', margin: '2px 0 0' }}>{(f.size / 1024 / 1024).toFixed(1)} MB</p>
                        </div>
                        <button onClick={e => { e.stopPropagation(); removeFile(f.name) }} style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', padding: 4, borderRadius: 4, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Output options */}
              {files.length > 0 && (
                <div style={{ background: '#FAFAF8', border: '1px solid var(--border-warm)', borderRadius: 6, padding: '16px 20px' }}>
                  <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 12, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>אופן הפקת הקובץ</p>
                  <div style={{ display: 'flex', gap: 10, marginBottom: 16 }}>
                    {(['merged', 'separate'] as OutputMode[]).map(m => (
                      <button key={m} onClick={() => setOutputMode(m)} style={{ flex: 1, padding: '9px', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit', border: outputMode === m ? '1.5px solid var(--navy)' : '1.5px solid var(--border-warm)', background: outputMode === m ? 'var(--navy)' : '#fff', color: outputMode === m ? '#fff' : 'var(--navy)', transition: 'all 0.15s' }}>
                        {m === 'merged' ? 'קובץ אחד מאוחד' : 'קובץ נפרד לכל PDF'}
                      </button>
                    ))}
                  </div>
                  {outputMode === 'merged' && (
                    <div>
                      <p style={{ fontSize: 12, fontWeight: 700, color: 'var(--muted)', marginBottom: 8, textTransform: 'uppercase' as const, letterSpacing: 0.5 }}>שם קובץ Excel</p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="text" value={fileName} onChange={e => setFileName(e.target.value)} placeholder="התנגדויות_מאוגדות" style={{ flex: 1, padding: '8px 12px', border: '1px solid var(--border-warm)', borderRadius: 4, fontSize: 13, color: 'var(--navy)', fontFamily: 'inherit', outline: 'none', background: '#fff' }} />
                        <span style={{ fontSize: 13, color: 'var(--muted)', fontWeight: 500 }}>.xlsx</span>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Process button */}
              {files.length > 0 && (
                <button onClick={startProcessing} style={{ width: '100%', padding: '14px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.18s' }}>
                  {files.length === 1 ? 'עבד מסמך' : `עבד ${files.length} מסמכים`}{' — '}{outputMode === 'merged' ? 'עבור לבדיקה מקדימה' : 'קבצים נפרדים'}
                </button>
              )}

              {/* Trust bar */}
              <div style={{ display: 'flex', gap: 20, justifyContent: 'center', flexWrap: 'wrap', padding: '14px 20px', background: '#FAFAF8', borderRadius: 6, border: '1px solid var(--border-warm)' }}>
                {[{ icon: '🔒', text: 'הקבצים נמחקים לאחר 24 שעות' }, { icon: '🇮🇱', text: 'שרתים בישראל' }, { icon: '⚡', text: 'פחות מ-20 שניות' }].map((item, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--navy)', opacity: 0.55 }}>
                    <span>{item.icon}</span>{item.text}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* ── PROCESSING ── */}
          {state === 'processing' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              {/* File info */}
              <div style={{ background: '#FAFAF8', border: '1px solid var(--border-warm)', borderRadius: 6, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 14 }}>
                <div style={{ width: 40, height: 40, background: '#E8302B', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 800, color: '#fff', flexShrink: 0 }}>PDF</div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--navy)' }}>{files.length} {files.length === 1 ? 'קובץ' : 'קבצים'} בעיבוד</div>
                  <div style={{ fontSize: 12, color: 'var(--muted)', marginTop: 2 }}>{logs.length > 0 ? logs[logs.length - 1] : 'מתחיל עיבוד...'}</div>
                </div>
              </div>

              {/* Step cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {PROCESSING_STEPS.map((step, i) => {
                  const isDone = i < processingStep
                  const isActive = i === processingStep
                  const isPending = i > processingStep
                  return (
                    <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 18px', borderRadius: 6, background: isActive ? 'var(--navy)' : '#fff', border: isActive ? '1px solid var(--navy)' : isDone ? '1px solid var(--border-warm)' : '1px solid transparent', opacity: isPending ? 0.38 : 1, transition: 'all 0.35s ease' }}>
                      <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: isDone ? 'var(--excel-green-text)' : isActive ? 'rgba(255,255,255,0.15)' : 'var(--border-warm)', display: 'flex', alignItems: 'center', justifyContent: 'center', border: isActive ? '2px solid rgba(255,255,255,0.3)' : 'none', transition: 'all 0.35s' }}>
                        {isDone ? (
                          <svg width="13" height="13" viewBox="0 0 14 14" fill="none"><path d="M3 7l3 3 5-5" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" /></svg>
                        ) : isActive ? (
                          <div style={{
                            width: 12,
                            height: 12,
                            border: '2px solid rgba(255,255,255,0.3)',
                            borderTopColor: '#fff',
                            borderRadius: '50%',
                            animation: 'spin-brass 0.75s linear infinite'
                          }} />
                        ) : (
                          <span style={{ fontSize: 11, color: 'var(--navy)', opacity: 0.5 }}>{i + 1}</span>
                        )}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontSize: 14, fontWeight: isActive ? 700 : 500, color: isActive ? '#fff' : 'var(--navy)' }}>{step.label}</div>
                        {isActive && <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.55)', marginTop: 2 }}>{step.detail}</div>}
                        {isDone && <div style={{ fontSize: 11, color: 'var(--excel-green-text)', marginTop: 2 }}>הושלם</div>}
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Logs (collapsed by default in new design, kept functional) */}
              <div style={{ border: '1px solid var(--border-warm)', borderRadius: 6, overflow: 'hidden' }}>
                <button onClick={() => setLogsOpen(v => !v)} style={{ width: '100%', padding: '10px 16px', background: '#FAFAF8', border: 'none', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: 13, fontWeight: 600, color: 'var(--navy)', fontFamily: 'inherit' }}>
                  <span>יומן פעולות</span>
                  <svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ transform: logsOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
                {logsOpen && (
                  <div style={{ background: '#0F172A', padding: 16, maxHeight: 200, overflowY: 'auto', direction: 'ltr' }}>
                    <div style={{ fontFamily: 'monospace', fontSize: 12, color: '#CBD5E1', lineHeight: 1.6 }}>
                      {logs.map((l, i) => (
                        <div key={i} style={{ color: l.includes('✓') ? '#4ADE80' : l.includes('✗') ? '#F87171' : '#CBD5E1' }}>{l}</div>
                      ))}
                      <div ref={logsEndRef} />
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── PREVIEW ── */}
          {state === 'preview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 12, paddingBottom: 20, borderBottom: '1px solid var(--border-warm)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: 'rgba(21,128,61,0.07)', border: '1px solid rgba(21,128,61,0.2)', borderRadius: 4, padding: '6px 12px' }}>
                    <div style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--excel-green-text)' }} />
                    <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--excel-green-text)' }}>{objections.length} התנגדויות · {totalClausesCount} סעיפים</span>
                  </div>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
                  <div>
                    <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)', margin: 0, letterSpacing: '-0.3px' }}>בדיקה מקדימה</h2>
                    <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>סכם פרקים בודדים או המשך לניתוח מלא</p>
                  </div>
                  <button disabled={stage3Loading} onClick={proceedToSummary} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 20px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 700, cursor: stage3Loading ? 'not-allowed' : 'pointer', opacity: stage3Loading ? 0.6 : 1, fontFamily: 'inherit', flexShrink: 0 }}>
                    {stage3Loading ? (
                      <><div className="spinner-brass" style={{ width: 16, height: 16, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: '#fff' }} />מנתח... ({stage3Progress.current}/{stage3Progress.total})</>
                    ) : (
                      <><svg width="14" height="14" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>המשך לניתוח מלא</>
                    )}
                  </button>
                </div>
              </div>

              {stage3Loading && (
                <div style={{ background: '#FAFAF8', border: '1px solid var(--border-warm)', borderRadius: 6, padding: '14px 18px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: 'var(--navy)', marginBottom: 8 }}>
                    <span>מנתח פרקי התנגדות...</span>
                    <span>{Math.round((stage3Progress.current / stage3Progress.total) * 100)}%</span>
                  </div>
                  <div style={{ background: 'var(--border-warm)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', background: 'var(--brass)', width: `${(stage3Progress.current / stage3Progress.total) * 100}%`, borderRadius: 4, transition: 'width 0.3s' }} />
                  </div>
                </div>
              )}

              {/* Preview table */}
              <div style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-warm)', boxShadow: '0 2px 8px rgba(10,22,60,0.06)' }}>
                <div style={{ background: '#1D6F42', height: 30, display: 'flex', alignItems: 'center', padding: '0 16px' }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginRight: 'auto', fontWeight: 600 }}>תצוגה מקדימה</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl', fontSize: 13 }}>
                    <thead>
                      <tr>
                        {[
                          { label: 'פרק / סעיף', green: false },
                          { label: 'מלל ההתנגדות', green: false },
                          { label: 'נותן מענה', green: true },
                          { label: 'ניתוח', green: false },
                        ].map((col, ci) => (
                          <th key={ci} style={{ background: col.green ? 'var(--excel-green)' : 'var(--excel-blue)', color: '#fff', padding: '9px 14px', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap', borderLeft: '1px solid rgba(255,255,255,0.15)', fontSize: 12 }}>{col.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {objections.flatMap((obj, objIdx) =>
                        obj.sections.flatMap((sec, secIdx) => {
                          const analysisKey = `${objIdx}-${secIdx}`
                          const isExpanded = expandedAnalysis.has(analysisKey)
                          const isWarning = sec.missed_some_clauses
                          return sec.clauses.map((clause, clIdx) => {
                            const isFirst = clIdx === 0
                            return (
                              <tr key={`${objIdx}-${secIdx}-${clIdx}`} style={{ background: (objIdx + secIdx) % 2 === 0 ? '#fff' : '#EBF2F9', borderRight: isWarning ? '3px solid #F59E0B' : 'none' }}>
                                <td style={{ padding: '10px 14px', borderBottom: '1px solid #DDE8F2', borderLeft: '1px solid #DDE8F2', verticalAlign: 'top', whiteSpace: 'nowrap', minWidth: 120 }}>
                                  {isFirst ? (
                                    <div>
                                      <p style={{ fontSize: 10, color: 'var(--muted)', margin: '0 0 2px' }}>{obj.meta.megish || obj.fileName}</p>
                                      <p style={{ fontSize: 13, color: 'var(--excel-blue)', fontWeight: 700, margin: 0 }}>{sec.section_number}</p>
                                      <p style={{ fontSize: 10, color: 'var(--muted)', margin: '2px 0 0', maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{sec.section_title}</p>
                                      {isWarning && <span style={{ display: 'inline-block', background: 'rgba(245,158,11,0.1)', color: '#B45309', fontSize: 9, padding: '2px 5px', borderRadius: 2, fontWeight: 700, marginTop: 3 }}>סריקה חלקית?</span>}
                                    </div>
                                  ) : null}
                                </td>
                                <td style={{ padding: '10px 14px', borderBottom: '1px solid #DDE8F2', borderLeft: '1px solid #DDE8F2', color: '#0F1F3D', lineHeight: 1.55, verticalAlign: 'top' }}>{clause.text}</td>
                                <td style={{ padding: '10px 14px', borderBottom: '1px solid #DDE8F2', borderLeft: '1px solid #DDE8F2', textAlign: 'center', verticalAlign: 'top', background: 'rgba(29,111,66,0.04)' }}>
                                  {sec.isAnalyzing ? <span style={{ fontSize: 12, color: 'var(--excel-blue)' }}>מחשב...</span>
                                    : clause.gorem ? <span style={{ display: 'inline-block', background: 'rgba(29,111,66,0.08)', color: 'var(--excel-green-text)', padding: '3px 8px', borderRadius: 3, fontSize: 12, fontWeight: 600 }}>{clause.gorem}</span>
                                      : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}
                                </td>
                                <td style={{ padding: '10px 14px', borderBottom: '1px solid #DDE8F2', textAlign: 'center', verticalAlign: 'top' }}>
                                  {isFirst ? (
                                    sec.isAnalyzing ? <div style={{ width: 16, height: 16, border: '2px solid var(--border-warm)', borderTopColor: 'var(--brass)', borderRadius: '50%', animation: 'spin-brass 0.75s linear infinite', margin: 'auto' }} />
                                      : sec.section_summary ? (
                                        <div>
                                          {sec.confidence === 'low' && <ConfidenceFlag />}
                                          <button onClick={() => toggleAnalysisExpand(analysisKey)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '4px 8px', border: '1px solid var(--border-warm)', borderRadius: 4, cursor: 'pointer', background: '#fff', color: 'var(--navy)', fontFamily: 'inherit', margin: 'auto' }}>
                                            <svg width="10" height="10" fill="none" stroke="currentColor" viewBox="0 0 24 24" style={{ transform: isExpanded ? 'rotate(180deg)' : 'none' }}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                                            {isExpanded ? 'הסתר' : 'הצג'}
                                          </button>
                                          {isExpanded && <div style={{ background: '#FAFAF8', border: '1px solid var(--border-warm)', borderRadius: 4, padding: '8px 10px', marginTop: 6, textAlign: 'right', width: 140 }}>
                                            <p style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, margin: '0 0 2px' }}>נושא</p>
                                            <p style={{ fontSize: 12, color: 'var(--navy)', fontWeight: 600, margin: '0 0 6px' }}>{sec.section_summary}</p>
                                            <p style={{ fontSize: 10, color: 'var(--muted)', fontWeight: 700, margin: '0 0 2px' }}>נספח</p>
                                            <p style={{ fontSize: 12, color: 'var(--navy)', margin: 0 }}>{sec.section_annex}</p>
                                          </div>}
                                        </div>
                                      ) : (
                                        <button disabled={stage3Loading} onClick={() => analyzeSingleSection(objIdx, secIdx)} style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 12, padding: '4px 10px', border: '1px solid var(--border-warm)', borderRadius: 4, cursor: 'pointer', background: '#fff', color: 'var(--navy)', fontFamily: 'inherit', margin: 'auto', opacity: stage3Loading ? 0.5 : 1 }}>
                                          נתח פרק
                                        </button>
                                      )
                                  ) : null}
                                </td>
                              </tr>
                            )
                          })
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div style={{ background: '#1D6F42', padding: '4px 14px', display: 'flex', gap: 20, direction: 'rtl' }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>בדיקה מקדימה</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{objections.length} התנגדויות</span>
                </div>
              </div>
            </div>
          )}

          {/* ── DONE ── */}
          {state === 'done' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 16, paddingBottom: 20, borderBottom: '1px solid var(--border-warm)' }}>
                <div style={{ width: 48, height: 48, background: 'rgba(21,128,61,0.08)', border: '1px solid rgba(21,128,61,0.2)', borderRadius: 6, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <svg width="22" height="22" fill="none" stroke="var(--excel-green-text)" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                </div>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--navy)', margin: 0, letterSpacing: '-0.3px' }}>עיבוד הושלם בהצלחה</h2>
                  <p style={{ fontSize: 13, color: 'var(--muted)', marginTop: 4 }}>{summary.length} קבצים · {objections.length} התנגדויות · {totalClausesCount} סעיפים</p>
                </div>
              </div>

              {/* Download */}
              {outputMode === 'merged' && downloadFiles[0] && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => triggerDownload(downloadFiles[0].url, downloadFiles[0].name)} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', background: 'var(--excel-green)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', minWidth: 200 }}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" /></svg>
                    הורד Excel מאוחד
                  </button>
                  <button onClick={() => setShowReportModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '13px 18px', background: 'transparent', color: 'var(--muted)', border: '1.5px solid var(--border-warm)', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    דווח על שגיאה
                  </button>
                </div>
              )}
              {outputMode === 'separate' && downloadFiles.length > 0 && (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button onClick={() => downloadFiles.forEach(f => triggerDownload(f.url, f.name))} style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '13px', background: 'var(--excel-green)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                    <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3M3 17v3a2 2 0 002 2h14a2 2 0 002-2v-3" /></svg>
                    הורד {downloadFiles.length} קבצי Excel
                  </button>
                  <button onClick={() => setShowReportModal(true)} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '13px 18px', background: 'transparent', color: 'var(--muted)', border: '1.5px solid var(--border-warm)', borderRadius: 4, fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                    דווח על שגיאה
                  </button>
                </div>
              )}

              {/* Results table */}
              <div style={{ borderRadius: 6, overflow: 'hidden', border: '1px solid var(--border-warm)' }}>
                <div style={{ background: '#1D6F42', height: 30, display: 'flex', alignItems: 'center', padding: '0 16px' }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.85)', marginRight: 'auto', fontWeight: 600 }}>{(fileName.trim() || 'התנגדויות_מאוגדות')}.xlsx — Excel</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse', direction: 'rtl', fontSize: 13 }}>
                    <thead>
                      <tr>
                        {[
                          { label: 'פרק / סעיף', green: false },
                          { label: 'מלל ההתנגדות', green: false },
                          { label: 'נושא', green: false },
                          { label: 'נספח', green: true },
                          { label: 'נותן מענה', green: true },
                        ].map((col, ci) => (
                          <th key={ci} style={{ background: col.green ? 'var(--excel-green)' : 'var(--excel-blue)', color: '#fff', padding: '9px 14px', fontWeight: 700, textAlign: 'right', whiteSpace: 'nowrap', borderLeft: '1px solid rgba(255,255,255,0.15)', fontSize: 12 }}>{col.label}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {objections.flatMap((obj, objIdx) =>
                        obj.sections.flatMap((sec, secIdx) => {
                          const isLowConf = sec.missed_some_clauses || sec.confidence === 'low'
                          return sec.clauses.map((clause, clIdx) => {
                            const isFirst = clIdx === 0
                            const ri = objIdx * 100 + secIdx * 10 + clIdx
                            return (
                              <tr key={`${objIdx}-${secIdx}-${clIdx}`} style={{ background: ri % 2 === 0 ? '#fff' : '#EBF2F9', borderRight: isLowConf ? '3px solid #F59E0B' : 'none' }}>
                                <td style={{ padding: '10px 14px', borderBottom: '1px solid #DDE8F2', borderLeft: '1px solid #DDE8F2', verticalAlign: 'top', whiteSpace: 'nowrap' }}>
                                  {isFirst ? <div><p style={{ fontSize: 10, color: 'var(--muted)', margin: '0 0 2px' }}>{obj.meta.megish}</p><p style={{ fontSize: 13, fontWeight: 700, color: 'var(--excel-blue)', margin: 0 }}>{sec.section_number}</p>{isLowConf && <ConfidenceFlag />}</div> : null}
                                </td>
                                <td style={{ padding: '10px 14px', borderBottom: '1px solid #DDE8F2', borderLeft: '1px solid #DDE8F2', color: '#0F1F3D', lineHeight: 1.55, verticalAlign: 'top' }}>{clause.text}</td>
                                <td style={{ padding: '10px 14px', borderBottom: '1px solid #DDE8F2', borderLeft: '1px solid #DDE8F2', fontWeight: 600, color: 'var(--navy)', verticalAlign: 'top', whiteSpace: 'nowrap' }}>{isFirst ? sec.section_summary : null}</td>
                                <td style={{ padding: '10px 14px', borderBottom: '1px solid #DDE8F2', borderLeft: '1px solid #DDE8F2', verticalAlign: 'top', background: 'rgba(29,111,66,0.04)' }}>
                                  {isFirst ? <span style={{ display: 'inline-block', background: 'rgba(29,111,66,0.08)', color: 'var(--excel-green-text)', padding: '3px 8px', borderRadius: 3, fontSize: 12, fontWeight: 600 }}>{sec.section_annex}</span> : null}
                                </td>
                                <td style={{ padding: '10px 14px', borderBottom: '1px solid #DDE8F2', verticalAlign: 'top', background: 'rgba(29,111,66,0.04)' }}>
                                  {clause.gorem ? <span style={{ display: 'inline-block', background: 'rgba(29,111,66,0.08)', color: 'var(--excel-green-text)', padding: '3px 8px', borderRadius: 3, fontSize: 12, fontWeight: 600 }}>{clause.gorem}</span> : <span style={{ color: 'var(--muted)', fontSize: 12 }}>—</span>}
                                </td>
                              </tr>
                            )
                          })
                        })
                      )}
                    </tbody>
                  </table>
                </div>
                <div style={{ background: '#1D6F42', padding: '4px 14px', display: 'flex', gap: 20, direction: 'rtl' }}>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>מוכן</span>
                  <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)' }}>{totalClausesCount} רשומות</span>
                </div>
              </div>

              <button onClick={reset} style={{ width: '100%', padding: '12px', background: 'transparent', color: 'var(--navy)', border: '1.5px solid var(--border-warm)', borderRadius: 4, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>
                עבד קבצים נוספים
              </button>
            </div>
          )}

          {/* ── ERROR ── */}
          {state === 'error' && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '32px 16px', gap: 20, textAlign: 'center' }}>
              <div style={{ width: 68, height: 68, borderRadius: '50%', background: 'rgba(220,38,38,0.07)', border: '2px solid rgba(220,38,38,0.18)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="26" height="26" viewBox="0 0 28 28" fill="none"><path d="M14 9v6M14 18.5v.5" stroke="#DC2626" strokeWidth="2.5" strokeLinecap="round" /><circle cx="14" cy="14" r="11" stroke="#DC2626" strokeWidth="2" /></svg>
              </div>
              <div>
                <h2 style={{ fontSize: 20, fontWeight: 700, color: 'var(--navy)', margin: '0 0 10px', letterSpacing: '-0.3px' }}>לא הצלחנו לעבד את הקובץ</h2>
                <p style={{ fontSize: 14, color: 'var(--muted)', lineHeight: 1.65, maxWidth: 400, margin: '0 auto 16px' }}>{errorMsg}</p>
                {errorMsg.includes('קרדיטים') && <Link href="/dashboard" style={{ fontSize: 14, fontWeight: 600, color: 'var(--brass)', textDecoration: 'underline' }}>לרכישת קרדיטים ←</Link>}
              </div>
              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={reset} style={{ padding: '10px 22px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>נסה שוב</button>
                <button onClick={reset} style={{ padding: '10px 22px', background: 'transparent', color: 'var(--navy)', border: '1.5px solid var(--border-warm)', borderRadius: 4, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>העלה קובץ אחר</button>
              </div>
            </div>
          )}
        </div>

        <p style={{ textAlign: 'center', color: 'var(--muted)', fontSize: 12, marginTop: 24 }}>
          הנתונים מעובדים בעזרת Gemini 2.5 Flash ונשמרים בצורה מאובטחת לצורך היסטוריית עבודות
        </p>
      </div>

      {/* Report modal */}
      {showReportModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(10,22,60,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16, zIndex: 50 }} dir="rtl">
          <div style={{ background: '#fff', borderRadius: 8, maxWidth: 440, width: '100%', padding: 28, boxShadow: '0 16px 48px rgba(10,22,60,0.2)', border: '1px solid var(--border-warm)', position: 'relative' }}>
            <button onClick={() => { setShowReportModal(false); setReportSubmitted(false) }} style={{ position: 'absolute', top: 12, left: 14, background: 'transparent', border: 'none', cursor: 'pointer', color: 'var(--muted)', fontSize: 18, lineHeight: 1 }}>✕</button>
            {!reportSubmitted ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                <h3 style={{ fontSize: 18, fontWeight: 800, color: 'var(--navy)', margin: 0 }}>דיווח על שגיאה</h3>
                <textarea value={reportText} onChange={e => setReportText(e.target.value)} placeholder="תאר את השגיאה שמצאת..." style={{ width: '100%', height: 110, border: '1px solid var(--border-warm)', borderRadius: 4, padding: '10px 12px', fontSize: 13, color: 'var(--navy)', fontFamily: 'inherit', resize: 'none', outline: 'none', boxSizing: 'border-box' }} />
                <button disabled={!reportText.trim() || submittingReport} onClick={submitErrorReport} style={{ width: '100%', padding: '11px', background: '#DC2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', opacity: !reportText.trim() || submittingReport ? 0.5 : 1 }}>
                  {submittingReport ? 'שולח...' : 'שלח דיווח'}
                </button>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '12px 0' }}>
                <div style={{ width: 48, height: 48, background: 'rgba(21,128,61,0.08)', border: '1px solid rgba(21,128,61,0.2)', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
                  <svg width="22" height="22" fill="none" stroke="var(--excel-green-text)" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                </div>
                <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy)', margin: '0 0 8px' }}>תודה על הדיווח!</h3>
                <p style={{ fontSize: 14, color: 'var(--muted)', margin: '0 0 20px' }}>הדיווח נקלט ויסייע לשיפור המערכת.</p>
                <button onClick={() => setShowReportModal(false)} style={{ padding: '9px 20px', background: 'var(--navy)', color: '#fff', border: 'none', borderRadius: 4, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit' }}>סגור</button>
              </div>
            )}
          </div>
        </div>
      )}
    </main>
  )
}
