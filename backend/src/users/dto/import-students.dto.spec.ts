import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { StudentImportRequestDto, StudentImportRowDto } from './import-students.dto'

function request(overrides: Record<string, unknown> = {}) {
  return plainToInstance(StudentImportRequestDto, {
    mode: 'validate',
    conflictMode: 'skip_existing',
    rows: [
      {
        rowNumber: '2',
        fullName: '  Dela Cruz, Juan M.  ',
        studentId: ' 2024-00001-mn-0 ',
        email: ' JUAN@PUP.EDU.PH ',
        program: ' BSIT ',
        yearLevel: '2',
        department: ' CCIS ',
      },
    ],
    ...overrides,
  })
}

describe('StudentImportRequestDto', () => {
  it('normalizes row values and converts numeric fields', async () => {
    const dto = request()

    await expect(validate(dto)).resolves.toEqual([])
    expect(dto.rows[0].rowNumber).toBe(2)
    expect(dto.rows[0].studentId).toBe('2024-00001-MN-0')
    expect(dto.rows[0].fullName).toBe('Dela Cruz, Juan M.')
    expect(dto.rows[0].email).toBe('juan@pup.edu.ph')
    expect(dto.rows[0].yearLevel).toBe(2)
    expect(dto.rows[0].department).toBe('CCIS')
  })

  it.each([
    ['missing rows', { rows: [] }],
    [
      'too many rows',
      {
        rows: Array.from({ length: 251 }, (_, index) => ({
          rowNumber: index + 1,
          fullName: 'Student',
          studentId: '2024-00001-MN-0',
        })),
      },
    ],
    ['unknown mode', { mode: 'preview' }],
    ['unknown conflict mode', { conflictMode: 'overwrite' }],
    ['bad idempotency key', { idempotencyKey: 'short' }],
  ])('rejects %s', async (_label, override) => {
    await expect(validate(request(override))).resolves.not.toEqual([])
  })

  it('requires a valid checksum for execute mode only', async () => {
    await expect(validate(request({ mode: 'execute' }))).resolves.not.toEqual([])
    await expect(validate(request({ mode: 'execute', rowChecksum: 'not-a-checksum' }))).resolves.not.toEqual([])
    await expect(validate(request({ mode: 'execute', rowChecksum: 'a'.repeat(16) }))).resolves.toEqual([])
    await expect(validate(request({ mode: 'validate' }))).resolves.toEqual([])
  })

  it.each([
    ['malformed student number', { studentId: '2024-1' }],
    ['invalid email', { email: 'not-an-email' }],
    ['year level out of range', { yearLevel: 9 }],
    ['too-short program', { program: 'B' }],
    ['too-short department', { department: 'C' }],
    ['too-short name', { fullName: 'A' }],
  ])('rejects %s', async (_label, override) => {
    const dto = plainToInstance(StudentImportRowDto, {
      rowNumber: 2,
      fullName: 'Student Name',
      studentId: '2024-00001-MN-0',
      ...override,
    })
    await expect(validate(dto)).resolves.not.toEqual([])
  })

  it('accepts 250 rows (the chunk limit) per request', async () => {
    const rows = Array.from({ length: 250 }, (_, index) => ({
      rowNumber: index + 1,
      fullName: `Student ${index + 1}`,
      studentId: `2024-${String(index + 1).padStart(5, '0')}-MN-0`,
    }))
    await expect(validate(request({ rows }))).resolves.toEqual([])
  })
})
