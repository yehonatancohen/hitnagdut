'use client'

import { useEffect, useState } from 'react'

export default function ReferralSection() {
  const [code, setCode] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    fetch('/api/referral').then(r => r.ok ? r.json() : null).then(d => setCode(d?.code ?? null)).catch(() => {})
  }, [])

  const link = code && typeof window !== 'undefined' ? `${window.location.origin}/sign-up?ref=${code}` : ''

  const handleCopy = async () => {
    if (!link) return
    try {
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {}
  }

  return (
    <section>
      <h2 style={{ fontSize: 18, fontWeight: 700, color: 'var(--navy)', marginBottom: 16 }}>הזמן חבר וקבל קרדיט</h2>
      <div style={{
        background: '#fff', border: '1px solid var(--border-warm)', borderRadius: 4,
        padding: '20px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap',
      }}>
        <p style={{ fontSize: 14, color: 'var(--navy)', margin: 0, flex: '1 1 280px' }}>
          שלח את הקישור הזה לחבר — כשהוא יירשם, תקבל קרדיט נוסף.
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flex: '1 1 320px' }}>
          <input
            readOnly
            value={code ? link : 'טוען...'}
            onFocus={e => e.target.select()}
            style={{
              flex: 1, padding: '9px 12px', border: '1px solid var(--border-warm)', borderRadius: 4,
              fontSize: 13, color: 'var(--muted)', background: 'var(--parchment)',
              fontFamily: 'monospace', minWidth: 0,
            }}
          />
          <button
            onClick={handleCopy}
            disabled={!code}
            style={{
              flexShrink: 0, padding: '9px 16px', background: copied ? 'var(--excel-green-text)' : 'var(--navy)',
              color: '#fff', fontWeight: 700, fontSize: 13, borderRadius: 4, border: 'none',
              cursor: code ? 'pointer' : 'default', opacity: code ? 1 : 0.6, transition: 'background 0.15s',
            }}
          >
            {copied ? 'הועתק!' : 'העתק'}
          </button>
        </div>
      </div>
    </section>
  )
}
