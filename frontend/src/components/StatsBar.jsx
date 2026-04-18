import { useState, useEffect } from 'react'
import { BookOpen, AlertTriangle, CheckCircle, Clock } from 'lucide-react'

export default function StatsBar({ mapData }) {
  const [seats, setSeats] = useState(5)

  useEffect(() => {
    const interval = setInterval(() => {
      setSeats(prev => Math.max(0, prev - Math.floor(Math.random() * 2)))
    }, 8000)
    return () => clearInterval(interval)
  }, [])

  if (!mapData) return null

  const { total_courses, completed, bottlenecks, credits_remaining } = mapData

  return (
    <div className="flex items-center gap-6 px-6 py-2 bg-[#111827] border-b border-[#1f2937] text-sm">
      <Stat icon={<BookOpen size={14} />} label="Remaining" value={credits_remaining ?? '—'} unit="credits" />
      <Stat icon={<CheckCircle size={14} className="text-[#10b981]" />} label="Completed" value={completed ?? '—'} unit="courses" />
      <Stat
        icon={<AlertTriangle size={14} className="text-[#f59e0b]" />}
        label="Bottlenecks"
        value={bottlenecks?.length ?? 0}
        unit="flagged"
        warn={bottlenecks?.length > 0}
      />
      <div className="ml-auto flex items-center gap-2">
        <Clock size={14} className={seats <= 2 ? 'text-[#ef4444]' : 'text-[#f59e0b]'} />
        <span className={`font-mono font-bold ${seats <= 2 ? 'text-[#ef4444]' : 'text-[#f59e0b]'}`}>
          {seats}
        </span>
        <span className="text-[#6b7280]">seats in CMSC 441</span>
      </div>
    </div>
  )
}

function Stat({ icon, label, value, unit, warn }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={warn ? 'text-[#f59e0b]' : 'text-[#6b7280]'}>{icon}</span>
      <span className="text-[#6b7280]">{label}:</span>
      <span className={`font-semibold ${warn ? 'text-[#f59e0b]' : 'text-white'}`}>{value}</span>
      <span className="text-[#6b7280]">{unit}</span>
    </div>
  )
}
