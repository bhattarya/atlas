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
  const [parseError, setParseError] = useState(null)

  useEffect(() => {
    fetchCourseMetadata()
      .then(setCourseMetadata)
      .catch(err => console.warn('Metadata fetch failed (backend may not be running):', err))
  }, [])

  const handleAuditUpload = useCallback(async (audit, transcript) => {
    setAuditFile(audit)
    setTranscriptFile(transcript)
    setParseError(null)
    setLoading(true)
    try {
      const data = await parseAudit(audit, transcript, addedMinor)
      setMapData(data)
    } catch (err) {
      const msg = err.message?.includes('422') ? 'Not a UMBC degree audit. Please upload your audit PDF.' : 'Parse failed — check backend logs.'
      setParseError(msg)
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
    <div className="flex flex-col h-screen bg-[#f7f6f1] text-[#111111] overflow-hidden">
      {/* UMBC black topbar */}
      <TopBar onUpload={handleAuditUpload} loading={loading} mapData={mapData} />

      {/* Gold countdown strip */}
      <CountdownBanner />

      {/* Subbar: stats + minor toggle */}
      <div className="flex items-center justify-between px-5 border-b border-[#e8e7e0] bg-white min-h-[36px]">
        <StatsBar mapData={mapData} />
        <MinorToggle selected={addedMinor} onChange={handleMinorChange} />
      </div>

      {parseError && (
        <div className="mx-5 mt-3 px-4 py-2 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
          {parseError}
        </div>
      )}

      {/* Main canvas + drawer */}
      <div className="flex flex-1 overflow-hidden relative">
        <MapView
          mapData={mapData}
          loading={loading}
          onCourseSelect={setSelectedCourse}
          selectedId={selectedCourse?.id}
        />
        {selectedCourse && (
          <CourseDrawer
            course={selectedCourse}
            metadata={courseMetadata}
            onClose={() => setSelectedCourse(null)}
          />
        )}
      </div>

      {/* Pilot bar */}
      <PilotBar mapData={mapData} onLaunch={handlePilotStart} />

      {/* Pilot overlay */}
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
