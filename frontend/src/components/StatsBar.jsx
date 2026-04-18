import { useState, useEffect } from 'react'

export default function StatsBar({ mapData }) {
  const [seats, setSeats] = useState(5)

  useEffect(() => {
    const id = setInterval(() => {
      setSeats(prev => Math.max(0, prev - Math.floor(Math.random() * 2)))
    }, 8000)
    return () => clearInterval(id)
  }, [])

  if (!mapData) return <div />

  const { completed, bottlenecks, credits_remaining } = mapData

  return (
    <div className="flex items-center gap-4 py-1.5 text-xs text-[#555]">
      <Chip label="Credits left" value={credits_remaining ?? '—'} />
      <Chip label="Completed" value={completed ?? '—'} />
      {bottlenecks?.length > 0 && (
        <Chip label="Bottlenecks" value={bottlenecks.length} color="amber" />
      )}
      <div className={`flex items-center gap-1 font-medium ${seats <= 2 ? 'text-red-600' : 'text-[#111]'}`}>
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${seats <= 2 ? 'bg-red-500 animate-pulse' : 'bg-[#FFC300]'}`} />
        <span><b>{seats}</b> seats — CMSC 441</span>
      </div>
    </div>
  )
}

function Chip({ label, value, color }) {
  return (
    <span className="flex items-center gap-1">
      <span className="text-[#999]">{label}</span>
      <span className={`font-semibold ${color === 'amber' ? 'text-amber-600' : 'text-[#111]'}`}>{value}</span>
    </span>
  )
}
