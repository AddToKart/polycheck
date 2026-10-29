import type { AiCapabilities } from '@polycheck/shared'

/** Pure settings-tab configuration and derivations (no React). */

export const SETTINGS_TABS = [
  {
    id: 'institution',
    label: 'Institution',
    shortLabel: 'Institution',
    accessibilityLabel: 'Institution settings',
  },
  {
    id: 'sessions',
    label: 'Sessions & attendance',
    shortLabel: 'Sessions',
    accessibilityLabel: 'Sessions and attendance settings',
  },
  {
    id: 'accounts',
    label: 'Accounts & access',
    shortLabel: 'Accounts',
    accessibilityLabel: 'Accounts and access settings',
  },
  {
    id: 'ai',
    label: 'AI Assistant',
    shortLabel: 'AI',
    accessibilityLabel: 'AI Assistant settings',
  },
] as const

export type SettingsTabId = (typeof SETTINGS_TABS)[number]['id']

export type SettingsFieldIcon =
  | 'account-balance'
  | 'my-location'
  | 'timer'
  | 'hourglass-bottom'
  | 'vpn-key'
  | 'percent'
  | 'link'
  | 'smart-toy'

export interface SettingFieldDefinition {
  key: string
  tab: SettingsTabId
  label: string
  defaultValue: string
  keyboardType: 'default' | 'number-pad' | 'url'
  icon: SettingsFieldIcon
  caption: string
  optional?: boolean
  placeholder?: string
}

export const SETTING_FIELDS: readonly SettingFieldDefinition[] = [
  {
    key: 'institution_name',
    tab: 'institution',
    label: 'Institution name',
    defaultValue: 'Polytechnic University of the Philippines',
    keyboardType: 'default',
    icon: 'account-balance',
    caption: 'Used as the header on generated master-list exports.',
  },
  {
    key: 'default_geofence_radius_meters',
    tab: 'sessions',
    label: 'Default geofence radius (meters)',
    defaultValue: '40',
    keyboardType: 'number-pad',
    icon: 'my-location',
    caption: 'Session prefill — teachers can still adjust the radius before activating.',
  },
  {
    key: 'default_qr_validity_minutes',
    tab: 'sessions',
    label: 'Default QR validity (minutes)',
    defaultValue: '5',
    keyboardType: 'number-pad',
    icon: 'timer',
    caption: 'Session prefill — how long a generated QR code stays valid.',
  },
  {
    key: 'default_grace_period_minutes',
    tab: 'sessions',
    label: 'Default grace period (minutes)',
    defaultValue: '15',
    keyboardType: 'number-pad',
    icon: 'hourglass-bottom',
    caption: 'Session prefill — the late window after the QR code expires.',
  },
  {
    key: 'enrollment_code_expiry_days',
    tab: 'sessions',
    label: 'Enrollment code expiry (days)',
    defaultValue: '14',
    keyboardType: 'number-pad',
    icon: 'vpn-key',
    caption: 'Enrollment-code lifetime — codes stop accepting new students after this many days.',
  },
  {
    key: 'attendance_min_rate_percent',
    tab: 'sessions',
    label: 'Minimum attendance rate (%)',
    defaultValue: '75',
    keyboardType: 'number-pad',
    icon: 'percent',
    caption: 'Standing threshold — students below this rate are flagged.',
  },
  {
    key: 'device_cooldown_hours',
    tab: 'accounts',
    label: 'Device change cooldown (hours)',
    defaultValue: '2',
    keyboardType: 'number-pad',
    icon: 'timer',
    caption:
      'After a student unregisters their mobile device, mobile logins stay locked for this many hours (1–24). Instructors can release a student sooner.',
  },
  {
    key: 'ai_base_url',
    tab: 'ai',
    label: 'AI endpoint base URL (optional)',
    defaultValue: '',
    keyboardType: 'url',
    icon: 'link',
    optional: true,
    placeholder: 'https://opencode.ai/inference/go/openai/v1',
    caption: 'OpenAI-compatible base URL. For OpenCode Go use https://opencode.ai/inference/go/openai/v1.',
  },
  {
    key: 'ai_model',
    tab: 'ai',
    label: 'AI model name (optional)',
    defaultValue: '',
    keyboardType: 'default',
    icon: 'smart-toy',
    optional: true,
    placeholder: 'deepseek-v4.1-flash',
    caption: 'Model identifier sent to the configured endpoint.',
  },
]

export interface SettingSwitchDefinition {
  key: string
  tab: SettingsTabId
  label: string
  caption: string
  defaultValue: 'true' | 'false'
}

export const SETTING_SWITCHES: readonly SettingSwitchDefinition[] = [
  {
    key: 'allow_teacher_student_provisioning',
    tab: 'accounts',
    label: 'Allow teacher student provisioning',
    caption:
      'Let teachers auto-provision inactive student accounts when importing a master-list enrollment for a student without an account (bulk import, v2 opt-in).',
    defaultValue: 'false',
  },
  {
    key: 'allow_teacher_password_reset',
    tab: 'accounts',
    label: 'Allow teacher password resets',
    caption:
      'Let teachers issue temporary passwords to students enrolled in their own sections. Per-teacher overrides can restrict this further.',
    defaultValue: 'true',
  },
  {
    key: 'allow_teacher_emergency_device_unbind',
    tab: 'accounts',
    label: 'Allow emergency device release',
    caption:
      'Let teachers clear a student device binding and cooldown from the roster when a phone is lost, damaged, or borrowed.',
    defaultValue: 'true',
  },
  {
    key: 'ai_assistant_enabled',
    tab: 'ai',
    label: 'AI assistant enabled',
    caption: 'Turns the assistant off for the entire system, including super admins.',
    defaultValue: 'true',
  },
  {
    key: 'ai_assistant_teacher_enabled',
    tab: 'ai',
    label: 'Available to teachers',
    caption: 'Shows the assistant to teachers and department administrators.',
    defaultValue: 'true',
  },
  {
    key: 'ai_assistant_student_enabled',
    tab: 'ai',
    label: 'Available to students',
    caption: 'Shows the assistant on the student dashboard and mobile app.',
    defaultValue: 'true',
  },
]

export function fieldsForTab(tab: SettingsTabId): readonly SettingFieldDefinition[] {
  return SETTING_FIELDS.filter((field) => field.tab === tab)
}

export function switchesForTab(tab: SettingsTabId): readonly SettingSwitchDefinition[] {
  return SETTING_SWITCHES.filter((item) => item.tab === tab)
}

export const TAB_SETTING_KEYS: Record<SettingsTabId, readonly string[]> = {
  institution: fieldsForTab('institution').map((field) => field.key),
  sessions: fieldsForTab('sessions').map((field) => field.key),
  accounts: [
    ...switchesForTab('accounts').map((item) => item.key),
    ...fieldsForTab('accounts').map((field) => field.key),
  ],
  ai: [
    ...switchesForTab('ai').map((item) => item.key),
    ...fieldsForTab('ai').map((field) => field.key),
  ],
}

export const SETTING_DEFAULTS: Record<string, string> = Object.fromEntries([
  ...SETTING_FIELDS.map((field) => [field.key, field.defaultValue] as const),
  ...SETTING_SWITCHES.map((item) => [item.key, item.defaultValue] as const),
])

/** Merge API rows over defaults so missing rows keep their documented fallback. */
export function mergeSettingValues(
  settings: readonly { key: string; value: string }[],
): Record<string, string> {
  return {
    ...SETTING_DEFAULTS,
    ...Object.fromEntries(settings.map((setting) => [setting.key, setting.value])),
  }
}

export function isTabDirty(
  tab: SettingsTabId,
  values: Record<string, string>,
  saved: Record<string, string>,
): boolean {
  return TAB_SETTING_KEYS[tab].some((key) => (values[key] ?? '') !== (saved[key] ?? ''))
}

export function isTabSaveable(tab: SettingsTabId, values: Record<string, string>): boolean {
  return fieldsForTab(tab)
    .filter((field) => !field.optional)
    .every((field) => (values[field.key] ?? '').trim().length > 0)
}

/** Boolean rows are stored as the strings 'true'/'false'; missing rows use the fallback. */
export function settingIsOn(
  values: Record<string, string>,
  key: string,
  fallbackWhenMissing = false,
): boolean {
  const value = values[key]
  if (value === undefined || value === '') return fallbackWhenMissing
  return value === 'true'
}

/** The master switch disables the role switches in the UI; values are preserved. */
export function areAiRoleSwitchesDisabled(values: Record<string, string>): boolean {
  return values.ai_assistant_enabled === 'false'
}

export const AI_AVAILABILITY_KEYS = [
  'ai_assistant_enabled',
  'ai_assistant_teacher_enabled',
  'ai_assistant_student_enabled',
] as const

export const AI_MISSING_LABELS: Record<string, string> = {
  base_url: 'endpoint base URL',
  model: 'model name',
  api_key: 'API key',
}

export type AssistantStatusTone = 'ready' | 'warning' | 'neutral'

export interface AssistantStatus {
  tone: AssistantStatusTone
  message: string
}

export interface AssistantStatusInput {
  values: Record<string, string>
  saved: Record<string, string>
  capabilities: AiCapabilities | null
  capabilitiesLoading?: boolean
}

/**
 * Narrates the live assistant state for the AI tab. Persisted availability
 * wins over provider capabilities (which reflect the super admin's own role).
 */
export function describeAssistantStatus({
  values,
  saved,
  capabilities,
  capabilitiesLoading = false,
}: AssistantStatusInput): AssistantStatus {
  const availabilityDirty = AI_AVAILABILITY_KEYS.some(
    (key) => (values[key] ?? '') !== (saved[key] ?? ''),
  )
  if (availabilityDirty) {
    return { tone: 'warning', message: 'Unsaved availability changes — save to apply.' }
  }

  if (saved.ai_assistant_enabled === 'false') {
    return { tone: 'warning', message: 'Disabled for everyone.' }
  }

  const teachersEnabled = saved.ai_assistant_teacher_enabled !== 'false'
  const studentsEnabled = saved.ai_assistant_student_enabled !== 'false'
  if (!teachersEnabled && !studentsEnabled) {
    return { tone: 'warning', message: 'Disabled for teachers and students.' }
  }
  if (!teachersEnabled) return { tone: 'warning', message: 'Disabled for teachers.' }
  if (!studentsEnabled) return { tone: 'warning', message: 'Disabled for students.' }

  if (capabilitiesLoading && !capabilities) {
    return { tone: 'neutral', message: 'Checking assistant status…' }
  }
  if (!capabilities) {
    return { tone: 'warning', message: 'Unable to read the assistant configuration.' }
  }
  if (capabilities.enabled) {
    return {
      tone: 'ready',
      message: `Assistant ready${capabilities.model ? ` (${capabilities.model})` : ''}.`,
    }
  }
  if (capabilities.policyBlocked) {
    return { tone: 'warning', message: 'The assistant is disabled by policy.' }
  }

  const missing = capabilities.missing ?? []
  if (missing.length > 0) {
    return {
      tone: 'warning',
      message: `Not configured — missing ${missing
        .map((item) => AI_MISSING_LABELS[item] ?? item)
        .join(', ')}.`,
    }
  }
  return { tone: 'warning', message: 'Not configured yet — add an endpoint, model, and API key.' }
}
