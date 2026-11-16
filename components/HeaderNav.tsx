'use client'
import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase/client'
type N = { id: string; title: string; body: string | null; read_at: string | null; created_at: string }
export default function HeaderNav() {
  const [role, setRole] = useState<string | null>(null)
  const [items, setItems] = useState<N[]>([]); const [open, setOpen] = useState(false)
  const load = useCallback(async (r: string) => {
    const { data } = await supabaseBrowser().from('notifications').select('id,title,body,read_at,created_at')
      .eq('audience', r).order('created_at', { ascending: false }).limit(15)
    setItems(data ?? [])
  }, [])
  useEffect(() => {
    const sb = supabaseBrowser(); let timer: ReturnType<typeof setInterval>
    sb.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: p } = await sb.from('profiles').select('role').eq('id', data.user.id).single()
      if (!p) return
      setRole(p.role)
      const day = new Date().toISOString().slice(0, 10)
      if (sessionStorage.getItem('edu-rem') !== day) { await sb.rpc('generate_reminders'); sessionStorage.setItem('edu-rem', day) }
      load(p.role); timer = setInterval(() => load(p.role), 60000)
    })
    return () => clearInterval(timer)
  }, [load])
  if (!role) return null
  const unread = items.filter(i => !i.read_at)
  async function toggle() {
    const next = !open; setOpen(next)
    if (next && unread.length) {
      await supabaseBrowser().from('notifications').update({ read_at: new Date().toISOString() }).in('id', unread.map(u => u.id))
      setTimeout(() => load(role!), 1500)
    }
  }
  return (
    <nav className="flex items-center gap-3 text-sm">
      <Link href="/" className="hover:underline">الرئيسية</Link>
      <Link href="/stats" className="hover:underline">📈 الإحصائيات</Link>
      <Link href="/calendar" className="hover:underline">🗓️ التقويم</Link>
      <div className="relative">
        <button className="rounded-lg border px-3 py-1" onClick={toggle} aria-label="الإشعارات">🔔{unread.length > 0 && <b className="mr-1 rounded-full bg-red-600 px-1.5 text-xs text-white">{unread.length}</b>}</button>
        {open && (
          <div className="absolute left-0 z-20 mt-2 max-h-96 w-72 overflow-auto rounded-xl border bg-white p-2 shadow-lg dark:border-slate-700 dark:bg-slate-800">
            {items.length === 0 ? <p className="p-2">لا توجد إشعارات</p> : items.map(n => (
              <div key={n.id} className={`border-b p-2 last:border-0 dark:border-slate-700 ${n.read_at ? 'opacity-60' : ''}`}>
                <div className="font-semibold">{n.title}</div>{n.body && <div className="text-xs">{n.body}</div>}
                <div className="text-xs opacity-60">{new Date(n.created_at).toLocaleString('ar-EG')}</div></div>))}
          </div>)}
      </div>
    </nav>
  )
}
