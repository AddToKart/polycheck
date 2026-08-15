import { lockStudentSection } from './student-section-lock'

describe('lockStudentSection', () => {
  it('uses stable pair-specific keys with a tagged transaction query', async () => {
    const executeRaw = jest.fn().mockResolvedValue(0)
    const tx = { $executeRaw: executeRaw }

    await lockStudentSection(tx as never, 'student-1', 'section-1')
    await lockStudentSection(tx as never, 'student-1', 'section-1')
    await lockStudentSection(tx as never, 'student-1', 'section-2')

    const firstKeys = executeRaw.mock.calls[0].slice(1)
    expect(executeRaw.mock.calls[0][0]).toEqual([
      'SELECT pg_advisory_xact_lock(',
      ', ',
      ')',
    ])
    expect(executeRaw.mock.calls[1].slice(1)).toEqual(firstKeys)
    expect(executeRaw.mock.calls[2].slice(1)).not.toEqual(firstKeys)
    expect(firstKeys).toEqual([expect.any(Number), expect.any(Number)])
  })
})
