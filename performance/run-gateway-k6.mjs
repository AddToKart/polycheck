import { readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { spawn } from 'node:child_process'
import { join } from 'node:path'
import { signQRToken } from '../shared/dist/index.mjs'

const API = process.env.E2E_API ?? 'http://127.0.0.1:4000/api'
const INGEST = process.env.E2E_INGEST ?? 'http://127.0.0.1:4001'
const fixturePath = process.argv[2] ?? 'performance/.local-fixture-lt5-1794430125.json'
const k6Bin = process.env.K6_BIN ?? 'C:\\Users\\Cayz\\tools\\k6\\k6-v2.3.0-windows-amd64\\k6.exe'

const fixture = JSON.parse(readFileSync(fixturePath, 'utf8'))
console.log(`[k6-prep] loaded fixture: ${fixturePath} (${fixture.sections.length} sections, ${fixture.students.length} students)`)

const pad = (n) => String(n).padStart(2, '0')
const now = new Date()
const date = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
const startTime = `${pad(now.getHours())}:${pad(now.getMinutes())}`
const endTime = `${pad((now.getHours() + 1) % 24)}:${pad(now.getMinutes())}`

async function api(path, { method = 'GET', token, body } = {}) {
  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      ...(body ? { 'content-type': 'application/json' } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(30_000),
  })
  return { status: response.status, json: await response.json().catch(() => null) }
}

const targets = []

console.log('[k6-prep] arming sessions on backend...')
for (const [index, section] of fixture.sections.entries()) {
  const created = await api('/sessions', {
    method: 'POST',
    token: section.teacherToken,
    body: {
      sectionId: section.sectionId,
      subjectName: `k6 Burst ${fixture.K6_RUN_ID} S${index + 1}`,
      mode: 'in_person',
      date,
      startTime,
      endTime,
      qrValidityMinutes: 15,
      gracePeriodMinutes: 15,
      geofence: { latitude: fixture.LATITUDE, longitude: fixture.LONGITUDE, radiusMeters: 200 },
    },
  })
  let sessionId = created.json?.id
  let qrToken = null
  let issuedAt = Date.now()

  if (created.status === 409) {
    // Existing active session for section — fetch it
    const list = await api(`/sessions?sectionId=${encodeURIComponent(section.sectionId)}`, {
      token: section.teacherToken,
    })
    const active = Array.isArray(list.json) ? list.json.find((s) => s.isActive && s.qrToken) : null
    if (active) {
      sessionId = active.id
      qrToken = active.qrToken
    }
  }

  if (!sessionId) {
    console.error(`session create failed for section ${index}: ${created.status}`)
    continue
  }

  if (!qrToken) {
    qrToken = signQRToken(
      {
        version: 1,
        sessionId,
        sectionId: section.sectionId,
        teacherId: section.teacherId,
        teacherName: section.teacherName ?? 'k6 Professor',
        issuedAt,
        validityMinutes: 15,
        gracePeriodMinutes: 15,
        mode: 'in_person',
        pinRequired: false,
      },
      section.signingKey,
    )
    const activated = await api(`/sessions/${encodeURIComponent(sessionId)}/activate`, {
      method: 'POST',
      token: section.teacherToken,
      body: { validityMinutes: 15, gracePeriodMinutes: 15, token: qrToken },
    })
    if (activated.status >= 400) {
      console.error(`activate failed for section ${index}: ${activated.status}`)
      continue
    }
  }
  const students = fixture.students.filter((student) => student.sectionIndex === index)
  for (const student of students) {
    targets.push({
      sessionId,
      qrToken,
      studentToken: student.token,
      issuedAt,
      lat: fixture.LATITUDE + 0.00002,
      lon: fixture.LONGITUDE,
    })
  }
}

console.log(`[k6-prep] armed ${fixture.sections.length} sessions, total ${targets.length} targets prepared`)

const targetFilePath = join('performance', '.gateway-k6-targets.json')
writeFileSync(targetFilePath, JSON.stringify(targets, null, 2))
console.log(`[k6-prep] wrote target payload file: ${targetFilePath}`)

console.log(`[k6-run] executing k6 benchmark (${targets.length} VUs concurrent burst against ${INGEST})...`)

const child = spawn(k6Bin, ['run', 'performance/gateway-scan-k6.js', '-e', `INGEST_URL=${INGEST}`], {
  stdio: 'inherit',
  shell: true,
})

child.on('close', (code) => {
  console.log(`[k6-run] k6 finished with exit code ${code}`)
  try {
    unlinkSync(targetFilePath)
  } catch {}
  process.exit(code)
})
