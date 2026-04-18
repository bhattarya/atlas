import { useState } from 'react'
import { ChevronDown, ChevronRight, GraduationCap, Clock } from 'lucide-react'

const YEAR_MAP = [
  { label: 'Freshman',  color: '#3b82f6', bg: '#eff6ff', sems: ['Fall 2022', 'Spring 2023'] },
  { label: 'Sophomore', color: '#8b5cf6', bg: '#f5f3ff', sems: ['Fall 2023', 'Spring 2024'] },
  { label: 'Junior',    color: '#f59e0b', bg: '#fffbeb', sems: ['Fall 2024', 'Spring 2025'] },
  { label: 'Senior',    color: '#10b981', bg: '#f0fdf4', sems: ['Fall 2025', 'Spring 2026'] },
]

function groupBySemester(courses) {
  const completed = courses.filter(c => c.status === 'completed')
  const inProgress = courses.filter(c => c.status === 'in_progress')

  // Sort by level then alphabetically
  const sorted = [...completed].sort((a, b) => (a.level ?? 1) - (b.level ?? 1) || a.id.localeCompare(b.id))

  // Group by course level → semester
  const byLevel = { 1: [], 2: [], 3: [], 4: [] }
  sorted.forEach(c => {
    const lvl = Math.min(Math.max(c.level ?? 1, 1), 4)
    byLevel[lvl].push(c)
  })

  const result = {}
  const semMap = { 1: ['Fall 2022', 'Spring 2023'], 2: ['Fall 2023', 'Spring 2024'], 3: ['Fall 2024', 'Spring 2025'], 4: ['Fall 2025', 'Spring 2026'] }

  Object.entries(byLevel).forEach(([lvl, cs]) => {
    const [sem1, sem2] = semMap[lvl]
    const half = Math.ceil(cs.length / 2)
    if (cs.length) result[sem1] = cs.slice(0, half)
    if (cs.length > half) result[sem2] = cs.slice(half)
  })

  if (inProgress.length) result['_current'] = inProgress
  return result
}

export default function AcademicTimeline({ mapData, onCourseSelect }) {
  const [collapsed, setCollapsed] = useState({})
  const [open, setOpen] = useState(true)

  if (!mapData) return null

  const semesterMap = groupBySemester(mapData.courses ?? [])
  const inProgress = semesterMap['_current'] ?? []
  const totalCredits = (mapData.credits_remaining ?? 0) + (mapData.completed ?? 0) * 3
  const pct = Math.round(((mapData.completed ?? 0) * 3) / 120 * 100)

  const toggle = (key) => setCollapsed(prev => ({ ...prev, [key]: !prev[key] }))

  if (!open) {
    return (
      <div className="w-8 shrink-0 bg-white border-r border-[#e8e7e0] flex flex-col items-center pt-3">
        <button onClick={() => setOpen(true)} className="text-[#bbb] hover:text-[#333] rotate-90">
          <ChevronDown size={14} />
        </button>
      </div>
    )
  }

  return (
    <div className="w-[210px] shrink-0 bg-white border-r border-[#e8e7e0] flex flex-col overflow-hidden">
      {/* Header */}
      <div className="px-3 pt-3 pb-2 border-b border-[#f0efe9] flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <GraduationCap size={13} className="text-[#FFC300]" />
          <span className="text-[10px] font-bold text-[#111] uppercase tracking-widest">Journey</span>
        </div>
        <button onClick={() => setOpen(false)} className="text-[#ccc] hover:text-[#888]">
          <ChevronRight size={13} />
        </button>
      </div>

      {/* Progress */}
      <div className="px-3 py-2 border-b border-[#f0efe9]">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[9px] text-[#999]">Graduation progress</span>
          <span className="text-[9px] font-bold text-[#111]">{pct}%</span>
        </div>
        <div className="h-1.5 bg-[#f0efe9] rounded-full overflow-hidden">
          <div className="h-full bg-[#FFC300] rounded-full transition-all" style={{ width: `${pct}%` }} />
        </div>
        <div className="flex justify-between mt-1">
          <span className="text-[8px] text-[#bbb]">GPA {mapData.gpa ?? '—'}</span>
          <span className="text-[8px] text-[#bbb]">{mapData.credits_remaining} cr left</span>
        </div>
      </div>

      {/* In Progress */}
      {inProgress.length > 0 && (
        <div className="px-3 py-2 border-b border-[#f0efe9] bg-[#fffbea]">
          <div className="flex items-center gap-1 mb-1.5">
            <Clock size={9} className="text-[#FFC300]" />
            <span className="text-[9px] font-bold text-[#FFC300] uppercase tracking-wide">Current Semester</span>
          </div>
          <div className="flex flex-wrap gap-1">
            {inProgress.map(c => (
              <button
                key={c.id}
                onClick={() => onCourseSelect?.(c)}
                className="text-[8px] font-mono font-bold bg-[#FFC300]/20 text-[#856600] px-1.5 py-0.5 rounded hover:bg-[#FFC300]/40 transition-colors"
              >
                {c.id}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Year sections */}
      <div className="flex-1 overflow-y-auto">
        {YEAR_MAP.map(({ label, color, bg, sems }) => {
          const yearCourses = sems.flatMap(s => semesterMap[s] ?? [])
          if (!yearCourses.length) return null
          const isCollapsed = collapsed[label]
          const yearCredits = yearCourses.reduce((s, c) => s + (c.credits ?? 3), 0)

          return (
            <div key={label} className="border-b border-[#f0efe9]">
              <button
                onClick={() => toggle(label)}
                className="w-full flex items-center justify-between px-3 py-1.5 hover:bg-[#fafaf8] transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: color }} />
                  <span className="text-[9px] font-bold uppercase tracking-wider" style={{ color }}>
                    {label}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[8px] text-[#bbb]">{yearCredits} cr</span>
                  {isCollapsed ? <ChevronRight size={10} className="text-[#ccc]" /> : <ChevronDown size={10} className="text-[#ccc]" />}
                </div>
              </button>

              {!isCollapsed && (
                <div className="pb-2">
                  {sems.map(sem => {
                    const cs = semesterMap[sem] ?? []
                    if (!cs.length) return null
                    const isFall = sem.includes('Fall')
                    return (
                      <div key={sem} className="px-3 mb-2">
                        <p className="text-[8px] text-[#bbb] mb-1 font-medium">
                          {isFall ? '🍂' : '🌸'} {sem}
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {cs.map(c => (
                            <button
                              key={c.id}
                              onClick={() => onCourseSelect?.(c)}
                              title={c.name}
                              className="text-[7.5px] font-mono font-bold px-1.5 py-0.5 rounded hover:opacity-80 transition-opacity"
                              style={{ backgroundColor: bg, color, border: `1px solid ${color}22` }}
                            >
                              {c.id}
                            </button>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Transfer note */}
      <div className="px-3 py-2 border-t border-[#f0efe9]">
        <p className="text-[8px] text-[#ccc] italic">UMBC · CS-BS · 4-year track</p>
      </div>
    </div>
  )
}
