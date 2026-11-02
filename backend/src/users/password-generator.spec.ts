import { isStrongPassword } from '../auth/password-policy'
import { generateTemporaryPassword } from './password-generator'

describe('generateTemporaryPassword', () => {
  it('always satisfies the 12-character PUP password policy', () => {
    for (let index = 0; index < 200; index += 1) {
      const password = generateTemporaryPassword()
      expect(password.length).toBeGreaterThanOrEqual(12)
      expect(password.length).toBeLessThanOrEqual(128)
      expect(isStrongPassword(password)).toBe(true)
    }
  })

  it('uses the human-readable PUP format without ambiguous glyphs', () => {
    for (let index = 0; index < 50; index += 1) {
      const password = generateTemporaryPassword()
      expect(password).toMatch(/^PUP-[A-Z2-9]{8}-[a-z]{2}[!@#$%_-]$/)
      expect(password).not.toMatch(/[ILO01]/)
    }
  })

  it('is effectively unique across a classroom-sized batch', () => {
    const sample = new Set(Array.from({ length: 200 }, () => generateTemporaryPassword()))
    expect(sample.size).toBeGreaterThan(190)
  })
})
