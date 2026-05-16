import type { Metadata } from 'next'
import { Heebo } from 'next/font/google'
import './globals.css'

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  weight: ['300', '400', '500', '700', '800'],
  variable: '--font-heebo',
})

export const metadata: Metadata = {
  title: 'ממיר התנגדויות תכנוניות',
  description: 'המרת מסמכי התנגדות לתכניות בניין עיר לטבלת Excel מסודרת',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl" className={heebo.variable}>
      <body className="font-heebo">{children}</body>
    </html>
  )
}
