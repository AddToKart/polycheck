import { broadcastsLoginReplacement, resolveSessionCreateAfter, resolveSessionGeneration } from './session-policy'

describe('session policy (single-active-session scoping)', () => {
  describe('resolveSessionGeneration', () => {
    it('blocks inactive accounts from signing in', () => {
      expect(resolveSessionGeneration({ isActive: false, role: 'student', authVersion: 4 })).toEqual({ allowed: false })
      expect(resolveSessionGeneration({ isActive: false, role: 'teacher', authVersion: 4 })).toEqual({ allowed: false })
    })

    it('bumps authVersion and stamps the new value for students (single session)', () => {
      expect(resolveSessionGeneration({ isActive: true, role: 'student', authVersion: 7 })).toEqual({
        allowed: true,
        generation: 8,
        bumpedAuthVersion: true,
      })
    })

    it('stamps the current authVersion for staff without bumping it (multi-session)', () => {
      expect(resolveSessionGeneration({ isActive: true, role: 'teacher', authVersion: 7 })).toEqual({
        allowed: true,
        generation: 7,
        bumpedAuthVersion: false,
      })
      expect(resolveSessionGeneration({ isActive: true, role: 'super_admin', authVersion: 3 })).toEqual({
        allowed: true,
        generation: 3,
        bumpedAuthVersion: false,
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

    it('deletes sibling sessions for students', () => {
      expect(resolveSessionCreateAfter({ id: 's1', generation: 6 }, { authVersion: 6, role: 'student' })).toBe(
        'delete-others',
      )
    })

    it('keeps sibling sessions for staff so devices can coexist', () => {
      expect(resolveSessionCreateAfter({ id: 's1', generation: 6 }, { authVersion: 6, role: 'teacher' })).toBe('keep')
      expect(resolveSessionCreateAfter({ id: 's1', generation: 6 }, { authVersion: 6, role: 'super_admin' })).toBe(
        'keep',
      )
    })
  })

  describe('broadcastsLoginReplacement', () => {
    it('broadcasts the new_login replacement for students only', () => {
      expect(broadcastsLoginReplacement('student')).toBe(true)
      expect(broadcastsLoginReplacement('teacher')).toBe(false)
      expect(broadcastsLoginReplacement('super_admin')).toBe(false)
    })
  })
})
