import { useRef } from 'react'
import { Upload, Loader2, GraduationCap } from 'lucide-react'

export default function TopBar({ onUpload, loading, mapData }) {
  const auditRef = useRef()

  const handleFileSelect = () => {
    const audit = auditRef.current.files[0]
    if (audit) onUpload(audit, null)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    const audit = files.find(f => f.name.toLowerCase().includes('audit')) ?? files[0]
    const transcript = files.find(f => f.name.toLowerCase().includes('transcript'))
    if (audit) onUpload(audit, transcript ?? null)
  }

  return (
    <header
      className="grid bg-black border-b border-[#1c1c1c] shrink-0 px-6"
      style={{ height: '52px', gridTemplateColumns: '1fr auto 1fr' }}
      onDragOver={(e) => e.preventDefault()}
      onDrop={handleDrop}
    >
      {/* Left — Logo */}
      <div className="flex items-center">
        <div className="flex items-center gap-2.5 select-none">
          <div className="w-7 h-7 bg-[#FFC300] rounded-lg flex items-center justify-center">
            <GraduationCap size={14} className="text-black" strokeWidth={2.5} />
          </div>
          <span className="text-white font-bold text-[15px] tracking-tight">Atlas</span>
        </div>
      </div>

      {/* Center — Student context */}
      <div className="flex items-center justify-center gap-2.5">
        {mapData ? (
          <>
            <span className="text-[13px] text-[#999] font-medium">{mapData.student_name}</span>
            <span className="w-1 h-1 rounded-full bg-[#333]" />
            <span className="px-2 py-0.5 rounded-md bg-[#FFC300]/10 border border-[#FFC300]/20 text-[#FFC300] text-[11px] font-semibold tracking-wide">
              {mapData.major}
            </span>
            {mapData.minor && (
              <span className="px-2 py-0.5 rounded-md bg-[#ffffff05] border border-[#252525] text-[#444] text-[11px] font-medium">
                {mapData.minor}
              </span>
            )}
          </>
        ) : (
          <span className="text-[11px] text-[#333] font-medium tracking-widest uppercase select-none">
            UMBC COEIT
          </span>
        )}
      </div>

      {/* Right — Action */}
      <div className="flex items-center justify-end">
        <input ref={auditRef} type="file" accept=".pdf" className="hidden" onChange={handleFileSelect} />

        {mapData || loading ? (
          <button
            onClick={() => auditRef.current.click()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-semibold border border-[#252525] bg-[#111] text-[#555] hover:text-white hover:border-[#383838] hover:bg-[#181818] transition-all disabled:opacity-40"
          >
            {loading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
            {loading ? 'Parsing…' : 'New Audit'}
          </button>
        ) : (
          <button
            onClick={() => auditRef.current.click()}
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-[12px] font-bold bg-[#FFC300] hover:bg-[#FFD340] text-black transition-all"
          >
            <Upload size={11} />
            Upload Audit
          </button>
        )}
      </div>
    </header>
  )
}
