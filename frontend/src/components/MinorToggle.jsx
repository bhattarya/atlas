const MINORS = ['Finance', 'Entrepreneurship']

export default function MinorToggle({ selected, onChange }) {
  return (
    <div className="flex items-center gap-1.5 py-1.5">
      <span className="text-xs text-[#999] mr-1">Minor:</span>
      {MINORS.map(m => (
        <button
          key={m}
          onClick={() => onChange(selected === m ? null : m)}
          className={`px-2.5 py-0.5 rounded-full text-xs font-medium border transition-all ${
            selected === m
              ? 'bg-black text-[#FFC300] border-black'
              : 'bg-white text-[#555] border-[#ddd] hover:border-black hover:text-black'
          }`}
        >
          {m}
        </button>
      ))}
    </div>
  )
}
