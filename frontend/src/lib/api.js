const BASE = ''  // proxied to localhost:8000 by Vite

export async function parseAudit(auditFile, transcriptFile = null, addedMinor = null) {
  const form = new FormData()
  form.append('audit', auditFile)
  if (transcriptFile) form.append('transcript', transcriptFile)
  if (addedMinor) form.append('added_minor', addedMinor)
  const res = await fetch(`${BASE}/api/parse`, { method: 'POST', body: form })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`${res.status}: ${body.detail ?? 'Parse failed'}`)
  }
  return res.json()
}

export async function parseCached(addedMinor = null) {
  const res = await fetch(`${BASE}/api/parse-cached`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ added_minor: addedMinor }),
  })
  if (!res.ok) throw new Error(`Parse-cached failed: ${res.status}`)
  return res.json()
}

export async function fetchCourseMetadata() {
  const res = await fetch(`${BASE}/api/course-metadata`)
  if (!res.ok) throw new Error(`Metadata fetch failed: ${res.status}`)
  return res.json()
}

export async function startPilot(plan = null) {
  const res = await fetch(`${BASE}/api/pilot-register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  })
  if (!res.ok) throw new Error(`Pilot start failed: ${res.status}`)
  return res.json()  // { session_id }
}

export async function confirmPilot(sessionId) {
  const res = await fetch(`${BASE}/api/pilot-confirm/${sessionId}`, { method: 'POST' })
  if (!res.ok) throw new Error(`Pilot confirm failed: ${res.status}`)
  return res.json()
}

export async function getAdvisorInsights(plan) {
  const res = await fetch(`${BASE}/api/advisor`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ plan }),
  })
  if (!res.ok) throw new Error(`Advisor failed: ${res.status}`)
  return res.json()
}

export async function askAdvisor(question, plan = null) {
  const res = await fetch(`${BASE}/api/advisor/ask`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ question, plan }),
  })
  if (!res.ok) throw new Error(`Advisor ask failed: ${res.status}`)
  return res.json()  // { answer }
}

export async function chatAdvisor(messages, plan = null) {
  const res = await fetch(`${BASE}/api/advisor/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages, plan }),
  })
  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(`${res.status}: ${body.detail ?? 'Chat failed'}`)
  }
  return res.json()  // { type: "text"|"tool_use", ... }
}

export async function exportPlanPdf({ registered, student_name, major, term }) {
  const res = await fetch(`${BASE}/api/export-plan`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ registered, student_name, major, term }),
  })
  if (!res.ok) throw new Error(`PDF export failed: ${res.status}`)
  return res.blob()
}

export async function validatePlacement(courseCode, semester, currentPlan) {
  const res = await fetch(`${BASE}/api/validate-placement`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ course_code: courseCode, semester, current_plan: currentPlan }),
  })
  if (!res.ok) throw new Error(`Validation failed: ${res.status}`)
  return res.json()
}
