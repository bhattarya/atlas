import { useState, useRef, useEffect } from 'react'
import { Zap, ChevronDown, CalendarCheck, Mail, Bell } from 'lucide-react'

const ACTIONS = [
  { id: 'register', icon: <Zap size={12} />, label: 'Register CMSC 441', desc: 'Pilot secures your seat automatically' },
  { id: 'email',    icon: <Mail size={12} />, label: 'Email My Advisor',  desc: 'Draft your semester plan for review' },
  { id: 'waitlist', icon: <Bell size={12} />, label: 'Check Seat Alerts', desc: 'Monitor seats across bottleneck courses' },
  { id: 'plan',     icon: <CalendarCheck size={12} />, label: 'Submit 4-Year Plan', desc: 'Send planner schedule to DegreeWorks' },
]

export default function PilotBar({ mapData, seats = 5, onAction }) {
  const [open, setOpen] = useState(false)
  const ref = useRef()
  const urgent = seats <= 2

  useEffect(() => {
    const handler = (e) => { if (!ref.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!mapData) return null

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
        {urgent && (
          <span className="ml-1 text-[9px] font-bold bg-red-900/50 text-red-300 px-1.5 py-0.5 rounded uppercase tracking-wider">Critical</span>
        )}
      </div>

      <div className="relative" ref={ref}>
        <div className={`flex rounded overflow-hidden ${urgent ? 'ring-1 ring-red-500/40' : ''}`}>
          <button
            onClick={() => onAction('register')}
            className={`flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold transition-all ${
              urgent ? 'bg-red-600 hover:bg-red-500 text-white' : 'bg-[#FFC300] hover:bg-[#FFD84D] text-black'
            }`}
          >
            <Zap size={13} />
            Launch Pilot
          </button>
          <button
            onClick={() => setOpen(o => !o)}
            className={`px-2 py-1.5 border-l text-xs font-bold transition-all ${
              urgent ? 'bg-red-600 hover:bg-red-500 text-white border-red-500' : 'bg-[#FFC300] hover:bg-[#FFD84D] text-black border-[#e6b000]'
            }`}
          >
            <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {open && (
          <div className="absolute bottom-full right-0 mb-2 w-64 bg-[#111] border border-[#222] rounded-xl shadow-2xl overflow-hidden z-50">
            <p className="px-3 py-2 text-[9px] font-bold text-[#444] uppercase tracking-widest border-b border-[#1a1a1a]">
              Pilot Actions
            </p>
            {ACTIONS.map(action => (
              <button
                key={action.id}
                onClick={() => { onAction(action.id); setOpen(false) }}
                className="w-full flex items-start gap-3 px-3 py-2.5 hover:bg-[#1a1a1a] transition-colors text-left"
              >
                <span className="mt-0.5 text-[#FFC300] shrink-0">{action.icon}</span>
                <div>
                  <p className="text-xs font-semibold text-white">{action.label}</p>
                  <p className="text-[9px] text-[#555] mt-0.5">{action.desc}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
