'use client'
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
export default function StudyChart({ data }: { data: { day: string; minutes: number }[] }) {
  return (
    <div className="h-56" dir="ltr">
      <ResponsiveContainer><BarChart data={data}><XAxis dataKey="day" /><YAxis /><Tooltip formatter={(v) => [`${v} دقيقة`, 'المذاكرة']} />
        <Bar dataKey="minutes" fill="#2563eb" radius={[6, 6, 0, 0]} /></BarChart></ResponsiveContainer>
    </div>
  )
}
