import type { AiCapabilities } from '@polycheck/shared'
import {
  AI_AVAILABILITY_KEYS,
  SETTINGS_TABS,
  SETTING_DEFAULTS,
  SETTING_FIELDS,
  SETTING_SWITCHES,
  TAB_SETTING_KEYS,
  areAiRoleSwitchesDisabled,
  describeAssistantStatus,
  fieldsForTab,
  isTabDirty,
  isTabSaveable,
  mergeSettingValues,
  settingIsOn,
  switchesForTab,
  type AssistantStatusInput,
  type SettingsTabId,
} from '../lib/institution-settings'

const TAB_IDS = SETTINGS_TABS.map((tab) => tab.id)

const allSettingKeys = [...SETTING_FIELDS, ...SETTING_SWITCHES].map((item) => item.key)

describe('settings tab configuration', () => {
  it('defines the four locked categories in order', () => {
    expect(TAB_IDS).toEqual<SettingsTabId[]>(['institution', 'sessions', 'accounts', 'ai'])
    expect(SETTINGS_TABS.map((tab) => tab.label)).toEqual([
      'Institution',
      'Sessions & attendance',
      'Accounts & access',
      'AI Assistant',
    ])
    expect(SETTINGS_TABS.map((tab) => tab.shortLabel)).toEqual([
      'Institution',
      'Sessions',
      'Accounts',
      'AI',
    ])
  })

  it('assigns every setting key to exactly one tab', () => {
    const tabKeys = TAB_IDS.flatMap((tab) => TAB_SETTING_KEYS[tab])
    expect(new Set(tabKeys).size).toBe(tabKeys.length)
    expect([...tabKeys].sort()).toEqual([...allSettingKeys].sort())
    expect(tabKeys).not.toContain('ai_api_key')
  })

  it('groups the category contents from the plan', () => {
    expect(TAB_SETTING_KEYS.institution).toEqual(['institution_name'])
    expect(TAB_SETTING_KEYS.sessions).toEqual([
      'default_geofence_radius_meters',
      'default_qr_validity_minutes',
      'default_grace_period_minutes',
      'enrollment_code_expiry_days',
      'attendance_min_rate_percent',
    ])
    expect(TAB_SETTING_KEYS.accounts).toEqual(['allow_teacher_student_provisioning'])
    expect(TAB_SETTING_KEYS.ai).toEqual([
      'ai_assistant_enabled',
      'ai_assistant_teacher_enabled',
      'ai_assistant_student_enabled',
      'ai_base_url',
      'ai_model',
    ])
    expect(fieldsForTab('sessions')).toHaveLength(5)
    expect(switchesForTab('ai')).toHaveLength(3)
    expect(switchesForTab('accounts')).toHaveLength(1)
  })

  it('documents runtime defaults (AI on, provisioning off)', () => {
    expect(SETTING_DEFAULTS.institution_name).toBe('Polytechnic University of the Philippines')
    expect(SETTING_DEFAULTS.default_geofence_radius_meters).toBe('40')
    expect(SETTING_DEFAULTS.default_qr_validity_minutes).toBe('5')
    expect(SETTING_DEFAULTS.default_grace_period_minutes).toBe('15')
    expect(SETTING_DEFAULTS.enrollment_code_expiry_days).toBe('14')
    expect(SETTING_DEFAULTS.attendance_min_rate_percent).toBe('75')
    expect(SETTING_DEFAULTS.allow_teacher_student_provisioning).toBe('false')
    expect(SETTING_DEFAULTS.ai_assistant_enabled).toBe('true')
    expect(SETTING_DEFAULTS.ai_assistant_teacher_enabled).toBe('true')
    expect(SETTING_DEFAULTS.ai_assistant_student_enabled).toBe('true')
  })
})

describe('mergeSettingValues', () => {
  it('keeps documented fallbacks for missing rows', () => {
    expect(mergeSettingValues([])).toEqual(SETTING_DEFAULTS)
  })

  it('overrides defaults with persisted rows and keeps unrelated defaults', () => {
    const merged = mergeSettingValues([
      { key: 'institution_name', value: 'PUP Santa Maria' },
      { key: 'ai_assistant_enabled', value: 'false' },
    ])
    expect(merged.institution_name).toBe('PUP Santa Maria')
    expect(merged.ai_assistant_enabled).toBe('false')
    expect(merged.ai_assistant_student_enabled).toBe('true')
    expect(merged.allow_teacher_student_provisioning).toBe('false')
  })
})

describe('tab dirty and save gates', () => {
  const saved = mergeSettingValues([])

  it('reports no changes for the merged baseline', () => {
    TAB_IDS.forEach((tab) => expect(isTabDirty(tab, saved, saved)).toBe(false))
  })

  it('marks only the edited tab dirty', () => {
    const values = { ...saved, institution_name: 'PUP Sta. Mesa' }
    expect(isTabDirty('institution', values, saved)).toBe(true)
    expect(isTabDirty('sessions', values, saved)).toBe(false)
    expect(isTabDirty('accounts', values, saved)).toBe(false)
    expect(isTabDirty('ai', values, saved)).toBe(false)
  })

  it('tracks switch changes as dirty', () => {
    const values = { ...saved, allow_teacher_student_provisioning: 'true' }
    expect(isTabDirty('accounts', values, saved)).toBe(true)
    expect(isTabDirty('institution', values, saved)).toBe(false)
  })

  it('blocks saving a tab with a blank required field', () => {
    expect(isTabSaveable('institution', saved)).toBe(true)
    expect(isTabSaveable('institution', { ...saved, institution_name: '   ' })).toBe(false)
    expect(isTabSaveable('sessions', { ...saved, default_qr_validity_minutes: '' })).toBe(false)
  })

  it('allows saving optional AI configuration when empty', () => {
    expect(isTabSaveable('ai', { ...saved, ai_base_url: '', ai_model: '' })).toBe(true)
    expect(isTabSaveable('accounts', saved)).toBe(true)
  })
})

describe('boolean helpers', () => {
  it('interprets persisted boolean strings with a missing-row fallback', () => {
    expect(settingIsOn({ ai_assistant_enabled: 'true' }, 'ai_assistant_enabled')).toBe(true)
    expect(settingIsOn({ ai_assistant_enabled: 'false' }, 'ai_assistant_enabled')).toBe(false)
    expect(settingIsOn({}, 'ai_assistant_enabled', true)).toBe(true)
    expect(settingIsOn({}, 'allow_teacher_student_provisioning', false)).toBe(false)
    expect(settingIsOn({ allow_teacher_student_provisioning: 'true' }, 'allow_teacher_student_provisioning')).toBe(true)
  })

  it('disables role switches only when the master switch is off', () => {
    expect(areAiRoleSwitchesDisabled({ ai_assistant_enabled: 'false' })).toBe(true)
    expect(areAiRoleSwitchesDisabled({ ai_assistant_enabled: 'true' })).toBe(false)
    expect(areAiRoleSwitchesDisabled({})).toBe(false)
    expect(AI_AVAILABILITY_KEYS).toEqual([
      'ai_assistant_enabled',
      'ai_assistant_teacher_enabled',
      'ai_assistant_student_enabled',
    ])
  })
})

describe('describeAssistantStatus', () => {
  const saved = mergeSettingValues([])

  const describe = (overrides: Partial<AssistantStatusInput>) =>
    describeAssistantStatus({ values: saved, saved, capabilities: null, ...overrides })

  it('prioritizes unsaved availability changes', () => {
    expect(describe({
      values: { ...saved, ai_assistant_student_enabled: 'false' },
      capabilities: { enabled: true },
    })).toEqual({ tone: 'warning', message: 'Unsaved availability changes — save to apply.' })
  })

  it('narrates a master-off state', () => {
    const masterOff = { ...saved, ai_assistant_enabled: 'false' }
    expect(describe({ values: masterOff, saved: masterOff })).toEqual({
      tone: 'warning',
      message: 'Disabled for everyone.',
    })
  })

  it('narrates per-role availability', () => {
    const bothOff = { ...saved, ai_assistant_teacher_enabled: 'false', ai_assistant_student_enabled: 'false' }
    expect(describe({ values: bothOff, saved: bothOff }).message).toBe('Disabled for teachers and students.')

    const teachersOff = { ...saved, ai_assistant_teacher_enabled: 'false' }
    expect(describe({ values: teachersOff, saved: teachersOff }).message).toBe('Disabled for teachers.')

    const studentsOff = { ...saved, ai_assistant_student_enabled: 'false' }
    expect(describe({ values: studentsOff, saved: studentsOff }).message).toBe('Disabled for students.')
  })

  it('reports while the capability check is in flight', () => {
    expect(describe({ capabilitiesLoading: true })).toEqual({
      tone: 'neutral',
      message: 'Checking assistant status…',
    })
  })

  it('reports an unreadable configuration', () => {
    expect(describe({ capabilities: null })).toEqual({
      tone: 'warning',
      message: 'Unable to read the assistant configuration.',
    })
  })

  it('reports a ready assistant with and without a model', () => {
    expect(describe({ capabilities: { enabled: true, model: 'deepseek-v4.1-flash' } })).toEqual({
      tone: 'ready',
      message: 'Assistant ready (deepseek-v4.1-flash).',
    })
    expect(describe({ capabilities: { enabled: true } })).toEqual({
      tone: 'ready',
      message: 'Assistant ready.',
    })
  })

  it('reports a policy block that the saved switches do not explain', () => {
    expect(describe({ capabilities: { enabled: false, policyBlocked: true } })).toEqual({
      tone: 'warning',
      message: 'The assistant is disabled by policy.',
    })
  })

  it('lists the missing configuration pieces', () => {
    const capabilities: AiCapabilities = { enabled: false, missing: ['base_url', 'model', 'api_key'] }
    expect(describe({ capabilities })).toEqual({
      tone: 'warning',
      message: 'Not configured — missing endpoint base URL, model name, API key.',
    })
  })

  it('falls back to the generic not-configured copy', () => {
    expect(describe({ capabilities: { enabled: false } })).toEqual({
      tone: 'warning',
      message: 'Not configured yet — add an endpoint, model, and API key.',
    })
  })
})
