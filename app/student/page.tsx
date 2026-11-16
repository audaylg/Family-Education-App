import { requireProfile } from '@/lib/supabase/server'
import StudentPanel from '@/components/StudentPanel'
export const dynamic = 'force-dynamic'
export default async function StudentDashboard() {
  const { sb, profile } = await requireProfile('student')
  const { data: me } = await sb.from('students').select('id,name,points_balance,level').maybeSingle()
  const { data: exams } = await sb.from('exams').select('id,title,exam_date').gte('exam_date', new Date().toISOString()).order('exam_date').limit(5)
  const days = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 864e5)
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">مرحباً {me?.name ?? profile.full_name} 👋</h1>
      <div className="card">⭐ المستوى {me?.level ?? 1} — {me?.points_balance ?? 0} نقطة</div>
      <div className="card"><h2 className="font-bold">📅 الامتحانات القادمة</h2>
        {(exams ?? []).length === 0 ? <p>لا توجد امتحانات مسجلة</p> :
          <ul>{exams!.map(e => <li key={e.id}>{e.title} — {days(e.exam_date) <= 0 ? 'اليوم' : `بعد ${days(e.exam_date)} يوم`}</li>)}</ul>}</div>
      {me ? <StudentPanel studentId={me.id} familyId={profile.family_id} /> : <p className="card">لم يُربط حسابك بملف طالب بعد.</p>}
    </div>
  )
}
