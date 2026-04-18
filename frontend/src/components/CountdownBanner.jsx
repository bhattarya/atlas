import { useState, useEffect } from 'react'

function getWindowOpen() {
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
      if (diff <= 0) { setTimeLeft('OPEN NOW'); setUrgent(true); return }
      const h = Math.floor(diff / 3600000)
      const m = Math.floor((diff % 3600000) / 60000)
      const s = Math.floor((diff % 60000) / 1000)
      setTimeLeft(`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`)
      setUrgent(h === 0 && m < 30)
    }
    tick()
    const id = setInterval(tick, 1000)
    return () => clearInterval(id)
  }, [])

  return (
    <div className={`flex items-center justify-center gap-2 py-1 text-xs font-mono shrink-0 ${
      urgent
        ? 'bg-red-600 text-white'
        : 'bg-[#FFC300] text-black'
    }`}>
      <span className="font-medium">Registration window opens in</span>
      <span className="font-bold tracking-widest">{timeLeft}</span>
    </div>
  )
}
