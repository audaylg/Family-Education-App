'use client'
import { useState } from 'react'
import Link from 'next/link'
import { supabaseBrowser } from '@/lib/supabase/client'
export default function Login() {
  const [email, setEmail] = useState(''); const [password, setPassword] = useState('')
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false)
  async function submit(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    const { error } = await supabaseBrowser().auth.signInWithPassword({ email, password })
    if (error) { setErr('البريد الإلكتروني أو كلمة المرور غير صحيحة'); setBusy(false) } else location.href = '/'
  }
  return (
    <form onSubmit={submit} className="card mx-auto mt-10 max-w-sm space-y-3">
      <h1 className="text-xl font-bold">تسجيل الدخول</h1>
      <input className="input" type="email" placeholder="البريد الإلكتروني" value={email} onChange={e => setEmail(e.target.value)} required />
      <input className="input" type="password" placeholder="كلمة المرور" value={password} onChange={e => setPassword(e.target.value)} required />
      {err && <p className="text-red-600">{err}</p>}
      <button className="btn w-full" disabled={busy}>دخول</button>
      <p className="text-sm">ليس لديك حساب؟ <Link className="text-blue-600" href="/register">إنشاء حساب</Link></p>
    </form>
  )
}
