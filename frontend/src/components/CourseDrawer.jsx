import { X, AlertTriangle, CheckCircle, Star, TrendingDown } from 'lucide-react'

export default function CourseDrawer({ course, metadata, onClose }) {
  const courseProfs = metadata?.profs?.filter(p => p.courses_taught?.includes(course.id)) ?? []
  const courseGrades = metadata?.grades?.filter(g => g.course_code === course.id) ?? []
  const latestGrade = courseGrades[0] ?? null

  const statusLabel = { completed: 'Completed', in_progress: 'In Progress', needed: 'Needed' }[course.status] ?? course.status
  const statusColor = { completed: 'text-[#CC9C00]', in_progress: 'text-[#555]', needed: 'text-[#999]' }[course.status] ?? 'text-[#999]'

  return (
    <div className="w-[300px] shrink-0 bg-white border-l border-[#e8e7e0] flex flex-col overflow-y-auto shadow-panel">
      {/* Header */}
      <div className="flex items-start justify-between px-5 pt-5 pb-3 border-b border-[#f0efe9]">
        <div>
          <span className="text-xs font-mono font-bold text-[#FFC300] bg-black px-2 py-0.5 rounded">
            {course.id}
          </span>
          <h2 className="mt-2 text-sm font-semibold text-[#111] leading-snug">{course.name}</h2>
          <p className="text-xs text-[#999] mt-0.5">{course.credits} credits</p>
        </div>
        <button onClick={onClose} className="text-[#bbb] hover:text-[#333] mt-0.5 ml-3 shrink-0">
          <X size={16} />
        </button>
      </div>

      <div className="p-5 flex flex-col gap-5">

        {/* Status badges */}
        <div className="flex flex-wrap gap-1.5">
          <Badge
            icon={course.status === 'completed' ? <CheckCircle size={11} /> : null}
            label={statusLabel}
            className={`${statusColor} bg-[#f7f6f1] border border-[#e8e7e0]`}
          />
          {course.spring_only && (
            <Badge label="Spring only" className="text-amber-700 bg-amber-50 border border-amber-200" />
          )}
          {course.is_bottleneck && (
            <Badge
              icon={<AlertTriangle size={11} />}
              label="Bottleneck"
              className="text-red-600 bg-red-50 border border-red-200"
            />
          )}
        </div>

        {/* Prereqs */}
        {course.prereqs?.length > 0 && (
          <Section title="Prerequisites">
            <div className="flex flex-wrap gap-1.5">
              {course.prereqs.map(p => (
                <span key={p} className="text-xs font-mono bg-[#f0efe9] text-[#555] px-2 py-0.5 rounded">
                  {p}
                </span>
              ))}
            </div>
          </Section>
        )}

        {/* Sections */}
        {course.sections?.length > 0 && (
          <Section title="Open Sections">
            <div className="space-y-2">
              {course.sections.map(s => (
                <div key={s.section} className="flex items-center justify-between text-xs bg-[#f7f6f1] rounded-lg px-3 py-2">
                  <div>
                    <span className="font-semibold text-[#111]">Sec {s.section}</span>
                    <span className="text-[#999] ml-2">{s.days} · {s.time}</span>
                  </div>
                  <span className={`font-bold ${s.seats === 0 ? 'text-[#bbb]' : s.seats <= 3 ? 'text-red-600' : 'text-[#111]'}`}>
                    {s.seats === 0 ? 'CLOSED' : `${s.seats} left`}
                  </span>
                </div>
              ))}
            </div>
          </Section>
        )}

        {/* Professors */}
        {courseProfs.length > 0 && (
          <Section title="Professors">
            <div className="space-y-2">
              {courseProfs.map(prof => <ProfCard key={prof.name} prof={prof} />)}
            </div>
          </Section>
        )}

        {/* Grade distribution */}
        {latestGrade && (
          <Section title={`Grades · ${latestGrade.instructor} (${latestGrade.semester})`}>
            <GradeBar distribution={latestGrade.distribution} />
            <div className="flex items-center justify-between mt-2 text-xs">
              <span className={latestGrade.c_or_below_pct > 40 ? 'text-red-600 font-medium' : latestGrade.c_or_below_pct > 20 ? 'text-amber-600' : 'text-green-600'}>
                {latestGrade.c_or_below_pct}% C or below
              </span>
              <span className="text-[#999]">{latestGrade.withdraw_rate}% withdrew</span>
            </div>
          </Section>
        )}

        {courseProfs.length === 0 && !latestGrade && metadata && (
          <p className="text-xs text-[#bbb] italic">No RMP or grade data available.</p>
        )}
      </div>
    </div>
  )
}

function Badge({ icon, label, className }) {
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${className}`}>
      {icon}
      {label}
    </span>
  )
}

function ProfCard({ prof }) {
  return (
    <div className="bg-[#f7f6f1] rounded-lg p-3 space-y-1">
      <p className="text-xs font-semibold text-[#111]">{prof.name}</p>
      <div className="flex items-center gap-3 text-xs">
        <span className="flex items-center gap-1 text-[#CC9C00] font-medium">
          <Star size={10} fill="#CC9C00" />
          {prof.rating}/5
        </span>
        <span className="text-[#999]">Difficulty {prof.difficulty}/5</span>
      </div>
      {prof.would_take_again_pct !== undefined && (
        <div className="flex items-center gap-1 text-xs">
          <TrendingDown size={10} className={prof.would_take_again_pct < 50 ? 'text-red-500' : 'text-green-600'} />
          <span className={prof.would_take_again_pct < 50 ? 'text-red-600' : 'text-green-700'}>
            {prof.would_take_again_pct}% would take again
          </span>
        </div>
      )}
      {prof.quote && (
        <p className="text-xs text-[#999] italic leading-relaxed border-t border-[#e8e7e0] pt-2 mt-1">
          "{prof.quote}"
        </p>
      )}
    </div>
  )
}

function GradeBar({ distribution }) {
  const COLORS = { A: '#FFC300', B: '#111111', C: '#f59e0b', D: '#f97316', F: '#ef4444', W: '#ccc' }
  return (
    <div className="space-y-1.5">
      {Object.entries(distribution).map(([grade, pct]) => (
        <div key={grade} className="flex items-center gap-2">
          <span className="text-xs text-[#999] w-3">{grade}</span>
          <div className="flex-1 bg-[#f0efe9] rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full"
              style={{ width: `${pct}%`, backgroundColor: COLORS[grade] ?? '#999' }}
            />
          </div>
          <span className="text-xs text-[#999] w-7 text-right">{pct}%</span>
        </div>
      ))}
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-[#bbb] uppercase tracking-widest mb-2">{title}</p>
      {children}
    </div>
  )
}
