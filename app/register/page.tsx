'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase/client'
export default function Register() {
  const [role, setRole] = useState<'parent' | 'student'>('parent')
  const [f, setF] = useState({ fullName: '', email: '', password: '', familyName: '', inviteCode: '' })
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    let res: Response
    try { res = await fetch('/api/register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...f, role }) }) }
    catch { setErr('تعذر الاتصال بالخادم'); setBusy(false); return }
    if (!res.ok) { const j = await res.json().catch(() => null); setErr(j?.error ?? `خطأ في الخادم (${res.status}) - راجع logs\\server.log`); setBusy(false); return }
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email: f.email, password: f.password })
    if (error) { setErr('تم إنشاء الحساب، سجّل الدخول يدوياً'); setBusy(false) } else location.href = '/'
  }
  return (
    <form onSubmit={submit} className="card mx-auto mt-10 max-w-sm space-y-3">
      <h1 className="text-xl font-bold">إنشاء حساب</h1>
      <div className="flex gap-2">
        {(['parent', 'student'] as const).map(r => (
          <button type="button" key={r} onClick={() => setRole(r)}
            className={`flex-1 rounded-xl border px-3 py-2 ${role === r ? 'bg-blue-600 text-white' : ''}`}>{r === 'parent' ? 'ولي أمر' : 'طالب'}</button>))}
      </div>
      <input className="input" placeholder="الاسم الكامل" value={f.fullName} onChange={set('fullName')} required />
      <input className="input" type="email" placeholder="البريد الإلكتروني" value={f.email} onChange={set('email')} required />
      <input className="input" type="password" minLength={8} placeholder="كلمة المرور (8 أحرف على الأقل)" value={f.password} onChange={set('password')} required />
      {role === 'parent'
        ? <input className="input" placeholder="اسم العائلة" value={f.familyName} onChange={set('familyName')} required />
        : <input className="input" placeholder="رمز الدعوة من ولي الأمر" value={f.inviteCode} onChange={set('inviteCode')} required />}
      {err && <p className="text-red-600">{err}</p>}
      <button className="btn w-full" disabled={busy}>إنشاء الحساب</button>
      <p className="text-sm">لديك حساب؟ <Link className="text-blue-600" href="/login">دخول</Link></p>
    </form>
  )
}
