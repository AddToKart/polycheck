import { describe, expect, it } from 'vitest'
import type { AiCapabilities } from '@polycheck/shared'
import {
  DEFAULT_SETTINGS_TAB,
  SETTING_DEFAULTS,
  SETTINGS_TABS,
  TAB_SETTING_KEYS,
  describeAssistantStatus,
  isTabDirty,
  isTabSaveable,
  mergeSettingValues,
  resolveSettingsTab,
} from './settings-config'

const allEnabled: Record<string, string> = {
  ...SETTING_DEFAULTS,
}

const capabilities = (overrides: Partial<AiCapabilities>): AiCapabilities => ({
  enabled: false,
  maxMessageChars: 2_000,
  ...overrides,
})

describe('settings tab routing', () => {
  it('exposes the four locked categories', () => {
    expect(SETTINGS_TABS.map((tab) => tab.id)).toEqual([
      'institution',
      'sessions',
      'accounts',
      'ai',
    ])
  })

  it('resolves deep links and falls back to Institution for invalid values', () => {
    expect(resolveSettingsTab('sessions')).toBe('sessions')
    expect(resolveSettingsTab('accounts')).toBe('accounts')
    expect(resolveSettingsTab('ai')).toBe('ai')
    expect(resolveSettingsTab('institution')).toBe('institution')
    expect(resolveSettingsTab(null)).toBe(DEFAULT_SETTINGS_TAB)
    expect(resolveSettingsTab(undefined)).toBe(DEFAULT_SETTINGS_TAB)
    expect(resolveSettingsTab('bogus')).toBe(DEFAULT_SETTINGS_TAB)
    expect(resolveSettingsTab('')).toBe(DEFAULT_SETTINGS_TAB)
  })

  it('keeps each setting in exactly one save scope (API key is separate)', () => {
    const seen = new Set<string>()
    for (const keys of Object.values(TAB_SETTING_KEYS)) {
      for (const key of keys) {
        expect(seen.has(key)).toBe(false)
        seen.add(key)
      }
    }
    expect(seen.has('institution_name')).toBe(true)
    expect(seen.has('allow_teacher_student_provisioning')).toBe(true)
    expect(seen.has('ai_assistant_enabled')).toBe(true)
    expect(seen.has('ai_assistant_teacher_enabled')).toBe(true)
    expect(seen.has('ai_assistant_student_enabled')).toBe(true)
    expect(seen.has('ai_base_url')).toBe(true)
    expect(seen.has('ai_model')).toBe(true)
    expect(seen.has('ai_api_key')).toBe(false)
  })
})

describe('settings dirty tracking', () => {
  it('marks only the tab whose values diverge from the saved snapshot', () => {
    const saved = { ...allEnabled }
    const values = { ...saved, institution_name: 'PUP Santa Maria' }

    expect(isTabDirty('institution', values, saved)).toBe(true)
    expect(isTabDirty('sessions', values, saved)).toBe(false)
    expect(isTabDirty('accounts', values, saved)).toBe(false)
    expect(isTabDirty('ai', values, saved)).toBe(false)
  })

  it('tracks boolean switches per tab', () => {
    const saved = { ...allEnabled }
    const values = {
      ...saved,
      allow_teacher_student_provisioning: 'true',
      ai_assistant_student_enabled: 'false',
    }

    expect(isTabDirty('accounts', values, saved)).toBe(true)
    expect(isTabDirty('ai', values, saved)).toBe(true)
    expect(isTabDirty('institution', values, saved)).toBe(false)
  })

  it('requires a value for every mandatory field in a tab', () => {
    const values = { ...allEnabled, institution_name: '   ' }
    expect(isTabSaveable('institution', values)).toBe(false)
    expect(isTabSaveable('sessions', values)).toBe(true)

    const blankSessions = { ...allEnabled, default_qr_validity_minutes: '' }
    expect(isTabSaveable('sessions', blankSessions)).toBe(false)

    // Optional AI fields may be cleared.
    expect(isTabSaveable('ai', { ...allEnabled, ai_base_url: '', ai_model: '' })).toBe(true)
  })
})

describe('mergeSettingValues', () => {
  it('keeps documented defaults when rows are missing', () => {
    const merged = mergeSettingValues([])
    expect(merged.ai_assistant_enabled).toBe('true')
    expect(merged.ai_assistant_teacher_enabled).toBe('true')
    expect(merged.ai_assistant_student_enabled).toBe('true')
    expect(merged.allow_teacher_student_provisioning).toBe('false')
    expect(merged.attendance_min_rate_percent).toBe('75')
  })

  it('lets persisted rows win over defaults', () => {
    const merged = mergeSettingValues([
      { key: 'institution_name', value: 'PUP Santa Maria' },
      { key: 'ai_assistant_enabled', value: 'false' },
      { key: 'default_qr_validity_minutes', value: '10' },
    ])
    expect(merged.institution_name).toBe('PUP Santa Maria')
    expect(merged.ai_assistant_enabled).toBe('false')
    expect(merged.default_qr_validity_minutes).toBe('10')
    expect(merged.ai_assistant_teacher_enabled).toBe('true')
  })
})

describe('describeAssistantStatus', () => {
  const base = { values: { ...allEnabled }, saved: { ...allEnabled } }

  it('prioritises unsaved availability changes', () => {
    const status = describeAssistantStatus({
      ...base,
      values: { ...allEnabled, ai_assistant_student_enabled: 'false' },
      capabilities: capabilities({ enabled: true, model: 'deepseek-v4.1-flash' }),
    })
    expect(status).toEqual({
      tone: 'warning',
      message: 'Unsaved availability changes — save to apply.',
    })
  })

  it('narrates the master switch first', () => {
    expect(
      describeAssistantStatus({
        values: { ...allEnabled, ai_assistant_enabled: 'false' },
        saved: { ...allEnabled, ai_assistant_enabled: 'false' },
        capabilities: capabilities({ enabled: false, policyBlocked: true }),
      }).message,
    ).toBe('Disabled for everyone.')
  })

  it('reports role availability before provider configuration', () => {
    const bothOff = {
      ...allEnabled,
      ai_assistant_teacher_enabled: 'false',
      ai_assistant_student_enabled: 'false',
    }
    expect(
      describeAssistantStatus({
        values: bothOff,
        saved: bothOff,
        capabilities: capabilities({ enabled: false, missing: ['api_key'] }),
      }).message,
    ).toBe('Disabled for teachers and students.')

    const teachersOff = { ...allEnabled, ai_assistant_teacher_enabled: 'false' }
    expect(
      describeAssistantStatus({
        values: teachersOff,
        saved: teachersOff,
        capabilities: capabilities({ enabled: true }),
      }).message,
    ).toBe('Disabled for teachers.')

    const studentsOff = { ...allEnabled, ai_assistant_student_enabled: 'false' }
    expect(
      describeAssistantStatus({
        values: studentsOff,
        saved: studentsOff,
        capabilities: capabilities({ enabled: true }),
      }).message,
    ).toBe('Disabled for students.')
  })

  it('reports loading, unreachable, ready, missing, and policy states', () => {
    expect(
      describeAssistantStatus({
        ...base,
        capabilities: null,
        capabilitiesLoading: true,
      }),
    ).toEqual({ tone: 'neutral', message: 'Checking assistant status…' })
    expect(
      describeAssistantStatus({ ...base, capabilities: null }).message,
    ).toBe('Unable to read the assistant configuration.')
    expect(
      describeAssistantStatus({
        ...base,
        capabilities: capabilities({ enabled: true, model: 'deepseek-v4.1-flash' }),
      }),
    ).toEqual({ tone: 'ready', message: 'Assistant ready (deepseek-v4.1-flash).' })
    expect(
      describeAssistantStatus({
        ...base,
        capabilities: capabilities({ enabled: false, missing: ['base_url', 'api_key'] }),
      }).message,
    ).toBe('Not configured — missing endpoint base URL, API key.')
    expect(
      describeAssistantStatus({
        ...base,
        capabilities: capabilities({ enabled: false, policyBlocked: true }),
      }).message,
    ).toBe('The assistant is disabled by policy.')
  })
})
