import { useState, useCallback, useEffect, useRef } from 'react'
import TopBar from './components/TopBar'
import StatsBar from './components/StatsBar'
import MapView from './components/MapView'
import CourseDrawer from './components/CourseDrawer'
import PilotBar from './components/PilotBar'
import PilotPanel from './components/PilotPanel'
import CountdownBanner from './components/CountdownBanner'
import MinorToggle from './components/MinorToggle'
import { parseAudit, parseCached, fetchCourseMetadata, startPilot, confirmPilot } from './lib/api'

export default function App() {
  const [mapData, setMapData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [pilotActive, setPilotActive] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [pilotSteps, setPilotSteps] = useState([])
  const [pilotDone, setPilotDone] = useState(false)
  const [addedMinor, setAddedMinor] = useState(null)
  const [auditFile, setAuditFile] = useState(null)
  const [transcriptFile, setTranscriptFile] = useState(null)
  const [courseMetadata, setCourseMetadata] = useState(null)
  const [parseError, setParseError] = useState(null)
  const [seats, setSeats] = useState(5)
  const pilotLaunched = useRef(false)

  // Fetch prof + grade metadata once on mount
  useEffect(() => {
    fetchCourseMetadata()
      .then(setCourseMetadata)
      .catch(err => console.warn('Metadata fetch failed:', err))
  }, [])

  // Seat countdown — only starts after audit is loaded
  useEffect(() => {
    if (!mapData) return
    const id = setInterval(() => {
      setSeats(prev => Math.max(0, prev - Math.floor(Math.random() * 2)))
    }, 8000)
    return () => clearInterval(id)
  }, [mapData])

  // Auto-launch Pilot when seats hit 2
  useEffect(() => {
    if (seats <= 2 && mapData && !pilotLaunched.current) {
      pilotLaunched.current = true
      handlePilotStart()
    }
  }, [seats, mapData])

  // Open SSE stream once sessionId is set
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
      } catch {
        // ignore malformed events
      }
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
      const data = await parseAudit(audit, transcript, addedMinor)
      setMapData(data)
    } catch (err) {
      const msg = err.message?.includes('422')
        ? 'Not a UMBC degree audit. Please upload your audit PDF.'
        : 'Parse failed — check backend logs.'
      setParseError(msg)
    } finally {
      setLoading(false)
    }
  }, [addedMinor])

  const handleMinorChange = useCallback(async (minor) => {
    setAddedMinor(minor)
    if (!mapData) return
    setLoading(true)
    try {
      const data = auditFile
        ? await parseAudit(auditFile, transcriptFile, minor)
        : await parseCached(minor)
      setMapData(data)
    } catch (err) {
      console.error('Minor toggle failed:', err)
    } finally {
      setLoading(false)
    }
  }, [mapData, auditFile, transcriptFile])

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
    // Mark CMSC 441 as completed on the map
    setMapData(prev => {
      if (!prev) return prev
      return {
        ...prev,
        courses: prev.courses.map(c =>
          c.id === 'CMSC 441'
            ? { ...c, status: 'completed', is_bottleneck: false }
            : c
        ),
        bottlenecks: (prev.bottlenecks ?? []).filter(b => b !== 'CMSC 441'),
      }
    })
  }, [sessionId])

  return (
    <div className="flex flex-col h-screen bg-[#0a0e1a] text-[#e5e7eb] overflow-hidden">
      <TopBar onUpload={handleAuditUpload} loading={loading} mapData={mapData} />
      <CountdownBanner />
      <StatsBar mapData={mapData} seats={seats} />
      <MinorToggle selected={addedMinor} onChange={handleMinorChange} />
      {parseError && (
        <div className="mx-6 mt-3 px-4 py-2 rounded-lg bg-[#450a0a] border border-[#ef4444] text-[#fca5a5] text-sm">
          {parseError}
        </div>
      )}
      <div className="flex flex-1 overflow-hidden relative">
        <MapView mapData={mapData} loading={loading} onCourseSelect={setSelectedCourse} />
        {selectedCourse && (
          <CourseDrawer
            course={selectedCourse}
            metadata={courseMetadata}
            onClose={() => setSelectedCourse(null)}
          />
        )}
      </div>
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
