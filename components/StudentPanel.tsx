'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase/client'
type Row = Record<string, any>
type Me = { name: string; level: number; points_balance: number; avatar_path: string | null }
const POMO = { study: 1500, brk: 300 }
const fmt = (s: number) => [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map(n => String(n).padStart(2, '0')).join(':')

async function shrink(file: File, max = 1600): Promise<Blob> {
  const bmp = await createImageBitmap(file); const k = Math.min(1, max / Math.max(bmp.width, bmp.height))
  const c = document.createElement('canvas'); c.width = Math.round(bmp.width * k); c.height = Math.round(bmp.height * k)
  c.getContext('2d')!.drawImage(bmp, 0, 0, c.width, c.height)
  return new Promise(r => c.toBlob(b => r(b!), 'image/jpeg', 0.8))
}

export default function StudentPanel({ studentId, familyId, me }: { studentId: string; familyId: string; me: Me }) {
  const sb = supabaseBrowser(); const router = useRouter()
  const [subjects, setSubjects] = useState<Row[]>([]); const [lessons, setLessons] = useState<Row[]>([]); const [hw, setHw] = useState<Row[]>([])
  const [week, setWeek] = useState<Row[]>([]); const [catalog, setCatalog] = useState<Row[]>([]); const [earned, setEarned] = useState<Set<string>>(new Set())
  const [active, setActive] = useState<Row | null>(null); const [subject, setSubject] = useState(''); const [now, setNow] = useState(Date.now())
  const [mode, setMode] = useState<'free' | 'pomodoro'>('free'); const [brk, setBrk] = useState<number | null>(null)
  const [err, setErr] = useState(''); const [msg, setMsg] = useState(''); const [avatar, setAvatar] = useState('')
  const finishing = useRef(false)

  const load = useCallback(async () => {
    const since = new Date(Date.now() - 7 * 864e5).toISOString()
    const [s, l, h, a, w, c, e] = await Promise.all([
      sb.from('subjects').select('id,name').order('name'),
      sb.from('lessons').select('id,title,subject_id,status'),
      sb.from('homework').select('id,title,due_date,subject_id,status,photo_path,review_status,review_note,kind').or('status.neq.done,photo_path.not.is.null').order('due_date'),
      sb.from('study_sessions').select('id,subject_id,started_at').is('ended_at', null).limit(1),
      sb.from('study_sessions').select('duration_sec').gte('started_at', since).not('ended_at', 'is', null),
      sb.from('badges').select('id,title,description').is('family_id', null).order('title'),
      sb.from('student_badges').select('badge_id'),
    ])
    setSubjects(s.data ?? []); setLessons(l.data ?? []); setHw(h.data ?? []); setActive(a.data?.[0] ?? null)
    setWeek(w.data ?? []); setCatalog(c.data ?? []); setEarned(new Set((e.data ?? []).map(x => x.badge_id)))
  }, [])
  useEffect(() => { load(); setMode(localStorage.getItem('edu-mode') === 'pomodoro' ? 'pomodoro' : 'free') }, [load])
  useEffect(() => {
    if (!me.avatar_path) return
    sb.storage.from('homework-photos').createSignedUrl(me.avatar_path, 3600).then(({ data }) => setAvatar(data?.signedUrl ?? ''))
  }, [me.avatar_path])

  const elapsed = active ? Math.max(0, Math.round((now - new Date(active.started_at).getTime()) / 1000)) : 0
  useEffect(() => {
    if (!active && !brk) return
    const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i)
  }, [active, brk])
  useEffect(() => {
    if (brk && now >= brk) { setBrk(null); setMsg('☕ انتهت الاستراحة — ابدأ جلسة جديدة') }
    if (mode === 'pomodoro' && active && elapsed >= POMO.study) stop()
  })

  const name = (id: string) => subjects.find(s => s.id === id)?.name ?? ''
  const fail = (e: { message: string } | null) => { setErr(e ? 'تعذر الحفظ: ' + e.message : ''); return !e }
  const chooseMode = (m: 'free' | 'pomodoro') => { setMode(m); localStorage.setItem('edu-mode', m) }

  async function start() {
    if (!subject) return setErr('اختر المادة أولاً')
    setMsg(''); setBrk(null)
    const { data, error } = await sb.from('study_sessions').insert({ family_id: familyId, student_id: studentId, subject_id: subject }).select('id,subject_id,started_at').single()
    if (fail(error)) { setActive(data); setNow(Date.now()) }
  }
  async function stop() {
    if (!active || finishing.current) return
    finishing.current = true
    const { data, error } = await sb.rpc('finish_study_session', { p_session: active.id })
    finishing.current = false
    if (error) return setErr('تعذر حفظ الجلسة: ' + error.message)
    const r = data as { seconds: number; points: number; badges: string[] }
    setActive(null)
    setMsg(`✅ حُفظت الجلسة (${Math.round(r.seconds / 60)} دقيقة) — +${r.points} نقطة${r.badges.length ? ' — 🏆 إنجاز جديد: ' + r.badges.join('، ') : ''}`)
    if (mode === 'pomodoro') setBrk(Date.now() + POMO.brk * 1000)
    load(); router.refresh()
  }
  async function afterDone() {
    const { data } = await sb.rpc('refresh_achievements', { p_student: studentId })
    const b = (data as string[] | null) ?? []
    if (b.length) setMsg('🏆 إنجاز جديد: ' + b.join('، '))
    load(); router.refresh()
  }
  async function finish(table: 'homework' | 'lessons', id: string) {
    if (fail((await sb.from(table).update({ status: 'done', completed_at: new Date().toISOString() }).eq('id', id)).error)) afterDone()
  }
  async function addRow(table: 'subjects' | 'lessons' | 'homework', row: Row) {
    if (fail((await sb.from(table).insert({ family_id: familyId, student_id: studentId, ...row })).error)) load()
  }
  const onAdd = (table: 'subjects' | 'lessons' | 'homework', pick: (f: FormData) => Row) => (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault(); const form = e.currentTarget; addRow(table, pick(new FormData(form))).then(() => form.reset())
  }
  async function upload(file: File, path: string, max?: number) {
    const up = await sb.storage.from('homework-photos').upload(path, await shrink(file, max), { contentType: 'image/jpeg' })
    if (up.error) { setErr('تعذر رفع الصورة: ' + up.error.message); return false }
    return true
  }
  async function uploadPhoto(id: string, file: File) {
    setErr('جارٍ رفع الصورة...')
    try {
      const path = `${familyId}/${studentId}/${id}-${Date.now()}.jpg`
      if (!(await upload(file, path))) return
      if (fail((await sb.from('homework').update({ status: 'done', completed_at: new Date().toISOString(), photo_path: path }).eq('id', id)).error)) afterDone()
    } catch { setErr('تعذر معالجة الصورة') }
  }
  async function setAvatarFile(file: File) {
    try {
      const path = `${familyId}/${studentId}/avatar-${Date.now()}.jpg`
      if ((await upload(file, path, 400)) && fail((await sb.from('students').update({ avatar_path: path }).eq('id', studentId)).error)) router.refresh()
    } catch { setErr('تعذر معالجة الصورة') }
  }

  const today = new Date().toISOString().slice(0, 10)
  const openHw = hw.filter(h => h.status !== 'done'), sent = hw.filter(h => h.photo_path)
  const RV: Record<string, string> = { pending: '⏳ بانتظار المراجعة', approved: '✅ تمت الموافقة', rejected: '↩ مطلوب إعادة' }
  async function submitProject(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); const form = e.currentTarget; const f = new FormData(form); const file = f.get('photo') as File
    setErr('جارٍ رفع المشروع...')
    try {
      const id = crypto.randomUUID(), path = `${familyId}/${studentId}/${id}-${Date.now()}.jpg`
      if (!(await upload(file, path))) return
      const { error } = await sb.from('homework').insert({ id, family_id: familyId, student_id: studentId, title: f.get('title'), due_date: today, kind: 'project', status: 'done', completed_at: new Date().toISOString(), photo_path: path })
      if (fail(error)) { form.reset(); afterDone() }
    } catch { setErr('تعذر معالجة الصورة') }
  }
  const weekSec = week.reduce((a, r) => a + (r.duration_sec ?? 0), 0)
  const remaining = Math.max(0, POMO.study - elapsed)
  const Stat = ({ icon, label, value }: { icon: string; label: string; value: React.ReactNode }) =>
    <div className="card !p-3 text-center"><div className="text-xl">{icon}</div><div className="text-lg font-bold">{value}</div><div className="text-xs opacity-70">{label}</div></div>

  return (
    <div className="space-y-4">
      {err && <p className="card text-red-600">{err}</p>}
      {msg && <p className="card text-green-600">{msg}</p>}

      <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
        <label className="card !p-3 flex cursor-pointer flex-col items-center justify-center" title="تغيير الصورة">
          {avatar ? <img src={avatar} alt="" className="h-14 w-14 rounded-full object-cover" /> : <span className="text-4xl">🧑‍🎓</span>}
          <span className="mt-1 text-xs opacity-70">{me.name}</span>
          <input type="file" accept="image/*" hidden onChange={e => { const f = e.target.files?.[0]; if (f) setAvatarFile(f); e.target.value = '' }} />
        </label>
        <Stat icon="⭐" label="المستوى" value={me.level} />
        <Stat icon="💰" label="النقاط" value={me.points_balance} />
        <Stat icon="📚" label="المواد" value={subjects.length} />
        <Stat icon="📝" label="واجبات مفتوحة" value={hw.filter(h => h.status !== 'done').length} />
        <Stat icon="⏱️" label="مذاكرة الأسبوع" value={`${Math.floor(weekSec / 3600)}س ${Math.round(weekSec / 60) % 60}د`} />
      </div>

      <div className="card space-y-2">
        <div className="flex items-center justify-between"><h2 className="font-bold">⏱️ مؤقت المذاكرة</h2>
          {!active && <div className="flex gap-1 text-sm">
            <button className={`rounded-lg border px-2 py-1 ${mode === 'free' ? 'bg-blue-600 text-white' : ''}`} onClick={() => chooseMode('free')}>حر</button>
            <button className={`rounded-lg border px-2 py-1 ${mode === 'pomodoro' ? 'bg-blue-600 text-white' : ''}`} onClick={() => chooseMode('pomodoro')}>🍅 25/5</button></div>}
        </div>
        {active ? (<>
          <p className="text-3xl font-mono" dir="ltr">{mode === 'pomodoro' ? fmt(remaining) : fmt(elapsed)}</p>
          <p>تذاكر الآن: {name(active.subject_id)} {mode === 'pomodoro' && '(ينتهي تلقائياً بعد 25 دقيقة)'}</p>
          <button className="btn" onClick={stop}>إنهاء الجلسة وحفظها</button></>
        ) : brk ? (<>
          <p className="text-3xl font-mono" dir="ltr">☕ {fmt(Math.max(0, Math.round((brk - now) / 1000)))}</p>
          <button className="btn" onClick={() => setBrk(null)}>تخطي الاستراحة</button></>
        ) : (
          <div className="flex gap-2">
            <select className="input" value={subject} onChange={e => setSubject(e.target.value)}>
              <option value="">— اختر المادة —</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
            <button className="btn" onClick={start}>ابدأ</button></div>)}
        <p className="text-xs opacity-70">نقطة لكل 5 دقائق كاملة (حتى 24 نقطة للجلسة). تُحسب المدة على الخادم.</p>
        {subjects.length === 0 && <p className="text-sm opacity-75">أضف مادة أولاً من قسم "أضف بنفسك".</p>}
      </div>

      <div className="card space-y-3"><h2 className="font-bold">📊 تقدمي في المواد</h2>
        {subjects.length === 0 ? <p>لا توجد مواد بعد</p> : subjects.map(s => {
          const ls = lessons.filter(l => l.subject_id === s.id), d = ls.filter(l => l.status === 'done').length, pct = ls.length ? Math.round(d / ls.length * 100) : 0
          return (<div key={s.id}>
            <div className="flex justify-between text-sm"><span>{s.name}</span><span>{d}/{ls.length} درس — {pct}%</span></div>
            <div className="h-2 rounded bg-slate-200 dark:bg-slate-700"><div className="h-2 rounded bg-green-500" style={{ width: `${pct}%` }} /></div></div>)
        })}
      </div>

      <div className="card"><h2 className="font-bold">🏆 إنجازاتي ({catalog.filter(b => earned.has(b.id)).length}/{catalog.length})</h2>
        <div className="mt-2 flex flex-wrap gap-2">{catalog.map(b => (
          <span key={b.id} title={b.description} className={`rounded-full border px-3 py-1 text-sm ${earned.has(b.id) ? 'bg-amber-100 text-amber-900' : 'opacity-40'}`}>{earned.has(b.id) ? '🏆' : '🔒'} {b.title}</span>))}</div>
      </div>

      <div className="card space-y-3"><h2 className="font-bold">➕ أضف بنفسك</h2>
        <form className="flex gap-2" onSubmit={onAdd('subjects', f => ({ name: f.get('name') }))}>
          <input name="name" className="input" placeholder="مادة جديدة" required /><button className="btn">إضافة</button></form>
        <form className="flex flex-wrap gap-2" onSubmit={onAdd('lessons', f => ({ subject_id: f.get('subject_id'), title: f.get('title') }))}>
          <select name="subject_id" className="input flex-1" required><option value="">— المادة —</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <input name="title" className="input flex-1" placeholder="درس جديد" required /><button className="btn">إضافة درس</button></form>
        <form className="flex flex-wrap gap-2" onSubmit={onAdd('homework', f => ({ subject_id: f.get('subject_id') || null, title: f.get('title'), due_date: f.get('due_date') }))}>
          <select name="subject_id" className="input flex-1"><option value="">— المادة —</option>{subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
          <input name="title" className="input flex-1" placeholder="واجب جديد" required /><input name="due_date" type="date" className="input flex-1" required /><button className="btn">إضافة واجب</button></form>
        <form className="flex flex-wrap gap-2" onSubmit={submitProject}>
          <input name="title" className="input flex-1" placeholder="عنوان المشروع" required /><input name="photo" type="file" accept="image/*" className="input flex-1" required /><button className="btn">🎨 رفع مشروع</button></form>
      </div>

      <div className="card"><h2 className="font-bold">📝 واجباتي</h2>
        {openHw.length === 0 ? <p>لا توجد واجبات مفتوحة 🎉</p> : <ul>{openHw.map(h => (
          <li key={h.id} className="flex items-center justify-between gap-2 border-t py-1 dark:border-slate-700">
            <span>{h.title} {h.subject_id && `(${name(h.subject_id)})`} — {h.due_date < today ? <b className="text-red-600">متأخر</b> : h.due_date}{h.review_status === 'rejected' && <b className="text-orange-600"> ↩ {h.review_note || 'أعد التسليم'}</b>}</span>
            <span className="flex items-center gap-3">
              <label className="cursor-pointer text-blue-600">📷 صورة + تم<input type="file" accept="image/*" capture="environment" hidden onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(h.id, f); e.target.value = '' }} /></label>
              <button className="text-green-600" onClick={() => finish('homework', h.id)}>✔ تم (بدون صورة)</button></span></li>))}</ul>}
      </div>
      <div className="card"><h2 className="font-bold">📷 تسليماتي</h2>
        {sent.length === 0 ? <p className="opacity-70">لم ترفع صوراً بعد</p> : <ul>{sent.map(h => (
          <li key={h.id} className="flex justify-between gap-2 border-t py-1 dark:border-slate-700"><span>{h.kind === 'project' ? '🎨' : '📝'} {h.title}</span><span>{RV[h.review_status] ?? ''}{h.review_status === 'rejected' && h.review_note ? ` — ${h.review_note}` : ''}</span></li>))}</ul>}
      </div>
      <div className="card"><h2 className="font-bold">📖 دروسي المتبقية</h2>
        {lessons.filter(l => l.status !== 'done').length === 0 ? <p>لا توجد دروس متبقية</p> : <ul>{lessons.filter(l => l.status !== 'done').map(l => (
          <li key={l.id} className="flex items-center justify-between gap-2 border-t py-1 dark:border-slate-700">
            <span>{name(l.subject_id)}: {l.title}</span><button className="text-green-600" onClick={() => finish('lessons', l.id)}>✔ أنهيته</button></li>))}</ul>}
      </div>
    </div>
  )
}
