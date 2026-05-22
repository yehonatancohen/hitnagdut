'use client'

import { SignIn } from '@clerk/nextjs'

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6" dir="rtl">
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-slate-800">כניסה למערכת</h1>
        <p className="text-slate-500 text-sm mt-1">מערכת ניתוח התנגדויות תכנוניות</p>
      </div>
      <SignIn
        appearance={{
          elements: {
            rootBox: 'w-full max-w-md',
            card: 'shadow-sm border border-slate-200 rounded-xl',
          },
        }}
      />
    </main>
  )
}
