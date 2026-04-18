import { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import {
  ReactFlow, Background, Controls, Handle, Position, MarkerType,
  BackgroundVariant, Panel, useNodesState, useEdgesState,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { Loader2, Upload, FileText, RotateCcw } from 'lucide-react'

/* ── Layout constants ── */
const BUBBLE_SIZE = 88          // diameter of circular bubble
const COL_W = 250               // horizontal distance between year columns
const ROW_H = 110               // vertical distance between siblings
const PAD_X = 80                // outer horizontal padding
const PAD_Y = 80                // outer vertical padding (room for year header)

/* ── Academic year labels for the 4 columns ── */
const YEAR_LABELS = [
  { label: 'Freshman', sub: '100-level' },
  { label: 'Sophomore', sub: '200-level' },
  { label: 'Junior', sub: '300-level' },
  { label: 'Senior', sub: '400-level' },
]

/* ── Friendlier display label for placeholder elective IDs ── */
function displayCode(id, name) {
  if (!id) return ''
  if (id.includes('_')) {
    const parts = id.split('_')
    const subj = parts[0]
    const lvl = parts[1]?.match(/\d/)?.[0]
    if (subj && lvl) return `${subj} ${lvl}00`
    if (name) return name.length > 10 ? name.slice(0, 10) + '…' : name
  }
  return id
}

/* ── Recursive prereq + dependent chain ── */
function collectChain(courses, selectedId) {
  if (!selectedId) return { prereqs: new Set(), dependents: new Set() }

  const prereqMap = {}
  const dependentMap = {}
  courses.forEach(c => {
    prereqMap[c.id] = c.prereqs ?? []
    ;(c.prereqs ?? []).forEach(p => {
      ;(dependentMap[p] ??= []).push(c.id)
    })
  })

  const walk = (start, map) => {
    const seen = new Set()
    const stack = [...(map[start] ?? [])]
    while (stack.length) {
      const id = stack.pop()
      if (seen.has(id)) continue
      seen.add(id)
      ;(map[id] ?? []).forEach(n => stack.push(n))
    }
    return seen
  }

  return {
    prereqs: walk(selectedId, prereqMap),
    dependents: walk(selectedId, dependentMap),
  }
}

/* ── Compute year-tree layout (left → right by academic year) ── */
function computeLayout(courses) {
  const idSet = new Set(courses.map(c => c.id))
  const validPrereqs = c => (c.prereqs ?? []).filter(p => idSet.has(p))

  // Prereq depth = longest path from any root (used as a tie-breaker within year)
  const depths = {}
  const visit = (id, depth, seen) => {
    if (seen.has(id)) return
    seen.add(id)
    depths[id] = Math.max(depths[id] ?? 0, depth)
    courses.forEach(other => {
      if (validPrereqs(other).includes(id)) visit(other.id, depth + 1, new Set(seen))
    })
  }
  courses.forEach(c => {
    if (validPrereqs(c).length === 0) visit(c.id, 0, new Set())
  })

  // Group by academic year column using course number (100→0, 200→1, 300→2, 400+→3)
  // Fall back to parsing course code (e.g. "CMSC 341" → 300 → col 2)
  const yearOf = c => {
    let lvl = c.level ?? 0
    if (lvl < 10) {
      // Old-style 1-4 encoding
      if (lvl <= 1) return 0
      if (lvl >= 4) return 3
      return lvl - 1
    }
    // New-style course number (100, 200, 300, 400)
    if (lvl >= 400) return 3
    if (lvl >= 300) return 2
    if (lvl >= 200) return 1
    if (lvl >= 100) return 0
    // Last resort: parse from course code string
    const num = parseInt((c.id ?? '').match(/\d+/)?.[0] ?? '100')
    if (num >= 400) return 3
    if (num >= 300) return 2
    if (num >= 200) return 1
    return 0
  }

  const layerGroups = { 0: [], 1: [], 2: [], 3: [] }
  courses.forEach(c => {
    layerGroups[yearOf(c)].push(c)
  })

  // Sort within column: status first (completed → in_progress → needed), then prereq depth
  const statusOrder = { completed: 0, in_progress: 1, needed: 2 }
  Object.values(layerGroups).forEach(arr =>
    arr.sort((a, b) =>
      (statusOrder[a.status] ?? 3) - (statusOrder[b.status] ?? 3) ||
      (depths[a.id] ?? 0) - (depths[b.id] ?? 0) ||
      a.id.localeCompare(b.id)
    )
  )

  // Position vertically centered around y=400
  const positions = {}
  for (let li = 0; li < 4; li++) {
    const group = layerGroups[li]
    if (!group?.length) continue
    const colCenterY = (group.length - 1) * ROW_H / 2
    group.forEach((c, ri) => {
      positions[c.id] = {
        x: PAD_X + li * COL_W,
        y: PAD_Y + ri * ROW_H - colCenterY + 360,
      }
    })
  }

  return { positions, layerGroups }
}

/* ── Status color palette (matches reference legend) ── */
function statusStyle(course, isOnPath, isFaded) {
  // status: completed → mastered (green), in_progress → building (yellow),
  // needed → developing (orange) if bottleneck or has many dependents else not_started (gray)
  const { status, is_bottleneck } = course

  let ring, fill, text, glow
  if (status === 'completed') {
    ring = '#10b981'; fill = '#ecfdf5'; text = '#065f46'; glow = 'rgba(16,185,129,0.30)'
  } else if (status === 'in_progress') {
    ring = '#FFC300'; fill = '#fffbe6'; text = '#7a5a00'; glow = 'rgba(255,195,0,0.35)'
  } else if (is_bottleneck) {
    ring = '#f97316'; fill = '#fff7ed'; text = '#9a3412'; glow = 'rgba(249,115,22,0.35)'
  } else {
    ring = '#9ca3af'; fill = '#f5f4ee'; text = '#6b7280'; glow = 'rgba(107,114,128,0.15)'
  }

  return { ring, fill, text, glow, faded: isFaded, onPath: isOnPath }
}

/* ── Bubble node ── */
function BubbleNode({ data }) {
  const { id, name, status, is_bottleneck, isSelected, isOnPath, isFaded } = data
  const s = statusStyle({ status, is_bottleneck }, isOnPath, isFaded)
  const label = displayCode(id, name)

  return (
    <>
      <Handle type="target" position={Position.Left} style={{ opacity: 0, width: 1, height: 1 }} />
      <div
        className="atlas-bubble"
        title={name ? `${id} — ${name}` : id}
        style={{
          width: BUBBLE_SIZE,
          height: BUBBLE_SIZE,
          borderRadius: '50%',
          background: s.fill,
          border: `3px solid ${s.ring}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: 6,
          cursor: 'grab',
          opacity: isFaded ? 0.18 : 1,
          boxShadow: isSelected
            ? `0 0 0 4px ${s.glow}, 0 14px 32px rgba(15,23,42,0.20), inset 0 1px 0 rgba(255,255,255,0.7)`
            : isOnPath
              ? `0 0 0 2px ${s.glow}, 0 8px 20px ${s.glow}, inset 0 1px 0 rgba(255,255,255,0.7)`
              : `0 4px 12px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.7)`,
          transform: isSelected ? 'scale(1.12)' : 'scale(1)',
          transition: 'opacity 0.2s, box-shadow 0.2s, transform 0.2s, filter 0.2s',
          position: 'relative',
          userSelect: 'none',
        }}
      >
        {/* Glossy top — subtle bubble depth */}
        <span style={{
          position: 'absolute',
          top: 6, left: '15%', right: '15%',
          height: '32%',
          borderRadius: '50%',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.55) 0%, rgba(255,255,255,0) 100%)',
          pointerEvents: 'none',
        }} />

        <p style={{
          fontFamily: 'ui-monospace, SFMono-Regular, monospace',
          fontWeight: 700,
          fontSize: label.length > 9 ? 9 : label.length > 7 ? 10 : 11,
          color: s.text,
          lineHeight: 1.1,
          zIndex: 1,
          wordBreak: 'break-word',
        }}>
          {label}
        </p>
      </div>
      <Handle type="source" position={Position.Right} style={{ opacity: 0, width: 1, height: 1 }} />
    </>
  )
}

/* ── Year header node (decorative, non-draggable) ── */
function YearHeaderNode({ data }) {
  const { label, sub, count } = data
  return (
    <div
      style={{
        width: COL_W - 40,
        textAlign: 'center',
        pointerEvents: 'none',
        userSelect: 'none',
      }}
    >
      <div
        style={{
          display: 'inline-flex',
          alignItems: 'baseline',
          gap: 8,
          padding: '6px 14px',
          borderRadius: 999,
          background: 'rgba(255,255,255,0.85)',
          border: '1px solid #e8e7e0',
          boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
          backdropFilter: 'blur(6px)',
        }}
      >
        <span style={{ fontSize: 11, fontWeight: 700, color: '#1a1a1a', letterSpacing: 0.3 }}>
          {label}
        </span>
        <span style={{ fontSize: 9, color: '#999', fontWeight: 500 }}>{sub}</span>
        {count > 0 && (
          <span style={{
            fontSize: 9,
            fontWeight: 700,
            color: '#666',
            background: '#f3f1e9',
            padding: '1px 6px',
            borderRadius: 999,
            tabularNums: true,
          }}>
            {count}
          </span>
        )}
      </div>
    </div>
  )
}

const nodeTypes = { bubble: BubbleNode, yearHeader: YearHeaderNode }

/* ── Build flow data ── */
function buildFlowData(mapData, manualPositions, selectedId) {
  if (!mapData?.courses) return { nodes: [], edges: [] }

  const courses = mapData.courses
  const bottleneckSet = new Set(mapData.bottlenecks ?? [])
  const { prereqs, dependents } = collectChain(courses, selectedId)
  const hasSelection = !!selectedId

  // Compute auto layout, then override with any manual positions
  const { positions: autoPositions, layerGroups } = computeLayout(courses)

  // Year header nodes — one per column, positioned above the topmost bubble
  const headerNodes = YEAR_LABELS.map((y, li) => {
    const group = layerGroups[li] ?? []
    const headerY = group.length
      ? Math.min(...group.map(c => autoPositions[c.id]?.y ?? PAD_Y)) - 70
      : PAD_Y - 30
    return {
      id: `__year_header_${li}`,
      type: 'yearHeader',
      position: { x: PAD_X + li * COL_W - (COL_W - 40 - BUBBLE_SIZE) / 2, y: headerY },
      data: { label: y.label, sub: y.sub, count: group.length },
      draggable: false,
      selectable: false,
      zIndex: 1,
    }
  })

  const nodes = courses.map(c => {
    const pos = manualPositions[c.id] ?? autoPositions[c.id] ?? { x: 0, y: 0 }
    const isSelected = c.id === selectedId
    const isOnPath = isSelected || prereqs.has(c.id) || dependents.has(c.id)
    const isFaded = hasSelection && !isOnPath

    return {
      id: c.id,
      type: 'bubble',
      position: pos,
      data: {
        ...c,
        is_bottleneck: bottleneckSet.has(c.id) || c.is_bottleneck,
        isSelected, isOnPath, isFaded,
      },
      draggable: true,
      zIndex: isSelected ? 100 : isOnPath ? 50 : 10,
    }
  })

  const edges = []
  const courseSet = new Set(courses.map(c => c.id))
  courses.forEach(c => {
    ;(c.prereqs ?? []).forEach(preId => {
      if (!courseSet.has(preId)) return

      const inUpstream = hasSelection && (
        (c.id === selectedId && prereqs.has(preId)) ||
        (prereqs.has(c.id) && (prereqs.has(preId) || preId === selectedId))
      )
      const inDownstream = hasSelection && (
        (preId === selectedId && dependents.has(c.id)) ||
        (dependents.has(preId) && (dependents.has(c.id) || c.id === selectedId))
      )
      const onPath = inUpstream || inDownstream

      let stroke, strokeWidth, opacity, animated
      if (hasSelection) {
        if (onPath) {
          // Active path — bold blue (matches the reference)
          stroke = '#3b82f6'; strokeWidth = 3; opacity = 0.95; animated = true
        } else {
          stroke = '#d6d4cc'; strokeWidth = 1; opacity = 0.08; animated = false
        }
      } else {
        // Default — light gray, slightly thicker for bottleneck-feeding chains
        const feedsBottleneck = bottleneckSet.has(c.id)
        stroke = feedsBottleneck ? '#f59e0b' : '#c4c1b4'
        strokeWidth = feedsBottleneck ? 1.6 : 1.2
        opacity = feedsBottleneck ? 0.55 : 0.4
        animated = false
      }

      edges.push({
        id: `${preId}→${c.id}`,
        source: preId,
        target: c.id,
        type: 'bezier',
        animated,
        style: { stroke, strokeWidth, opacity },
        markerEnd: {
          type: MarkerType.ArrowClosed,
          width: onPath ? 14 : 10,
          height: onPath ? 14 : 10,
          color: stroke,
        },
        zIndex: onPath ? 30 : 1,
      })
    })
  })

  return { nodes: [...headerNodes, ...nodes], edges }
}

/* ── Empty / upload state ── */
function UploadZone({ onUpload }) {
  const ref = useRef()
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    const files = Array.from(e.dataTransfer.files)
    const audit = files.find(f => f.name.toLowerCase().includes('audit')) ?? files[0]
    const transcript = files.find(f => f.name.toLowerCase().includes('transcript'))
    if (audit) onUpload(audit, transcript ?? null)
  }

  return (
    <div className="flex-1 flex items-center justify-center bg-[#f7f6f1]">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => ref.current.click()}
        className={`flex flex-col items-center gap-5 px-16 py-14 rounded-2xl border-2 border-dashed cursor-pointer transition-all select-none ${
          dragging
            ? 'border-[#FFC300] bg-[#FFC300]/8 scale-[1.01]'
            : 'border-[#dedad4] hover:border-[#FFC300]/60 hover:bg-[#FFC300]/4'
        }`}
      >
        <input
          ref={ref}
          type="file"
          accept=".pdf"
          className="hidden"
          onChange={(e) => { if (e.target.files[0]) onUpload(e.target.files[0], null) }}
        />
        <div className={`w-16 h-16 rounded-2xl flex items-center justify-center transition-colors ${
          dragging ? 'bg-[#FFC300]/20' : 'bg-[#f0efe9]'
        }`}>
          <FileText size={28} className={dragging ? 'text-[#FFC300]' : 'text-[#bbb]'} />
        </div>
        <div className="text-center">
          <p className="text-[15px] font-semibold text-[#222]">Upload your degree audit PDF</p>
          <p className="text-sm text-[#999] mt-1">Drag & drop here, or click to browse</p>
        </div>
        <div className="flex items-center gap-2 px-5 py-2.5 bg-[#FFC300] hover:bg-[#FFD84D] rounded-xl transition-colors">
          <Upload size={14} className="text-black" />
          <span className="text-sm font-bold text-black">Choose PDF</span>
        </div>
        <p className="text-[11px] text-[#ccc]">UMBC degree audit · CS · IS · CE + Finance / Entrepreneurship minors</p>
      </div>
    </div>
  )
}

/* ── Status counts for legend ── */
function getStatusCounts(courses) {
  if (!courses) return { mastered: 0, building: 0, developing: 0, notStarted: 0 }
  let mastered = 0, building = 0, developing = 0, notStarted = 0
  courses.forEach(c => {
    if (c.status === 'completed') mastered++
    else if (c.status === 'in_progress') building++
    else if (c.is_bottleneck) developing++
    else notStarted++
  })
  return { mastered, building, developing, notStarted }
}

/* ── Component ── */
export default function MapView({ mapData, loading, onCourseSelect, selectedId, onUpload }) {
  const [manualPositions, setManualPositions] = useState({})
  const [nodes, setNodes, onNodesChange] = useNodesState([])
  const [edges, setEdges, onEdgesChange] = useEdgesState([])

  const counts = useMemo(() => getStatusCounts(mapData?.courses), [mapData])

  // Recompute layout whenever inputs change
  useEffect(() => {
    const { nodes: n, edges: e } = buildFlowData(mapData, manualPositions, selectedId)
    setNodes(n)
    setEdges(e)
  }, [mapData, manualPositions, selectedId, setNodes, setEdges])

  const handleNodeDragStop = useCallback((_, node) => {
    if (node.type !== 'bubble') return
    setManualPositions(prev => ({ ...prev, [node.id]: node.position }))
  }, [])

  const handleNodeClick = useCallback((_, node) => {
    if (node.type !== 'bubble') return
    if (node.id === selectedId) onCourseSelect(null)
    else onCourseSelect(node.data)
  }, [selectedId, onCourseSelect])

  const handlePaneClick = useCallback(() => {
    onCourseSelect(null)
  }, [onCourseSelect])

  const handleReset = useCallback(() => {
    setManualPositions({})
    onCourseSelect(null)
  }, [onCourseSelect])

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

  const hasManualEdits = Object.keys(manualPositions).length > 0

  return (
    <div className="flex-1 relative" style={{ background: '#f8f7f2' }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onNodeClick={handleNodeClick}
        onNodeDragStop={handleNodeDragStop}
        onPaneClick={handlePaneClick}
        fitView
        fitViewOptions={{ padding: 0.15, maxZoom: 1.0 }}
        minZoom={0.15}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        nodesConnectable={false}
        selectNodesOnDrag={false}
        panOnScroll
        zoomOnScroll={false}
      >
        <Background color="#e0ddd6" variant={BackgroundVariant.Dots} gap={24} size={1.2} />
        <Controls
          showInteractive={false}
          style={{ left: 'auto', right: 14, bottom: 70, top: 'auto', borderRadius: 10, boxShadow: '0 2px 12px rgba(0,0,0,0.10)', border: '1px solid #e8e7e0' }}
        />

        {/* Legend — top-left, matches reference */}
        <Panel position="top-left" style={{ margin: 14 }}>
          <div className="bg-white rounded-xl border border-[#e8e7e0] shadow-sm overflow-hidden">
            <div className="flex items-center gap-2 px-3.5 py-2 border-b border-[#f0efe9]">
              <svg width="20" height="10" viewBox="0 0 20 10">
                <line x1="2" y1="5" x2="14" y2="5" stroke="#3b82f6" strokeWidth="1.6" />
                <polygon points="13,2 18,5 13,8" fill="#3b82f6" />
              </svg>
              <span className="text-[10px] font-semibold text-[#555]">Prerequisite</span>
            </div>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 px-3.5 py-2.5">
              <LegendDot color="#10b981" label="Mastered" />
              <LegendDot color="#FFC300" label="Building" />
              <LegendDot color="#f97316" label="Developing" />
              <LegendDot color="#9ca3af" label="Not Started" />
            </div>
          </div>
        </Panel>

        {/* Reset button when manual layout edits exist */}
        {hasManualEdits && (
          <Panel position="top-right" style={{ margin: 14 }}>
            <button
              onClick={handleReset}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white hover:bg-[#f7f6f1] rounded-lg border border-[#e8e7e0] shadow-sm text-[10px] font-semibold text-[#666] hover:text-[#111] transition-colors"
            >
              <RotateCcw size={11} />
              Reset layout
            </button>
          </Panel>
        )}

        {/* Bottom legend — count pill, matches reference */}
        <Panel position="bottom-center" style={{ margin: 16 }}>
          <div className="flex items-center gap-3 px-4 py-2 bg-white rounded-full border border-[#e8e7e0] shadow-md">
            <CountPill color="#10b981" count={counts.mastered} />
            <CountPill color="#FFC300" count={counts.building} />
            <CountPill color="#f97316" count={counts.developing} />
            <CountPill color="#9ca3af" count={counts.notStarted} />
          </div>
        </Panel>
      </ReactFlow>
    </div>
  )
}

function LegendDot({ color, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block rounded-full"
        style={{ width: 9, height: 9, background: color, boxShadow: `0 0 0 1.5px ${color}40` }}
      />
      <span className="text-[10px] text-[#555] font-medium">{label}</span>
    </div>
  )
}

function CountPill({ color, count }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="inline-block rounded-full"
        style={{ width: 8, height: 8, background: color }}
      />
      <span className="text-xs font-semibold text-[#222] tabular-nums">{count}</span>
    </div>
  )
}
