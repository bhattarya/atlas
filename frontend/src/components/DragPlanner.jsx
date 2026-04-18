import { useState } from 'react'
import { DndContext, DragOverlay, pointerWithin, useDraggable, useDroppable } from '@dnd-kit/core'
import { validatePlacement } from '../lib/api'

const SEMESTERS = ['Fall 2026', 'Spring 2027', 'Fall 2027', 'Spring 2028']

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

export default function DragPlanner({ plannerState, onDrop }) {
  const [activeId, setActiveId] = useState(null)
  const [toast, setToast] = useState(null)

  const activeCourse = activeId ? findCourse(plannerState, activeId) : null

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

    if (target !== 'bank') {
      try {
        const currentPlan = {}
        for (const [sem, courses] of Object.entries(plannerState.semesters)) {
          currentPlan[sem] = courses.map(c => c.id)
        }
        const result = await validatePlacement(courseId, target, currentPlan)
        if (!result.valid) {
          showToast(result.errors[0] || 'Invalid placement')
          return
        }
        if (result.warnings.length > 0) {
          showToast(result.warnings[0], 'warning')
        }
      } catch {
        showToast('Validation unavailable — placing anyway', 'warning')
      }
    }

    onDrop(courseId, source, target, course)
  }

  return (
    <DndContext
      onDragStart={({ active }) => setActiveId(active.id)}
      onDragEnd={handleDragEnd}
      collisionDetection={pointerWithin}
    >
      <div className="shrink-0 bg-[#0d0d0d] border-t border-[#1a1a1a] px-5 pt-3 pb-4 flex flex-col gap-2" style={{ height: '255px' }}>
        <div className="flex items-center justify-between">
          <p className="text-[10px] font-bold text-[#555] uppercase tracking-widest">4-Year Planner</p>
          <p className="text-[9px] text-[#333]">drag courses into semesters · drops are validated</p>
        </div>

        <BankZone courses={plannerState.bank} />

        <div className="flex gap-2 flex-1 min-h-0">
          {SEMESTERS.map(sem => (
            <SemesterColumn
              key={sem}
              semester={sem}
              courses={plannerState.semesters[sem]}
            />
          ))}
        </div>
      </div>

      <DragOverlay dropAnimation={{ duration: 160, easing: 'ease-out' }}>
        {activeCourse && <CourseCard course={activeCourse} overlay />}
      </DragOverlay>

      {toast && (
        <div className={`fixed bottom-20 right-5 z-[60] px-4 py-2.5 rounded-lg text-sm font-medium shadow-2xl pointer-events-none ${
          toast.type === 'warning' ? 'bg-[#f59e0b] text-black' : 'bg-[#ef4444] text-white'
        }`}>
          {toast.message}
        </div>
      )}
    </DndContext>
  )
}

function BankZone({ courses }) {
  const { setNodeRef, isOver } = useDroppable({ id: 'bank' })
  return (
    <div
      ref={setNodeRef}
      className={`flex gap-1.5 overflow-x-auto px-2 py-1.5 rounded-lg min-h-[38px] transition-colors shrink-0 ${
        isOver ? 'bg-[#1a1a1a] ring-1 ring-[#06b6d4]/50' : 'bg-[#111]'
      }`}
    >
      {courses.length === 0 && (
        <p className="text-[9px] text-[#2a2a2a] self-center pl-1 italic">all courses placed</p>
      )}
      {courses.map(c => <CourseCard key={c.id} course={c} />)}
    </div>
  )
}

function SemesterColumn({ semester, courses }) {
  const { setNodeRef, isOver } = useDroppable({ id: semester })
  const isSpring = semester.toLowerCase().includes('spring')
  const totalCredits = courses.reduce((s, c) => s + (c.credits ?? 3), 0)
  const isHeavy = totalCredits > 19.5

  return (
    <div
      ref={setNodeRef}
      className={`flex-1 flex flex-col rounded-lg border transition-all duration-150 ${
        isOver
          ? 'border-[#06b6d4] bg-[#071518] shadow-[0_0_14px_rgba(6,182,212,0.12)]'
          : 'border-[#1f1f1f] bg-[#111]'
      }`}
    >
      <div className="flex items-center justify-between px-2.5 pt-1.5 pb-1 border-b border-[#1a1a1a] shrink-0">
        <span className="text-[9px] font-bold text-[#444]">{semester}</span>
        {totalCredits > 0 && (
          <span className={`text-[8px] font-semibold ${isHeavy ? 'text-[#ec4899]' : 'text-[#333]'}`}>
            {totalCredits} cr{isHeavy ? ' !' : ''}
          </span>
        )}
      </div>
      <div className="flex-1 overflow-y-auto px-1.5 py-1 flex flex-col gap-1 min-h-0">
        {courses.map(c => <CourseCard key={c.id} course={c} compact />)}
      </div>
    </div>
  )
}

function CourseCard({ course, compact, overlay }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({ id: course.id })

  const isBottleneck = course.is_bottleneck
  const isSpringOnly = course.spring_only && !isBottleneck

  return (
    <div
      ref={setNodeRef}
      {...listeners}
      {...attributes}
      className={`
        shrink-0 rounded cursor-grab active:cursor-grabbing select-none transition-opacity
        ${compact ? 'px-2 py-0.5' : 'px-2.5 py-1.5'}
        ${isDragging ? 'opacity-25' : 'opacity-100'}
        ${overlay ? 'shadow-2xl ring-1 ring-[#06b6d4]/70 rotate-1 scale-105' : ''}
        ${isBottleneck
          ? 'bg-[#1f0a0a] border border-[#ef4444]/30 text-[#f87171]'
          : isSpringOnly
          ? 'bg-[#161100] border border-[#FFC300]/25 text-[#FFC300]'
          : 'bg-[#1a1a1a] border border-[#252525] text-[#aaa]'
        }
      `}
    >
      <p className={`font-mono font-bold leading-none ${compact ? 'text-[8px]' : 'text-[10px]'}`}>
        {course.id}
      </p>
      {!compact && course.name && (
        <p className="text-[8px] text-[#555] mt-0.5 leading-none truncate max-w-[90px]">
          {course.name}
        </p>
      )}
    </div>
  )
}
