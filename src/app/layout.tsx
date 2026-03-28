import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'מעקב נוכחות',
  description: 'אפליקציית מעקב נוכחות למורים',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${inter.variable} font-sans bg-slate-50 min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
