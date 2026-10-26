import 'reflect-metadata'
import { plainToInstance } from 'class-transformer'
import { validate } from 'class-validator'
import { EnrollImportRequestDto, EnrollImportRowDto } from './import-enrollments.dto'

function request(overrides: Record<string, unknown> = {}) {
  return plainToInstance(EnrollImportRequestDto, {
    mode: 'validate',
    rows: [
      {
        rowNumber: '2',
        studentId: ' 2024-00001-mn-0 ',
        studentName: ' Dela Cruz, Juan M. ',
        expectedProgram: ' BSIT ',
        expectedYearLevel: '2',
      },
    ],
    ...overrides,
  })
}

describe('EnrollImportRequestDto', () => {
  it('normalizes verification fields and converts the expected year level', async () => {
    const dto = request()

    await expect(validate(dto)).resolves.toEqual([])
    expect(dto.rows[0].studentId).toBe('2024-00001-MN-0')
    expect(dto.rows[0].studentName).toBe('Dela Cruz, Juan M.')
    expect(dto.rows[0].expectedProgram).toBe('BSIT')
    expect(dto.rows[0].expectedYearLevel).toBe(2)
  })

  it.each([
    ['empty rows', { rows: [] }],
    [
      'more than 250 rows',
      { rows: Array.from({ length: 251 }, (_, index) => ({ rowNumber: index + 1, studentId: '2024-00001-MN-0' })) },
    ],
    ['unknown mode', { mode: 'preview' }],
    ['bad idempotency key', { idempotencyKey: 'short' }],
  ])('rejects %s', async (_label, override) => {
    await expect(validate(request(override))).resolves.not.toEqual([])
  })

  it('requires a checksum for execute', async () => {
    await expect(validate(request({ mode: 'execute' }))).resolves.not.toEqual([])
    await expect(validate(request({ mode: 'execute', rowChecksum: 'a'.repeat(16) }))).resolves.toEqual([])
  })

  it.each([
    ['malformed student number', { studentId: 'S-1' }],
    ['year level out of range', { expectedYearLevel: 0 }],
    ['empty student name', { studentName: '' }],
  ])('rejects %s', async (_label, override) => {
    const dto = plainToInstance(EnrollImportRowDto, {
      rowNumber: 2,
      studentId: '2024-00001-MN-0',
      ...override,
    })
    await expect(validate(dto)).resolves.not.toEqual([])
  })
})
