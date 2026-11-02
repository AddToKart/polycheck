import { describe, expect, it } from 'vitest'
import type { AiCapabilities, UserRole } from '@polycheck/shared'
import { shouldShowAssistantEntry } from './assistant-visibility'

const ROLES: UserRole[] = ['super_admin', 'teacher', 'student']

const policyBlocked: AiCapabilities = {
  enabled: false,
  policyBlocked: true,
  reason: 'The AI assistant has been disabled by your administrator.',
  maxMessageChars: 2_000,
}

const unconfigured: AiCapabilities = {
  enabled: false,
  missing: ['base_url', 'model', 'api_key'],
  reason: 'Assistant is not configured (missing base_url, model, api_key)',
  maxMessageChars: 2_000,
}

const enabled: AiCapabilities = {
  enabled: true,
  model: 'deepseek-v4.1-flash',
  maxMessageChars: 2_000,
}

describe('shouldShowAssistantEntry', () => {
  it('hides the entry point for every role until capabilities resolve', () => {
    for (const role of ROLES) {
      expect(shouldShowAssistantEntry(role, null)).toBe(false)
    }
  })

  it('hides the entry point for every role when policy-blocked', () => {
    for (const role of ROLES) {
      expect(shouldShowAssistantEntry(role, policyBlocked)).toBe(false)
    }
  })

  it('treats policy-blocked as authoritative even if enabled is also set', () => {
    const contradictory: AiCapabilities = { enabled: true, policyBlocked: true }
    for (const role of ROLES) {
      expect(shouldShowAssistantEntry(role, contradictory)).toBe(false)
    }
  })

  it('shows an unconfigured assistant only to super admins', () => {
    expect(shouldShowAssistantEntry('super_admin', unconfigured)).toBe(true)
    expect(shouldShowAssistantEntry('teacher', unconfigured)).toBe(false)
    expect(shouldShowAssistantEntry('student', unconfigured)).toBe(false)
  })

  it('shows a ready assistant to every assistant role', () => {
    for (const role of ROLES) {
      expect(shouldShowAssistantEntry(role, enabled)).toBe(true)
    }
  })

  it('uses the missing-config shape when capabilities omit enabled=false', () => {
    expect(shouldShowAssistantEntry('super_admin', { enabled: false, missing: ['api_key'] })).toBe(true)
    expect(shouldShowAssistantEntry('teacher', { enabled: false, missing: ['api_key'] })).toBe(false)
  })
})
