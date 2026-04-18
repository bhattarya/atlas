import { useEffect, useRef, useState } from 'react'
import { X, CheckCircle, Loader2, Zap, Compass, Eye, Brain } from 'lucide-react'

/* Map sub-agent role → badge styling */
const ROLE_STYLE = {
  Navigator: { color: '#1e40af', bg: '#dbeafe', icon: Compass, label: 'NAVIGATOR' },
  Inspector: { color: '#7c3aed', bg: '#ede9fe', icon: Eye,     label: 'INSPECTOR' },
  Decision:  { color: '#a16207', bg: '#fef3c7', icon: Brain,   label: 'DECISION'  },
  Pilot:     { color: '#000',    bg: '#f5f5f0', icon: Zap,     label: 'PILOT'     },
}

function RoleBadge({ role }) {
  const style = ROLE_STYLE[role] ?? ROLE_STYLE.Pilot
  const Icon = style.icon
  return (
    <span
      className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-bold tracking-wider shrink-0"
      style={{ color: style.color, background: style.bg }}
    >
      <Icon size={9} strokeWidth={2.5} /> {style.label}
    </span>
  )
}

export default function PilotPanel({ steps, done, registered, onConfirm, onClose }) {
  const [confirmed, setConfirmed] = useState(false)
  const bottomRef = useRef()

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [steps])

  const handleConfirm = async () => {
    setConfirmed(true)
    await onConfirm()
  }

  return (
    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50">
      <div className="w-[560px] bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.20)] flex flex-col max-h-[85vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#222] bg-black rounded-t-2xl">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#FFC300] rounded-full animate-pulse" />
            <span className="text-white font-bold text-sm flex items-center gap-1.5">
              <Zap size={14} className="text-[#FFC300]" /> Pilot · Exporting to PeopleSoft
            </span>
            <span className="text-[10px] text-[#888] ml-1">Navigator · Inspector · Decision</span>
          </div>
          <button onClick={onClose} className="text-[#888] hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Sub-agent legend */}
        <div className="flex items-center gap-2 px-5 py-2 bg-[#fafaf6] border-b border-[#f0efe9]">
          <span className="text-[9px] text-[#999] font-semibold uppercase tracking-wider">Roles:</span>
          <RoleBadge role="Navigator" />
          <RoleBadge role="Inspector" />
          <RoleBadge role="Decision" />
        </div>

        {/* Steps */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2 min-h-[200px]">
          {steps.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-[#999]">
              <Loader2 size={14} className="animate-spin text-[#FFC300]" />
              Initializing browser session…
            </div>
          )}
          {steps.map((step, i) => {
            const isError = step.level === 'error' || step.error
            const isWarn = step.level === 'warn'
            const isWaiting = step.waiting
            return (
              <div key={i} className="flex items-start gap-2 leading-snug">
                <RoleBadge role={step.role || 'Pilot'} />
                <span className={`text-[12.5px] flex-1 ${
                  isError ? 'text-red-600' :
                  isWarn ? 'text-amber-700' :
                  isWaiting ? 'text-[#a87a00] font-semibold' :
                  'text-[#222]'
                }`}>
                  {step.text}
                </span>
              </div>
            )
          })}

          {confirmed && registered?.length > 0 && (
            <div className="mt-3 p-3 rounded-lg bg-green-50 border border-green-200">
              <div className="flex items-center gap-2 mb-1.5">
                <CheckCircle size={15} className="text-green-700" />
                <span className="text-sm text-green-800 font-bold">
                  Enrolled in {registered.length} course{registered.length !== 1 ? 's' : ''}
                </span>
              </div>
              <ul className="space-y-0.5 pl-7">
                {registered.map((r, i) => (
                  <li key={i} className="text-[11px] text-green-700">
                    <span className="font-mono font-bold">{r.course}</span> {r.section} — {r.instructor}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {done && !confirmed && (
          <div className="px-5 py-4 border-t border-[#f0efe9] bg-[#fffbea]">
            <p className="text-[11px] text-[#888] mb-3">
              Pilot staged your cart in PeopleSoft and stopped at the final Enroll button — awaiting your confirmation.
              {registered?.length > 0 && ` ${registered.length} course${registered.length !== 1 ? 's' : ''} loaded.`}
            </p>
            <button
              onClick={handleConfirm}
              className="w-full py-2.5 bg-black hover:bg-[#111] text-[#FFC300] font-bold rounded-xl text-sm transition-colors"
            >
              Finish Enrolling on PeopleSoft
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
