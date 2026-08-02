import { isValidIsoDate, parseIsoDate } from './iso-date'

describe('ISO calendar date validation', () => {
  it.each(['2026-01-01', '2024-02-29', '9999-12-31'])('accepts a real date: %s', (value) => {
    expect(isValidIsoDate(value)).toBe(true)
    expect(parseIsoDate(value)?.toISOString().slice(0, 10)).toBe(value)
  })

  it.each(['2026-02-29', '2026-02-30', '2026-13-01', '2026-00-10', '2026-1-01', 'not-a-date'])(
    'rejects an invalid date: %s',
    (value) => {
      expect(isValidIsoDate(value)).toBe(false)
      expect(parseIsoDate(value)).toBeNull()
    },
  )
})
