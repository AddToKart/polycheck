import { describe, expect, it } from 'vitest'
import { brandingLabel, brandingMonogram, DEFAULT_BRANDING, deriveShortName, resolveBranding } from './branding'

describe('deriveShortName', () => {
  it('takes initials and skips connector words', () => {
    expect(deriveShortName('Polytechnic University of the Philippines')).toBe('PUP')
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
    expect(resolveBranding({ name: 'Polytechnic University of the Philippines' }).shortName).toBe('PUP')
    expect(resolveBranding({ name: 'Polytechnic University of the Philippines', shortName: 'PUP-SM' }).shortName).toBe('PUP-SM')
  })
  it('keeps the logo and trims the campus', () => {
    const branding = resolveBranding({ name: 'X University', campus: '  Main  ', logoDataUrl: 'data:image/png;base64,AAAA' })
    expect(branding.campus).toBe('Main')
    expect(branding.logoDataUrl).toBe('data:image/png;base64,AAAA')
  })
})

describe('brandingMonogram / brandingLabel', () => {
  it('builds a 1-4 character monogram', () => {
    expect(brandingMonogram('PUP')).toBe('PUP')
    expect(brandingMonogram('St. Mary')).toBe('STMA')
    expect(brandingMonogram('')).toBe('IN')
  })
  it('collapses the label without a campus', () => {
    expect(brandingLabel({ shortName: 'PUP', campus: 'Santa Maria' })).toBe('PUP · Santa Maria')
    expect(brandingLabel({ shortName: 'PUP', campus: '' })).toBe('PUP')
  })
})
