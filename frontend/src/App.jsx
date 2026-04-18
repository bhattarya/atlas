import { useState, useCallback, useEffect } from 'react'
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
  const [addedMinor, setAddedMinor] = useState(null)
  const [auditFile, setAuditFile] = useState(null)
  const [transcriptFile, setTranscriptFile] = useState(null)
  const [courseMetadata, setCourseMetadata] = useState(null)

  useEffect(() => {
    fetchCourseMetadata()
      .then(setCourseMetadata)
      .catch(err => console.warn('Metadata fetch failed (backend may not be running):', err))
  }, [])

  const handleAuditUpload = useCallback(async (audit, transcript) => {
    setAuditFile(audit)
    setTranscriptFile(transcript)
    setLoading(true)
    try {
      const data = await parseAudit(audit, transcript, addedMinor)
      setMapData(data)
    } catch (err) {
      console.error('Parse failed:', err)
    } finally {
      setLoading(false)
    }
  }, [addedMinor])

  const handleMinorChange = useCallback(async (minor) => {
    setAddedMinor(minor)
    if (!mapData) return
    setLoading(true)
    try {
      // Re-run full parse with minor context if we have the file, else use cached
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
    const { session_id } = await startPilot()
    setSessionId(session_id)
    setPilotActive(true)
  }, [])

  const handlePilotConfirm = useCallback(async () => {
    if (!sessionId) return
    await confirmPilot(sessionId)
  }, [sessionId])

  return (
    <div className="flex flex-col h-screen bg-[#0a0e1a] text-[#e5e7eb] overflow-hidden">
      <TopBar onUpload={handleAuditUpload} loading={loading} mapData={mapData} />
      <CountdownBanner />
      <StatsBar mapData={mapData} />
      <MinorToggle selected={addedMinor} onChange={handleMinorChange} />
      <div className="flex flex-1 overflow-hidden relative">
        <MapView
          mapData={mapData}
          loading={loading}
          onCourseSelect={setSelectedCourse}
        />
        {selectedCourse && (
          <CourseDrawer
            course={selectedCourse}
            metadata={courseMetadata}
            onClose={() => setSelectedCourse(null)}
          />
        )}
      </div>
      <PilotBar mapData={mapData} onLaunch={handlePilotStart} />
      {pilotActive && (
        <PilotPanel
          sessionId={sessionId}
          onConfirm={handlePilotConfirm}
          onClose={() => setPilotActive(false)}
        />
      )}
    </div>
  )
}
