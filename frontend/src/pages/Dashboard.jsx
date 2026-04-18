import { useState, useCallback, useEffect } from 'react'
import TopBar from '../components/TopBar'
import MapView from '../components/MapView'
import CourseDrawer from '../components/CourseDrawer'
import AdvisorPanel from '../components/AdvisorPanel'
import CountdownBanner from '../components/CountdownBanner'
import { parseAudit, fetchCourseMetadata } from '../lib/api'

// No sessionStorage restore — every /dashboard load is a fresh session.
// The user always sees the upload zone first. This is the demo behavior we want:
// judges see the drop-PDF → map-builds → pilot-runs story from the top every time.
// (Auth + Firestore would be the "proper" per-user persistence; save that for v2.)

export default function Dashboard() {
  const [mapData, setMapData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [selectedCourse, setSelectedCourse] = useState(null)
  const [courseMetadata, setCourseMetadata] = useState(null)
  const [parseError, setParseError] = useState(null)

  // Nuke any stale cache from older builds on mount — belt-and-suspenders so
  // no one lingering in sessionStorage accidentally repopulates the map.
  useEffect(() => {
    try {
      sessionStorage.removeItem('atlas.mapData.v2')
      sessionStorage.removeItem('atlas.mapData.v1')
    } catch {}
  }, [])

  useEffect(() => {
    fetchCourseMetadata()
      .then(setCourseMetadata)
      .catch(err => console.warn('Metadata fetch failed:', err))
  }, [])

  const handleAuditUpload = useCallback(async (audit, transcript) => {
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

  // Called by AdvisorAsk when the pilot finishes and the user confirms.
  // Marks those courses as PLANNED (not completed) and stamps the target term
  // so the bubbles light up blue inside the Senior year column — they haven't
  // been taken yet, they're scheduled.
  const handlePilotComplete = useCallback((registered, targetTerm = 'Fall 2026') => {
    if (!registered?.length) return
    const plannedIds = new Set(registered.map(r => r.course))
    setMapData(prev => prev ? {
      ...prev,
      courses: prev.courses.map(c =>
        plannedIds.has(c.id)
          ? {
              ...c,
              status: 'planned',
              planned_semester: targetTerm,
              planned_instructor: registered.find(r => r.course === c.id)?.instructor ?? null,
              is_bottleneck: false,
            }
          : c
      ),
      bottlenecks: (prev.bottlenecks ?? []).filter(b => !plannedIds.has(b)),
    } : prev)
  }, [])

  return (
    <div className="flex flex-col h-screen bg-[#f7f6f1] text-[#111111] overflow-hidden">
      <TopBar onUpload={handleAuditUpload} loading={loading} mapData={mapData} />
      <CountdownBanner mapData={mapData} />

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
        <AdvisorPanel mapData={mapData} onPilotComplete={handlePilotComplete} />
      </div>
    </div>
  )
}
