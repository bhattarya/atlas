import { useEffect, useState } from 'react'
import { Clock, Zap, AlertCircle } from 'lucide-react'

/**
 * For demo purposes the registration window is set to ~3 days, 14 hrs from "now"
 * so the countdown ticks visibly during the pitch. In production this would come
 * from the UMBC academic calendar API.
 */
const REGISTRATION_OPEN = (() => {
  const t = new Date()
  t.setDate(t.getDate() + 3)
  t.setHours(t.getHours() + 14)
  t.setMinutes(t.getMinutes() + 27)
  return t
})()

function diffParts(target) {
  const ms = Math.max(0, target.getTime() - Date.now())
  const total = Math.floor(ms / 1000)
  return {
    ms,
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  }
}

export default function CountdownBanner({ mapData, onLaunchPilot }) {
  const [parts, setParts] = useState(() => diffParts(REGISTRATION_OPEN))

  useEffect(() => {
    const id = setInterval(() => setParts(diffParts(REGISTRATION_OPEN)), 1000)
    return () => clearInterval(id)
  }, [])

  if (!mapData) return null

  const open = parts.ms === 0
  const urgent = !open && parts.days === 0 && parts.hours < 6

  return (
    <div className={`flex items-center justify-between px-5 py-1.5 border-b shrink-0 transition-colors ${
      open
        ? 'bg-gradient-to-r from-green-50 via-white to-green-50 border-green-200'
        : urgent
        ? 'bg-gradient-to-r from-red-50 via-white to-red-50 border-red-200'
        : 'bg-gradient-to-r from-[#fffbe6] via-white to-[#fffbe6] border-[#FFD84D]'
    }`}>
      <div className="flex items-center gap-2 text-[11px]">
        {open ? (
          <Zap size={11} className="text-green-700" strokeWidth={2.4} />
        ) : urgent ? (
          <AlertCircle size={11} className="text-red-700 animate-pulse" strokeWidth={2.4} />
        ) : (
          <Clock size={11} className="text-[#a87a00]" strokeWidth={2.4} />
        )}
        <span className={`font-semibold ${open ? 'text-green-800' : urgent ? 'text-red-800' : 'text-[#7a5a00]'}`}>
          Spring 2026 registration
        </span>
        <span className="text-[#999]">·</span>
        <span className={open ? 'text-green-700' : urgent ? 'text-red-700' : 'text-[#7a5a00]'}>
          {open ? 'WINDOW OPEN — Pilot is racing now' : 'opens in'}
        </span>
        {!open && (
          <span className={`flex items-center gap-1 font-mono font-bold tabular-nums ${urgent ? 'text-red-900' : 'text-[#1a1a1a]'}`}>
            <TimeBlock value={parts.days} unit="d" />
            <TimeBlock value={parts.hours} unit="h" pad />
            <TimeBlock value={parts.minutes} unit="m" pad />
            <TimeBlock value={parts.seconds} unit="s" pad highlight={urgent} />
          </span>
        )}
      </div>

      <div className="flex items-center gap-3 text-[10px] text-[#888]">
        <span className="hidden md:inline">
          Pilot armed · fires <span className="font-semibold text-[#1a1a1a]">automatically</span> when window opens
        </span>
        {open && onLaunchPilot && (
          <button
            onClick={onLaunchPilot}
            className="px-2.5 py-1 rounded bg-green-700 hover:bg-green-800 text-white font-bold text-[10px] transition-colors"
          >
            Launch Pilot now
          </button>
        )}
      </div>
    </div>
  )
}

function TimeBlock({ value, unit, pad, highlight }) {
  const display = pad ? String(value).padStart(2, '0') : String(value)
  return (
    <span className={`px-1 py-0.5 rounded border ${
      highlight ? 'bg-red-100 border-red-200' : 'bg-white/70 border-[#e8e7e0]'
    }`}>
      {display}
      <span className="text-[8px] font-normal text-[#999] ml-0.5">{unit}</span>
    </span>
  )
}
