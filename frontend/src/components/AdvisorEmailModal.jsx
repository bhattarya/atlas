import { useState } from 'react'
import { X, Copy, Check, Mail } from 'lucide-react'

function buildEmailText(mapData, plannerState) {
  const name = mapData?.student_name ?? 'Student'
  const major = mapData?.major ?? 'Computer Science'
  const gpa = mapData?.gpa ?? '—'

  const lines = [
    `Subject: Semester Plan Review Request — ${name}`,
    '',
    `Dear Advisor,`,
    '',
    `I hope you're doing well. I'm writing to share my planned course schedule for the upcoming academic year and request a quick review before I finalize registration.`,
    '',
    `Student: ${name}`,
    `Major: ${major}`,
    `Current GPA: ${gpa}`,
    `Credits Remaining: ${mapData?.credits_remaining ?? '—'}`,
    '',
    `PLANNED SEMESTER SCHEDULE`,
    '─'.repeat(40),
  ]

  const placed = Object.entries(plannerState?.semesters ?? {})
    .filter(([, courses]) => courses.length > 0)

  if (placed.length === 0) {
    lines.push('No courses planned yet in the 4-year planner.')
  } else {
    placed.forEach(([semester, courses]) => {
      const credits = courses.reduce((s, c) => s + (c.credits ?? 3), 0)
      lines.push(`\n${semester}  (${credits} credits)`)
      courses.forEach(c => lines.push(`  • ${c.id} — ${c.name ?? c.id}  (${c.credits ?? 3} cr)`))
    })
  }

  const bottlenecks = mapData?.bottlenecks ?? []
  if (bottlenecks.length > 0) {
    lines.push('')
    lines.push('FLAGGED BOTTLENECKS')
    lines.push('─'.repeat(40))
    bottlenecks.forEach(b => lines.push(`  ⚠ ${b} — limited seats, time-sensitive`))
  }

  lines.push('')
  lines.push('Please let me know if you have any concerns or suggested changes.')
  lines.push('')
  lines.push(`Best regards,`)
  lines.push(name)

  return lines.join('\n')
}

export default function AdvisorEmailModal({ mapData, plannerState, onClose }) {
  const [copied, setCopied] = useState(false)
  const text = buildEmailText(mapData, plannerState)

  const handleCopy = async () => {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleMailto = () => {
    const subject = encodeURIComponent(`Semester Plan Review Request — ${mapData?.student_name ?? 'Student'}`)
    const body = encodeURIComponent(text)
    window.open(`mailto:?subject=${subject}&body=${body}`)
  }

  return (
    <div className="absolute inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
      <div className="w-[560px] max-h-[80vh] bg-white rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#f0efe9] bg-[#fafaf8]">
          <div className="flex items-center gap-2">
            <Mail size={15} className="text-[#FFC300]" />
            <span className="font-bold text-sm text-[#111]">Draft Advisor Email</span>
          </div>
          <button onClick={onClose} className="text-[#bbb] hover:text-[#333]">
            <X size={16} />
          </button>
        </div>

        {/* Email preview */}
        <div className="flex-1 overflow-y-auto p-5">
          <pre className="text-xs text-[#444] font-mono whitespace-pre-wrap leading-relaxed bg-[#f7f6f1] rounded-lg p-4 border border-[#e8e7e0]">
            {text}
          </pre>
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-5 py-4 border-t border-[#f0efe9]">
          <button
            onClick={handleCopy}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#111] text-white hover:bg-[#333] transition-colors"
          >
            {copied ? <Check size={14} className="text-[#10b981]" /> : <Copy size={14} />}
            {copied ? 'Copied!' : 'Copy to Clipboard'}
          </button>
          <button
            onClick={handleMailto}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-[#FFC300] text-black hover:bg-[#FFD84D] transition-colors"
          >
            <Mail size={14} />
            Open in Mail App
          </button>
          <p className="ml-auto self-center text-[10px] text-[#bbb] italic">Edit before sending</p>
        </div>
      </div>
    </div>
  )
}
