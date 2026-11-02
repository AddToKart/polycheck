import type { AiCapabilities } from '@polycheck/shared'

/** Pure settings-tab configuration and derivations (no React). */

export const SETTINGS_TABS = [
  { id: 'institution', label: 'Institution' },
  { id: 'sessions', label: 'Sessions & attendance' },
  { id: 'accounts', label: 'Accounts & access' },
  { id: 'ai', label: 'AI Assistant' },
  { id: 'system', label: 'System' },
  { id: 'privacy', label: 'Privacy (RA 10173)' },
] as const

export type SettingsTabId = (typeof SETTINGS_TABS)[number]['id']

export const DEFAULT_SETTINGS_TAB: SettingsTabId = 'institution'

export function resolveSettingsTab(value: string | null | undefined): SettingsTabId {
  return SETTINGS_TABS.some((tab) => tab.id === value)
    ? (value as SettingsTabId)
    : DEFAULT_SETTINGS_TAB
}

export interface SettingFieldDefinition {
  key: string
  tab: SettingsTabId
  label: string
  type: 'text' | 'number' | 'datetime-local' | 'textarea'
  defaultValue: string
  min?: number
  max?: number
  optional?: boolean
  placeholder?: string
  caption: string
}

export const SETTING_FIELDS: readonly SettingFieldDefinition[] = [
  {
    key: 'institution_name',
    tab: 'institution',
    label: 'Institution name',
    type: 'text',
    defaultValue: 'Polytechnic University of the Philippines',
    caption: 'Used as the header on generated master-list exports.',
  },
  {
    key: 'default_geofence_radius_meters',
    tab: 'sessions',
    label: 'Default geofence radius (meters)',
    type: 'number',
    defaultValue: '40',
    min: 10,
    max: 500,
    caption: 'Session prefill — teachers can still adjust the radius before activating.',
  },
  {
    key: 'default_qr_validity_minutes',
    tab: 'sessions',
    label: 'Default QR validity (minutes)',
    type: 'number',
    defaultValue: '5',
    min: 1,
    max: 15,
    caption: 'Session prefill — how long a generated QR code accepts scans.',
  },
  {
    key: 'default_grace_period_minutes',
    tab: 'sessions',
    label: 'Default grace period (minutes)',
    type: 'number',
    defaultValue: '15',
    min: 0,
    max: 60,
    caption: 'Session prefill — the late window after the QR code expires.',
  },
  {
    key: 'enrollment_code_expiry_days',
    tab: 'sessions',
    label: 'Enrollment code expiry (days)',
    type: 'number',
    defaultValue: '14',
    min: 1,
    max: 90,
    caption: 'Section enrollment — codes stop accepting students after this many days.',
  },
  {
    key: 'attendance_min_rate_percent',
    tab: 'sessions',
    label: 'Minimum attendance rate (%)',
    type: 'number',
    defaultValue: '75',
    min: 0,
    max: 100,
    caption: 'Standing threshold — students below this rate are flagged on their dashboard.',
  },
  {
    key: 'device_cooldown_hours',
    tab: 'accounts',
    label: 'Device change cooldown (hours)',
    type: 'number',
    defaultValue: '2',
    min: 1,
    max: 24,
    caption:
      'After a student unregisters their mobile device, mobile logins stay locked for this many hours. Instructors can release a student sooner.',
  },
  {
    key: 'ai_base_url',
    tab: 'ai',
    label: 'AI endpoint base URL (optional)',
    type: 'text',
    defaultValue: '',
    optional: true,
    placeholder: 'https://opencode.ai/inference/go/openai/v1',
    caption: 'OpenAI-compatible base URL. For OpenCode Go use https://opencode.ai/inference/go/openai/v1.',
  },
  {
    key: 'ai_model',
    tab: 'ai',
    label: 'AI model name (optional)',
    type: 'text',
    defaultValue: '',
    optional: true,
    placeholder: 'deepseek-v4.1-flash',
    caption: 'Model identifier sent to the configured endpoint.',
  },
  {
    key: 'maintenance_message',
    tab: 'system',
    label: 'Maintenance announcement (optional)',
    type: 'textarea',
    defaultValue: '',
    optional: true,
    placeholder: 'Polycheck is undergoing scheduled server maintenance…',
    caption:
      'Shown on the branded maintenance screen. Leave blank to use the built-in copy about offline attendance preservation.',
  },
  {
    key: 'maintenance_until',
    tab: 'system',
    label: 'Estimated resumption (optional)',
    type: 'datetime-local',
    defaultValue: '',
    optional: true,
    caption:
      'Display-only estimate. Maintenance never turns off automatically at this time — an exempt administrator must switch it off.',
  },
  {
    key: 'geolocation_retention_days',
    tab: 'system',
    label: 'Geolocation retention (days)',
    type: 'number',
    defaultValue: '30',
    min: 7,
    max: 90,
    caption:
      'RA 10173 ephemeral-telemetry window — the nightly shredder strips stored coordinates older than this. Dispute outcomes and distances are kept.',
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
      'Let teachers auto-provision inactive student accounts when importing an enrollment list for a student without an account.',
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
    caption:
      'Master switch — turns the assistant off for the entire system. With it on, super admins always retain access.',
    defaultValue: 'true',
  },
  {
    key: 'ai_assistant_teacher_enabled',
    tab: 'ai',
    label: 'Available to teachers',
    caption: 'Hides the assistant entry point for teachers and department administrators.',
    defaultValue: 'true',
  },
  {
    key: 'ai_assistant_student_enabled',
    tab: 'ai',
    label: 'Available to students',
    caption: 'Hides the assistant entry point for students on web and mobile.',
    defaultValue: 'true',
  },
  {
    key: 'maintenance_mode_enabled',
    tab: 'system',
    label: 'Maintenance mode',
    caption:
      'Closes Polycheck for students and non-designated teachers. Super admins and IT coordinators stay signed in; health probes remain open.',
    defaultValue: 'false',
  },
]

export const TAB_SETTING_KEYS: Record<SettingsTabId, readonly string[]> = {
  institution: SETTING_FIELDS.filter((field) => field.tab === 'institution').map((field) => field.key),
  sessions: SETTING_FIELDS.filter((field) => field.tab === 'sessions').map((field) => field.key),
  accounts: [
    ...SETTING_SWITCHES.filter((item) => item.tab === 'accounts').map((item) => item.key),
    ...SETTING_FIELDS.filter((field) => field.tab === 'accounts').map((field) => field.key),
  ],
  ai: [
    ...SETTING_SWITCHES.filter((item) => item.tab === 'ai').map((item) => item.key),
    ...SETTING_FIELDS.filter((field) => field.tab === 'ai').map((field) => field.key),
  ],
  system: [
    ...SETTING_SWITCHES.filter((item) => item.tab === 'system').map((item) => item.key),
    ...SETTING_FIELDS.filter((field) => field.tab === 'system').map((field) => field.key),
  ],
  // F6: the privacy tab is a read-only transparency dashboard — no saveable keys,
  // so the Save row is hidden while `isTabDirty`/`isTabSaveable` stay safe (empty `.some`/`.every`).
  privacy: [],
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
  return SETTING_FIELDS.filter((field) => field.tab === tab && !field.optional).every(
    (field) => (values[field.key] ?? '').trim().length > 0,
  )
}

export const AI_AVAILABILITY_KEYS = [
  'ai_assistant_enabled',
  'ai_assistant_teacher_enabled',
  'ai_assistant_student_enabled',
] as const

const AI_MISSING_LABELS: Record<string, string> = {
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
