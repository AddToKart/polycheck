import { isQrFallbackEnabled } from '../hooks/qr-fallback-policy'

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
