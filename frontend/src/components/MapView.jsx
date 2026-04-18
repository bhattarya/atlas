import { useMemo } from 'react'
import { Loader2 } from 'lucide-react'

const NODE_W = 140
const NODE_H = 52
const COL_GAP = 200
const ROW_GAP = 80

export default function MapView({ mapData, loading, onCourseSelect }) {
  const { nodes, edges, viewBox } = useMemo(() => buildGraph(mapData), [mapData])

  if (loading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 size={40} className="animate-spin text-[#3b82f6]" />
        <span className="ml-3 text-[#6b7280]">Parsing audit…</span>
      </div>
    )
  }

  if (!mapData) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-[#6b7280]">
        <p className="text-lg">Drop your degree audit PDF to begin.</p>
        <p className="text-sm">Supports CS, IS, CE + Finance / Entrepreneurship minors</p>
      </div>
    )
  }

  return (
    <div className="flex-1 overflow-auto bg-[#0a0e1a] p-4">
      <svg
        viewBox={viewBox}
        width="100%"
        style={{ minHeight: '100%' }}
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <marker id="arrow" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto">
            <path d="M0,0 L0,6 L8,3 z" fill="#374151" />
          </marker>
        </defs>
        {edges.map((e, i) => (
          <line
            key={i}
            x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
            stroke="#374151"
            strokeWidth="1.5"
            markerEnd="url(#arrow)"
          />
        ))}
        {nodes.map(node => (
          <CourseNode key={node.id} node={node} onClick={() => onCourseSelect(node)} />
        ))}
      </svg>
    </div>
  )
}

function CourseNode({ node, onClick }) {
  const fill = node.status === 'completed'
    ? '#064e3b'
    : node.is_bottleneck
    ? '#451a03'
    : node.status === 'in_progress'
    ? '#1e3a5f'
    : '#1f2937'

  const border = node.status === 'completed'
    ? '#10b981'
    : node.is_bottleneck
    ? '#f59e0b'
    : node.status === 'in_progress'
    ? '#3b82f6'
    : '#374151'

  return (
    <g
      transform={`translate(${node.x},${node.y})`}
      onClick={onClick}
      style={{ cursor: 'pointer' }}
    >
      <rect
        width={NODE_W}
        height={NODE_H}
        rx={8}
        fill={fill}
        stroke={border}
        strokeWidth={node.is_bottleneck ? 2 : 1}
      />
      {node.is_bottleneck && (
        <rect width={NODE_W} height={4} rx={2} fill="#f59e0b" y={0} />
      )}
      <text
        x={NODE_W / 2}
        y={22}
        textAnchor="middle"
        fill="#e5e7eb"
        fontSize={11}
        fontWeight="600"
        fontFamily="monospace"
      >
        {node.id}
      </text>
      <text
        x={NODE_W / 2}
        y={38}
        textAnchor="middle"
        fill="#9ca3af"
        fontSize={9}
      >
        {node.name?.length > 20 ? node.name.slice(0, 18) + '…' : node.name}
      </text>
    </g>
  )
}

function buildGraph(mapData) {
  if (!mapData?.courses) return { nodes: [], edges: [], viewBox: '0 0 800 600' }

  const courses = mapData.courses
  const levelMap = {}

  courses.forEach(c => {
    const lvl = c.level ?? Math.floor(parseInt(c.id?.replace(/\D/g, '') || '0') / 100)
    if (!levelMap[lvl]) levelMap[lvl] = []
    levelMap[lvl].push(c)
  })

  const levels = Object.keys(levelMap).sort()
  const nodes = []
  const posMap = {}

  levels.forEach((lvl, colIdx) => {
    levelMap[lvl].forEach((c, rowIdx) => {
      const x = colIdx * (NODE_W + COL_GAP) + 40
      const y = rowIdx * (NODE_H + ROW_GAP) + 40
      nodes.push({ ...c, x, y })
      posMap[c.id] = { x: x + NODE_W / 2, y: y + NODE_H / 2 }
    })
  })

  const edges = []
  courses.forEach(c => {
    ;(c.prereqs ?? []).forEach(preId => {
      if (posMap[preId] && posMap[c.id]) {
        edges.push({
          x1: posMap[preId].x,
          y1: posMap[preId].y,
          x2: posMap[c.id].x - NODE_W / 2,
          y2: posMap[c.id].y,
        })
      }
    })
  })

  const maxX = Math.max(...nodes.map(n => n.x)) + NODE_W + 60
  const maxY = Math.max(...nodes.map(n => n.y)) + NODE_H + 60

  return { nodes, edges, viewBox: `0 0 ${maxX} ${maxY}` }
}
