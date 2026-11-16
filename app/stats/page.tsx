import Link from 'next/link'
import { requireProfile } from '@/lib/supabase/server'
import StudyChart from '@/components/StudyChart'
export const dynamic = 'force-dynamic'
const AR_DAYS = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت']
const key = (d: Date | string) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })
const hm = (sec: number) => `${Math.floor(sec / 3600)}س ${Math.round(sec / 60) % 60}د`

export default async function Stats({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const { child } = await searchParams
  const { sb } = await requireProfile()
  const { data: kids } = await sb.from('students').select('id,name').order('created_at')
  const list = kids ?? [], sel = list.find(k => k.id === child) ?? list[0]
  if (!sel) return <p className="card">لا يوجد طلاب بعد.</p>

  const since = new Date(Date.now() - 28 * 864e5)
  const [ses, subs, hw] = await Promise.all([
    sb.from('study_sessions').select('subject_id,started_at,duration_sec').eq('student_id', sel.id).gte('started_at', since.toISOString()).not('ended_at', 'is', null),
    sb.from('subjects').select('id,name').eq('student_id', sel.id),
    sb.from('homework').select('completed_at').eq('student_id', sel.id).eq('status', 'done'),
  ])
  const S = ses.data ?? [], now = Date.now()
  const daily = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(now - (6 - i) * 864e5), k = key(d)
    const sec = S.filter(s => key(s.started_at) === k).reduce((a, s) => a + (s.duration_sec ?? 0), 0)
    return { day: AR_DAYS[new Date(k + 'T12:00:00').getDay()], minutes: Math.round(sec / 60), sec }
  })
  const weekly = Array.from({ length: 4 }, (_, i) => {
    const w = 3 - i, sec = S.filter(s => { const age = (now - new Date(s.started_at).getTime()) / 864e5; return age >= w * 7 && age < (w + 1) * 7 })
      .reduce((a, s) => a + (s.duration_sec ?? 0), 0)
    return { day: w === 0 ? 'هذا الأسبوع' : `قبل ${w} أسبوع`, minutes: Math.round(sec / 60), sec }
  })
  const bySubject = (subs.data ?? []).map(s => ({
    day: s.name, sec: S.filter(x => x.subject_id === s.id).reduce((a, x) => a + (x.duration_sec ?? 0), 0),
  })).map(x => ({ ...x, minutes: Math.round(x.sec / 60) }))
  const sorted = [...bySubject].sort((a, b) => b.sec - a.sec)
  const done = hw.data ?? [], doneWeek = done.filter(h => h.completed_at && now - new Date(h.completed_at).getTime() < 7 * 864e5).length
  const todaySec = daily[6].sec, weekSec = daily.reduce((a, d) => a + d.sec, 0)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">📈 الإحصائيات — {sel.name}</h1>
      {list.length > 1 && <div className="flex flex-wrap gap-2">{list.map(k => (
        <Link key={k.id} href={`/stats?child=${k.id}`} className={`rounded-xl border px-3 py-1 ${k.id === sel.id ? 'bg-blue-600 text-white' : ''}`}>{k.name}</Link>))}</div>}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <div className="card !p-3 text-center"><b className="text-lg">{hm(todaySec)}</b><div className="text-xs opacity-70">اليوم</div></div>
        <div className="card !p-3 text-center"><b className="text-lg">{hm(weekSec)}</b><div className="text-xs opacity-70">آخر 7 أيام</div></div>
        <div className="card !p-3 text-center"><b className="text-lg">{done.length}</b><div className="text-xs opacity-70">واجبات منجزة ({doneWeek} هذا الأسبوع)</div></div>
        <div className="card !p-3 text-center"><b className="text-lg">{S.length}</b><div className="text-xs opacity-70">جلسات آخر 28 يوماً</div></div>
      </div>
      <div className="card"><h2 className="mb-2 font-bold">المذاكرة اليومية (دقائق)</h2><StudyChart data={daily} /></div>
      <div className="card"><h2 className="mb-2 font-bold">المذاكرة الأسبوعية (دقائق)</h2><StudyChart data={weekly} /></div>
      <div className="card"><h2 className="mb-2 font-bold">حسب المادة — آخر 28 يوماً (دقائق)</h2>
        {bySubject.length === 0 ? <p>لا توجد مواد بعد.</p> : <>
          <StudyChart data={bySubject} />
          {sorted[0].sec > 0 ? <p className="mt-2">الأكثر مذاكرة: <b>{sorted[0].day}</b> ({hm(sorted[0].sec)}) — الأقل: <b>{sorted[sorted.length - 1].day}</b> ({hm(sorted[sorted.length - 1].sec)})</p>
            : <p className="mt-2 opacity-70">لا توجد جلسات مسجلة بعد.</p>}</>}
      </div>
    </div>
  )
}
