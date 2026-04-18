import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'

const R = 46          // node radius
const COL_GAP = 220   // horizontal distance between column centers
const ROW_GAP = 120   // vertical distance between row centers
const PAD = 80        // canvas padding

export default function MapView({ mapData, loading, onCourseSelect, selectedId }) {
  const { nodes, edges, viewBox } = useMemo(() => buildGraph(mapData), [mapData])

  if (loading) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#f7f6f1]">
        <Loader2 size={32} className="animate-spin text-[#FFC300]" />
        <p className="text-sm text-[#888]">Parsing audit with Gemini…</p>
      </div>
    )
  }

  if (!mapData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-3 bg-[#f7f6f1] select-none">
        <div className="w-16 h-16 rounded-full bg-[#FFC300]/20 flex items-center justify-center">
          <span className="text-3xl">🗺</span>
        </div>
        <p className="text-base font-medium text-[#333]">Drop your degree audit PDF to begin</p>
        <p className="text-sm text-[#999]">Supports CS, IS, CE · Finance / Entrepreneurship minors</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto bg-[#f7f6f1]">
      <svg
        viewBox={viewBox}
        width="100%"
        style={{ minHeight: '100%', minWidth: '600px' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <marker id="arrowhead" markerWidth="7" markerHeight="7" refX="6" refY="3.5" orient="auto">
            <path d="M0,0 L0,7 L7,3.5 z" fill="#c8c6be" />
          </marker>
          {/* Gold glow for bottleneck */}
          <filter id="gold-glow" x="-40%" y="-40%" width="180%" height="180%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Edges first (behind nodes) */}
        {edges.map((e, i) => (
          <path
            key={i}
            d={e.path}
            fill="none"
            stroke="#d0cfc8"
            strokeWidth="1.5"
            markerEnd="url(#arrowhead)"
          />
        ))}

        {/* Nodes */}
        {nodes.map(node => (
          <CourseNode
            key={node.id}
            node={node}
            selected={selectedId === node.id}
            onClick={() => onCourseSelect(node)}
          />
        ))}
      </svg>
    </div>
  )
}

function CourseNode({ node, selected, onClick }) {
  const cx = node.x
  const cy = node.y

  // Fill & stroke based on status
  let fill = '#ffffff'
  let stroke = '#d0cfc8'
  let strokeWidth = 1.5
  let textColor = '#333333'
  let subColor = '#888888'

  if (node.status === 'completed') {
    fill = '#FFC300'
    stroke = '#CC9C00'
    strokeWidth = 0
    textColor = '#000000'
    subColor = '#6b5800'
  } else if (node.status === 'in_progress') {
    fill = '#fffbea'
    stroke = '#FFC300'
    strokeWidth = 2.5
    textColor = '#111111'
  } else if (node.is_bottleneck) {
    fill = '#fff5f5'
    stroke = '#f87171'
    strokeWidth = 2
  }

  if (selected) {
    stroke = '#000000'
    strokeWidth = 2.5
  }

  const label = node.id ?? ''
  // Shorten name to fit in circle
  const rawName = node.name ?? ''
  const words = rawName.split(' ')
  // Up to 2 lines of ~12 chars
  let line1 = '', line2 = ''
  let cur = ''
  for (const w of words) {
    if ((cur + ' ' + w).trim().length <= 12) {
      cur = (cur + ' ' + w).trim()
    } else {
      if (!line1) { line1 = cur; cur = w }
      else { line2 = cur + (cur ? ' ' : '') + w; cur = ''; break }
    }
  }
  if (!line1) line1 = cur
  else if (!line2 && cur) line2 = cur
  if (line2.length > 14) line2 = line2.slice(0, 13) + '…'

  return (
    <g
      className="course-node"
      transform={`translate(${cx},${cy})`}
      onClick={onClick}
      filter={node.is_bottleneck && !selected ? 'url(#gold-glow)' : undefined}
    >
      {/* Outer ring for selected */}
      {selected && (
        <circle r={R + 6} fill="none" stroke="#000" strokeWidth="2" opacity="0.15" />
      )}

      {/* Main circle */}
      <circle r={R} fill={fill} stroke={stroke} strokeWidth={strokeWidth} />

      {/* Bottleneck amber dot indicator */}
      {node.is_bottleneck && (
        <circle cx={R - 8} cy={-(R - 8)} r={7} fill="#f59e0b" stroke="white" strokeWidth="1.5" />
      )}

      {/* Spring-only pill */}
      {node.spring_only && !node.is_bottleneck && (
        <circle cx={R - 8} cy={-(R - 8)} r={6} fill="#FFC300" stroke="white" strokeWidth="1.5" />
      )}

      {/* Course ID */}
      <text
        y={line2 ? -10 : -4}
        textAnchor="middle"
        fill={textColor}
        fontSize={11}
        fontWeight="700"
        fontFamily="Inter, system-ui, sans-serif"
        letterSpacing="0.02em"
      >
        {label}
      </text>

      {/* Course name line 1 */}
      {line1 && (
        <text
          y={line2 ? 5 : 10}
          textAnchor="middle"
          fill={subColor}
          fontSize={8.5}
          fontFamily="Inter, system-ui, sans-serif"
        >
          {line1}
        </text>
      )}

      {/* Course name line 2 */}
      {line2 && (
        <text
          y={17}
          textAnchor="middle"
          fill={subColor}
          fontSize={8.5}
          fontFamily="Inter, system-ui, sans-serif"
        >
          {line2}
        </text>
      )}
    </g>
  )
}

function buildGraph(mapData) {
  if (!mapData?.courses) return { nodes: [], edges: [], viewBox: '0 0 800 600' }

  const courses = mapData.courses

  // Group by level column
  const levelMap = {}
  courses.forEach(c => {
    const num = parseInt((c.id ?? '').replace(/\D/g, '') || '0')
    const lvl = c.level ?? Math.floor(num / 100)
    if (!levelMap[lvl]) levelMap[lvl] = []
    levelMap[lvl].push(c)
  })

  const levels = Object.keys(levelMap).sort()
  const nodes = []
  const posMap = {}

  levels.forEach((lvl, colIdx) => {
    const col = levelMap[lvl]
    col.forEach((c, rowIdx) => {
      const totalRows = col.length
      const cx = PAD + colIdx * COL_GAP
      const totalHeight = (totalRows - 1) * ROW_GAP
      const cy = PAD + rowIdx * ROW_GAP - totalHeight / 2 + (levels.length > 1 ? 80 : 0) + 200
      nodes.push({ ...c, x: cx, y: cy })
      posMap[c.id] = { x: cx, y: cy }
    })
  })

  // Curved bezier edges
  const edges = []
  courses.forEach(c => {
    ;(c.prereqs ?? []).forEach(preId => {
      const src = posMap[preId]
      const dst = posMap[c.id]
      if (!src || !dst) return
      const x1 = src.x + R
      const y1 = src.y
      const x2 = dst.x - R - 2
      const y2 = dst.y
      const cx1 = x1 + (x2 - x1) * 0.45
      const cx2 = x2 - (x2 - x1) * 0.45
      edges.push({ path: `M${x1},${y1} C${cx1},${y1} ${cx2},${y2} ${x2},${y2}` })
    })
  })

  const maxX = Math.max(...nodes.map(n => n.x)) + R + PAD
  const maxY = Math.max(...nodes.map(n => n.y)) + R + PAD

  return { nodes, edges, viewBox: `0 0 ${maxX} ${maxY}` }
}
