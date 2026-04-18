import { useState, useEffect } from 'react'
import { Zap } from 'lucide-react'

export default function PilotBar({ mapData, onLaunch }) {
  const [seats, setSeats] = useState(5)

  useEffect(() => {
    const id = setInterval(() => {
      setSeats(prev => Math.max(0, prev - Math.floor(Math.random() * 2)))
    }, 8000)
    return () => clearInterval(id)
  }, [])

  if (!mapData) return null

  const urgent = seats <= 2

  return (
    <div className={`flex items-center justify-between px-5 py-2.5 border-t shrink-0 transition-colors ${
      urgent ? 'bg-black border-[#333]' : 'bg-black border-[#222]'
    }`}>
      <div className="flex items-center gap-2 text-xs">
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${urgent ? 'bg-red-500 animate-pulse' : 'bg-[#FFC300]'}`} />
        <span className={urgent ? 'text-red-400' : 'text-[#888]'}>
          CMSC 441 ·{' '}
          <span className={`font-semibold ${urgent ? 'text-red-300' : 'text-white'}`}>
            {seats} seat{seats !== 1 ? 's' : ''} remaining
          </span>
        </span>
      </div>
      <button
        onClick={onLaunch}
        className={`flex items-center gap-1.5 px-4 py-1.5 rounded text-xs font-bold transition-all ${
          urgent
            ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
            : 'bg-[#FFC300] hover:bg-[#FFD84D] text-black'
        }`}
      >
        <Zap size={13} />
        Launch Pilot
      </button>
    </div>
  )
}
