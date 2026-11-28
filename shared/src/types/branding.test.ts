import { describe, expect, it } from 'vitest'
import { brandingLabel, brandingMonogram, campusHeading, DEFAULT_BRANDING, deriveShortName, resolveBranding } from './branding'

describe('deriveShortName', () => {
  it('takes initials and skips connector words', () => {
    expect(deriveShortName('Example Polytechnic of the Province')).toBe('EPP')
    expect(deriveShortName('University of Santo Tomas')).toBe('UST')
  })
  it('falls back to a trimmed name when initials are too short', () => {
    expect(deriveShortName('Harvard')).toBe('Harvard')
  })
})

describe('resolveBranding', () => {
  it('returns the neutral defaults for nothing configured', () => {
    expect(resolveBranding(null)).toEqual(DEFAULT_BRANDING)
    expect(resolveBranding({})).toEqual(DEFAULT_BRANDING)
  })
  it('derives the short name from a configured name but honours an explicit one', () => {
    expect(resolveBranding({ name: 'Example Polytechnic of the Province' }).shortName).toBe('EPP')
    expect(resolveBranding({ name: 'Example Polytechnic of the Province', shortName: 'EPP-SM' }).shortName).toBe('EPP-SM')
  })
  it('keeps the logo and trims the campus', () => {
    const branding = resolveBranding({ name: 'X University', campus: '  Main  ', logoDataUrl: 'data:image/png;base64,AAAA' })
    expect(branding.campus).toBe('Main')
    expect(branding.logoDataUrl).toBe('data:image/png;base64,AAAA')
  })
})

describe('brandingMonogram / brandingLabel', () => {
  it('builds a 1-4 character monogram', () => {
    expect(brandingMonogram('EPP')).toBe('EPP')
    expect(brandingMonogram('St. Mary')).toBe('STMA')
    expect(brandingMonogram('')).toBe('IN')
  })
  it('collapses the label without a campus', () => {
    expect(brandingLabel({ shortName: 'EPP', campus: 'Santa Maria' })).toBe('EPP · Santa Maria')
    expect(brandingLabel({ shortName: 'EPP', campus: '' })).toBe('EPP')
  })
})

describe('campusHeading', () => {
  it('adds the word Campus only when the value does not already say it', () => {
    expect(campusHeading('Santa Maria')).toBe('Santa Maria Campus')
    expect(campusHeading('Main Campus')).toBe('Main Campus')
    expect(campusHeading('campus of Santa Maria')).toBe('campus of Santa Maria')
    expect(campusHeading('Campusville')).toBe('Campusville Campus')
    expect(campusHeading('  ')).toBe('')
    expect(campusHeading(undefined)).toBe('')
  })
})
