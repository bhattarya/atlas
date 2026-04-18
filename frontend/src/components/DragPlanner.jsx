import { useState } from 'react'
import { DndContext, DragOverlay, pointerWithin, useDraggable, useDroppable } from '@dnd-kit/core'
import { ChevronDown, GraduationCap } from 'lucide-react'
import { validatePlacement } from '../lib/api'

/* ── Two academic years, each split into Fall + Spring ── */
const YEARS = [
  {
    label: 'Junior Year',
    sublabel: '2026 – 2027',
    semesters: ['Fall 2026', 'Spring 2027'],
  },
  {
    label: 'Senior Year',
    sublabel: '2027 – 2028',
    semesters: ['Fall 2027', 'Spring 2028'],
  },
]
const ALL_SEMS = YEARS.flatMap(y => y.semesters)

function findCourse(plannerState, id) {
  const fromBank = plannerState.bank.find(c => c.id === id)
  if (fromBank) return fromBank
  for (const courses of Object.values(plannerState.semesters)) {
    const found = courses.find(c => c.id === id)
    if (found) return found
  }
  return null
}

function findSource(plannerState, id) {
  if (plannerState.bank.find(c => c.id === id)) return 'bank'
  for (const [sem, courses] of Object.entries(plannerState.semesters)) {
    if (courses.find(c => c.id === id)) return sem
  }
  return null
}

/* ── Status color (matches MapView bubbles) ── */
function statusColor(course) {
  if (course.is_bottleneck) return { ring: '#f97316', fill: '#fff7ed', text: '#9a3412' }
  if (course.spring_only) return { ring: '#FFC300', fill: '#fffbe6', text: '#7a5a00' }
  return { ring: '#cfccc1', fill: '#ffffff', text: '#3f3f46' }
}

export default function DragPlanner({ plannerState, onDrop }) {
  const [activeId, setActiveId] = useState(null)
  const [toast, setToast] = useState(null)
  const [collapsed, setCollapsed] = useState(false)

  const activeCourse = activeId ? findCourse(plannerState, activeId) : null
  const totalPlanned = ALL_SEMS.reduce((s, sem) => s + (plannerState.semesters[sem]?.length ?? 0), 0)

  const showToast = (message, type = 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  const handleDragEnd = async ({ active, over }) => {
    setActiveId(null)
    if (!over) return
    const courseId = active.id
    const target = over.id
    const source = findSource(plannerState, courseId)
    if (source === target) return
    const course = findCourse(plannerState, courseId)

    // Always place the course — validator only surfaces advisories, never blocks
    onDrop(courseId, source, target, course)

    if (target !== 'bank') {
      try {
        const currentPlan = {}
        for (const [sem, courses] of Object.entries(plannerState.semesters)) {
          currentPlan[sem] = courses.map(c => c.id)
        }
        const result = await validatePlacement(courseId, target, currentPlan)
        // Surface the most important advisory (errors first, then warnings) as a soft side message
        const advisory = result.errors?.[0] || result.warnings?.[0]
        if (advisory) {
          showToast(advisory, result.errors?.length ? 'warning' : 'info')
        }
      } catch {
        // Validator down — placement still succeeded, no need to nag
      }
    }
  }

  return (
    <DndContext
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragEnd={handleDragEnd}
      collisionDetection={pointerWithin}
    >
      <div
        className="shrink-0 border-t border-[#e8e7e0] bg-gradient-to-b from-[#fafaf6] to-[#f3f1e9] px-5 pt-3 pb-3 flex flex-col gap-2.5 transition-[height] duration-300"
        style={{ height: collapsed ? 56 : 230 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-gradient-to-br from-[#FFC300]/25 to-[#FFC300]/10 text-[#a87a00] shadow-[0_2px_6px_rgba(255,195,0,0.12)]">
              <GraduationCap size={16} strokeWidth={2.2} />
            </div>
            <div className="leading-tight">
              <p className="text-[12.5px] font-bold text-[#1a1a1a] tracking-tight">Graduation Roadmap</p>
              <p className="text-[10px] text-[#999] flex items-center gap-1.5 mt-0.5">
                <span className="tabular-nums font-semibold text-[#a87a00]">{plannerState.bank.length}</span>
                <span>unplaced</span>
                <span className="text-[#d4d2c7]">·</span>
                <span className="tabular-nums font-semibold text-[#5a6f3f]">{totalPlanned}</span>
                <span>scheduled</span>
                <span className="text-[#d4d2c7]">·</span>
                <span className="italic">prereqs validated on drop</span>
              </p>
            </div>
          </div>
          <button
            onClick={() => setCollapsed(c => !c)}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg hover:bg-white/80 text-[10px] font-semibold text-[#777] hover:text-[#111] transition-colors border border-transparent hover:border-[#e8e7e0]"
          >
            {collapsed ? 'Expand' : 'Hide'}
            <ChevronDown
              size={12}
              className="transition-transform"
              style={{ transform: collapsed ? 'rotate(0deg)' : 'rotate(180deg)' }}
            />
          </button>
        </div>

        {/* Body */}
        {!collapsed && (
          <>
            <BankZone courses={plannerState.bank} />
            <div className="flex gap-3 flex-1 min-h-0">
              {YEARS.map(year => (
                <YearGroup
                  key={year.label}
                  year={year}
                  semesters={plannerState.semesters}
                />
              ))}
            </div>
          </>
        )}
      </div>

      <DragOverlay dropAnimation={{ duration: 160, easing: 'ease-out' }}>
        {activeCourse && <CourseChip course={activeCourse} overlay />}
      </DragOverlay>

      {toast && (
        <div className={`fixed bottom-24 right-5 z-[60] px-4 py-2.5 rounded-xl text-[13px] font-medium shadow-2xl pointer-events-none border max-w-sm flex items-start gap-2 ${
          toast.type === 'warning'
            ? 'bg-[#fffbe6] text-[#7a5a00] border-[#FFC300]'
            : 'bg-[#eff6ff] text-[#1e40af] border-[#bfdbfe]'
        }`}>
          <span className="text-[14px] leading-none mt-0.5">
            {toast.type === 'warning' ? '⚠' : 'ℹ'}
          </span>
          <span>
            <span className="font-bold uppercase tracking-wider text-[10px] block mb-0.5 opacity-80">
              {toast.type === 'warning' ? 'Heads up' : 'Note'}
            </span>
            {toast.message}
          </span>
        </div>
      )}
    </DndContext>
  )
}

/* ── Bank: unplaced course chips strip ── */
function BankZone({ courses }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'bank' })
  return (
    <div
      ref={setNodeRef}
      className={`flex items-center gap-2 overflow-x-auto px-3 py-2 rounded-xl min-h-[40px] shrink-0 transition-all border ${
        isOver
          ? 'bg-white border-[#FFC300] shadow-[0_0_0_3px_rgba(255,195,0,0.15)]'
          : 'bg-white/70 border-[#e8e7e0] hover:bg-white'
      }`}
    >
      <div className="flex items-center gap-1.5 shrink-0 pr-2 border-r border-[#e8e7e0]">
        <span className="text-[9px] font-bold uppercase tracking-wider text-[#888]">Unplaced</span>
        {courses.length > 0 && (
          <span className="text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded-full bg-[#fffbe6] text-[#a87a00] border border-[#FFD84D]/60">
            {courses.length}
          </span>
        )}
      </div>
      {courses.length === 0 ? (
        <div className="flex items-center gap-1.5 text-[10px] text-[#9d9a8e] italic px-1">
          <svg width="10" height="10" viewBox="0 0 12 12" fill="none">
            <path d="M2 6l3 3 5-7" stroke="#5fa86b" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          every course placed — your plan is complete
        </div>
      ) : (
        courses.map(c => <CourseChip key={c.id} course={c} />)
      )}
    </div>
  )
}

/* ── Year group: pair of semester columns under a year header ── */
function YearGroup({ year, semesters }) {
  return (
    <div className="flex-1 flex flex-col min-w-0">
      <div className="flex items-baseline justify-between px-1 mb-1.5 shrink-0">
        <span className="text-[10.5px] font-bold text-[#1a1a1a] tracking-tight">{year.label}</span>
        <span className="text-[9px] text-[#aaa] font-semibold tabular-nums tracking-wider">{year.sublabel}</span>
      </div>
      <div className="flex gap-2 flex-1 min-h-0">
        {year.semesters.map(sem => (
          <SemesterColumn key={sem} semester={sem} courses={semesters[sem] ?? []} />
        ))}
      </div>
    </div>
  )
}

/* ── Single semester column ── */
function SemesterColumn({ semester, courses }) {
  const { setNodeRef, isOver } = useDroppable({ id: semester })
  const totalCredits = courses.reduce((s, c) => s + (c.credits ?? 3), 0)
  const isHeavy = totalCredits > 18
  const isLight = totalCredits > 0 && totalCredits < 12
  const [season, year] = semester.split(' ')
  const isFall = season === 'Fall'

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 flex flex-col rounded-xl border transition-all duration-150 min-w-0 ${
        isOver
          ? 'border-[#FFC300] bg-white shadow-[0_0_0_3px_rgba(255,195,0,0.18)] scale-[1.005]'
          : courses.length === 0
          ? 'border-dashed border-[#dfddd2] bg-white/40 hover:bg-white/70 hover:border-[#cfccc1]'
          : 'border-[#e6e4dc] bg-white hover:shadow-sm'
      }`}
    >
      <div className="flex items-center justify-between px-2.5 py-1.5 border-b border-[#f0efe9] shrink-0">
        <div className="flex items-center gap-1.5">
          <span
            className="inline-block w-2 h-2 rounded-full shadow-sm"
            style={{
              background: isFall ? '#c97a3f' : '#5fa86b',
              boxShadow: `0 0 0 2px ${isFall ? '#c97a3f20' : '#5fa86b20'}`,
            }}
          />
          <span className="text-[10.5px] font-bold text-[#1a1a1a] tracking-tight">{season}</span>
          <span className="text-[9.5px] text-[#999] tabular-nums">{year}</span>
        </div>
        {totalCredits > 0 ? (
          <span className={`text-[9px] font-bold tabular-nums px-1.5 py-0.5 rounded ${
            isHeavy
              ? 'text-[#9a1f1f] bg-[#fef2f2] ring-1 ring-[#fecaca]'
              : isLight
              ? 'text-[#7a5a00] bg-[#fffbe6] ring-1 ring-[#FFD84D]/50'
              : 'text-[#5a6f3f] bg-[#f0f6e8] ring-1 ring-[#cfe0b4]/50'
          }`}>
            {totalCredits} cr
          </span>
        ) : (
          <span className="text-[8.5px] text-[#cfccc1] font-bold tracking-[0.12em]">EMPTY</span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-1.5 py-1.5 flex flex-col gap-1 min-h-0">
        {courses.length === 0 ? (
          <EmptyDropHint isOver={isOver} />
        ) : (
          courses.map(c => <CourseChip key={c.id} course={c} compact />)
        )}
      </div>
    </div>
  )
}

function EmptyDropHint({ isOver }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-1 select-none">
      <div className={`w-6 h-6 rounded-md flex items-center justify-center transition-colors ${
        isOver ? 'bg-[#FFC300]/30 text-[#a87a00]' : 'bg-[#f0efe9] text-[#cfccc1]'
      }`}>
        <svg width="11" height="11" viewBox="0 0 12 12" fill="none">
          <path d="M6 2v8M2 6h8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
        </svg>
      </div>
      <p className={`text-[9px] transition-colors ${isOver ? 'text-[#a87a00] font-semibold' : 'text-[#bfbcb1]'}`}>
        {isOver ? 'release to add' : 'drop a course'}
      </p>
    </div>
  )
}

/* ── Course chip (matches MapView's bubble visual language) ── */
function CourseChip({ course, compact, overlay }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: course.id })
  const c = statusColor(course)

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`
        shrink-0 select-none transition-all flex items-center gap-1.5
        ${compact ? 'px-2 py-1 rounded-md' : 'px-2.5 py-1.5 rounded-full'}
        ${isDragging ? 'opacity-30' : 'opacity-100'}
        ${overlay ? 'shadow-2xl scale-110 -rotate-1 z-50' : 'hover:scale-[1.04] hover:shadow-md'}
      `}
      style={{
        background: c.fill,
        border: `1.5px solid ${c.ring}`,
        cursor: isDragging ? 'grabbing' : 'grab',
        boxShadow: overlay ? `0 16px 36px rgba(15,23,42,0.18), 0 0 0 3px ${c.ring}33` : undefined,
      }}
    >
      <span
        className="inline-block rounded-full shrink-0"
        style={{
          width: 6,
          height: 6,
          background: c.ring,
          boxShadow: course.is_bottleneck ? `0 0 0 2px ${c.ring}33` : undefined,
        }}
      />
      <span
        className={`font-mono font-bold leading-none ${compact ? 'text-[10px]' : 'text-[11px]'}`}
        style={{ color: c.text }}
      >
        {course.id}
      </span>
      {!compact && course.spring_only && (
        <span className="text-[8px] font-bold text-[#a87a00] uppercase tracking-wide">SP</span>
      )}
    </div>
  )
}
