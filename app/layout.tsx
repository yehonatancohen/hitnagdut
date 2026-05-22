import type { Metadata } from 'next'
import { Heebo } from 'next/font/google'
import { ClerkProvider } from '@clerk/nextjs'
import './globals.css'
import NavBar from './components/NavBar'

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['300', '400', '500', '600', '700', '800'],
  variable: '--font-heebo',
})

export const metadata: Metadata = {
  title: 'מערכת ניתוח התנגדויות תכנוניות',
  description: 'עיבוד וסיכום התנגדויות לתכניות בנייה בעזרת בינה מלאכותית',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="he" dir="rtl" className={heebo.variable}>
        <body className="font-heebo bg-slate-50 text-slate-800 antialiased">
          <NavBar />
          {children}
        </body>
      </html>
    </ClerkProvider>
  )
}
