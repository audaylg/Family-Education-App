'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
type Row = Record<string, any>
type Props = { studentId: string; familyId: string; subjects: Row[]; lessons: Row[]; homework: Row[]; exams: Row[]; grades: Row[] }
const statusAr: Record<string, string> = { pending: 'لم يبدأ', in_progress: 'جارٍ', done: 'تم', missed: 'فائت' }

export default function ManageChild({ studentId, familyId, subjects, lessons, homework, exams, grades }: Props) {
  const router = useRouter(); const sb = supabaseBrowser(); const [err, setErr] = useState('')
  const done = (error: { message: string } | null) => { if (error) setErr('تعذر الحفظ: ' + error.message); else { setErr(''); router.refresh() } }
  const add = async (table: string, row: Row) => done((await sb.from(table).insert({ family_id: familyId, student_id: studentId, ...row })).error)
  const del = async (table: string, id: string) => { if (confirm('تأكيد الحذف؟')) done((await sb.from(table).delete().eq('id', id)).error) }
  const setStatus = async (table: string, id: string, status: string) =>
    done((await sb.from(table).update({ status, completed_at: status === 'done' ? new Date().toISOString() : null }).eq('id', id)).error)
  const subName = (id: string) => subjects.find(s => s.id === id)?.name ?? '—'
  const viewPhoto = async (path: string) => {
    const { data, error } = await sb.storage.from('homework-photos').createSignedUrl(path, 300)
    if (error || !data) setErr('تعذر فتح الصورة'); else window.open(data.signedUrl, '_blank')
  }
  const submit = (fn: (f: FormData) => Promise<void>) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); fn(f).then(() => form.reset())
  }
  const SubjectSelect = ({ required = true }: { required?: boolean }) => (
    <select name="subject_id" className="input" required={required}>
      <option value="">— المادة —</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
    </select>)
  const daysLeft = (d: string) => Math.ceil((new Date(d).getTime() - Date.now()) / 864e5)
  const Del = ({ t, id }: { t: string; id: string }) => <button className="text-red-600" onClick={() => del(t, id)}>حذف</button>

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {err && <p className="card col-span-full text-red-600">{err}</p>}

      <section className="card space-y-2">
        <h2 className="font-bold">📚 المواد</h2>
        <form className="space-y-2" onSubmit={submit(async f => add('subjects', { name: f.get('name'), priority: Number(f.get('priority')), is_weak: f.get('weak') === 'on' }))}>
          <input name="name" className="input" placeholder="اسم المادة" required />
          <select name="priority" className="input" defaultValue="3"><option value="1">أولوية عالية</option><option value="3">متوسطة</option><option value="5">منخفضة</option></select>
          <label className="flex gap-2"><input type="checkbox" name="weak" /> مادة ضعيفة (تُعطى وقتاً أكثر في الخطة)</label>
          <button className="btn">إضافة مادة</button>
        </form>
        <ul>{subjects.map(s => <li key={s.id} className="flex justify-between border-t py-1 dark:border-slate-700"><span>{s.name} {s.is_weak && '⚠️'}</span><Del t="subjects" id={s.id} /></li>)}</ul>
      </section>

      <section className="card space-y-2">
        <h2 className="font-bold">📖 الدروس</h2>
        <form className="space-y-2" onSubmit={submit(async f => add('lessons', { subject_id: f.get('subject_id'), title: f.get('title'), unit: f.get('unit') || null }))}>
          <SubjectSelect /><input name="title" className="input" placeholder="عنوان الدرس" required /><input name="unit" className="input" placeholder="الوحدة (اختياري)" />
          <button className="btn">إضافة درس</button>
        </form>
        <ul>{lessons.map(l => <li key={l.id} className="flex items-center justify-between gap-2 border-t py-1 dark:border-slate-700">
          <span>{subName(l.subject_id)}: {l.title} — {statusAr[l.status]}</span>
          <span className="flex gap-2"><button className="text-blue-600" onClick={() => setStatus('lessons', l.id, l.status === 'done' ? 'pending' : 'done')}>{l.status === 'done' ? 'إلغاء' : 'تم'}</button><Del t="lessons" id={l.id} /></span></li>)}</ul>
      </section>

      <section className="card space-y-2">
        <h2 className="font-bold">📝 الواجبات</h2>
        <form className="space-y-2" onSubmit={submit(async f => add('homework', { subject_id: f.get('subject_id') || null, title: f.get('title'), due_date: f.get('due_date') }))}>
          <SubjectSelect required={false} /><input name="title" className="input" placeholder="الواجب" required /><input name="due_date" type="date" className="input" required />
          <button className="btn">إضافة واجب</button>
        </form>
        <ul>{homework.map(h => <li key={h.id} className="flex items-center justify-between gap-2 border-t py-1 dark:border-slate-700">
          <span>{h.title} ({subName(h.subject_id)}) — {h.due_date} {h.status !== 'done' && h.due_date < new Date().toISOString().slice(0, 10) && <b className="text-red-600">متأخر</b>} — {statusAr[h.status]}</span>
          <span className="flex gap-2">{h.photo_path && <button className="text-purple-600" onClick={() => viewPhoto(h.photo_path)}>📷 عرض الصورة</button>}<button className="text-blue-600" onClick={() => setStatus('homework', h.id, h.status === 'done' ? 'pending' : 'done')}>{h.status === 'done' ? 'إلغاء' : 'تم'}</button><Del t="homework" id={h.id} /></span></li>)}</ul>
      </section>

      <section className="card space-y-2">
        <h2 className="font-bold">📅 الامتحانات</h2>
        <form className="space-y-2" onSubmit={submit(async f => add('exams', { subject_id: f.get('subject_id') || null, title: f.get('title'), exam_date: new Date(String(f.get('exam_date'))).toISOString(), max_score: f.get('max_score') ? Number(f.get('max_score')) : null }))}>
          <SubjectSelect required={false} /><input name="title" className="input" placeholder="اسم الامتحان" required />
          <input name="exam_date" type="datetime-local" className="input" required /><input name="max_score" type="number" step="any" className="input" placeholder="الدرجة الكبرى (اختياري)" />
          <button className="btn">إضافة امتحان</button>
        </form>
        <ul>{exams.map(x => <li key={x.id} className="flex justify-between border-t py-1 dark:border-slate-700">
          <span>{x.title} ({subName(x.subject_id)}) — {new Date(x.exam_date).toLocaleString('ar-EG')} — {daysLeft(x.exam_date) >= 0 ? `بعد ${daysLeft(x.exam_date)} يوم` : 'انتهى'}</span><Del t="exams" id={x.id} /></li>)}</ul>
      </section>

      <section className="card col-span-full space-y-2">
        <h2 className="font-bold">🏅 الدرجات</h2>
        <form className="grid gap-2 md:grid-cols-5" onSubmit={submit(async f => add('grades', { subject_id: f.get('subject_id'), score: Number(f.get('score')), max_score: Number(f.get('max_score')), note: f.get('note') || null }))}>
          <SubjectSelect /><input name="score" type="number" step="any" min="0" className="input" placeholder="الدرجة" required />
          <input name="max_score" type="number" step="any" min="1" className="input" placeholder="من" required /><input name="note" className="input" placeholder="ملاحظة" />
          <button className="btn">إضافة</button>
        </form>
        <ul>{grades.map(g => <li key={g.id} className="flex justify-between border-t py-1 dark:border-slate-700">
          <span>{subName(g.subject_id)}: {g.score}/{g.max_score} ({Math.round(g.score / g.max_score * 100)}%) — {g.recorded_on} {g.note}</span><Del t="grades" id={g.id} /></li>)}</ul>
      </section>
    </div>
  )
}
