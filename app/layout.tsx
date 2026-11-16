import './globals.css'
import { Cairo } from 'next/font/google'
import { ThemeProvider } from 'next-themes'
import ThemeToggle from '@/components/ThemeToggle'
import SwRegister from '@/components/SwRegister'
import LogoutButton from '@/components/LogoutButton'
const cairo = Cairo({ subsets: ['arabic', 'latin'], variable: '--font-cairo' })
export const metadata = { title: 'مدير التعليم العائلي', manifest: '/manifest.json', icons: { icon: '/icon-192.png', apple: '/icon-192.png' } }
export const viewport = { themeColor: '#2563eb' }
export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${cairo.variable} font-sans bg-slate-50 text-slate-900 dark:bg-slate-900 dark:text-slate-100`}>
        <SwRegister />
        <ThemeProvider attribute="class" defaultTheme="system">
          <header className="flex items-center justify-between border-b p-4 dark:border-slate-700">
            <b>📚 مدير التعليم العائلي</b><span className="flex gap-2"><LogoutButton /><ThemeToggle /></span>
          </header>
          <main className="mx-auto max-w-5xl p-4">{children}</main>
        </ThemeProvider>
      </body>
    </html>
  )
}
