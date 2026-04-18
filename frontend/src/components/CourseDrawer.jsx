import { X, AlertTriangle, CheckCircle, Clock, Star } from 'lucide-react'

export default function CourseDrawer({ course, onClose }) {
  const statusColor = {
    completed: 'text-[#10b981]',
    in_progress: 'text-[#3b82f6]',
    needed: 'text-[#6b7280]',
    bottleneck: 'text-[#f59e0b]',
  }[course.status] ?? 'text-[#6b7280]'

  return (
    <div className="w-80 bg-[#111827] border-l border-[#1f2937] flex flex-col overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1f2937]">
        <span className="font-mono font-bold text-white">{course.id}</span>
        <button onClick={onClose} className="text-[#6b7280] hover:text-white">
          <X size={18} />
        </button>
      </div>

      <div className="p-4 flex flex-col gap-4">
        <div>
          <h2 className="text-white font-semibold">{course.name}</h2>
          <p className="text-sm text-[#6b7280] mt-1">{course.credits} credits</p>
        </div>

        <div className="flex items-center gap-2">
          <span className={`text-sm font-medium ${statusColor}`}>
            {course.status === 'completed' && <CheckCircle size={14} className="inline mr-1" />}
            {course.is_bottleneck && <AlertTriangle size={14} className="inline mr-1" />}
            {course.status?.replace('_', ' ')}
          </span>
          {course.spring_only && (
            <span className="text-xs bg-[#451a03] text-[#f59e0b] px-2 py-0.5 rounded-full">
              Spring only
            </span>
          )}
        </div>

        {course.prereqs?.length > 0 && (
          <Section title="Prerequisites">
            <ul className="space-y-1">
              {course.prereqs.map(p => (
                <li key={p} className="text-sm font-mono text-[#9ca3af]">{p}</li>
              ))}
            </ul>
          </Section>
        )}

        {course.professor && (
          <Section title="Professor">
            <p className="text-sm text-[#9ca3af]">{course.professor}</p>
            {course.rating && (
              <div className="flex items-center gap-1 mt-1">
                <Star size={12} className="text-[#f59e0b]" />
                <span className="text-xs text-[#f59e0b]">{course.rating}/5</span>
              </div>
            )}
          </Section>
        )}

        {course.avg_grade && (
          <Section title="Avg Grade">
            <p className="text-sm text-[#9ca3af]">{course.avg_grade}</p>
          </Section>
        )}

        {course.description && (
          <Section title="Description">
            <p className="text-sm text-[#9ca3af] leading-relaxed">{course.description}</p>
          </Section>
        )}

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
                    <td className={s.seats <= 3 ? 'text-[#ef4444]' : ''}>{s.seats}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}
      </div>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div>
      <p className="text-xs text-[#6b7280] uppercase tracking-wider mb-1">{title}</p>
      {children}
    </div>
  )
}
