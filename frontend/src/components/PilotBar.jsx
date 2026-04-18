import { Zap, Info } from 'lucide-react'

export default function PilotBar({ mapData, seats = 5, onLaunch }) {
  if (!mapData) return null

  const urgent = seats <= 2

  return (
    <div className={`flex items-center justify-between px-5 py-2 border-t shrink-0 transition-colors duration-500 ${
      urgent ? 'bg-[#0f0000] border-[#2a0000]' : 'bg-black border-[#181818]'
    }`}>
      <div className="flex items-center gap-3">
        {/* Seat indicator */}
        <div className="flex items-center gap-2">
          <span className={`inline-block w-2 h-2 rounded-full shrink-0 ${
            urgent ? 'bg-red-500 animate-pulse shadow-[0_0_6px_rgba(239,68,68,0.8)]' : 'bg-[#FFC300]'
          }`} />
          <span className="text-[11px] text-[#555]">
            CMSC 441 —{' '}
            <span className={`font-semibold ${urgent ? 'text-red-400' : 'text-[#aaa]'}`}>
              {seats} seat{seats !== 1 ? 's' : ''} left
            </span>
          </span>
        </div>

        {urgent && (
          <div className="flex items-center gap-1 px-2 py-0.5 rounded bg-red-900/40 border border-red-800/50">
            <Info size={9} className="text-red-400" />
            <span className="text-[9px] text-red-400 font-medium">Registration window closing</span>
          </div>
        )}
      </div>

      <button
        onClick={onLaunch}
        className={`flex items-center gap-2 px-4 py-1.5 rounded-lg text-[12px] font-bold transition-all ${
          urgent
            ? 'bg-red-600 hover:bg-red-500 text-white shadow-[0_0_16px_rgba(239,68,68,0.4)]'
            : 'bg-[#FFC300] hover:bg-[#FFD340] text-black shadow-[0_0_12px_rgba(255,195,0,0.2)]'
        }`}
      >
        <Zap size={12} strokeWidth={2.5} />
        Launch Pilot
      </button>
    </div>
  )
}
