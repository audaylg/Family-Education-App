'use client'
import { useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
export default function LogoutButton() {
  const [on, setOn] = useState(false)
  useEffect(() => {
    const sb = supabaseBrowser()
    sb.auth.getUser().then(({ data }) => setOn(!!data.user))
    const { data: l } = sb.auth.onAuthStateChange((_e, s) => setOn(!!s))
    return () => l.subscription.unsubscribe()
  }, [])
  if (!on) return null
  return <button className="rounded-lg border px-3 py-1" onClick={async () => { await supabaseBrowser().auth.signOut(); location.href = '/login' }}>🚪 تسجيل الخروج</button>
}
