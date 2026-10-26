import { describe, expect, it } from 'vitest'
import { buildCsv, csvCell } from './csv-download'

describe('import CSV downloads', () => {
  it('quotes cells and escapes embedded quotes', () => {
    expect(csvCell('Dela Cruz, Juan "JD"')).toBe('"Dela Cruz, Juan ""JD"""')
  })

  it('neutralizes spreadsheet formula injection', () => {
    expect(csvCell('=HYPERLINK("http://evil")')).toBe(
      '"\'=HYPERLINK(""http://evil"")"',
    )
    expect(csvCell('+SUM(A1)')).toBe(`"'+SUM(A1)"`)
    expect(csvCell('-2+3')).toBe(`"'-2+3"`)
    expect(csvCell('@cmd')).toBe(`"'@cmd"`)
  })

  it('renders undefined as an empty cell', () => {
    expect(csvCell(undefined)).toBe('""')
    expect(buildCsv([['a', 'b'], [1, undefined]])).toBe('"a","b"\r\n"1",""')
  })
})
