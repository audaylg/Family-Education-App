import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
export async function supabaseServer() {
  const c = await cookies()
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
    cookies: { getAll: () => c.getAll(),
      setAll: (l) => { try { l.forEach(({ name, value, options }) => c.set(name, value, options)) } catch {} } } })
}
export async function requireProfile(role?: 'parent' | 'student') {
  const sb = await supabaseServer()
  const { data: { user } } = await sb.auth.getUser()
  if (!user) redirect('/login')
  const { data: profile } = await sb.from('profiles').select('*').eq('id', user.id).single()
  if (!profile) redirect('/login')
  if (role && profile.role !== role) redirect(profile.role === 'parent' ? '/parent' : '/student')
  return { sb, profile }
}
