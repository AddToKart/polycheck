import { resolveSessionCreateAfter, resolveSessionGeneration } from './session-policy'

describe('session policy (device-integrity login scoping)', () => {
  describe('resolveSessionGeneration', () => {
    it('blocks inactive accounts from signing in', () => {
      expect(resolveSessionGeneration({ isActive: false, role: 'student', authVersion: 4 })).toEqual({ allowed: false })
      expect(resolveSessionGeneration({ isActive: false, role: 'teacher', authVersion: 4 })).toEqual({ allowed: false })
    })

    it('stamps the current authVersion for students without bumping it', () => {
      expect(resolveSessionGeneration({ isActive: true, role: 'student', authVersion: 7 })).toEqual({
        allowed: true,
        generation: 7,
      })
    })

    it('stamps the current authVersion for staff without bumping it (multi-session)', () => {
      expect(resolveSessionGeneration({ isActive: true, role: 'teacher', authVersion: 7 })).toEqual({
        allowed: true,
        generation: 7,
      })
      expect(resolveSessionGeneration({ isActive: true, role: 'super_admin', authVersion: 3 })).toEqual({
        allowed: true,
        generation: 3,
      })
    })
  })

  describe('resolveSessionCreateAfter', () => {
    it('self-deletes when the authVersion moved past the session generation (race/rotation)', () => {
      expect(resolveSessionCreateAfter({ id: 's1', generation: 5 }, { authVersion: 6, role: 'student' })).toBe(
        'delete-self',
      )
      expect(resolveSessionCreateAfter({ id: 's1', generation: 5 }, { authVersion: 6, role: 'teacher' })).toBe(
        'delete-self',
      )
      expect(resolveSessionCreateAfter({ id: 's1', generation: 5 }, null)).toBe('delete-self')
    })

    it('only purges same-device duplicates for students (never sibling devices)', () => {
      expect(resolveSessionCreateAfter({ id: 's1', generation: 6 }, { authVersion: 6, role: 'student' })).toBe(
        'purge-same-device',
      )
    })

    it('keeps sibling sessions for staff so devices can coexist', () => {
      expect(resolveSessionCreateAfter({ id: 's1', generation: 6 }, { authVersion: 6, role: 'teacher' })).toBe('keep')
      expect(resolveSessionCreateAfter({ id: 's1', generation: 6 }, { authVersion: 6, role: 'super_admin' })).toBe(
        'keep',
      )
    })
  })
})
