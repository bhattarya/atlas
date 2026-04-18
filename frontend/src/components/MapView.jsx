import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { Loader2 } from 'lucide-react'

const R = 34
const COL_GAP = 180
const ROW_GAP = 100
const PAD = 70
const MAX_PER_COL = 5   // wrap to next column after this many nodes

export default function MapView({ mapData, loading, onCourseSelect, selectedId }) {
  const { nodes, edges, graphW, graphH } = useMemo(() => buildGraph(mapData), [mapData])

  const [transform, setTransform] = useState({ scale: 1, tx: 0, ty: 0 })
  const dragging = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const containerRef = useRef()
  const fitScale = useRef(1)

  // Auto-fit graph to container on first render / when data changes
  useEffect(() => {
    if (!mapData || !containerRef.current) return
    const { width, height } = containerRef.current.getBoundingClientRect()
    const scaleX = (width - PAD * 2) / graphW
    const scaleY = (height - PAD * 2) / graphH
    const scale = Math.min(scaleX, scaleY, 1) // never scale up past 100%
    fitScale.current = scale
    // Center the graph
    const tx = (width - graphW * scale) / 2
    const ty = (height - graphH * scale) / 2
    setTransform({ scale, tx, ty })
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
      return {
        scale: newScale,
        tx: mx - ratio * (mx - prev.tx),
        ty: my - ratio * (my - prev.ty),
      }
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
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#f7f6f1] select-none">
        <div className="w-14 h-14 rounded-full bg-[#FFC300]/20 flex items-center justify-center text-2xl">🗺</div>
        <p className="text-sm font-medium text-[#333]">Drop your degree audit PDF to begin</p>
        <p className="text-xs text-[#999]">Supports CS, IS, CE · Finance / Entrepreneurship minors</p>
      </div>
    )
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
            <CourseNode
              key={node.id}
              node={node}
              selected={selectedId === node.id}
              onClick={() => onCourseSelect(node)}
            />
          ))}
        </g>
      </svg>
    </div>
  )
}

function CourseNode({ node, selected, onClick }) {
  let fill = '#ffffff', stroke = '#d0cfc8', strokeWidth = 1.5
  let textColor = '#333333', subColor = '#999999'

  if (node.status === 'completed') {
    fill = '#FFC300'; stroke = '#CC9C00'; strokeWidth = 0
    textColor = '#000000'; subColor = '#7a6200'
  } else if (node.planned_semester) {
    fill = '#f0fdf4'; stroke = '#10b981'; strokeWidth = 2
    textColor = '#065f46'; subColor = '#166534'
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
    } else if (!line1) {
      line1 = cur; cur = w
    } else {
      line2 = (cur + ' ' + w).trim(); cur = ''; break
    }
  }
  if (!line1) line1 = cur
  else if (!line2 && cur) line2 = cur
  if (line2.length > 13) line2 = line2.slice(0, 12) + '…'

  return (
    <g
      className="course-node"
      transform={`translate(${node.x},${node.y})`}
      onClick={onClick}
      filter={node.is_bottleneck && !selected ? 'url(#gold-glow)' : undefined}
    >
      {selected && <circle r={R + 5} fill="none" stroke="#000" strokeWidth="1.5" opacity="0.12" />}
      <circle r={R} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />

      {node.is_bottleneck && (
        <circle cx={R - 7} cy={-(R - 7)} r={6} fill="#f59e0b" stroke="white" strokeWidth="1.5" />
      )}
      {node.spring_only && !node.is_bottleneck && (
        <circle cx={R - 7} cy={-(R - 7)} r={5} fill="#FFC300" stroke="white" strokeWidth="1.5" />
      )}

      <text y={line2 ? -9 : -3} textAnchor="middle" fill={textColor}
        fontSize={10} fontWeight="700" fontFamily="Inter, system-ui, sans-serif">
        {node.id}
      </text>
      {line1 && (
        <text y={line2 ? 4 : 9} textAnchor="middle" fill={subColor}
          fontSize={7.5} fontFamily="Inter, system-ui, sans-serif">{line1}</text>
      )}
      {line2 && (
        <text y={15} textAnchor="middle" fill={subColor}
          fontSize={7.5} fontFamily="Inter, system-ui, sans-serif">{line2}</text>
      )}
    </g>
  )
}

function buildGraph(mapData) {
  if (!mapData?.courses) return { nodes: [], edges: [], graphW: 800, graphH: 600 }

  const courses = mapData.courses

  // Group by prereq depth level
  const levelMap = {}
  courses.forEach(c => {
    const num = parseInt((c.id ?? '').replace(/\D/g, '') || '0')
    const lvl = c.level ?? Math.floor(num / 100)
    if (!levelMap[lvl]) levelMap[lvl] = []
    levelMap[lvl].push(c)
  })

  const levels = Object.keys(levelMap).sort()

  // Flatten all courses into columns, wrapping at MAX_PER_COL
  const columns = []
  levels.forEach(lvl => {
    const group = levelMap[lvl]
    for (let i = 0; i < group.length; i += MAX_PER_COL) {
      columns.push(group.slice(i, i + MAX_PER_COL))
    }
  })

  const nodes = []
  const posMap = {}

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
      const src = posMap[preId]
      const dst = posMap[c.id]
      if (!src || !dst) return
      const x1 = src.x + R, y1 = src.y
      const x2 = dst.x - R - 1, y2 = dst.y
      const cpx = x1 + (x2 - x1) * 0.5
      edges.push({ path: `M${x1},${y1} C${cpx},${y1} ${cpx},${y2} ${x2},${y2}` })
    })
  })

  const graphW = columns.length * COL_GAP + R * 2
  const graphH = Math.max(...columns.map(c => c.length)) * ROW_GAP + R * 2

  return { nodes, edges, graphW, graphH }
}
