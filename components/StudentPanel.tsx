'use client'
import { useCallback, useEffect, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase/client'
type Row = Record<string, any>
const fmt = (s: number) => [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, '0')).join(':')

export default function StudentPanel({ studentId, familyId }: { studentId: string; familyId: string }) {
  const sb = supabaseBrowser()
  const [subjects, setSubjects] = useState<Row[]>([]); const [lessons, setLessons] = useState<Row[]>([]); const [hw, setHw] = useState<Row[]>([])
  const [active, setActive] = useState<Row | null>(null); const [subject, setSubject] = useState(''); const [now, setNow] = useState(Date.now())
  const [err, setErr] = useState(''); const [todaySec, setTodaySec] = useState(0)

  const load = useCallback(async () => {
    const start = new Date(); start.setHours(0, 0, 0, 0)
    const [s, l, h, a, t] = await Promise.all([
      sb.from('subjects').select('id,name').order('name'),
      sb.from('lessons').select('id,title,subject_id,status').neq('status', 'done').order('title'),
      sb.from('homework').select('id,title,due_date,subject_id').neq('status', 'done').order('due_date'),
      sb.from('study_sessions').select('id,subject_id,started_at').is('ended_at', null).limit(1),
      sb.from('study_sessions').select('duration_sec').gte('started_at', start.toISOString()).not('ended_at', 'is', null),
    ])
    setSubjects(s.data ?? []); setLessons(l.data ?? []); setHw(h.data ?? []); setActive(a.data?.[0] ?? null)
    setTodaySec((t.data ?? []).reduce((x, r) => x + (r.duration_sec ?? 0), 0))
  }, [])
  useEffect(() => { load() }, [load])
  useEffect(() => { if (!active) return; const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i) }, [active])

  const name = (id: string) => subjects.find(s => s.id === id)?.name ?? ''
  const fail = (e: { message: string } | null) => { setErr(e ? 'تعذر الحفظ: ' + e.message : ''); return !e }
  async function start() {
    if (!subject) return setErr('اختر المادة أولاً')
    if (fail((await sb.from('study_sessions').insert({ family_id: familyId, student_id: studentId, subject_id: subject })).error)) load()
  }
  async function stop() {
    if (!active) return
    const sec = Math.max(1, Math.round((Date.now() - new Date(active.started_at).getTime()) / 1000))
    if (fail((await sb.from('study_sessions').update({ ended_at: new Date().toISOString(), duration_sec: sec }).eq('id', active.id)).error)) load()
  }
  async function finish(table: 'homework' | 'lessons', id: string) {
    if (fail((await sb.from(table).update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', id)).error)) load()
  }
  const today = new Date().toISOString().slice(0, 10)
  const elapsed = active ? Math.round((now - new Date(active.started_at).getTime()) / 1000) : 0

  return (
    <div className="space-y-4">
      {err && <p className="card text-red-600">{err}</p>}
      <div className="card space-y-2">
        <h2 className="font-bold">⏱️ مؤقت المذاكرة</h2>
        {active ? (
          <>
            <p className="text-3xl font-mono" dir="ltr">{fmt(elapsed)}</p>
            <p>تذاكر الآن: {name(active.subject_id)}</p>
            <button className="btn" onClick={stop}>إنهاء الجلسة</button>
          </>
        ) : (
          <div className="flex gap-2">
            <select className="input" value={subject} onChange={e => setSubject(e.target.value)}>
              <option value="">— اختر المادة —</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
            <button className="btn" onClick={start}>ابدأ</button>
          </div>)}
        <p className="text-sm opacity-75">مذاكرة اليوم (جلسات منتهية): {Math.round(todaySec / 60)} دقيقة</p>
        {subjects.length === 0 && <p className="text-sm opacity-75">لم يضف ولي الأمر مواداً بعد.</p>}
      </div>
      <div className="card"><h2 className="font-bold">📝 واجباتي</h2>
        {hw.length === 0 ? <p>لا توجد واجبات مفتوحة 🎉</p> : <ul>{hw.map(h => (
          <li key={h.id} className="flex items-center justify-between gap-2 border-t py-1 dark:border-slate-700">
            <span>{h.title} {h.subject_id && `(${name(h.subject_id)})`} — {h.due_date < today ? <b className="text-red-600">متأخر</b> : h.due_date}</span>
            <button className="text-green-600" onClick={() => finish('homework', h.id)}>✔ تم</button></li>))}</ul>}
      </div>
      <div className="card"><h2 className="font-bold">📖 دروسي المتبقية</h2>
        {lessons.length === 0 ? <p>لا توجد دروس متبقية</p> : <ul>{lessons.map(l => (
          <li key={l.id} className="flex items-center justify-between gap-2 border-t py-1 dark:border-slate-700">
            <span>{name(l.subject_id)}: {l.title}</span><button className="text-green-600" onClick={() => finish('lessons', l.id)}>✔ أنهيته</button></li>))}</ul>}
      </div>
    </div>
  )
}
