import { describe, expect, it } from 'vitest'
import {
  activeFilterCount,
  defaultUrlFilters,
  filterSearchString,
  readUrlFilters,
  writeUrlFilters,
} from './url-filters'

const schema = {
  subjectId: { defaultValue: '' },
  sectionId: { defaultValue: '' },
  status: { defaultValue: 'all', allowed: ['all', 'active', 'completed'] as const },
  from: { defaultValue: '' },
} as const

describe('url filter helpers', () => {
  it('reads defaults when the query string is empty', () => {
    const values = readUrlFilters(schema, new URLSearchParams())
    expect(values).toEqual({ subjectId: '', sectionId: '', status: 'all', from: '' })
  })

  it('restores declared values and falls back for disallowed ones', () => {
    const values = readUrlFilters(
      schema,
      new URLSearchParams('subjectId=sub-1&status=active'),
    )
    expect(values.subjectId).toBe('sub-1')
    expect(values.status).toBe('active')
    expect(readUrlFilters(schema, new URLSearchParams('status=hacked')).status).toBe('all')
  })

  it('writes only non-default values and preserves unrelated params', () => {
    const next = writeUrlFilters(
      schema,
      { subjectId: 'sub-1', status: 'all', from: '2026-10-01' },
      new URLSearchParams('tab=attendance&teacherId=teacher-1'),
    )
    expect(next.get('subjectId')).toBe('sub-1')
    expect(next.get('from')).toBe('2026-10-01')
    expect(next.has('status')).toBe(false)
    expect(next.get('tab')).toBe('attendance')
    expect(next.get('teacherId')).toBe('teacher-1')
  })

  it('round-trips through a query string', () => {
    const written = writeUrlFilters(schema, { subjectId: 'sub-2', status: 'completed' })
    expect(filterSearchString(written)).toBe('?subjectId=sub-2&status=completed')
    expect(readUrlFilters(schema, new URLSearchParams(written.toString()))).toMatchObject({
      subjectId: 'sub-2',
      status: 'completed',
    })
  })

  it('clear-all removes owned defaults but keeps unrelated tabs', () => {
    const cleared = writeUrlFilters(
      schema,
      defaultUrlFilters(schema),
      new URLSearchParams('tab=attendance&subjectId=sub-1&status=active'),
    )
    expect(filterSearchString(cleared)).toBe('?tab=attendance')
    expect(filterSearchString(writeUrlFilters(schema, defaultUrlFilters(schema)))).toBe('')
  })

  it('counts only active filters', () => {
    expect(activeFilterCount(schema, defaultUrlFilters(schema))).toBe(0)
    expect(
      activeFilterCount(schema, { subjectId: 'sub-1', sectionId: '', status: 'active', from: '' }),
    ).toBe(2)
  })
})
