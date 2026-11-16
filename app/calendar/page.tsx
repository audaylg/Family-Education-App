import Link from 'next/link'
import { requireProfile } from '@/lib/supabase/server'
import CalendarView from '@/components/CalendarView'
export const dynamic = 'force-dynamic'
const key = (d: string) => new Date(d).toLocaleDateString('en-CA', { timeZone: 'Africa/Cairo' })

export default async function CalendarPage({ searchParams }: { searchParams: Promise<{ child?: string }> }) {
  const { child } = await searchParams
  const { sb } = await requireProfile()
  const { data: kids } = await sb.from('students').select('id,name').order('created_at')
  const list = kids ?? [], sel = list.find(k => k.id === child) ?? list[0]
  if (!sel) return <p className="card">لا يوجد طلاب بعد.</p>
  const [exams, hw] = await Promise.all([
    sb.from('exams').select('title,exam_date').eq('student_id', sel.id),
    sb.from('homework').select('title,due_date,status,kind').eq('student_id', sel.id),
  ])
  const events = [
    ...(exams.data ?? []).map(e => ({ date: key(e.exam_date), title: e.title, type: 'exam' as const })),
    ...(hw.data ?? []).map(h => ({ date: h.due_date as string, title: h.title,
      type: (h.status === 'done' ? 'done' : h.kind === 'project' ? 'project' : 'homework') as 'done' | 'project' | 'homework' })),
  ]
  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">🗓️ التقويم الدراسي — {sel.name}</h1>
      {list.length > 1 && <div className="flex flex-wrap gap-2">{list.map(k => (
        <Link key={k.id} href={`/calendar?child=${k.id}`} className={`rounded-xl border px-3 py-1 ${k.id === sel.id ? 'bg-blue-600 text-white' : ''}`}>{k.name}</Link>))}</div>}
      <CalendarView events={events} />
    </div>
  )
}
