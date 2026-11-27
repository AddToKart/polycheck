import { normalizeCourse } from '../course'

/**
 * Reshapes a class list into the columns the import understands, before the columns are matched. School lists
 * often (1) put the student number and the name in one cell, (2) split the name into Last, First and Middle
 * columns, or (3) name the class only by a section code such as `BSIT-SM 4-1`. Nothing is removed from the
 * file: new columns are added at the end, so the person importing sees and can change what will be read.
 */
export interface PreparedImportTable {
  headers: string[]
  rows: string[][]
  /** Plain-language account of what was added, shown next to the column matching. */
  notes: string[]
}

const canonical = (value: string) => value.toLowerCase().replace(/[^a-z0-9ñ]+/g, '')

const LAST_NAME = ['lastname', 'surname', 'familyname']
const FIRST_NAME = ['firstname', 'givenname']
const MIDDLE_NAME = ['middlename', 'middleinitial', 'mi']
const SUFFIX = ['suffix', 'nameextension', 'extensionname']
const WHOLE_NAME = ['name', 'fullname', 'studentname', 'completename', 'nameofstudent']

const NUMBER_ONLY = /^\s*\d{4}-\d{5}-[A-Za-z]{2}-\d\s*$/
const NUMBER_THEN_NAME = /^\s*(\d{4}-\d{5}-[A-Za-z]{2}-\d)(?!\d)\s*[-–,:]?\s*(\p{L}.*)$/u
// "BSIT-SM 4-1" or "BSIT 4-1": program, optional campus code, year level, section number.
const SECTION_CODE = /^\s*([A-Za-z]{3,10})(?:\s*-\s*[A-Za-z]{2,4})?\s+([1-8])\s*-\s*\d{1,2}[A-Za-z]?\s*$/

const MATCH_SHARE = 0.8

/** The index of the first column whose filled-in cells mostly satisfy `matches`, or -1. */
function columnWhere(width: number, rows: string[][], matches: (value: string) => boolean): number {
  for (let column = 0; column < width; column += 1) {
    const values = rows.map((row) => (row[column] ?? '').trim()).filter(Boolean)
    if (values.length > 0 && values.filter(matches).length / values.length >= MATCH_SHARE) return column
  }
  return -1
}

const sectionProgram = (value: string) => {
  const match = SECTION_CODE.exec(value)
  const course = match ? normalizeCourse(match[1]) : null
  return match && course?.matched && course.code ? { program: course.code, year: match[2] } : null
}

export function prepareImportTable(sourceHeaders: string[], sourceRows: string[][]): PreparedImportTable {
  // Some exports leave literal quotation marks around a heading.
  const headers = sourceHeaders.map((header) => header.replace(/^\s*"+|"+\s*$/g, ''))
  const rows = sourceRows.map((row) => headers.map((_, column) => row[column] ?? ''))
  const notes: string[] = []
  const find = (names: string[]) => headers.findIndex((header) => names.includes(canonical(header)))
  const add = (header: string, value: (row: string[]) => string) => {
    for (const row of rows) row.push(value(row))
    headers.push(header)
  }

  if (columnWhere(headers.length, rows, (value) => NUMBER_ONLY.test(value)) < 0) {
    const combined = columnWhere(headers.length, rows, (value) => NUMBER_THEN_NAME.test(value))
    if (combined >= 0) {
      const source = headers[combined]
      add('Student Number', (row) => NUMBER_THEN_NAME.exec(row[combined])?.[1] ?? '')
      for (const row of rows) row[combined] = NUMBER_THEN_NAME.exec(row[combined])?.[2].trim() ?? row[combined]
      notes.push(`The student number and name shared the "${source}" column, so they were separated.`)
    }
  }

  const last = find(LAST_NAME)
  const first = find(FIRST_NAME)
  if (last >= 0 && first >= 0 && find(WHOLE_NAME) < 0) {
    const middle = find(MIDDLE_NAME)
    const suffix = find(SUFFIX)
    add('Full Name', (row) => {
      const part = (column: number) => (column >= 0 ? row[column].trim() : '')
      const given = [part(first), part(middle), part(suffix)].filter(Boolean).join(' ')
      return [part(last), given].filter(Boolean).join(', ')
    })
    notes.push('A Full Name column was made from the separate name columns, as "Last, First Middle".')
  }

  const hasProgram =
    headers.some((header) => /program|course|degree|curriculum/.test(canonical(header))) ||
    columnWhere(headers.length, rows, (value) => normalizeCourse(value).matched) >= 0
  const section = columnWhere(headers.length, rows, (value) => sectionProgram(value) !== null)
  if (section >= 0) {
    const source = headers[section]
    const added: string[] = []
    if (!hasProgram) {
      add('Program', (row) => sectionProgram(row[section])?.program ?? '')
      added.push('Program')
    }
    if (!headers.some((header) => /^(year|yr)/.test(canonical(header)))) {
      add('Year Level', (row) => sectionProgram(row[section])?.year ?? '')
      added.push('Year Level')
    }
    if (added.length > 0) notes.push(`${added.join(' and ')} came from the "${source}" column. Check them below.`)
  }

  return { headers, rows, notes }
}
