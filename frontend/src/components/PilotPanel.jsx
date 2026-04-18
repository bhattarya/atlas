import { useEffect, useRef, useState } from 'react'
import { X, CheckCircle, Loader2, Zap } from 'lucide-react'

export default function PilotPanel({ steps, done, onConfirm, onClose }) {
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
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="w-[480px] bg-[#111827] border border-[#1f2937] rounded-xl shadow-2xl flex flex-col max-h-[80vh]">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f2937]">
          <span className="font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 bg-[#3b82f6] rounded-full animate-pulse" />
            Pilot Active
          </span>
          <button onClick={onClose} className="text-[#6b7280] hover:text-white">
            <X size={18} />
          </button>
        </div>

        {/* Steps */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {steps.length === 0 && (
            <div className="flex items-center gap-2 text-[#6b7280] text-sm">
              <Loader2 size={14} className="animate-spin" />
              Launching browser…
            </div>
          )}
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              {step.error ? (
                <span className="text-[#ef4444] text-xs mt-0.5 shrink-0">✕</span>
              ) : step.waiting || step.done ? (
                <CheckCircle
                  size={16}
                  className={`mt-0.5 shrink-0 ${step.waiting ? 'text-[#10b981]' : 'text-[#3b82f6]'}`}
                />
              ) : (
                <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin text-[#f59e0b]" />
              )}
              <span className={`text-sm ${
                step.error ? 'text-[#ef4444]'
                : step.waiting ? 'text-[#10b981]'
                : 'text-[#e5e7eb]'
              }`}>
                {step.text}
              </span>
            </div>
          ))}

          {/* Success state after confirm */}
          {confirmed && (
            <div className="flex items-center gap-3 mt-2">
              <CheckCircle size={16} className="text-[#10b981] shrink-0" />
              <span className="text-sm text-[#10b981] font-semibold">
                Submitted. CMSC 441 secured.
              </span>
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {/* Confirm footer */}
        {done && !confirmed && (
          <div className="px-5 py-4 border-t border-[#1f2937] flex flex-col gap-2">
            <p className="text-sm text-[#9ca3af]">
              Pilot assembled your cart. Review above, then confirm to lock in your seat.
            </p>
            <button
              onClick={handleConfirm}
              className="w-full py-2.5 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
            >
              <Zap size={15} />
              Confirm &amp; Submit Registration
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
