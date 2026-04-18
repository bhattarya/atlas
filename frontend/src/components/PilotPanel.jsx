import { useState, useEffect, useRef } from 'react'
import { X, CheckCircle, Loader2 } from 'lucide-react'

export default function PilotPanel({ sessionId, onConfirm, onClose }) {
  const [steps, setSteps] = useState([])
  const [done, setDone] = useState(false)
  const [confirmed, setConfirmed] = useState(false)
  const bottomRef = useRef()

  useEffect(() => {
    if (!sessionId) return
    const es = new EventSource(`/api/pilot-stream/${sessionId}`)

    es.onmessage = (e) => {
      const data = JSON.parse(e.data)
      if (data.type === 'action') {
        setSteps(prev => [...prev, { text: data.description, done: true }])
      } else if (data.type === 'waiting') {
        setSteps(prev => [...prev, { text: data.description, done: false }])
        setDone(true)
        es.close()
      } else if (data.type === 'error') {
        setSteps(prev => [...prev, { text: `Error: ${data.message}`, error: true }])
        es.close()
      }
    }

    es.onerror = () => es.close()
    return () => es.close()
  }, [sessionId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [steps])

  const handleConfirm = async () => {
    setConfirmed(true)
    await onConfirm()
    setSteps(prev => [...prev, { text: 'Submitted. CMSC 441 registered.', success: true }])
  }

  return (
    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="w-[480px] bg-[#111827] border border-[#1f2937] rounded-xl shadow-2xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#1f2937]">
          <span className="font-bold text-white flex items-center gap-2">
            <span className="w-2 h-2 bg-[#3b82f6] rounded-full animate-pulse" />
            Pilot Active
          </span>
          <button onClick={onClose} className="text-[#6b7280] hover:text-white">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-3">
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              {step.done || step.success ? (
                <CheckCircle size={16} className={`mt-0.5 shrink-0 ${step.success ? 'text-[#10b981]' : 'text-[#3b82f6]'}`} />
              ) : step.error ? (
                <span className="text-[#ef4444] text-xs mt-0.5">✕</span>
              ) : (
                <Loader2 size={16} className="mt-0.5 shrink-0 animate-spin text-[#f59e0b]" />
              )}
              <span className={`text-sm ${step.error ? 'text-[#ef4444]' : step.success ? 'text-[#10b981]' : 'text-[#e5e7eb]'}`}>
                {step.text}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {done && !confirmed && (
          <div className="px-5 py-4 border-t border-[#1f2937] flex flex-col gap-2">
            <p className="text-sm text-[#9ca3af]">
              Pilot has completed cart assembly. Review above, then confirm to submit.
            </p>
            <button
              onClick={handleConfirm}
              className="w-full py-2.5 bg-[#10b981] hover:bg-[#059669] text-white font-bold rounded-lg text-sm transition-colors"
            >
              Confirm & Submit Registration
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
