import { requireProfile } from '@/lib/supabase/server'
import ChildrenManager from '@/components/ChildrenManager'
import StudyChart from '@/components/StudyChart'
import Link from 'next/link'
export const dynamic = 'force-dynamic'
const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
export default async function ParentDashboard() {
  const { sb, profile } = await requireProfile('parent')
  const today = new Date().toISOString().slice(0, 10)
  const weekAgo = new Date(Date.now() - 6 * 864e5); weekAgo.setHours(0, 0, 0, 0)
  // 4 queries for the whole family (RLS limits rows to this family)
  const [kids, sessions, hw, exams] = await Promise.all([
    sb.from('students').select('id,name,user_id,invite_code,points_balance,level').order('created_at'),
    sb.from('study_sessions').select('student_id,started_at,duration_sec').gte('started_at', weekAgo.toISOString()),
    sb.from('homework').select('student_id,due_date').neq('status', 'done'),
    sb.from('exams').select('student_id,title,exam_date').gte('exam_date', new Date().toISOString()).order('exam_date').limit(50),
  ])
  const students = kids.data ?? []
  const chart = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekAgo.getTime() + i * 864e5), key = d.toDateString()
    const sec = (sessions.data ?? []).filter(s => new Date(s.started_at).toDateString() === key).reduce((a, s) => a + (s.duration_sec ?? 0), 0)
    return { day: AR_DAYS[d.getDay()], minutes: Math.round(sec / 60) }
  })
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">أهلاً {profile.full_name}</h1>
      {students.length === 0 && <p className="card">أضف ابنك/ابنتك من الأسفل للبدء.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {students.map(s => {
          const todayMin = Math.round((sessions.data ?? []).filter(x => x.student_id === s.id && x.started_at.slice(0, 10) === today).reduce((a, x) => a + (x.duration_sec ?? 0), 0) / 60)
          const open = (hw.data ?? []).filter(h => h.student_id === s.id)
          const overdue = open.filter(h => h.due_date < today).length
          const next = (exams.data ?? []).find(e => e.student_id === s.id)
          return (
            <div key={s.id} className="card space-y-1">
              <h2 className="text-lg font-bold"><Link href={`/parent/child/${s.id}`} className="text-blue-600 hover:underline">{s.name} — إدارة الدراسة ⚙️</Link></h2>
              <p>⏱️ مذاكرة اليوم: {todayMin} دقيقة</p>
              <p>📝 واجبات مفتوحة: {open.length} {overdue > 0 && <b className="text-red-600">(متأخر: {overdue})</b>}</p>
              <p>📅 أقرب امتحان: {next ? `${next.title} — ${new Date(next.exam_date).toLocaleDateString('ar-EG')}` : 'لا يوجد'}</p>
              <p>⭐ المستوى {s.level} — {s.points_balance} نقطة</p>
            </div>)
        })}
      </div>
      <div className="card"><h2 className="mb-2 font-bold">دقائق المذاكرة آخر 7 أيام (كل الأبناء)</h2><StudyChart data={chart} /></div>
      <ChildrenManager children={students} />
    </div>
  )
}
