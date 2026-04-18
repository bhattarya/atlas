const MINORS = ['Finance', 'Entrepreneurship']

export default function MinorToggle({ selected, onChange }) {
  return (
    <div className="flex items-center gap-2 px-6 py-2 bg-[#111827] border-b border-[#1f2937]">
      <span className="text-xs text-[#6b7280]">Add minor:</span>
      {MINORS.map(m => (
        <button
          key={m}
          onClick={() => onChange(selected === m ? null : m)}
          className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
            selected === m
              ? 'bg-[#3b82f6] text-white'
              : 'bg-[#1f2937] text-[#9ca3af] hover:bg-[#374151]'
          }`}
        >
          {m}
        </button>
      ))}
      {selected && (
        <button
          onClick={() => onChange(null)}
          className="px-3 py-1 rounded-full text-xs font-medium bg-transparent text-[#6b7280] hover:text-white"
        >
          Clear
        </button>
      )}
    </div>
  )
}
