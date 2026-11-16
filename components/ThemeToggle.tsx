'use client'
import { useTheme } from 'next-themes'
export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme()
  return <button className="rounded-lg border px-3 py-1" onClick={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}>
    {resolvedTheme === 'dark' ? '☀️ فاتح' : '🌙 داكن'}</button>
}
