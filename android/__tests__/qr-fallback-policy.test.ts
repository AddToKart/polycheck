import { isQrFallbackEnabled, shouldShowScanFallbacks } from '../hooks/qr-fallback-policy'

describe('isQrFallbackEnabled', () => {
  it('is disabled when unset', () => {
    expect(isQrFallbackEnabled(undefined)).toBe(false)
  })

  it('is disabled for empty or "false" values', () => {
    expect(isQrFallbackEnabled('')).toBe(false)
    expect(isQrFallbackEnabled('false')).toBe(false)
  })

  it('is enabled only for the exact opt-in value', () => {
    expect(isQrFallbackEnabled('true')).toBe(true)
    expect(isQrFallbackEnabled('TRUE')).toBe(false)
    expect(isQrFallbackEnabled('1')).toBe(false)
    expect(isQrFallbackEnabled(' true ')).toBe(false)
  })
})

describe('shouldShowScanFallbacks', () => {
  it('always allows screenshot/link fallbacks for online checkpoint tokens', () => {
    expect(shouldShowScanFallbacks(undefined, 'online')).toBe(true)
    expect(shouldShowScanFallbacks('false', 'online')).toBe(true)
  })

  it('keeps the production env gate for in-person sessions', () => {
    expect(shouldShowScanFallbacks(undefined, 'in_person')).toBe(false)
    expect(shouldShowScanFallbacks('false', 'in_person')).toBe(false)
    expect(shouldShowScanFallbacks('true', 'in_person')).toBe(true)
  })

  it('falls back to the env gate before a session mode is known', () => {
    expect(shouldShowScanFallbacks(undefined, null)).toBe(false)
    expect(shouldShowScanFallbacks('true', null)).toBe(true)
  })
})
