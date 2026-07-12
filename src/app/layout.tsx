import type { Metadata, Viewport } from 'next'
import { Inter } from 'next/font/google'
import ErrorBoundary from '@/components/error/ErrorBoundary'
import TabAuthGuard from '@/components/layout/TabAuthGuard'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })

export const metadata: Metadata = {
  title: 'רותי – מעקב נוכחות',
  description: 'אפליקציית מעקב נוכחות למורים | קונסרבטוריון דימונה',
  openGraph: {
    title: 'רותי – מעקב נוכחות',
    description: 'אפליקציית מעקב נוכחות למורים | קונסרבטוריון דימונה',
    url: 'https://teacher-attendance-app-xi.vercel.app',
    siteName: 'רותי',
    locale: 'he_IL',
    type: 'website',
  },
}

export const viewport: Viewport = {
  themeColor: '#114F32',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="he" dir="rtl">
      <body className={`${inter.variable} font-sans bg-slate-50 min-h-screen`}>
        <TabAuthGuard />
        <ErrorBoundary>{children}</ErrorBoundary>
      </body>
    </html>
  )
}
