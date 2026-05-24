'use client'

import { SignUp } from '@clerk/nextjs'
import Link from 'next/link'

const appearance = {
  variables: {
    colorBackground: '#ffffff',
    colorInputBackground: '#faf9f6',
    colorInputText: 'oklch(17% 0.045 258)',
    colorText: 'oklch(17% 0.045 258)',
    colorTextSecondary: 'oklch(58% 0.022 258)',
    colorPrimary: 'oklch(17% 0.045 258)',
    colorDanger: '#DC2626',
    borderRadius: '4px',
    fontFamily: 'var(--font-heebo), Heebo, sans-serif',
  },
  elements: {
    rootBox: 'w-full max-w-md mx-auto',
    card: 'shadow-none border border-[oklch(88%_0.018_78)] rounded-[4px] w-full bg-white',
    headerTitle: 'text-right w-full font-extrabold',
    headerSubtitle: 'text-right w-full',
    socialButtonsBlockButton: 'border border-[oklch(88%_0.018_78)] bg-white hover:bg-[oklch(96.5%_0.012_78)] rounded-[4px] transition-colors',
    socialButtonsBlockButtonText: 'font-semibold',
    dividerLine: 'bg-[oklch(88%_0.018_78)]',
    dividerText: 'text-[oklch(58%_0.022_258)]',
    formFieldLabel: 'text-right block w-full text-sm font-semibold',
    formFieldInput: 'bg-[oklch(96.5%_0.012_78)] border-[oklch(88%_0.018_78)] text-right rounded-[4px] focus:border-[oklch(17%_0.045_258)]',
    formButtonPrimary: 'bg-[oklch(17%_0.045_258)] hover:opacity-90 rounded-[4px] font-bold transition-opacity',
    footerActionText: 'text-[oklch(58%_0.022_258)]',
    footerActionLink: 'text-[oklch(65%_0.13_72)] hover:opacity-80 font-semibold',
    identityPreviewText: 'text-[oklch(17%_0.045_258)]',
    identityPreviewEditButton: 'text-[oklch(65%_0.13_72)]',
    formFieldInputShowPasswordButton: 'text-[oklch(58%_0.022_258)]',
    otpCodeFieldInput: 'border-[oklch(88%_0.018_78)] bg-[oklch(96.5%_0.012_78)] rounded-[4px]',
  },
}

export default function SignUpPage() {
  return (
    <main
      style={{
        minHeight: '100vh',
        background: 'var(--parchment)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      dir="rtl"
    >
      {/* Logo + heading */}
      <div style={{ marginBottom: 28, textAlign: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, marginBottom: 10 }}>
          <div style={{
            width: 40, height: 40, background: 'var(--brass)', borderRadius: 4,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontWeight: 900, fontSize: 22, color: '#fff', letterSpacing: '-1px',
          }}>
            נ
          </div>
          <span style={{ fontWeight: 800, fontSize: 24, color: 'var(--navy)', letterSpacing: '-0.5px' }}>נוסח</span>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: 14 }}>יצירת חשבון במערכת ניתוח התנגדויות</p>
      </div>

      <SignUp appearance={appearance} />

      <p style={{ marginTop: 20, color: 'var(--muted)', fontSize: 14 }}>
        כבר יש לך חשבון?{' '}
        <Link href="/sign-in" style={{ color: 'var(--brass)', fontWeight: 700, textDecoration: 'none' }}>
          כניסה למערכת
        </Link>
      </p>
    </main>
  )
}
