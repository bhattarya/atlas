import { useState, useCallback, useEffect } from 'react'
import TopBar from '../components/TopBar'
import MapView from '../components/MapView'
import CourseDrawer from '../components/CourseDrawer'
import PilotBar from '../components/PilotBar'
import PilotPanel from '../components/PilotPanel'
import DragPlanner from '../components/DragPlanner'
import { parseAudit, parseCached, fetchCourseMetadata, startPilot, confirmPilot } from '../lib/api'

const PLANNER_SEMS = ['Fall 2026', 'Spring 2027', 'Fall 2027', 'Spring 2028']
const EMPTY_SEMS = () => Object.fromEntries(PLANNER_SEMS.map(s => [s, []]))

export default function Dashboard() {
  const [mapData, setMapData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [pilotActive, setPilotActive] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [pilotSteps, setPilotSteps] = useState([])
  const [pilotDone, setPilotDone] = useState(false)
  const [auditFile, setAuditFile] = useState(null)
  const [transcriptFile, setTranscriptFile] = useState(null)
  const [courseMetadata, setCourseMetadata] = useState(null)
  const [parseError, setParseError] = useState(null)
  const [seats, setSeats] = useState(5)
  const [plannerState, setPlannerState] = useState({ bank: [], semesters: EMPTY_SEMS() })

  useEffect(() => {
    fetchCourseMetadata()
      .then(setCourseMetadata)
      .catch(err => console.warn('Metadata fetch failed:', err))
  }, [])

  // Seat countdown starts after audit loads
  useEffect(() => {
    if (!mapData) return
    const id = setInterval(() => {
      setSeats(prev => Math.max(0, prev - Math.floor(Math.random() * 2)))
    }, 8000)
    return () => clearInterval(id)
  }, [mapData])

  // Seed planner when audit loads
  useEffect(() => {
    if (!mapData?.courses) return
    const bank = []
    const semesters = EMPTY_SEMS()
    mapData.courses
      .filter(c => c.status !== 'completed' && c.status !== 'in_progress')
      .forEach(c => {
        const sem = PLANNER_SEMS.find(s => s === c.planned_semester)
        if (sem) semesters[sem].push(c)
        else bank.push(c)
      })
    setPlannerState({ bank, semesters })
  }, [mapData])

  // SSE stream
  useEffect(() => {
    if (!sessionId) return
    const es = new EventSource(`/api/pilot-stream/${sessionId}`)
    es.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data)
        if (data.type === 'ping') return
        if (data.type === 'action') {
          setPilotSteps(prev => [...prev, { text: data.description, done: true }])
        } else if (data.type === 'waiting') {
          setPilotSteps(prev => [...prev, { text: data.description, waiting: true }])
          setPilotDone(true)
          es.close()
        } else if (data.type === 'error') {
          setPilotSteps(prev => [...prev, { text: `Error: ${data.message}`, error: true }])
          es.close()
        }
      } catch { /* ignore */ }
    }
    es.onerror = () => es.close()
    return () => es.close()
  }, [sessionId])

  const handleAuditUpload = useCallback(async (audit, transcript) => {
    setAuditFile(audit)
    setTranscriptFile(transcript)
    setParseError(null)
    setLoading(true)
    try {
      const data = await parseAudit(audit, transcript, null)
      setMapData(data)
    } catch (err) {
      setParseError(err.message?.includes('422')
        ? 'Not a UMBC degree audit. Please upload your audit PDF.'
        : 'Parse failed — check backend logs.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handlePilotStart = useCallback(async () => {
    try {
      const { session_id } = await startPilot()
      setSessionId(session_id)
      setPilotSteps([])
      setPilotDone(false)
      setPilotActive(true)
    } catch (err) {
      console.error('Pilot start failed:', err)
    }
  }, [])

  const handlePilotConfirm = useCallback(async () => {
    if (!sessionId) return
    await confirmPilot(sessionId)
    setMapData(prev => prev ? {
      ...prev,
      courses: prev.courses.map(c =>
        c.id === 'CMSC 441' ? { ...c, status: 'completed', is_bottleneck: false } : c
      ),
      bottlenecks: (prev.bottlenecks ?? []).filter(b => b !== 'CMSC 441'),
    } : prev)
  }, [sessionId])

  const handlePlannerDrop = useCallback((courseId, source, target, course) => {
    setPlannerState(prev => {
      const next = {
        bank: [...prev.bank],
        semesters: Object.fromEntries(
          Object.entries(prev.semesters).map(([k, v]) => [k, [...v]])
        ),
      }
      // Remove from source
      if (source === 'bank') next.bank = next.bank.filter(c => c.id !== courseId)
      else next.semesters[source] = next.semesters[source].filter(c => c.id !== courseId)
      // Add to target
      if (target === 'bank') next.bank.push(course)
      else next.semesters[target] = [...(next.semesters[target] ?? []), course]
      return next
    })
  }, [])

  return (
    <div className="flex flex-col h-screen bg-[#f7f6f1] text-[#111111] overflow-hidden">
      <TopBar onUpload={handleAuditUpload} loading={loading} mapData={mapData} />

      {parseError && (
        <div className="mx-5 mt-3 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {parseError}
        </div>
      )}

      <div className="flex flex-1 overflow-hidden relative min-h-0">
        <MapView
          mapData={mapData}
          loading={loading}
          onCourseSelect={setSelectedCourse}
          selectedId={selectedCourse?.id}
          onUpload={handleAuditUpload}
        />
        {selectedCourse && (
          <CourseDrawer
            course={selectedCourse}
            metadata={courseMetadata}
            onClose={() => setSelectedCourse(null)}
          />
        )}
      </div>

      {mapData && (
        <DragPlanner plannerState={plannerState} onDrop={handlePlannerDrop} />
      )}

      <PilotBar mapData={mapData} seats={seats} onLaunch={handlePilotStart} />

      {pilotActive && (
        <PilotPanel
          steps={pilotSteps}
          done={pilotDone}
          onConfirm={handlePilotConfirm}
          onClose={() => setPilotActive(false)}
        />
      )}
    </div>
  )
}
