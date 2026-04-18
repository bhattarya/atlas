import { useRef } from 'react'
import { Upload, Loader2, ChevronLeft } from 'lucide-react'

export default function TopBar({ onUpload, loading, mapData, onBack }) {
  const auditRef = useRef()
  const transcriptRef = useRef()

  const handleFileSelect = () => {
    const audit = auditRef.current.files[0]
    const transcript = transcriptRef.current?.files[0]
    if (audit) onUpload(audit, transcript ?? null)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    const audit = files.find(f => f.name.toLowerCase().includes('audit')) ?? files[0]
    const transcript = files.find(f => f.name.toLowerCase().includes('transcript'))
    if (audit) onUpload(audit, transcript ?? null)
  }

  return (
    <div
      className="flex items-center justify-between px-5 h-12 bg-black shrink-0"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-3">
        <span className="text-[#FFC300] font-bold text-lg tracking-tight select-none">Atlas</span>
        {mapData && (
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-white font-medium">{mapData.student_name}</span>
            <span className="text-[#444]">·</span>
            <span className="text-[#FFC300]">{mapData.major}</span>
            {mapData.minor && <><span className="text-[#444]">›</span><span className="text-[#aaa]">{mapData.minor}</span></>}
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input ref={auditRef} type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />
        <input ref={transcriptRef} type="file" accept=".pdf" className="hidden" />
        {mapData && (
          <button
            onClick={() => auditRef.current.click()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium text-[#888] hover:text-white transition-colors disabled:opacity-40"
          >
            {loading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
            {loading ? 'Parsing…' : 'New Audit'}
          </button>
        )}
      </div>
    </div>
  )
}
