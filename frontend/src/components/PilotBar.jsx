import { ArrowUpRight, Clock } from 'lucide-react'

export default function PilotBar({ mapData, seats = 5, plan, onLaunch, registrationOpen = false }) {
  if (!mapData) return null

  const urgent = seats <= 2
  const planCount = plan?.length ?? 4

  return (
    <div className={`flex items-center justify-between px-5 py-2.5 border-t shrink-0 transition-colors ${
      urgent ? 'bg-black border-[#333]' : 'bg-black border-[#222]'
    }`}>
      <div className="flex items-center gap-3 text-xs">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${urgent ? 'bg-red-500 animate-pulse' : 'bg-[#FFC300]'}`} />
        <span className={urgent ? 'text-red-400' : 'text-[#888]'}>
          Spring 2026 plan ·{' '}
          <span className={`font-semibold ${urgent ? 'text-red-300' : 'text-white'}`}>
            {planCount} courses staged
          </span>
        </span>
        <span className="text-[#444]">·</span>
        <span className={urgent ? 'text-red-400' : 'text-[#888]'}>
          CMSC 441 ·{' '}
          <span className={`font-semibold ${urgent ? 'text-red-300' : 'text-white'}`}>
            {seats} seat{seats !== 1 ? 's' : ''} left
          </span>
        </span>
        {!registrationOpen && (
          <>
            <span className="text-[#444]">·</span>
            <span className="text-[#888] flex items-center gap-1">
              <Clock size={11} className="text-[#FFC300]" />
              <span className="text-white font-semibold">Pilot armed</span>
              <span className="text-[#666]">— fires at registration window</span>
            </span>
          </>
        )}
      </div>
      <button
        onClick={onLaunch}
        className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-bold transition-all ${
          urgent
            ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
            : 'bg-[#FFC300] hover:bg-[#FFD84D] text-black'
        }`}
      >
        <ArrowUpRight size={13} strokeWidth={2.6} />
        Export to PeopleSoft
      </button>
    </div>
  )
}
