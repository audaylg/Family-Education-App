import Link from 'next/link'
import { requireProfile } from '@/lib/supabase/server'
import ChildrenManager from '@/components/ChildrenManager'
import StudyChart from '@/components/StudyChart'
export const dynamic = 'force-dynamic'
const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
export default async function ParentDashboard() {
  const { sb, profile } = await requireProfile('parent')
  const today = new Date().toISOString().slice(0, 10)
  const weekAgo = new Date(Date.now() - 6 * 864e5); weekAgo.setHours(0, 0, 0, 0)
  // 7 parallel queries for the whole family (RLS limits rows to this family)
  const [kids, sessions, hw, exams, lessons, badges, doneHw] = await Promise.all([
    sb.from('students').select('id,name,user_id,invite_code,points_balance,level').order('created_at'),
    sb.from('study_sessions').select('student_id,started_at,duration_sec').gte('started_at', weekAgo.toISOString()).not('ended_at', 'is', null).order('started_at', { ascending: false }),
    sb.from('homework').select('student_id,due_date').neq('status', 'done'),
    sb.from('exams').select('student_id,title,exam_date').gte('exam_date', new Date().toISOString()).order('exam_date').limit(50),
    sb.from('lessons').select('student_id,status'),
    sb.from('student_badges').select('student_id,earned_at,badges(title)').order('earned_at', { ascending: false }).limit(50),
    sb.from('homework').select('student_id,title,completed_at').eq('status', 'done').not('completed_at', 'is', null).order('completed_at', { ascending: false }).limit(10),
  ])
  const students = kids.data ?? [], S = sessions.data ?? [], B = badges.data ?? []
  const nameOf = (id: string) => students.find(s => s.id === id)?.name ?? ''
  const chart = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekAgo.getTime() + i * 864e5), key = d.toDateString()
    const sec = S.filter(s => new Date(s.started_at).toDateString() === key).reduce((a, s) => a + (s.duration_sec ?? 0), 0)
    return { day: AR_DAYS[d.getDay()], minutes: Math.round(sec / 60) }
  })
  const activity = [
    ...S.slice(0, 10).map(s => ({ t: s.started_at, text: `⏱️ ${nameOf(s.student_id)} ذاكر ${Math.round((s.duration_sec ?? 0) / 60)} دقيقة` })),
    ...(doneHw.data ?? []).map(h => ({ t: h.completed_at, text: `📝 ${nameOf(h.student_id)} أنجز واجب "${h.title}"` })),
    ...B.slice(0, 10).map(b => ({ t: b.earned_at, text: `🏆 ${nameOf(b.student_id)} حصل على إنجاز "${(b.badges as any)?.title ?? ''}"` })),
  ].sort((a, b) => +new Date(b.t) - +new Date(a.t)).slice(0, 10)
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">أهلاً {profile.full_name}</h1>
      {students.length === 0 && <p className="card">أضف ابنك/ابنتك من الأسفل للبدء.</p>}
      <div className="grid gap-4 md:grid-cols-2">
        {students.map(s => {
          const sSessions = S.filter(x => x.student_id === s.id)
          const todayMin = Math.round(sSessions.filter(x => x.started_at.slice(0, 10) === today).reduce((a, x) => a + (x.duration_sec ?? 0), 0) / 60)
          const weekMin = Math.round(sSessions.reduce((a, x) => a + (x.duration_sec ?? 0), 0) / 60)
          const open = (hw.data ?? []).filter(h => h.student_id === s.id)
          const overdue = open.filter(h => h.due_date < today).length
          const next = (exams.data ?? []).find(e => e.student_id === s.id)
          const ls = (lessons.data ?? []).filter(l => l.student_id === s.id), done = ls.filter(l => l.status === 'done').length
          const pct = ls.length ? Math.round(done / ls.length * 100) : 0
          const mine = B.filter(b => b.student_id === s.id)
          return (
            <div key={s.id} className="card space-y-1">
              <h2 className="text-lg font-bold"><Link href={`/parent/child/${s.id}`} className="text-blue-600 hover:underline">{s.name} — إدارة الدراسة ⚙️</Link></h2>
              <p>⏱️ اليوم: {todayMin} دقيقة — الأسبوع: {Math.floor(weekMin / 60)}س {weekMin % 60}د</p>
              <p>📝 واجبات مفتوحة: {open.length} {overdue > 0 && <b className="text-red-600">(متأخر: {overdue})</b>}</p>
              <p>📅 أقرب امتحان: {next ? `${next.title} — ${new Date(next.exam_date).toLocaleDateString('ar-EG')}` : 'لا يوجد'}</p>
              <p>⭐ المستوى {s.level} — {s.points_balance} نقطة</p>
              <div><div className="flex justify-between text-sm"><span>تقدم الدروس</span><span>{done}/{ls.length} ({pct}%)</span></div>
                <div className="h-2 rounded bg-slate-200 dark:bg-slate-700"><div className="h-2 rounded bg-green-500" style={{ width: `${pct}%` }} /></div></div>
              <p className="flex flex-wrap gap-1 pt-1">{mine.length === 0 ? <span className="text-sm opacity-60">لا إنجازات بعد</span> :
                mine.map((b, i) => <span key={i} className="rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-900">🏆 {(b.badges as any)?.title}</span>)}</p>
            </div>)
        })}
      </div>
      <div className="card"><h2 className="mb-2 font-bold">دقائق المذاكرة آخر 7 أيام (كل الأبناء)</h2><StudyChart data={chart} /></div>
      <div className="card"><h2 className="mb-2 font-bold">🕒 آخر النشاط</h2>
        {activity.length === 0 ? <p>لا يوجد نشاط بعد</p> : <ul className="space-y-1">{activity.map((a, i) =>
          <li key={i} className="flex justify-between gap-2 border-t py-1 text-sm dark:border-slate-700"><span>{a.text}</span><span className="opacity-60">{new Date(a.t).toLocaleDateString('ar-EG')}</span></li>)}</ul>}</div>
      <ChildrenManager children={students} />
    </div>
  )
}
