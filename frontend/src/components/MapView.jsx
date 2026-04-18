import { useMemo } from 'react'
import { ReactFlow, Background, Controls, Handle, Position, MarkerType, BackgroundVariant } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Loader2 } from 'lucide-react'

const COL_W = 195
const ROW_H = 82
const NODE_W = 150
const PAD = 44
const MAX_PER_COL = 6

/* ── Custom node card ── */
function CourseNode({ data }) {
  const { id, name, status, is_bottleneck, spring_only, planned_semester, isSelected } = data

  let bg = '#ffffff', border = '#e8e7e0', textCol = '#111', sub = '#aaa'

  if (status === 'completed') {
    bg = '#FFC300'; border = '#e6ae00'; textCol = '#1a1000'; sub = '#7a6200'
  } else if (planned_semester) {
    bg = '#f0fdf4'; border = '#10b981'; textCol = '#065f46'; sub = '#6ee7b7'
  } else if (is_bottleneck) {
    bg = '#fff5f5'; border = '#fca5a5'; textCol = '#dc2626'; sub = '#fca5a5'
  } else if (status === 'in_progress') {
    bg = '#fffbea'; border = '#FFC300'; textCol = '#111'; sub = '#92400e'
  } else if (spring_only) {
    bg = '#fffbeb'; border = '#fcd34d'; textCol = '#78350f'; sub = '#d97706'
  }

  const shortName = name ? (name.length > 20 ? name.slice(0, 19) + '…' : name) : id

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ opacity: 0, width: 1, height: 1 }} />
      <div style={{
        background: bg,
        border: `1.5px solid ${isSelected ? '#000' : border}`,
        borderRadius: 10,
        padding: '8px 11px',
        width: NODE_W,
        cursor: 'pointer',
        boxShadow: isSelected
          ? '0 0 0 2px #000, 0 4px 12px rgba(0,0,0,0.12)'
          : is_bottleneck
            ? '0 2px 10px rgba(252,165,165,0.25)'
            : '0 1px 3px rgba(0,0,0,0.06)',
        position: 'relative',
        userSelect: 'none',
      }}>
        {is_bottleneck && (
          <span style={{ position: 'absolute', top: 5, right: 7, fontSize: 9 }}>⚠</span>
        )}
        {spring_only && !is_bottleneck && (
          <span style={{ position: 'absolute', top: 5, right: 7, fontSize: 9 }}>🌸</span>
        )}
        <p style={{ fontFamily: 'ui-monospace,monospace', fontWeight: 700, fontSize: 10.5, color: textCol, lineHeight: 1.2 }}>
          {id}
        </p>
        <p style={{ fontSize: 8.5, color: sub, marginTop: 3, lineHeight: 1.3 }}>
          {shortName}
        </p>
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0, width: 1, height: 1 }} />
    </>
  )
}

const nodeTypes = { course: CourseNode }

/* ── Build React Flow data from audit ── */
function buildFlowData(mapData) {
  if (!mapData?.courses) return { nodes: [], edges: [] }

  const courses = mapData.courses
  const bottleneckSet = new Set(mapData.bottlenecks ?? [])

  const levelMap = {}
  courses.forEach(c => {
    const num = parseInt((c.id ?? '').replace(/\D/g, '') || '0')
    const lvl = c.level ?? Math.floor(num / 100)
    if (!levelMap[lvl]) levelMap[lvl] = []
    levelMap[lvl].push(c)
  })

  const levels = Object.keys(levelMap).sort((a, b) => +a - +b)
  const columns = []
  levels.forEach(lvl => {
    const grp = levelMap[lvl]
    for (let i = 0; i < grp.length; i += MAX_PER_COL) columns.push(grp.slice(i, i + MAX_PER_COL))
  })

  const nodes = []
  const posMap = {}

  columns.forEach((col, ci) => {
    col.forEach((c, ri) => {
      const x = PAD + ci * COL_W
      const y = PAD + ri * ROW_H
      posMap[c.id] = true
      nodes.push({ id: c.id, type: 'course', position: { x, y }, data: c, draggable: false })
    })
  })

  const edges = []
  courses.forEach(c => {
    ;(c.prereqs ?? []).forEach(preId => {
      if (!posMap[preId] || !posMap[c.id]) return
      const hot = bottleneckSet.has(c.id)
      edges.push({
        id: `${preId}→${c.id}`,
        source: preId,
        target: c.id,
        type: 'smoothstep',
        style: {
          stroke: hot ? '#f59e0b' : '#d6d4cc',
          strokeWidth: hot ? 1.5 : 1,
          opacity: hot ? 0.5 : 0.22,
        },
        ...(hot && {
          markerEnd: { type: MarkerType.ArrowClosed, width: 6, height: 6, color: '#f59e0b' },
        }),
      })
    })
  })

  return { nodes, edges }
}

/* ── Component ── */
export default function MapView({ mapData, loading, onCourseSelect, selectedId }) {
  const { nodes: rawNodes, edges } = useMemo(() => buildFlowData(mapData), [mapData])

  const nodes = useMemo(
    () => rawNodes.map(n => ({ ...n, data: { ...n.data, isSelected: n.id === selectedId } })),
    [rawNodes, selectedId]
  )

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
      <div className="flex-1 flex flex-col items-center justify-center gap-4 bg-[#f7f6f1] select-none">
        <div className="w-16 h-16 rounded-full bg-[#FFC300]/15 flex items-center justify-center text-3xl">🗺</div>
        <div className="text-center">
          <p className="text-sm font-semibold text-[#222]">Drop your degree audit PDF to begin</p>
          <p className="text-xs text-[#999] mt-1">Supports CS · IS · CE &nbsp;+&nbsp; Finance / Entrepreneurship minors</p>
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 relative" style={{ background: '#f7f6f1' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodeClick={(_, node) => onCourseSelect(node.data)}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1 }}
        minZoom={0.2}
        maxZoom={3}
        proOptions={{ hideAttribution: true }}
        nodesDraggable={false}
        nodesConnectable={false}
        selectNodesOnDrag={false}
        panOnScroll
        zoomOnScroll={false}
      >
        <Background color="#dedad2" variant={BackgroundVariant.Dots} gap={22} size={1.2} />
        <Controls
          showInteractive={false}
          style={{ left: 'auto', right: 12, bottom: 12, top: 'auto', borderRadius: 8, boxShadow: '0 1px 6px rgba(0,0,0,0.08)' }}
        />
      </ReactFlow>
    </div>
  )
}
