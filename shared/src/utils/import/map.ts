import { normalizeCourse } from '../course'
import { normalizeEmail, normalizeStudentId, normalizeYearLevel } from './normalize'

export interface ImportColumnMapping {
  studentId?: number
  fullName?: number
  email?: number
  program?: number
  yearLevel?: number
  department?: number
}

const ALIASES: Record<keyof ImportColumnMapping, string[]> = {
  studentId: [
    'studentnumber',
    'studentno',
    'studentid',
    'studentnumberno',
    'sn',
    'pupstudentnumber',
    'pupstudentid',
    'idnumber',
  ],
  fullName: [
    'name',
    'fullname',
    'studentname',
    'nameofstudent',
    'surnamefirstname',
    'surnamefirstnamemi',
    'lastnamefirstname',
    'completename',
  ],
  email: ['email', 'emailaddress', 'pupemail', 'studentemail'],
  program: ['program', 'course', 'degree', 'degreeprogram', 'curriculum'],
  yearLevel: ['yearlevel', 'year', 'yr', 'yrlevel', 'yearofstudy', 'yearstanding'],
  // Never suggested: students have no department, their program is the course.
  department: [],
}

function canonicalHeader(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/g, '')
}

function scoreHeader(field: keyof ImportColumnMapping, header: string): number {
  const canonical = canonicalHeader(header)
  if (!canonical) return 0
  if (ALIASES[field].includes(canonical)) return 100

  switch (field) {
    case 'studentId':
      if (/student(number|no|id)/.test(canonical)) return 90
      if (canonical === 'sn') return 85
      if (/(^|student)pup?(number|no|id)/.test(canonical)) return 70
      if (canonical.endsWith('idnumber')) return 60
      return 0
    case 'fullName':
      if (canonical.includes('name') && !canonical.includes('program')) return 80
      if (canonical.includes('surname')) return 70
      return 0
    case 'email':
      return canonical.includes('email') ? 90 : 0
    case 'program':
      if (canonical.includes('program') || canonical.includes('course')) return 80
      if (canonical.includes('degree') || canonical.includes('curriculum')) return 65
      return 0
    case 'yearLevel':
      if (/^(year|yr)(level|ofstudy|standing)?$/.test(canonical)) return 85
      if (canonical.includes('yearlevel') || canonical.includes('yearofstudy')) return 80
      return 0
    case 'department':
      return 0
  }
}

const FIELD_ORDER: (keyof ImportColumnMapping)[] = [
  'studentId',
  'email',
  'yearLevel',
  'program',
  'department',
  'fullName',
]

/** Fields that can be recognised from what a column holds, whatever its heading says. */
export type ContentDetectableField = 'studentId' | 'email' | 'program' | 'yearLevel'

const CONTENT_SAMPLE_ROWS = 50
const CONTENT_MATCH_SHARE = 0.8

const CONTENT_DETECTORS: Record<ContentDetectableField, (value: string) => boolean> = {
  studentId: (value) => normalizeStudentId(value).value !== undefined,
  email: (value) => normalizeEmail(value).value !== undefined,
  program: (value) => normalizeCourse(value).matched,
  // Bare digits are left alone: a "No." column of 1, 2, 3 is not a year level.
  yearLevel: (value) => /[a-z]/i.test(value) && normalizeYearLevel(value).value !== undefined,
}

/** Does most of this column's filled-in data look like the field? */
export function columnMatchesContent(
  rows: readonly (readonly string[])[],
  index: number,
  field: ContentDetectableField,
): boolean {
  const values = rows
    .slice(0, CONTENT_SAMPLE_ROWS)
    .map((row) => (row[index] ?? '').trim())
    .filter(Boolean)
  if (values.length === 0) return false
  const matches = values.filter(CONTENT_DETECTORS[field]).length
  return matches / values.length >= CONTENT_MATCH_SHARE
}

/**
 * Suggests the automatic mapping for known registrar SIS headers. With the data rows it also recognises
 * columns by their contents when the headings are unfamiliar. The import wizard always shows the result for
 * visual confirmation before parsing continues. One column is never suggested for two fields.
 */
export function suggestColumnMapping(headers: string[], rows?: readonly (readonly string[])[]): ImportColumnMapping {
  const mapping: ImportColumnMapping = {}
  const used = new Set<number>()

  for (const field of FIELD_ORDER) {
    let bestIndex: number | undefined
    let bestScore = 0
    headers.forEach((header, index) => {
      if (used.has(index)) return
      const score = scoreHeader(field, header)
      if (score > bestScore) {
        bestScore = score
        bestIndex = index
      }
    })
    if (bestIndex !== undefined && bestScore >= 60) {
      mapping[field] = bestIndex
      used.add(bestIndex)
    }
  }

  if (rows) {
    for (const field of Object.keys(CONTENT_DETECTORS) as ContentDetectableField[]) {
      if (mapping[field] !== undefined) continue
      const index = headers.findIndex((_, column) => !used.has(column) && columnMatchesContent(rows, column, field))
      if (index >= 0) {
        mapping[field] = index
        used.add(index)
      }
    }
  }

  return mapping
}

export function mappingFieldLabel(field: keyof ImportColumnMapping): string {
  switch (field) {
    case 'studentId': return 'Student number'
    case 'fullName': return 'Full name'
    case 'email': return 'Email'
    case 'program': return 'Program'
    case 'yearLevel': return 'Year level'
    case 'department': return 'Department'
  }
}
