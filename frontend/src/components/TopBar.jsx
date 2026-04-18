import { useRef } from 'react'
import { Upload, Loader2 } from 'lucide-react'

export default function TopBar({ onUpload, loading, mapData }) {
  const auditRef = useRef()
  const transcriptRef = useRef()

  const handleDrop = (e) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    const audit = files.find(f => f.name.toLowerCase().includes('audit')) ?? files[0]
    const transcript = files.find(f => f.name.toLowerCase().includes('transcript'))
    if (audit) onUpload(audit, transcript ?? null)
  }

  const handleFileSelect = () => {
    const audit = auditRef.current.files[0]
    const transcript = transcriptRef.current?.files[0]
    if (audit) onUpload(audit, transcript ?? null)
  }

  return (
    <div
      className="flex items-center justify-between px-5 h-12 bg-black shrink-0"
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Brand */}
      <div className="flex items-center gap-3">
        <span className="text-[#FFC300] font-bold text-lg tracking-tight select-none">
          Atlas
        </span>
        {mapData && (
          <div className="flex items-center gap-1.5 text-xs text-[#888]">
            <span className="text-white font-medium">{mapData.student_name}</span>
            <span className="text-[#555]">·</span>
            <span className="text-[#FFC300]">{mapData.major}</span>
            {mapData.minor && (
              <>
                <span className="text-[#555]">+</span>
                <span className="text-[#aaa]">{mapData.minor}</span>
              </>
            )}
          </div>
        )}
      </div>

      {/* Upload */}
      <div className="flex items-center gap-2">
        <input ref={auditRef} type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />
        <input ref={transcriptRef} type="file" accept=".pdf" className="hidden" />
        <button
          onClick={() => auditRef.current.click()}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-semibold border border-[#FFC300] text-[#FFC300] hover:bg-[#FFC300] hover:text-black transition-colors disabled:opacity-40"
        >
          {loading ? <Loader2 size={13} className="animate-spin" /> : <Upload size={13} />}
          {loading ? 'Parsing…' : 'Upload Audit'}
        </button>
      </div>
    </div>
  )
}
