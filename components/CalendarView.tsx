'use client'
import { useState } from 'react'
type Ev = { date: string; title: string; type: 'exam' | 'homework' | 'project' | 'done' }
const META = {
  exam: { label: 'امتحان', dot: 'bg-red-500', chip: 'bg-red-100 text-red-900' },
  homework: { label: 'واجب', dot: 'bg-blue-500', chip: 'bg-blue-100 text-blue-900' },
  project: { label: 'مشروع', dot: 'bg-purple-500', chip: 'bg-purple-100 text-purple-900' },
  done: { label: 'منجز', dot: 'bg-green-500', chip: 'bg-green-100 text-green-900' },
}
const WD = ['السبت', 'الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']
const MONTHS = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
const pad = (n: number) => String(n).padStart(2, '0')

export default function CalendarView({ events }: { events: Ev[] }) {
  const t = new Date(), todayKey = `${t.getFullYear()}-${pad(t.getMonth() + 1)}-${pad(t.getDate())}`
  const [cur, setCur] = useState({ y: t.getFullYear(), m: t.getMonth() }); const [sel, setSel] = useState<string>(todayKey)
  const first = (new Date(cur.y, cur.m, 1).getDay() + 1) % 7            // week starts on Saturday
  const days = new Date(cur.y, cur.m + 1, 0).getDate()
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => i + 1)]
  const keyOf = (d: number) => `${cur.y}-${pad(cur.m + 1)}-${pad(d)}`
  const by = (k: string) => events.filter(e => e.date === k)
  const move = (n: number) => setCur(c => { const d = new Date(c.y, c.m + n, 1); return { y: d.getFullYear(), m: d.getMonth() } })
  const limit = new Date(Date.now() + 14 * 864e5).toLocaleDateString('en-CA')
  const upcoming = events.filter(e => e.type !== 'done' && e.date >= todayKey && e.date <= limit).sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="space-y-4">
      <div className="card space-y-3">
        <div className="flex items-center justify-between">
          <button className="btn" onClick={() => move(-1)}>→</button>
          <b>{MONTHS[cur.m]} {cur.y}</b>
          <button className="btn" onClick={() => move(1)}>←</button>
        </div>
        <div className="grid grid-cols-7 gap-1 text-center text-xs opacity-70">{WD.map(w => <div key={w}>{w}</div>)}</div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => d === null ? <div key={i} /> : (
            <button key={i} onClick={() => setSel(keyOf(d))}
              className={`flex h-14 flex-col items-center rounded-lg border p-1 text-sm dark:border-slate-700 ${keyOf(d) === sel ? 'ring-2 ring-blue-500' : ''} ${keyOf(d) === todayKey ? 'bg-blue-50 dark:bg-slate-700' : ''}`}>
              <span>{d}</span>
              <span className="mt-auto flex gap-0.5">{by(keyOf(d)).slice(0, 4).map((e, j) => <i key={j} className={`h-2 w-2 rounded-full ${META[e.type].dot}`} />)}</span>
            </button>))}
        </div>
        <div className="flex flex-wrap gap-3 text-xs">{Object.values(META).map(m => <span key={m.label} className="flex items-center gap-1"><i className={`h-2 w-2 rounded-full ${m.dot}`} />{m.label}</span>)}</div>
      </div>
      <div className="card"><h2 className="font-bold">📌 {sel}</h2>
        {by(sel).length === 0 ? <p className="opacity-70">لا أحداث في هذا اليوم</p> :
          <ul className="mt-1 space-y-1">{by(sel).map((e, i) => <li key={i}><span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${META[e.type].chip}`}>{META[e.type].label}</span>{e.title}</li>)}</ul>}</div>
      <div className="card"><h2 className="font-bold">⏭️ القادم خلال 14 يوماً</h2>
        {upcoming.length === 0 ? <p className="opacity-70">لا شيء قادم</p> :
          <ul className="mt-1 space-y-1">{upcoming.map((e, i) => <li key={i}><span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${META[e.type].chip}`}>{META[e.type].label}</span>{e.title} — {e.date}</li>)}</ul>}</div>
    </div>
  )
}
