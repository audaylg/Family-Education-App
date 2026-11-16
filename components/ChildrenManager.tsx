'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
type Child = { id: string; name: string; user_id: string | null; invite_code: string | null }
export default function ChildrenManager({ children }: { children: Child[] }) {
  const [name, setName] = useState(''); const [msg, setMsg] = useState(''); const router = useRouter()
  async function call(method: string, body: object) {
    const r = await fetch('/api/children', { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (!r.ok) setMsg((await r.json()).error ?? 'خطأ'); else { setMsg(''); router.refresh() }
  }
  return (
    <div className="card space-y-3">
      <h2 className="font-bold">إدارة الأبناء</h2>
      <form className="flex gap-2" onSubmit={e => { e.preventDefault(); call('POST', { name }); setName('') }}>
        <input className="input" placeholder="اسم الابن/الابنة" value={name} onChange={e => setName(e.target.value)} required />
        <button className="btn">إضافة</button>
      </form>
      {msg && <p className="text-red-600">{msg}</p>}
      <ul className="space-y-2">
        {children.map(c => (
          <li key={c.id} className="flex items-center justify-between gap-2 rounded-xl border p-3 dark:border-slate-700">
            <span>{c.name} — {c.user_id ? '✅ الحساب مفعّل' : <>رمز الدعوة: <code className="font-mono">{c.invite_code}</code></>}</span>
            <button className="text-red-600" onClick={() => confirm(`حذف ${c.name} وحسابه وكل بياناته نهائياً؟`) && call('DELETE', { id: c.id })}>حذف</button>
          </li>))}
      </ul>
    </div>
  )
}
