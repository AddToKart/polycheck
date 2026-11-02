import { describe, expect, it } from 'vitest'
import { createSessionHref, sectionContextHref, sessionsListHref } from './section-context'

describe('section context URL helpers', () => {
  it('sets sectionId while preserving every other parameter', () => {
    expect(
      sectionContextHref('/faculty/sessions', 'status=active&from=2026-08-01&tab=calendar', 'section-1'),
    ).toBe('/faculty/sessions?status=active&from=2026-08-01&tab=calendar&sectionId=section-1')
  })

  it('replaces an existing sectionId instead of duplicating it', () => {
    expect(sectionContextHref('/faculty/sessions', 'sectionId=old&status=active', 'new')).toBe(
      '/faculty/sessions?sectionId=new&status=active',
    )
  })

  it('clears only sectionId', () => {
    expect(sectionContextHref('/faculty/sessions', 'sectionId=section-1&status=active&to=2026-08-31', null)).toBe(
      '/faculty/sessions?status=active&to=2026-08-31',
    )
  })

  it('returns a bare path when the query becomes empty', () => {
    expect(sectionContextHref('/faculty/sessions', 'sectionId=section-1', null)).toBe('/faculty/sessions')
  })

  it('builds canonical list and create links from a section', () => {
    expect(sessionsListHref('section-1')).toBe('/faculty/sessions?sectionId=section-1')
    expect(sessionsListHref()).toBe('/faculty/sessions')
    expect(createSessionHref('section-1')).toBe('/faculty/sessions/create?sectionId=section-1')
    expect(createSessionHref(null)).toBe('/faculty/sessions/create')
  })
})
