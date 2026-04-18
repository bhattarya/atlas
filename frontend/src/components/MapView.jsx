import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { Loader2, Upload } from 'lucide-react'

const R = 34
const COL_GAP = 180
const ROW_GAP = 100
const PAD = 70
const MAX_PER_COL = 5

export default function MapView({ mapData, loading, onCourseSelect, selectedId, onUpload }) {
  const { nodes, edges, graphW, graphH } = useMemo(() => buildGraph(mapData), [mapData])

  const [transform, setTransform] = useState({ scale: 1, tx: 0, ty: 0 })
  const dragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const containerRef = useRef()
  const fitScale = useRef(1)

  useEffect(() => {
    if (!mapData || !containerRef.current) return
    const { width, height } = containerRef.current.getBoundingClientRect()
    const scale = Math.min((width - PAD * 2) / graphW, (height - PAD * 2) / graphH, 1)
    fitScale.current = scale
    setTransform({ scale, tx: (width - graphW * scale) / 2, ty: (height - graphH * scale) / 2 })
  }, [mapData, graphW, graphH])

  const clampScale = (s) => Math.min(Math.max(s, fitScale.current), fitScale.current * 4)

  const onWheel = useCallback((e) => {
    e.preventDefault()
    const rect = containerRef.current.getBoundingClientRect()
    const mx = e.clientX - rect.left
    const my = e.clientY - rect.top
    const delta = e.deltaY > 0 ? 0.88 : 1.14
    setTransform(prev => {
      const newScale = clampScale(prev.scale * delta)
      const ratio = newScale / prev.scale
      return { scale: newScale, tx: mx - ratio * (mx - prev.tx), ty: my - ratio * (my - prev.ty) }
    })
  }, [])

  const onMouseDown = useCallback((e) => {
    if (e.button !== 0) return
    dragging.current = true
    lastPos.current = { x: e.clientX, y: e.clientY }
    containerRef.current.style.cursor = 'grabbing'
  }, [])

  const onMouseMove = useCallback((e) => {
    if (!dragging.current) return
    const dx = e.clientX - lastPos.current.x
    const dy = e.clientY - lastPos.current.y
    lastPos.current = { x: e.clientX, y: e.clientY }
    setTransform(prev => ({ ...prev, tx: prev.tx + dx, ty: prev.ty + dy }))
  }, [])

  const stopDrag = useCallback((e) => {
    dragging.current = false
    if (containerRef.current) containerRef.current.style.cursor = 'grab'
  }, [])

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#f7f6f1]">
        <Loader2 size={28} className="animate-spin text-[#FFC300]" />
        <p className="text-sm text-[#888]">Parsing audit with Gemini…</p>
      </div>
    )
  }

  if (!mapData) {
    return <UploadZone onUpload={onUpload} />
  }

  return (
    <div className="flex-1 relative overflow-hidden bg-[#f7f6f1]">
      <svg
        ref={containerRef}
        width="100%"
        height="100%"
        style={{ cursor: 'grab', userSelect: 'none' }}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={stopDrag}
        onMouseLeave={stopDrag}
      >
        <defs>
          <marker id="arrowhead" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto">
            <path d="M0,0 L0,6 L6,3 z" fill="#c8c6be" />
          </marker>
          <filter id="gold-glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>
        <g transform={`translate(${transform.tx},${transform.ty}) scale(${transform.scale})`}>
          {edges.map((e, i) => (
            <path key={i} d={e.path} fill="none" stroke="#d0cfc8" strokeWidth="1.5" markerEnd="url(#arrowhead)" />
          ))}
          {nodes.map(node => (
            <CourseNode key={node.id} node={node} selected={selectedId === node.id} onClick={() => onCourseSelect(node)} />
          ))}
        </g>
      </svg>
    </div>
  )
}

function UploadZone({ onUpload }) {
  const auditRef = useRef()
  const transcriptRef = useRef()
  const [draggingOver, setDraggingOver] = useState(false)

  const handleFiles = (files) => {
    const audit = files.find(f => f.name.toLowerCase().includes('audit')) ?? files[0]
    const transcript = files.find(f => f.name.toLowerCase().includes('transcript'))
    if (audit && onUpload) onUpload(audit, transcript ?? null)
  }

  return (
    <div className="flex-1 relative overflow-hidden bg-[#f7f6f1] flex items-center justify-center">
      {/* Background blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute top-[5%] left-[10%] w-80 h-80 rounded-full bg-[#FFC300]/20 blur-[90px]" />
        <div className="absolute bottom-[10%] right-[10%] w-72 h-72 rounded-full bg-[#FFC300]/15 blur-[80px]" />
        <div className="absolute top-[40%] right-[30%] w-48 h-48 rounded-full bg-black/4 blur-[60px]" />
      </div>

      <div className="relative z-10 flex flex-col items-center gap-8 px-6 max-w-lg w-full text-center">
        {/* Drop zone card */}
        <input ref={auditRef} type="file" accept=".pdf" className="hidden"
          onChange={() => handleFiles(Array.from(auditRef.current.files))} />
        <input ref={transcriptRef} type="file" accept=".pdf" className="hidden" />

        <div
          onClick={() => auditRef.current.click()}
          onDragOver={(e) => { e.preventDefault(); setDraggingOver(true) }}
          onDragLeave={() => setDraggingOver(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDraggingOver(false)
            handleFiles(Array.from(e.dataTransfer.files))
          }}
          className={`w-full cursor-pointer rounded-2xl border-2 border-dashed px-10 py-14 flex flex-col items-center gap-4 transition-all ${
            draggingOver
              ? 'border-[#FFC300] bg-[#FFC300]/10 scale-[1.01]'
              : 'border-[#d8d7d0] bg-white/60 hover:border-[#FFC300] hover:bg-[#FFC300]/5'
          } backdrop-blur-sm`}
        >
          <div className={`w-14 h-14 rounded-full flex items-center justify-center transition-colors ${
            draggingOver ? 'bg-[#FFC300]' : 'bg-[#f0efe9]'
          }`}>
            <Upload size={22} className={draggingOver ? 'text-black' : 'text-[#999]'} />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#111]">
              {draggingOver ? 'Drop to parse' : 'Drop your degree audit PDF'}
            </p>
            <p className="text-xs text-[#999] mt-1">or click to browse · also accepts unofficial transcript</p>
          </div>
          <span className="text-xs text-[#bbb] bg-[#f7f6f1] border border-[#e8e7e0] px-3 py-1 rounded-full">
            Parsed by Gemini · stays on your machine
          </span>
        </div>

        {/* Supported majors */}
        <div className="flex items-center gap-2 flex-wrap justify-center">
          <span className="text-[10px] text-[#bbb] uppercase tracking-widest">Works for</span>
          {['CS', 'IS', 'CE', 'EE', '+ Finance', '+ Entrepreneurship'].map(m => (
            <span key={m} className="text-xs text-[#888] bg-white border border-[#e8e7e0] px-2.5 py-0.5 rounded-full">
              {m}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

function CourseNode({ node, selected, onClick }) {
  let fill = '#ffffff', stroke = '#d0cfc8', strokeWidth = 1.5
  let textColor = '#333333', subColor = '#999999'

  if (node.status === 'completed') {
    fill = '#FFC300'; stroke = '#CC9C00'; strokeWidth = 0
    textColor = '#000000'; subColor = '#7a6200'
  } else if (node.status === 'in_progress') {
    fill = '#fffbea'; stroke = '#FFC300'; strokeWidth = 2.5; textColor = '#111111'
  } else if (node.is_bottleneck) {
    fill = '#fff5f5'; stroke = '#f87171'; strokeWidth = 2
  }
  if (selected) { stroke = '#000000'; strokeWidth = 2.5 }

  const words = (node.name ?? '').split(' ')
  let line1 = '', line2 = '', cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length <= 11) {
      cur = (cur + ' ' + w).trim()
    } else if (!line1) { line1 = cur; cur = w }
    else { line2 = (cur + ' ' + w).trim(); cur = ''; break }
  }
  if (!line1) line1 = cur
  else if (!line2 && cur) line2 = cur
  if (line2.length > 13) line2 = line2.slice(0, 12) + '…'

  return (
    <g className="course-node" transform={`translate(${node.x},${node.y})`} onClick={onClick}
      filter={node.is_bottleneck && !selected ? 'url(#gold-glow)' : undefined}>
      {selected && <circle r={R + 5} fill="none" stroke="#000" strokeWidth="1.5" opacity="0.12" />}
      <circle r={R} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />
      {node.is_bottleneck && <circle cx={R - 7} cy={-(R - 7)} r={6} fill="#f59e0b" stroke="white" strokeWidth="1.5" />}
      {node.spring_only && !node.is_bottleneck && <circle cx={R - 7} cy={-(R - 7)} r={5} fill="#FFC300" stroke="white" strokeWidth="1.5" />}
      <text y={line2 ? -9 : -3} textAnchor="middle" fill={textColor} fontSize={10} fontWeight="700" fontFamily="Inter, system-ui, sans-serif">{node.id}</text>
      {line1 && <text y={line2 ? 4 : 9} textAnchor="middle" fill={subColor} fontSize={7.5} fontFamily="Inter, system-ui, sans-serif">{line1}</text>}
      {line2 && <text y={15} textAnchor="middle" fill={subColor} fontSize={7.5} fontFamily="Inter, system-ui, sans-serif">{line2}</text>}
    </g>
  )
}

function buildGraph(mapData) {
  if (!mapData?.courses) return { nodes: [], edges: [], graphW: 800, graphH: 600 }
  const courses = mapData.courses
  const levelMap = {}
  courses.forEach(c => {
    const num = parseInt((c.id ?? '').replace(/\D/g, '') || '0')
    const lvl = c.level ?? Math.floor(num / 100)
    if (!levelMap[lvl]) levelMap[lvl] = []
    levelMap[lvl].push(c)
  })
  const levels = Object.keys(levelMap).sort()
  const columns = []
  levels.forEach(lvl => {
    const group = levelMap[lvl]
    for (let i = 0; i < group.length; i += MAX_PER_COL) columns.push(group.slice(i, i + MAX_PER_COL))
  })
  const nodes = [], posMap = {}
  columns.forEach((col, colIdx) => {
    col.forEach((c, rowIdx) => {
      const cx = PAD + R + colIdx * COL_GAP
      const cy = PAD + R + rowIdx * ROW_GAP
      nodes.push({ ...c, x: cx, y: cy })
      posMap[c.id] = { x: cx, y: cy }
    })
  })
  const edges = []
  courses.forEach(c => {
    ;(c.prereqs ?? []).forEach(preId => {
      const src = posMap[preId], dst = posMap[c.id]
      if (!src || !dst) return
      const x1 = src.x + R, y1 = src.y, x2 = dst.x - R - 1, y2 = dst.y
      const cpx = x1 + (x2 - x1) * 0.5
      edges.push({ path: `M${x1},${y1} C${cpx},${y1} ${cpx},${y2} ${x2},${y2}` })
    })
  })
  const graphW = columns.length * COL_GAP + R * 2
  const graphH = Math.max(...columns.map(c => c.length)) * ROW_GAP + R * 2
  return { nodes, edges, graphW, graphH }
}
