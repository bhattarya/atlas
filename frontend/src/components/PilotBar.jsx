import { Zap } from 'lucide-react'

export default function PilotBar({ mapData, seats = 5, onLaunch }) {
  const pulse = seats <= 2

  if (!mapData) return null

  const urgent = seats <= 2

  return (
    <div
      className={`flex items-center justify-between px-6 py-3 border-t border-[#1f2937] transition-colors ${
        urgent ? 'bg-[#1c0a0a]' : 'bg-[#111827]'
      }`}
    >
      <div className="flex items-center gap-3">
        <span className={`text-sm ${urgent ? 'text-[#ef4444]' : 'text-[#6b7280]'}`}>
          CMSC 441 — {seats} seat{seats !== 1 ? 's' : ''} remaining
        </span>
      </div>
      <button
        onClick={onLaunch}
        className={`flex items-center gap-2 px-5 py-2 rounded-lg font-semibold text-sm transition-all ${
          urgent
            ? `bg-[#ef4444] hover:bg-[#dc2626] text-white ${pulse ? 'animate-pulse' : ''}`
            : 'bg-[#3b82f6] hover:bg-[#2563eb] text-white'
        }`}
      >
        <Zap size={16} />
        Launch Pilot
      </button>
    </div>
  )
}
