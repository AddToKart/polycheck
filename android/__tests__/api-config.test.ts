import { API_BASE } from '../services/api-config'

describe('api-config', () => {
  it('returns a non-empty API_BASE string', () => {
    expect(typeof API_BASE).toBe('string')
    expect(API_BASE.length).toBeGreaterThan(0)
  })

  it('returns a URL ending with /api', () => {
    expect(API_BASE).toMatch(/\/api$/)
  })

  it('does not have trailing slashes', () => {
    expect(API_BASE).not.toMatch(/\/+$/)
  })

  it('uses http protocol', () => {
    expect(API_BASE).toMatch(/^http:\/\//)
  })
})
