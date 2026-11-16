import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase/admin'
const base = { fullName: z.string().min(2).max(80), email: z.string().email(), password: z.string().min(8).max(72) }
const schema = z.discriminatedUnion('role', [
  z.object({ ...base, role: z.literal('parent'), familyName: z.string().min(2).max(80) }),
  z.object({ ...base, role: z.literal('student'), inviteCode: z.string().min(6).max(32) }),
])
export async function POST(req: Request) {
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY || !process.env.NEXT_PUBLIC_SUPABASE_URL)
    return NextResponse.json({ error: 'مفتاح SUPABASE_SERVICE_ROLE_KEY غير مضبوط في .env.local (أعد تشغيل التطبيق بعد ضبطه)' }, { status: 500 })
  const p = schema.safeParse(await req.json().catch(() => null))
  if (!p.success) return NextResponse.json({ error: 'بيانات غير صالحة' }, { status: 400 })
  const d = p.data, admin = supabaseAdmin()
  let studentId: string | null = null, familyId: string
  if (d.role === 'student') {
    const { data: st } = await admin.from('students').select('id,family_id').eq('invite_code', d.inviteCode.trim()).is('user_id', null).maybeSingle()
    if (!st) return NextResponse.json({ error: 'رمز الدعوة غير صحيح أو مستخدم من قبل' }, { status: 400 })
    studentId = st.id; familyId = st.family_id
  } else familyId = ''
  const { data: u, error } = await admin.auth.admin.createUser({ email: d.email, password: d.password, email_confirm: true })
  if (error || !u.user) return NextResponse.json({ error: 'تعذر إنشاء الحساب (قد يكون البريد مستخدماً)' }, { status: 400 })
  const rollback = async () => { await admin.auth.admin.deleteUser(u.user.id) }
  if (d.role === 'parent') {
    const { data: fam, error: e1 } = await admin.from('families').insert({ name: d.familyName }).select('id').single()
    if (e1 || !fam) { await rollback(); return NextResponse.json({ error: 'خطأ في إنشاء العائلة' }, { status: 500 }) }
    familyId = fam.id
  }
  const { error: e2 } = await admin.from('profiles').insert({ id: u.user.id, family_id: familyId, role: d.role, full_name: d.fullName })
  if (e2) { await rollback(); return NextResponse.json({ error: 'خطأ في إنشاء الملف الشخصي' }, { status: 500 }) }
  if (studentId) {
    const { error: e3 } = await admin.from('students').update({ user_id: u.user.id, invite_code: null }).eq('id', studentId).is('user_id', null)
    if (e3) { await rollback(); return NextResponse.json({ error: 'خطأ في ربط الحساب' }, { status: 500 }) }
  }
  return NextResponse.json({ ok: true })
}
