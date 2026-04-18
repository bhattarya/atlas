import { useState, useEffect, useRef } from 'react'
import { X, CheckCircle, Loader2, Zap } from 'lucide-react'

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
        setSteps(prev => [...prev, { text: data.description, waiting: true }])
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
    setSteps(prev => [...prev, { text: 'Registration submitted. CMSC 441 secured.', success: true }])
  }

  return (
    <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-50">
      <div className="w-[460px] bg-white rounded-2xl shadow-[0_20px_60px_rgba(0,0,0,0.20)] flex flex-col max-h-[80vh] overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0efe9] bg-black rounded-t-2xl">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 bg-[#FFC300] rounded-full animate-pulse" />
            <span className="text-white font-bold text-sm flex items-center gap-1.5">
              <Zap size={14} className="text-[#FFC300]" /> Pilot Active
            </span>
          </div>
          <button onClick={onClose} className="text-[#666] hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Steps */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-2.5">
          {steps.length === 0 && (
            <div className="flex items-center gap-2 text-sm text-[#999]">
              <Loader2 size={14} className="animate-spin text-[#FFC300]" />
              Initializing browser session…
            </div>
          )}
          {steps.map((step, i) => (
            <div key={i} className="flex items-start gap-3">
              {step.success ? (
                <CheckCircle size={15} className="mt-0.5 shrink-0 text-green-600" />
              ) : step.error ? (
                <span className="text-red-500 text-xs mt-1 shrink-0">✕</span>
              ) : step.waiting ? (
                <span className="w-3.5 h-3.5 mt-0.5 rounded-full border-2 border-[#FFC300] shrink-0 flex items-center justify-center">
                  <span className="w-1.5 h-1.5 bg-[#FFC300] rounded-full" />
                </span>
              ) : (
                <CheckCircle size={15} className="mt-0.5 shrink-0 text-[#111]" />
              )}
              <span className={`text-sm leading-snug ${
                step.error ? 'text-red-600' :
                step.success ? 'text-green-700 font-medium' :
                step.waiting ? 'text-[#FFC300] font-medium' :
                'text-[#333]'
              }`}>
                {step.text}
              </span>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Confirm footer */}
        {done && !confirmed && (
          <div className="px-5 py-4 border-t border-[#f0efe9] bg-[#fffbea]">
            <p className="text-xs text-[#888] mb-3">
              Cart assembled. Pilot is stopped at Submit — your final confirmation required.
            </p>
            <button
              onClick={handleConfirm}
              className="w-full py-2.5 bg-black hover:bg-[#111] text-[#FFC300] font-bold rounded-xl text-sm transition-colors"
            >
              Confirm &amp; Submit Registration
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
