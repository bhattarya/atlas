import { useState, useEffect, useRef } from 'react'
import {
  Sparkles, Send, Paperclip, Mic, Loader2, User,
  Bot, Rocket, CheckCircle2, FileDown, PlayCircle,
} from 'lucide-react'
import { chatAdvisor, startPilot, confirmPilot, exportPlanPdf } from '../lib/api'

/**
 * Atlas Advisor chat — Claude-powered conversation with a "launch_pilot" tool
 * the model can call to trigger the automated registration agent. When Pilot
 * runs, its steps stream into the same conversation; when it finishes, a
 * "Finalized Schedule" card appears inline with Confirm + Export PDF actions.
 *
 * UI follows the minimalist chat-input mockup: rounded pill input, paperclip
 * on the left, mic + round black send button on the right.
 */

const PLACEHOLDERS = [
  'What should I register for?',
  'Is Spring 2027 too heavy?',
  'Best prof for CMSC 441?',
  'Can I graduate a semester early?',
  'Register me now.',
  'Which bottleneck should I hit first?',
]

// ─── Message shapes ─────────────────────────────────────────────────────
// { id, role: 'user'|'assistant', text }
// { id, role: 'pilot', step: { text, role, level } }
// { id, role: 'schedule', registered: [...], status: 'awaiting'|'confirmed'|'submitting' }

let idCounter = 0
const nextId = () => `m${++idCounter}`

export default function AdvisorAsk({ planObj, mapData, onPilotComplete }) {
  const [value, setValue] = useState('')
  const [messages, setMessages] = useState([])
  const [sending, setSending] = useState(false)
  const [placeholderIdx, setPlaceholderIdx] = useState(0)
  const [placeholderVisible, setPlaceholderVisible] = useState(true)
  const [pilotSessionId, setPilotSessionId] = useState(null)
  const inputRef = useRef(null)
  const scrollRef = useRef(null)

  // Rotating placeholder
  useEffect(() => {
    if (value) return
    const id = setInterval(() => {
      setPlaceholderVisible(false)
      setTimeout(() => {
        setPlaceholderIdx(p => (p + 1) % PLACEHOLDERS.length)
        setPlaceholderVisible(true)
      }, 260)
    }, 3200)
    return () => clearInterval(id)
  }, [value])

  // Auto-scroll to latest message
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages, sending])

  // ─── Pilot streaming ──────────────────────────────────────────────────
  useEffect(() => {
    if (!pilotSessionId) return
    const es = new EventSource(`/api/pilot-stream/${pilotSessionId}`)
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'ping') return
        if (data.type === 'action') {
          setMessages(prev => [...prev, {
            id: nextId(),
            role: 'pilot',
            step: { text: data.description, role: data.role, level: data.level },
          }])
        } else if (data.type === 'waiting') {
          setMessages(prev => [...prev, {
            id: nextId(),
            role: 'schedule',
            registered: data.registered || [],
            status: 'awaiting',
          }])
          es.close()
        } else if (data.type === 'error') {
          setMessages(prev => [...prev, {
            id: nextId(),
            role: 'assistant',
            text: `Pilot error: ${data.message}`,
            error: true,
          }])
          es.close()
        }
      } catch { /* ignore */ }
    }
    es.onerror = () => es.close()
    return () => es.close()
  }, [pilotSessionId])

  // ─── Send message / route to tool ─────────────────────────────────────
  const send = async (override) => {
    const question = (override ?? value).trim()
    if (!question || sending) return
    setValue('')

    const userMsg = { id: nextId(), role: 'user', text: question }
    const nextMessages = [...messages, userMsg]
    setMessages(nextMessages)
    setSending(true)

    // Build the claude-formatted conversation (strip pilot/schedule non-text turns)
    const convo = nextMessages
      .filter(m => m.role === 'user' || (m.role === 'assistant' && m.text))
      .map(m => ({ role: m.role, content: m.text }))

    try {
      const resp = await chatAdvisor(convo, planObj ?? null)
      if (resp.type === 'tool_use' && resp.tool === 'launch_pilot') {
        // Show Claude's rationale, then kick off Pilot
        const { courses = [], rationale } = resp.args || {}
        if (rationale) {
          setMessages(prev => [...prev, {
            id: nextId(),
            role: 'assistant',
            text: rationale,
            isAction: true,
          }])
        }
        setMessages(prev => [...prev, {
          id: nextId(),
          role: 'launch',
          courses,
        }])
        const { session_id } = await startPilot(courses)
        setPilotSessionId(session_id)
      } else {
        setMessages(prev => [...prev, {
          id: nextId(),
          role: 'assistant',
          text: resp.answer || '(no response)',
        }])
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        id: nextId(),
        role: 'assistant',
        text: `Couldn't reach advisor: ${err.message}`,
        error: true,
      }])
    } finally {
      setSending(false)
      inputRef.current?.focus()
    }
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // ─── Schedule actions ─────────────────────────────────────────────────
  const handleConfirmSchedule = async (msgId) => {
    if (!pilotSessionId) return
    setMessages(prev => prev.map(m => m.id === msgId ? { ...m, status: 'submitting' } : m))
    try {
      const result = await confirmPilot(pilotSessionId)
      // The waiting-event list is the source of truth — only overwrite if the
      // confirm response actually returned a non-empty registered list.
      setMessages(prev => prev.map(m => {
        if (m.id !== msgId) return m
        const existing = m.registered ?? []
        const fromResult = result?.registered ?? []
        const registered = fromResult.length > 0 ? fromResult : existing
        return { ...m, status: 'confirmed', registered, warning: result?.warning }
      }))
      // Fire onPilotComplete with whichever list we ended up with.
      // Default target term is Fall 2026 — that's the registration window Go-Atlas
      // is working against in the demo timeline.
      setMessages(prev => {
        const confirmed = prev.find(m => m.id === msgId)
        if (confirmed?.registered?.length) {
          onPilotComplete?.(confirmed.registered, 'Fall 2026')
        }
        return prev
      })
    } catch (err) {
      setMessages(prev => prev.map(m => m.id === msgId
        ? { ...m, status: 'awaiting', error: err.message }
        : m
      ))
    }
  }

  const handleExportPdf = async (registered) => {
    if (!registered || registered.length === 0) {
      setMessages(prev => [...prev, {
        id: nextId(),
        role: 'assistant',
        text: "I don't have any enrolled courses to export yet — run Go-Atlas first.",
        error: true,
      }])
      return
    }
    try {
      const blob = await exportPlanPdf({
        registered,
        student_name: mapData?.student_name,
        major: mapData?.major,
        term: 'Fall 2026',
      })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `atlas-schedule-${mapData?.student_name?.replace(/\s+/g, '-') || 'student'}.pdf`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      console.error('PDF export failed:', err)
      setMessages(prev => [...prev, {
        id: nextId(),
        role: 'assistant',
        text: `Couldn't build the PDF: ${err.message}`,
        error: true,
      }])
    }
  }

  const QUICK = [
    { label: 'What should I take?', prompt: 'What should I register for this semester?' },
    { label: 'Run the pilot', prompt: 'Register me for my best courses this semester.' },
    { label: 'Risks?', prompt: 'What are the biggest risks in my plan?' },
  ]

  return (
    <div className="flex flex-col h-full min-h-0 bg-gradient-to-b from-[#fdfdf8] to-[#f5f3eb]">
      {/* ── Conversation ───────────────────────────────────── */}
      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto px-4 py-4 space-y-3 min-h-0"
      >
        {messages.length === 0 && (
          <EmptyState onQuick={send} />
        )}

        {messages.map(m => {
          if (m.role === 'user') return <UserBubble key={m.id} text={m.text} />
          if (m.role === 'assistant') return <AssistantBubble key={m.id} text={m.text} error={m.error} isAction={m.isAction} />
          if (m.role === 'launch') return <LaunchCard key={m.id} courses={m.courses} />
          if (m.role === 'pilot') return <PilotStep key={m.id} step={m.step} />
          if (m.role === 'schedule') return (
            <ScheduleCard
              key={m.id}
              msg={m}
              onConfirm={() => handleConfirmSchedule(m.id)}
              onExport={() => handleExportPdf(m.registered)}
            />
          )
          return null
        })}

        {sending && (
          <div className="flex items-center gap-2 text-[11px] text-[#a87a00] pl-1">
            <Loader2 size={11} className="animate-spin" />
            <span className="italic">Atlas is thinking…</span>
          </div>
        )}
      </div>

      {/* ── Quick-action chips (only when no convo) ───────── */}
      {messages.length === 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-1.5">
          {QUICK.map(q => (
            <button
              key={q.label}
              type="button"
              onClick={() => send(q.prompt)}
              className="text-[10.5px] font-semibold px-2.5 py-1 rounded-full bg-white border border-[#e8e7e0] text-[#555] hover:bg-[#fffbe6] hover:border-[#FFD84D] hover:text-[#7a5a00] transition-colors shadow-sm"
            >
              {q.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Input pill (paperclip · input · mic · send) ───── */}
      <div className="shrink-0 px-4 pt-2 pb-4">
        <div className="flex items-center gap-2 bg-white rounded-full border border-[#e4e2d8] shadow-[0_4px_20px_rgba(0,0,0,0.04),0_1px_3px_rgba(0,0,0,0.06)] pl-3 pr-1.5 py-1.5 focus-within:border-[#FFC300] focus-within:shadow-[0_4px_20px_rgba(255,195,0,0.15)] transition-all">
          <button
            type="button"
            className="shrink-0 p-1.5 rounded-full text-[#999] hover:text-[#333] hover:bg-[#f5f3eb] transition-colors"
            title="Attach"
            tabIndex={-1}
          >
            <Paperclip size={15} strokeWidth={2} />
          </button>

          <div className="relative flex-1 min-w-0">
            <input
              ref={inputRef}
              type="text"
              value={value}
              onChange={e => setValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={sending}
              className="w-full bg-transparent outline-none text-[13px] text-[#111] placeholder-transparent py-1 disabled:opacity-60"
              style={{ caretColor: '#FFC300' }}
            />
            {!value && (
              <div className="absolute inset-0 flex items-center pointer-events-none">
                <span
                  className={`text-[13px] text-[#a8a599] truncate transition-all duration-300 ${
                    placeholderVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1'
                  }`}
                >
                  {PLACEHOLDERS[placeholderIdx]}
                </span>
              </div>
            )}
          </div>

          <button
            type="button"
            className="shrink-0 p-1.5 rounded-full text-[#999] hover:text-[#333] hover:bg-[#f5f3eb] transition-colors"
            title="Voice input"
            tabIndex={-1}
          >
            <Mic size={15} strokeWidth={2} />
          </button>

          <button
            type="button"
            onClick={() => send()}
            disabled={!value.trim() || sending}
            className={`shrink-0 flex items-center justify-center w-9 h-9 rounded-full transition-all ${
              value.trim() && !sending
                ? 'bg-black text-white hover:bg-[#1a1a1a] active:scale-95 shadow-md'
                : 'bg-[#ededed] text-[#bbb] cursor-not-allowed'
            }`}
            title="Send"
          >
            {sending
              ? <Loader2 size={14} className="animate-spin" />
              : <Send size={14} strokeWidth={2.2} className="translate-x-px -translate-y-px" />
            }
          </button>
        </div>

        <p className="text-[9.5px] text-center text-[#b0ad9f] mt-2 select-none">
          Atlas is powered by Claude Sonnet 4.5 + Gemini 2.5. Ask anything.
        </p>
      </div>
    </div>
  )
}

// ─── Message components ─────────────────────────────────────────────────

function EmptyState({ onQuick }) {
  return (
    <div className="flex flex-col items-center text-center pt-6 pb-2 px-2">
      <div className="flex items-center justify-center w-12 h-12 rounded-2xl bg-gradient-to-br from-[#FFC300] to-[#FFD84D] shadow-[0_6px_18px_rgba(255,195,0,0.28)] mb-3">
        <Sparkles size={20} strokeWidth={2.3} className="text-black" />
      </div>
      <p className="text-[15px] font-bold text-[#1a1a1a] tracking-tight mb-1">
        Hi — I'm Atlas.
      </p>
      <p className="text-[12px] text-[#777] leading-relaxed max-w-[260px]">
        Ask me what to take, who to take it with, or say <span className="font-semibold text-[#a87a00]">"register me"</span> and I'll run the pilot live.
      </p>
    </div>
  )
}

function UserBubble({ text }) {
  return (
    <div className="flex items-start gap-2 justify-end">
      <div className="max-w-[84%] rounded-2xl rounded-tr-md bg-black text-white px-3 py-2 text-[12.5px] leading-snug">
        {text}
      </div>
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-[#f0efe9] shrink-0 mt-0.5">
        <User size={11} className="text-[#888]" />
      </div>
    </div>
  )
}

function renderMd(text) {
  // Escape HTML, then convert **bold** and *italic*, preserve newlines
  const escaped = text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
  const html = escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(?!\*)(.+?)\*(?!\*)/g, '<em>$1</em>')
    .replace(/\n/g, '<br/>')
  return html
}

function AssistantBubble({ text, error, isAction }) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-gradient-to-br from-[#FFC300] to-[#FFD84D] shrink-0 mt-0.5 shadow-sm">
        <Sparkles size={10} strokeWidth={2.6} className="text-black" />
      </div>
      <div
        className={`max-w-[84%] rounded-2xl rounded-tl-md px-3 py-2 text-[12.5px] leading-relaxed ${
          error
            ? 'bg-red-50 text-red-700 border border-red-200'
            : isAction
              ? 'bg-[#fffbe6] text-[#6b4e00] border border-[#FFD84D]'
              : 'bg-white text-[#1a1a1a] border border-[#ece9df]'
        }`}
        dangerouslySetInnerHTML={{ __html: renderMd(text) }}
      />
    </div>
  )
}

function LaunchCard({ courses }) {
  return (
    <div className="flex items-start gap-2">
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-black shrink-0 mt-0.5">
        <Rocket size={11} className="text-[#FFC300]" />
      </div>
      <div className="flex-1 rounded-2xl rounded-tl-md px-3 py-2.5 bg-gradient-to-br from-black via-[#1a1a1a] to-[#0f0f0f] text-white">
        <div className="flex items-center gap-1.5 mb-2">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#FFC300] animate-pulse" />
          <span className="text-[9.5px] font-bold uppercase tracking-[0.14em] text-[#FFC300]">
            Go-Atlas engaged
          </span>
          <span className="text-[9px] text-[#888] ml-auto">searching live sections…</span>
        </div>
        <ul className="space-y-0.5">
          {courses.map((c, i) => (
            <li key={i} className="flex items-center gap-1.5 text-[11.5px]">
              <span className="text-[#FFC300] font-mono font-bold shrink-0">{c.course}</span>
              {c.preferred_instructor && (
                <>
                  <span className="text-[#555]">·</span>
                  <span className="text-[#ddd] truncate">{c.preferred_instructor}</span>
                </>
              )}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

function PilotStep({ step }) {
  const role = step?.role || 'Pilot'
  const tone = step?.level === 'error'
    ? 'text-red-700 bg-red-50 border-red-200'
    : step?.level === 'warn'
      ? 'text-amber-700 bg-amber-50 border-amber-200'
      : 'text-[#444] bg-[#f7f6ef] border-[#e8e5d6]'
  return (
    <div className={`flex items-start gap-2 pl-8`}>
      <div className={`flex-1 rounded-lg px-2.5 py-1.5 border text-[11px] leading-snug ${tone}`}>
        <div className="flex items-center gap-1.5 mb-0.5">
          <Bot size={9} className="text-[#999]" />
          <span className="text-[8.5px] font-bold uppercase tracking-wider text-[#888]">
            {role}
          </span>
        </div>
        {step.text}
      </div>
    </div>
  )
}

function ScheduleCard({ msg, onConfirm, onExport }) {
  const { registered = [], status } = msg
  const isConfirmed = status === 'confirmed'
  const isSubmitting = status === 'submitting'
  const totalCredits = registered.reduce((sum, r) => sum + (r.credits ?? 3), 0)
  return (
    <div className="flex items-start gap-2">
      <div className={`flex items-center justify-center w-6 h-6 rounded-full shrink-0 mt-0.5 ${
        isConfirmed ? 'bg-blue-500' : 'bg-gradient-to-br from-[#FFC300] to-[#FFD84D]'
      }`}>
        {isConfirmed
          ? <CheckCircle2 size={12} className="text-white" />
          : <Sparkles size={10} strokeWidth={2.6} className="text-black" />
        }
      </div>
      <div className="flex-1 rounded-2xl rounded-tl-md bg-white border border-[#ece9df] overflow-hidden shadow-sm">
        {/* Swap header border palette when confirmed: yellow "pending" → blue "planned" */}
        <div className={`px-3 py-2 ${isConfirmed ? 'bg-blue-50 border-b border-blue-200' : 'bg-[#fffbe6] border-b border-[#FFE280]'}`}>
          <div className="flex items-center gap-1.5 justify-between">
            <span className="text-[9.5px] font-bold uppercase tracking-[0.14em]" style={{
              color: isConfirmed ? '#1e40af' : '#8a6200'
            }}>
              {isConfirmed ? 'Fall 2026 Plan Locked' : 'Fall 2026 Plan · Ready to Lock'}
            </span>
            <span className="text-[9px] font-semibold text-[#999] tabular-nums">
              {registered.length} course{registered.length !== 1 ? 's' : ''} · {totalCredits} cr
            </span>
          </div>
          <p className="text-[12px] text-[#333] mt-0.5">
            {isConfirmed
              ? (registered.length > 0
                  ? `${registered.length} course${registered.length !== 1 ? 's' : ''} added to your Fall 2026 plan. They'll appear blue on your degree map.`
                  : 'Nothing was planned — Go-Atlas couldn\'t find open sections. Try again when more open.')
              : `Go-Atlas researched your Fall 2026 picks. Review and lock them into your plan.`}
          </p>
        </div>

        {registered.length === 0 ? (
          <div className="px-3 py-3 text-center text-[11px] text-[#888] italic">
            No courses enrolled.
          </div>
        ) : (
          <ul className="divide-y divide-[#f0eee4]">
            {registered.map((r, i) => (
              <li key={i} className="px-3 py-2 text-[11.5px]">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span className="font-mono font-bold text-[#1a1a1a]">{r.course}</span>
                    <span className="text-[#bbb]">·</span>
                    <span className="text-[#666] text-[10.5px]">{r.section}</span>
                  </div>
                  {isConfirmed && (
                    <span className="text-[9px] font-bold text-blue-700 bg-blue-100 px-1.5 py-0.5 rounded shrink-0">
                      PLANNED · FALL 2026
                    </span>
                  )}
                </div>
                <p className="text-[10.5px] text-[#444] mt-0.5 font-medium">{r.instructor}</p>
                {r.reason && (
                  <p className="text-[10px] text-[#999] italic leading-snug mt-0.5">
                    ↳ {r.reason}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}

        <div className="flex gap-1.5 px-3 py-2 bg-[#fafaf4] border-t border-[#f0eee4]">
          {!isConfirmed ? (
            <button
              onClick={onConfirm}
              disabled={isSubmitting || registered.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold bg-black text-[#FFC300] rounded-lg px-3 py-1.5 hover:bg-[#1a1a1a] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <Loader2 size={11} className="animate-spin" /> : <PlayCircle size={12} />}
              {isSubmitting ? 'Locking in…' : 'Lock Fall 2026 Plan'}
            </button>
          ) : (
            <button
              onClick={onExport}
              disabled={registered.length === 0}
              className="flex-1 flex items-center justify-center gap-1.5 text-[11px] font-bold bg-black text-[#FFC300] rounded-lg px-3 py-1.5 hover:bg-[#1a1a1a] active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <FileDown size={12} />
              Export PDF
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
