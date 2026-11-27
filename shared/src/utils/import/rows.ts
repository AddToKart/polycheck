import type { EnrollImportRow, ImportIssue, StudentImportRow } from '../../types/bulk-import'
import type { ImportColumnMapping } from './map'
import { cell } from './parse'
import {
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
  const emailRow = new Map<string, number>()

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
            ? 'Excel changed this student number. Save your file again with the student number column formatted as text.'
            : 'Enter a valid student number (e.g. 2024-00001-MN-0).',
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

    if (emailResult.value) {
      const sameEmail = emailRow.get(emailResult.value)
      if (sameEmail !== undefined) {
        issues.push({
          rowNumber,
          column: 'email',
          code: 'DUPLICATE_IN_FILE',
          message: `Same email address as row ${sameEmail}. Each student needs their own email.`,
        })
        return
      }
      emailRow.set(emailResult.value, rowNumber)
    }

    rows.push({
      rowNumber,
      studentId: studentIdResult.value,
      fullName: nameResult.value,
      ...(emailResult.value ? { email: emailResult.value } : {}),
      ...(programResult.value ? { program: programResult.value } : {}),
      ...(yearResult.value ? { yearLevel: yearResult.value } : {}),
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
    // Without a student number, the row can still be matched by the account's school email.
    const email = studentIdResult.value ? undefined : normalizeEmail(cell(raw, mapping.email)).value
    if (studentIdResult.issue === 'MISSING_REQUIRED_FIELD' && !email) {
      if (raw.some((value) => value.trim() !== '')) {
        issues.push({
          rowNumber,
          column: 'studentId',
          code: 'MISSING_REQUIRED_FIELD',
          message: 'This row has no student number or school email, so no student can be matched.',
        })
      }
      return
    }
    if (studentIdResult.issue && !email) {
      issues.push({
        rowNumber,
        column: 'studentId',
        code: studentIdResult.issue,
        message:
          studentIdResult.issue === 'EXCEL_MANGLED_STUDENT_NUMBER'
            ? 'Excel changed this student number. Save your file again with the student number column formatted as text.'
            : 'Enter a valid student number (e.g. 2024-00001-MN-0).',
      })
      return
    }
    const key = studentIdResult.value ?? email
    if (!key) return

    const duplicateOf = seen.get(key)
    if (duplicateOf !== undefined) {
      issues.push({
        rowNumber,
        column: studentIdResult.value ? 'studentId' : 'email',
        code: 'DUPLICATE_IN_FILE',
        message: `Duplicate of row ${duplicateOf}.`,
      })
      return
    }
    seen.set(key, rowNumber)

    const name = normalizeFullName(cell(raw, mapping.fullName))
    const program = normalizeProgram(cell(raw, mapping.program))
    const year = normalizeYearLevel(cell(raw, mapping.yearLevel))

    rows.push({
      rowNumber,
      ...(studentIdResult.value ? { studentId: studentIdResult.value } : { email }),
      ...(name.value ? { studentName: name.value } : {}),
      ...(program.value ? { expectedProgram: program.value } : {}),
      ...(year.value ? { expectedYearLevel: year.value } : {}),
    })
  })

  return { rows, issues }
}
