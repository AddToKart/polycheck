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
  department: ['department', 'dept', 'college', 'collegedepartment', 'departmentcollege'],
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
      if (canonical.includes('department') || canonical.includes('dept')) return 85
      if (canonical.includes('college')) return 75
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

/**
 * Suggests the automatic mapping for known PUP SIS headers. The import wizard
 * always shows the result for visual confirmation before parsing continues.
 */
export function suggestColumnMapping(headers: string[]): ImportColumnMapping {
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
