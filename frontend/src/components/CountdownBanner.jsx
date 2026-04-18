import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'

function getWindowOpen() {
  // Tomorrow at 08:00 local time
  const t = new Date()
  t.setDate(t.getDate() + 1)
  t.setHours(8, 0, 0, 0)
  return t
}

export default function CountdownBanner() {
  const [timeLeft, setTimeLeft] = useState('')
  const [urgent, setUrgent] = useState(false)

  useEffect(() => {
    const target = getWindowOpen()

    const tick = () => {
      const diff = target - Date.now()
      if (diff <= 0) {
        setTimeLeft('Window is OPEN')
        setUrgent(true)
        return
      }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`)
      setUrgent(h === 0 && m < 30)
    }

    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className={`flex items-center justify-center gap-2 py-1.5 text-xs font-mono ${urgent ? 'bg-[#1c0a0a] text-[#ef4444]' : 'bg-[#0f172a] text-[#6b7280]'}`}>
      <Clock size={12} />
      <span>Registration window opens in <strong>{timeLeft}</strong></span>
    </div>
  )
}
