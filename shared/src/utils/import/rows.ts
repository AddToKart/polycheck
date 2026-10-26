import type { EnrollImportRow, ImportIssue, StudentImportRow } from '../../types/bulk-import'
import type { ImportColumnMapping } from './map'
import { cell } from './parse'
import {
  normalizeDepartment,
  normalizeEmail,
  normalizeFullName,
  normalizeProgram,
  normalizeStudentId,
  normalizeYearLevel,
} from './normalize'

export interface BuildResult<T> {
  rows: T[]
  issues: ImportIssue[]
}

export function buildStudentRows(
  rawRows: string[][],
  mapping: ImportColumnMapping,
): BuildResult<StudentImportRow> {
  const rows: StudentImportRow[] = []
  const issues: ImportIssue[] = []
  const seen = new Map<string, number>()

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 2
    const studentIdResult = normalizeStudentId(cell(raw, mapping.studentId))
    const nameResult = normalizeFullName(cell(raw, mapping.fullName))

    if (studentIdResult.issue === 'MISSING_REQUIRED_FIELD' && !cell(raw, mapping.fullName).trim()) {
      return
    }
    if (studentIdResult.issue) {
      issues.push({
        rowNumber,
        column: 'studentId',
        code: studentIdResult.issue,
        message:
          studentIdResult.issue === 'EXCEL_MANGLED_STUDENT_NUMBER'
            ? 'Student number looks mangled by Excel. Re-export the CSV with the SN column formatted as text.'
            : 'Enter a valid PUP student number (e.g. 2024-00001-MN-0).',
      })
    }
    if (nameResult.issue) {
      issues.push({
        rowNumber,
        column: 'fullName',
        code: 'MISSING_REQUIRED_FIELD',
        message: 'Full name is required (at least 2 characters).',
      })
    }
    if (!studentIdResult.value || !nameResult.value) return

    const duplicateOf = seen.get(studentIdResult.value)
    if (duplicateOf !== undefined) {
      issues.push({
        rowNumber,
        column: 'studentId',
        code: 'DUPLICATE_IN_FILE',
        message: `Duplicate of row ${duplicateOf}.`,
      })
      return
    }
    seen.set(studentIdResult.value, rowNumber)

    const emailResult = normalizeEmail(cell(raw, mapping.email))
    const programResult = normalizeProgram(cell(raw, mapping.program))
    const yearResult = normalizeYearLevel(cell(raw, mapping.yearLevel))

    if (emailResult.issue) {
      issues.push({ rowNumber, column: 'email', code: 'INVALID_EMAIL', message: 'Email address is invalid and was ignored.' })
    }
    if (programResult.issue) {
      issues.push({ rowNumber, column: 'program', code: 'PROGRAM_TOO_SHORT', message: 'Program name is too short and was ignored.' })
    }
    if (yearResult.issue) {
      issues.push({ rowNumber, column: 'yearLevel', code: 'YEAR_LEVEL_OUT_OF_RANGE', message: 'Year level must be between 1 and 8 and was ignored.' })
    }

    rows.push({
      rowNumber,
      studentId: studentIdResult.value,
      fullName: nameResult.value,
      ...(emailResult.value ? { email: emailResult.value } : {}),
      ...(programResult.value ? { program: programResult.value } : {}),
      ...(yearResult.value ? { yearLevel: yearResult.value } : {}),
      ...(normalizeDepartment(cell(raw, mapping.department)) ? { department: normalizeDepartment(cell(raw, mapping.department)) } : {}),
    })
  })

  return { rows, issues }
}

export function buildEnrollRows(
  rawRows: string[][],
  mapping: ImportColumnMapping,
): BuildResult<EnrollImportRow> {
  const rows: EnrollImportRow[] = []
  const issues: ImportIssue[] = []
  const seen = new Map<string, number>()

  rawRows.forEach((raw, index) => {
    const rowNumber = index + 2
    const studentIdResult = normalizeStudentId(cell(raw, mapping.studentId))
    if (studentIdResult.issue === 'MISSING_REQUIRED_FIELD') return
    if (studentIdResult.issue) {
      issues.push({
        rowNumber,
        column: 'studentId',
        code: studentIdResult.issue,
        message:
          studentIdResult.issue === 'EXCEL_MANGLED_STUDENT_NUMBER'
            ? 'Student number looks mangled by Excel. Re-export the CSV with the SN column formatted as text.'
            : 'Enter a valid PUP student number (e.g. 2024-00001-MN-0).',
      })
      return
    }
    if (!studentIdResult.value) return

    const duplicateOf = seen.get(studentIdResult.value)
    if (duplicateOf !== undefined) {
      issues.push({
        rowNumber,
        column: 'studentId',
        code: 'DUPLICATE_IN_FILE',
        message: `Duplicate of row ${duplicateOf}.`,
      })
      return
    }
    seen.set(studentIdResult.value, rowNumber)

    const name = normalizeFullName(cell(raw, mapping.fullName))
    const program = normalizeProgram(cell(raw, mapping.program))
    const year = normalizeYearLevel(cell(raw, mapping.yearLevel))

    rows.push({
      rowNumber,
      studentId: studentIdResult.value,
      ...(name.value ? { studentName: name.value } : {}),
      ...(program.value ? { expectedProgram: program.value } : {}),
      ...(year.value ? { expectedYearLevel: year.value } : {}),
    })
  })

  return { rows, issues }
}
