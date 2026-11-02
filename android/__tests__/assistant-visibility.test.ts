import type { AiCapabilities, User } from '@polycheck/shared'
import { shouldShowAssistantEntry, type AssistantEntryRole } from '../lib/assistant-visibility'

type Role = User['role']

const ROLES: Role[] = ['super_admin', 'teacher', 'student']

interface CapabilityCase {
  label: string
  capabilities: AiCapabilities | null | undefined
  expected: Record<Role, boolean>
}

const cases: CapabilityCase[] = [
  {
    label: 'capabilities could not be read',
    capabilities: null,
    expected: { super_admin: false, teacher: false, student: false },
  },
  {
    label: 'capabilities were never loaded',
    capabilities: undefined,
    expected: { super_admin: false, teacher: false, student: false },
  },
  {
    label: 'configured and enabled',
    capabilities: { enabled: true, model: 'deepseek-v4.1-flash' },
    expected: { super_admin: true, teacher: true, student: true },
  },
  {
    label: 'enabled without a model name',
    capabilities: { enabled: true },
    expected: { super_admin: true, teacher: true, student: true },
  },
  {
    label: 'master switch off (policy blocked for everyone)',
    capabilities: { enabled: false, policyBlocked: true, reason: 'The AI assistant has been disabled by your administrator.' },
    expected: { super_admin: false, teacher: false, student: false },
  },
  {
    label: 'teacher switch off (policy blocked for the teacher surface)',
    capabilities: { enabled: false, policyBlocked: true, reason: 'The AI assistant is disabled for teachers.' },
    expected: { super_admin: false, teacher: false, student: false },
  },
  {
    label: 'student switch off (policy blocked for the student surface)',
    capabilities: { enabled: false, policyBlocked: true, reason: 'The AI assistant is disabled for students.' },
    expected: { super_admin: false, teacher: false, student: false },
  },
  {
    label: 'unconfigured with every config piece missing',
    capabilities: { enabled: false, missing: ['base_url', 'model', 'api_key'] },
    expected: { super_admin: true, teacher: false, student: false },
  },
  {
    label: 'unconfigured with only the API key missing',
    capabilities: { enabled: false, missing: ['api_key'] },
    expected: { super_admin: true, teacher: false, student: false },
  },
  {
    label: 'disabled without a policy or missing-config signal',
    capabilities: { enabled: false, reason: 'The assistant is not configured yet.' },
    expected: { super_admin: true, teacher: false, student: false },
  },
  {
    label: 'policy block wins over a contradictory enabled flag',
    capabilities: { enabled: true, policyBlocked: true },
    expected: { super_admin: false, teacher: false, student: false },
  },
]

describe('shouldShowAssistantEntry', () => {
  describe.each(cases)('$label', ({ capabilities, expected }) => {
    it.each(ROLES)('resolves %s visibility', (role) => {
      expect(shouldShowAssistantEntry(role, capabilities)).toBe(expected[role])
    })
  })

  it('hides the entry for an unknown or signed-out role', () => {
    const enabled: AiCapabilities = { enabled: true }
    expect(shouldShowAssistantEntry(null, enabled)).toBe(false)
    expect(shouldShowAssistantEntry(undefined, enabled)).toBe(false)
  })

  it('keeps the setup affordance for super admins while master is on', () => {
    const unconfigured: AiCapabilities = { enabled: false, missing: ['api_key'] }
    expect(shouldShowAssistantEntry('super_admin', unconfigured)).toBe(true)
    expect(shouldShowAssistantEntry('teacher', unconfigured)).toBe(false)
    expect(shouldShowAssistantEntry('student', unconfigured)).toBe(false)
  })

  it('reflects the server role exemption for super admins when only a role toggle is off', () => {
    // Capabilities are per-caller: a super admin still receives `enabled: true`
    // while the teacher toggle is off, whereas a teacher receives a policy block.
    expect(shouldShowAssistantEntry('super_admin', { enabled: true, model: 'deepseek-v4.1-flash' })).toBe(true)
    expect(shouldShowAssistantEntry('teacher', { enabled: false, policyBlocked: true })).toBe(false)
  })

  it('accepts every assistant role without casting', () => {
    const roles: AssistantEntryRole[] = ['super_admin', 'teacher', 'student']
    expect(roles.every((role) => shouldShowAssistantEntry(role, { enabled: true }))).toBe(true)
  })
})
