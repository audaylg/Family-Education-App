import Link from 'next/link'
import { notFound } from 'next/navigation'
import { requireProfile } from '@/lib/supabase/server'
import ManageChild from '@/components/ManageChild'
export const dynamic = 'force-dynamic'
export default async function ChildPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { sb, profile } = await requireProfile('parent')
  const { data: st } = await sb.from('students').select('id,name').eq('id', id).maybeSingle()
  if (!st) notFound()
  const q = (t: string, cols: string, order: string) => sb.from(t).select(cols).eq('student_id', id).order(order)
  const [subjects, lessons, homework, exams, grades] = await Promise.all([
    q('subjects', '*', 'name'), q('lessons', '*', 'title'), q('homework', '*', 'due_date'),
    q('exams', '*', 'exam_date'), q('grades', '*', 'recorded_on'),
  ])
  return (
    <div className="space-y-4">
      <Link href="/parent" className="text-blue-600">← الرجوع للوحة</Link>
      <h1 className="text-2xl font-bold">إدارة: {st.name}</h1>
      <ManageChild studentId={id} familyId={profile.family_id}
        subjects={subjects.data ?? []} lessons={lessons.data ?? []} homework={homework.data ?? []}
        exams={exams.data ?? []} grades={grades.data ?? []} />
    </div>
  )
}
