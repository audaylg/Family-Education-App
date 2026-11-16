import { NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseServer } from '@/lib/supabase/server'
import { supabaseAdmin } from '@/lib/supabase/admin'
async function parentCtx() {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) return null
  const { data: p } = await sb.from('profiles').select('family_id,role').eq('id', user.id).single()
  return p?.role === 'parent' ? { sb, familyId: p.family_id as string } : null
}
export async function POST(req: Request) {
  const ctx = await parentCtx(); if (!ctx) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
  const b = z.object({ name: z.string().min(2).max(60) }).safeParse(await req.json().catch(() => null))
  if (!b.success) return NextResponse.json({ error: 'اسم غير صالح' }, { status: 400 })
  const { error } = await ctx.sb.from('students').insert({ family_id: ctx.familyId, name: b.data.name })
  return error ? NextResponse.json({ error: 'تعذر الإضافة' }, { status: 500 }) : NextResponse.json({ ok: true })
}
// Only a parent can delete a child (and the child's login account)
export async function DELETE(req: Request) {
  const ctx = await parentCtx(); if (!ctx) return NextResponse.json({ error: 'غير مصرح' }, { status: 403 })
  const b = z.object({ id: z.string().uuid() }).safeParse(await req.json().catch(() => null))
  if (!b.success) return NextResponse.json({ error: 'طلب غير صالح' }, { status: 400 })
  const { data: st } = await ctx.sb.from('students').select('id,user_id').eq('id', b.data.id).maybeSingle() // RLS-scoped to family
  if (!st) return NextResponse.json({ error: 'غير موجود' }, { status: 404 })
  const admin = supabaseAdmin()
  if (st.user_id) await admin.auth.admin.deleteUser(st.user_id)
  const { error } = await admin.from('students').delete().eq('id', st.id)
  return error ? NextResponse.json({ error: 'تعذر الحذف' }, { status: 500 }) : NextResponse.json({ ok: true })
}
