/**
 * Deterministic load-test topology (PUP CCIS attendance, local disposable stack).
 *
 * Mandated shape:
 *   - 2000 students split over 34 sections: 33 sections x 60 students + 1 x 20.
 *   - 12 subjects: the first 11 own 3 sections, the 12th owns 1.
 *   - 12 professors, one per subject; a professor teaches its own sections.
 *
 * Every name, code, email and password is derived from the run ID, so a rerun
 * with the same `K6_RUN_ID` resolves to the exact same rows instead of
 * duplicating them. Nothing here talks to the network.
 */

export const TOPOLOGY = Object.freeze({
  studentCount: 2000,
  subjectCount: 12,
  professorCount: 12,
  sectionCount: 34,
  /** Subject 0..10 own 3 sections, subject 11 owns the single last section. */
  sectionsPerSubject: Object.freeze([3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 1]),
  /** 33 x 60 + 1 x 20 = 2000 */
  mandatedCapacities: Object.freeze([...Array.from({ length: 33 }, () => 60), 20]),
})

const MAX_SECTION_NAME = 100
const MAX_SUBJECT_NAME = 200
const MAX_SUBJECT_CODE = 30

/** URL/email-safe, lowercase slug derived from the run ID. */
const slugify = (value, maxLength, fallback) => {
  const slug = String(value)
    .replace(/[^A-Za-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
    .slice(0, maxLength)
  return slug || fallback
}

/** Compact alphanumeric token used inside passwords and subject codes. */
const compact = (value, maxLength, fallback) => {
  const token = String(value)
    .replace(/[^A-Za-z0-9]/g, '')
    .slice(0, maxLength)
  return token || fallback
}

/**
 * Strong-password policy (backend `IsStrongPassword`): >= 12 chars with lower,
 * upper, digit and symbol. The tag keeps each account distinct while remaining
 * reproducible for idempotent reruns.
 */
export const buildPassword = ({ runId, tag }) => `Ld${compact(runId, 8, 'Load')}${tag}Aa1!`

/**
 * Even split used for non-mandated student counts (smoke runs). The 2000-student
 * run always resolves to the mandated 33 x 60 + 20 split.
 */
const evenCapacities = (studentCount) => {
  const base = Math.floor(studentCount / TOPOLOGY.sectionCount)
  const remainder = studentCount % TOPOLOGY.sectionCount
  return Array.from({ length: TOPOLOGY.sectionCount }, (_, index) => base + (index < remainder ? 1 : 0))
}

export function buildTopology({ runId, studentCount = TOPOLOGY.studentCount }) {
  if (!Number.isInteger(studentCount) || studentCount < TOPOLOGY.sectionCount) {
    throw new Error(`studentCount must be an integer >= ${TOPOLOGY.sectionCount}`)
  }

  const mandated = studentCount === TOPOLOGY.studentCount
  const capacities = mandated ? [...TOPOLOGY.mandatedCapacities] : evenCapacities(studentCount)
  const total = capacities.reduce((sum, value) => sum + value, 0)
  if (total !== studentCount) {
    throw new Error(`topology capacities sum to ${total}, expected ${studentCount}`)
  }

  const professors = Array.from({ length: TOPOLOGY.professorCount }, (_, index) => {
    const tag = `Pf${index + 1}`
    return {
      index,
      tag,
      email: `load.${slugify(runId, 40, 'run')}.${tag.toLowerCase()}@pup.edu.ph`,
      fullName: `Load Professor ${runId} ${tag}`.slice(0, 150),
      password: buildPassword({ runId, tag }),
      department: 'CCIS',
      subjectIndex: index,
    }
  })

  const subjects = Array.from({ length: TOPOLOGY.subjectCount }, (_, index) => ({
    index,
    name: `Load ${runId} S${index + 1}`.slice(0, MAX_SUBJECT_NAME),
    code: `LD-${compact(runId, 12, 'RUN').toUpperCase()}-${index + 1}`.slice(0, MAX_SUBJECT_CODE),
    description: `Disposable local load-test subject (${runId})`,
    professorIndex: index,
  }))

  const sections = []
  for (let subjectIndex = 0; subjectIndex < TOPOLOGY.subjectCount; subjectIndex += 1) {
    for (let group = 0; group < TOPOLOGY.sectionsPerSubject[subjectIndex]; group += 1) {
      const index = sections.length
      const subject = subjects[subjectIndex]
      const studentStart = capacities.slice(0, index).reduce((sum, value) => sum + value, 0)
      sections.push({
        index,
        subjectIndex,
        group,
        name: `${subject.name} G${group + 1}`.slice(0, MAX_SECTION_NAME),
        capacity: capacities[index],
        studentStart,
        studentEnd: studentStart + capacities[index],
        professorIndex: subjectIndex,
      })
    }
  }

  if (sections.length !== TOPOLOGY.sectionCount) {
    throw new Error(`topology built ${sections.length} sections, expected ${TOPOLOGY.sectionCount}`)
  }

  const studentSectionIndexes = new Array(studentCount)
  for (const section of sections) {
    for (let student = section.studentStart; student < section.studentEnd; student += 1) {
      studentSectionIndexes[student] = section.index
    }
  }

  return {
    runId,
    studentCount,
    mandated,
    professors,
    subjects,
    sections,
    studentSectionIndexes,
    studentsBySection: sections.map((section) => Array.from({ length: section.capacity }, (_, offset) => section.studentStart + offset)),
  }
}
