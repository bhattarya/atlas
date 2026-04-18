import { X, AlertTriangle, CheckCircle, Star, TrendingDown } from 'lucide-react'

export default function CourseDrawer({ course, metadata, onClose }) {
  const statusColor = {
    completed: 'text-[#10b981]',
    in_progress: 'text-[#3b82f6]',
    needed: 'text-[#6b7280]',
  }[course.status] ?? 'text-[#6b7280]'

  const courseProfs = metadata?.profs?.filter(p =>
    p.courses_taught.includes(course.id)
  ) ?? []

  const courseGrades = metadata?.grades?.filter(g =>
    g.course_code === course.id
  ) ?? []

  // Most recent semester first
  const latestGrade = courseGrades[0] ?? null

  return (
    <div className="w-80 bg-[#111827] border-l border-[#1f2937] flex flex-col overflow-y-auto shrink-0">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f2937]">
        <span className="font-mono font-bold text-white">{course.id}</span>
        <button onClick={onClose} className="text-[#6b7280] hover:text-white">
          <X size={18} />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4">

        {/* Title + status */}
        <div>
          <h2 className="text-white font-semibold leading-snug">{course.name}</h2>
          <p className="text-sm text-[#6b7280] mt-1">{course.credits} credits</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`text-sm font-medium flex items-center gap-1 ${statusColor}`}>
            {course.status === 'completed' && <CheckCircle size={14} />}
            {course.is_bottleneck && <AlertTriangle size={14} className="text-[#f59e0b]" />}
            {course.status?.replace('_', ' ')}
          </span>
          {course.spring_only && (
            <span className="text-xs bg-[#451a03] text-[#f59e0b] px-2 py-0.5 rounded-full">
              Spring only
            </span>
          )}
          {course.is_bottleneck && (
            <span className="text-xs bg-[#451a03] text-[#f59e0b] px-2 py-0.5 rounded-full">
              Bottleneck
            </span>
          )}
        </div>

        {/* Prerequisites */}
        {course.prereqs?.length > 0 && (
          <Section title="Prerequisites">
            <ul className="space-y-1">
              {course.prereqs.map(p => (
                <li key={p} className="text-sm font-mono text-[#9ca3af]">{p}</li>
              ))}
            </ul>
          </Section>
        )}

        {/* Open Sections */}
        {course.sections?.length > 0 && (
          <Section title="Open Sections">
            <table className="text-xs w-full">
              <thead>
                <tr className="text-[#6b7280]">
                  <th className="text-left pb-1">Sec</th>
                  <th className="text-left pb-1">Days</th>
                  <th className="text-left pb-1">Time</th>
                  <th className="text-left pb-1">Seats</th>
                </tr>
              </thead>
              <tbody>
                {course.sections.map(s => (
                  <tr key={s.section} className="text-[#9ca3af]">
                    <td>{s.section}</td>
                    <td>{s.days}</td>
                    <td>{s.time}</td>
                    <td className={s.seats === 0 ? 'text-[#6b7280]' : s.seats <= 3 ? 'text-[#ef4444] font-bold' : 'text-[#10b981]'}>
                      {s.seats === 0 ? 'CLOSED' : s.seats}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Professors */}
        {courseProfs.length > 0 && (
          <Section title="Professors">
            <div className="space-y-3">
              {courseProfs.map(prof => (
                <ProfCard key={prof.name} prof={prof} />
              ))}
            </div>
          </Section>
        )}

        {/* Grade Distribution */}
        {latestGrade && (
          <Section title={`Grade Distribution — ${latestGrade.instructor} (${latestGrade.semester})`}>
            <GradeBar distribution={latestGrade.distribution} />
            <div className="flex items-center justify-between mt-2">
              <COrBelowBadge pct={latestGrade.c_or_below_pct} />
              <span className="text-xs text-[#6b7280]">
                {latestGrade.withdraw_rate}% withdraw
              </span>
            </div>
            {courseGrades.length > 1 && (
              <p className="text-xs text-[#6b7280] mt-1">
                Avg over last {courseGrades.length} semesters
              </p>
            )}
          </Section>
        )}

        {/* No metadata available */}
        {courseProfs.length === 0 && !latestGrade && metadata && (
          <p className="text-xs text-[#6b7280] italic">
            No RMP or grade data available for this course.
          </p>
        )}

      </div>
    </div>
  )
}

function ProfCard({ prof }) {
  return (
    <div className="bg-[#1f2937] rounded-lg p-3 space-y-1">
      <p className="text-sm text-white font-medium">{prof.name}</p>
      <div className="flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1 text-[#f59e0b]">
          <Star size={11} />
          {prof.rating}/5.0
        </span>
        <span className="text-[#6b7280]">Difficulty {prof.difficulty}/5.0</span>
      </div>
      <div className="flex items-center gap-1 text-xs">
        <TrendingDown size={11} className={prof.would_take_again_pct < 50 ? 'text-[#ef4444]' : 'text-[#10b981]'} />
        <span className={prof.would_take_again_pct < 50 ? 'text-[#ef4444]' : 'text-[#10b981]'}>
          {prof.would_take_again_pct}% would take again
        </span>
        <span className="text-[#4b5563]">· {prof.ratings_count} ratings</span>
      </div>
      {prof.quote && (
        <p className="text-xs text-[#6b7280] italic leading-relaxed border-t border-[#374151] pt-2 mt-2">
          "{prof.quote}"
        </p>
      )}
    </div>
  )
}

function GradeBar({ distribution }) {
  const GRADE_COLORS = {
    A: '#10b981',
    B: '#3b82f6',
    C: '#f59e0b',
    D: '#f97316',
    F: '#ef4444',
    W: '#6b7280',
  }

  return (
    <div className="space-y-1">
      {Object.entries(distribution).map(([grade, pct]) => (
        <div key={grade} className="flex items-center gap-2">
          <span className="text-xs text-[#6b7280] w-3">{grade}</span>
          <div className="flex-1 bg-[#1f2937] rounded-full h-2">
            <div
              className="h-2 rounded-full transition-all"
              style={{ width: `${pct}%`, backgroundColor: GRADE_COLORS[grade] ?? '#6b7280' }}
            />
          </div>
          <span className="text-xs text-[#6b7280] w-6 text-right">{pct}%</span>
        </div>
      ))}
    </div>
  )
}

function COrBelowBadge({ pct }) {
  const color = pct > 40 ? '#ef4444' : pct > 20 ? '#f59e0b' : '#10b981'
  return (
    <span className="text-xs font-medium" style={{ color }}>
      {pct}% C-or-below
    </span>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-xs text-[#6b7280] uppercase tracking-wider mb-2">{title}</p>
      {children}
    </div>
  )
}
