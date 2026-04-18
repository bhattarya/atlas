import { useState, useCallback } from 'react'
import TopBar from './components/TopBar'
import StatsBar from './components/StatsBar'
import MapView from './components/MapView'
import CourseDrawer from './components/CourseDrawer'
import PilotBar from './components/PilotBar'
import PilotPanel from './components/PilotPanel'
import CountdownBanner from './components/CountdownBanner'
import MinorToggle from './components/MinorToggle'

export default function App() {
  const [mapData, setMapData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [pilotActive, setPilotActive] = useState(false)
  const [sessionId, setSessionId] = useState(null)
  const [addedMinor, setAddedMinor] = useState(null)

  const handleAuditUpload = useCallback(async (auditFile, transcriptFile) => {
    setLoading(true)
    try {
      const form = new FormData()
      form.append('audit', auditFile)
      if (transcriptFile) form.append('transcript', transcriptFile)
      if (addedMinor) form.append('added_minor', addedMinor)
      const res = await fetch('/api/parse', { method: 'POST', body: form })
      const data = await res.json()
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
    // Re-parse with new minor using cached audit endpoint
    setLoading(true)
    try {
      const res = await fetch('/api/parse-cached', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ added_minor: minor }),
      })
      const data = await res.json()
      setMapData(data)
    } catch (err) {
      console.error('Minor toggle failed:', err)
    } finally {
      setLoading(false)
    }
  }, [mapData])

  const handlePilotStart = useCallback(async () => {
    const res = await fetch('/api/pilot-register', { method: 'POST' })
    const { session_id } = await res.json()
    setSessionId(session_id)
    setPilotActive(true)
  }, [])

  const handlePilotConfirm = useCallback(async () => {
    if (!sessionId) return
    await fetch(`/api/pilot-confirm/${sessionId}`, { method: 'POST' })
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
