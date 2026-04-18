import { useRef } from 'react'
import { Upload, Loader2 } from 'lucide-react'

export default function TopBar({ onUpload, loading, mapData }) {
  const auditRef = useRef()
  const transcriptRef = useRef()

  const handleDrop = (e) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    const audit = files.find(f => f.name.toLowerCase().includes('audit') || files[0])
    const transcript = files.find(f => f.name.toLowerCase().includes('transcript'))
    if (audit) onUpload(audit, transcript || null)
  }

  const handleFileSelect = () => {
    const audit = auditRef.current.files[0]
    const transcript = transcriptRef.current.files[0]
    if (audit) onUpload(audit, transcript || null)
  }

  return (
    <div
      className="flex items-center justify-between px-6 py-3 border-b border-[#1f2937] bg-[#111827]"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      <div className="flex items-center gap-3">
        <span className="text-2xl font-bold tracking-tight text-white">
          Atlas
        </span>
        {mapData && (
          <span className="text-xs text-[#6b7280] font-mono">
            {mapData.student_name} · {mapData.major}
            {mapData.minor ? ` + ${mapData.minor}` : ''}
          </span>
        )}
      </div>
      <div className="flex items-center gap-3">
        <input ref={auditRef} type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />
        <input ref={transcriptRef} type="file" accept=".pdf" className="hidden" />
        <button
          onClick={() => auditRef.current.click()}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-[#3b82f6] hover:bg-[#2563eb] text-white text-sm font-medium transition-colors disabled:opacity-50"
        >
          {loading ? (
            <Loader2 size={16} className="animate-spin" />
          ) : (
            <Upload size={16} />
          )}
          {loading ? 'Parsing…' : 'Drop Audit PDF'}
        </button>
      </div>
    </div>
  )
}
