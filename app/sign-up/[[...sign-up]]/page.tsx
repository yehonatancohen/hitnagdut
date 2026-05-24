'use client'

import { SignUp } from '@clerk/nextjs'
import Link from 'next/link'

const darkAppearance = {
  variables: {
    colorBackground: '#1e293b',
    colorInputBackground: '#0f172a',
    colorInputText: '#f1f5f9',
    colorText: '#f1f5f9',
    colorTextSecondary: '#94a3b8',
    colorPrimary: '#3b82f6',
    colorDanger: '#f87171',
    borderRadius: '0.5rem',
    fontFamily: 'var(--font-heebo), sans-serif',
  },
  elements: {
    rootBox: 'w-full max-w-md mx-auto',
    card: 'bg-slate-800 border border-slate-700 shadow-2xl rounded-xl w-full',
    headerTitle: 'text-white text-right w-full',
    headerSubtitle: 'text-slate-400 text-right w-full',
    socialButtonsBlockButton: 'bg-slate-700 border-slate-600 text-white hover:bg-slate-600 rounded-lg',
    socialButtonsBlockButtonText: 'text-white font-medium',
    dividerLine: 'bg-slate-600',
    dividerText: 'text-slate-400',
    formFieldLabel: 'text-slate-300 text-sm text-right block w-full',
    formFieldInput: 'bg-slate-900 border-slate-600 text-white placeholder-slate-500 focus:border-blue-500 text-right',
    formButtonPrimary: 'bg-blue-600 hover:bg-blue-500 text-white font-semibold rounded-lg',
    footerActionText: 'text-slate-400',
    footerActionLink: 'text-blue-400 hover:text-blue-300',
    identityPreviewText: 'text-white',
    identityPreviewEditButton: 'text-blue-400',
    formFieldInputShowPasswordButton: 'text-slate-400',
    otpCodeFieldInput: 'bg-slate-900 border-slate-600 text-white',
  },
}

export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6" dir="rtl">
      <div className="mb-8 text-center">
        <div className="flex items-center justify-center gap-3 mb-4">
          <div className="w-10 h-10 bg-blue-600 rounded-xl flex items-center justify-center">
            <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">יצירת חשבון</h1>
        </div>
        <p className="text-slate-400 text-sm">מערכת ניתוח התנגדויות תכנוניות</p>
      </div>

      <SignUp appearance={darkAppearance} />

      <p className="mt-6 text-slate-500 text-sm">
        כבר יש לך חשבון?{' '}
        <Link href="/sign-in" className="text-blue-400 hover:text-blue-300 font-medium transition-colors">
          כניסה למערכת
        </Link>
      </p>
    </main>
  )
}
