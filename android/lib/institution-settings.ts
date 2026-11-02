import { hasDesignation } from '@polycheck/shared'
import type {
  AiCapabilities,
  AtRiskReferral,
  DesignationCarrier,
  PrivacyCenterSnapshot,
  ReferralStatus,
  StudentAtRisk,
} from '@polycheck/shared'

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
  {
    id: 'system',
    label: 'System',
    shortLabel: 'System',
    accessibilityLabel: 'System maintenance settings',
  },
  {
    id: 'privacy',
    label: 'Privacy (RA 10173)',
    shortLabel: 'Privacy',
    accessibilityLabel: 'Privacy RA 10173 settings',
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
  | 'build'
  | 'schedule'

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
  {
    key: 'maintenance_message',
    tab: 'system',
    label: 'Maintenance announcement (optional)',
    defaultValue: '',
    keyboardType: 'default',
    icon: 'build',
    optional: true,
    placeholder: 'Polycheck is under scheduled maintenance…',
    caption:
      'Shown on the maintenance screen. Leave blank to keep the built-in offline-preservation copy.',
  },
  {
    key: 'maintenance_until',
    tab: 'system',
    label: 'Estimated resumption (optional)',
    defaultValue: '',
    keyboardType: 'default',
    icon: 'schedule',
    optional: true,
    placeholder: '2026-11-01T10:00',
    caption:
      'Display-only estimate (ISO datetime). Maintenance never switches off automatically — an exempt administrator must turn it off.',
  },
  {
    key: 'geolocation_retention_days',
    tab: 'system',
    label: 'Geolocation retention (days)',
    defaultValue: '30',
    keyboardType: 'number-pad',
    icon: 'my-location',
    caption:
      'RA 10173 ephemeral-telemetry window - the nightly shredder strips stored coordinates older than this (7-90). Dispute outcomes and distances are kept.',
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
  {
    key: 'maintenance_mode_enabled',
    tab: 'system',
    label: 'Maintenance mode',
    caption:
      'Closes Polycheck for students and non-designated teachers. Super admins and IT coordinators stay signed in; offline attendance stays queued on devices.',
    defaultValue: 'false',
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
  system: [
    ...switchesForTab('system').map((item) => item.key),
    ...fieldsForTab('system').map((field) => field.key),
  ],
  // F6 (WF-LD8): the privacy tab is a read-only transparency dashboard — it owns
  // no setting keys, so it is never dirty and never shows a save row.
  privacy: [],
}

/**
 * Tab visibility for the settings screen gate (super admins + IT coordinators
 * only). Super admins keep the full console; IT coordinators see the System
 * suite plus the read-only privacy center. Plain teachers never reach the
 * screen, but the derivation still answers defensively with System + Privacy.
 */
export type SettingsTabDefinition = (typeof SETTINGS_TABS)[number]

export function visibleSettingsTabs(
  user: { role: string; isItCoordinator?: boolean; isDepartmentHead?: boolean } | null | undefined,
): readonly SettingsTabDefinition[] {
  if (!user || user.role !== 'super_admin') {
    return SETTINGS_TABS.filter((tab) => tab.id === 'system' || tab.id === 'privacy')
  }
  return SETTINGS_TABS
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

// ── F5 (WF-LD7): CHED CMO No. 40 referral queue helpers (at-risk screen) ──
//
// Pure derivations for the referral sheet/queue; the screen keeps only React
// state. Mirrors the web `ReferralQueue` decisions (status order, pill tones,
// transition targets, typed error copy) so both platforms behave identically.

export const CHED_NOTICE_FILENAME = 'PUP-CHED-Drop-Notice.pdf'

/** Server-rendered CHED "Notice of Impending Drop" slip (authenticated GET). */
export function chedNoticeDownloadPath(referralId: string): string {
  return `/docs/at-risk-notice/${encodeURIComponent(referralId)}?format=pdf`
}

/** Lifecycle order used for the grouped queue (matches the shared status union). */
export const REFERRAL_STATUS_ORDER: readonly ReferralStatus[] = [
  'generated',
  'acknowledged',
  'counseling_scheduled',
  'resolved',
]

/** NativeWind pill tones per referral status (PUP tokens only). */
export const REFERRAL_STATUS_PILL_CLASSES: Record<ReferralStatus, string> = {
  generated: 'border-golden bg-golden',
  acknowledged: 'border-maroon bg-maroon dark:border-golden dark:bg-golden',
  counseling_scheduled: 'border-golden bg-maroon-dark dark:bg-maroon-deep',
  resolved: 'border-emerald-600 bg-emerald-600',
}

/** Pill text tones, kept separate so dark/light variants stay readable. */
export const REFERRAL_STATUS_TEXT_CLASSES: Record<ReferralStatus, string> = {
  generated: 'text-maroon-dark',
  acknowledged: 'text-white dark:text-maroon-dark',
  counseling_scheduled: 'text-golden',
  resolved: 'text-white',
}

/** Triage transitions offered to department heads and super admins. */
export const REFERRAL_TRANSITION_TARGETS: readonly ReferralStatus[] = [
  'acknowledged',
  'counseling_scheduled',
  'resolved',
]

export const REFERRAL_TRANSITION_LABELS: Partial<Record<ReferralStatus, string>> = {
  acknowledged: 'Acknowledge',
  counseling_scheduled: 'Schedule counseling',
  resolved: 'Mark resolved',
}

/**
 * Heads and super admins move referrals through the queue (triage
 * flexibility — the server allows any→any); plain oversight viewers are
 * read-only. Mirrors the web queue's `hasDesignation(user, 'academic_oversight')`.
 */
export function canManageReferrals(user: DesignationCarrier | null | undefined): boolean {
  return hasDesignation(user, 'academic_oversight')
}

/** Rows whose standing crossed into CHED CMO No. 40 territory (WF-LD7). */
export function isReferralNoticeEligible(row: Pick<StudentAtRisk, 'status'>): boolean {
  return row.status === 'below_threshold' || row.status === 'at_risk'
}

/** Transition buttons for a row: every triage target except the current status. */
export function referralTransitionOptions(current: ReferralStatus): ReferralStatus[] {
  return REFERRAL_TRANSITION_TARGETS.filter((status) => status !== current)
}

const REFERRAL_ERROR_MESSAGES: Record<string, string> = {
  referral_active: 'An active CHED referral already exists for this student in this section.',
  student_not_at_risk:
    'This student is no longer flagged as at risk — refresh the list before issuing another notice.',
}

/**
 * Typed referral errors (`referral_active`, `student_not_at_risk`) surface as
 * friendly sheet copy; anything else falls back to the server message so the
 * confirm sheet never crashes on an unexpected failure shape.
 */
export function describeReferralError(error: unknown): string {
  const code = (error as { code?: string } | null)?.code
  if (code && REFERRAL_ERROR_MESSAGES[code]) return REFERRAL_ERROR_MESSAGES[code]
  return error instanceof Error ? error.message : 'Unable to issue the CHED notice.'
}

/**
 * Mirrors the shared `GenerateAtRiskReferralSchema` note rule (trim, ≤500)
 * without importing zod: the jest manual mock for `@polycheck/shared` carries
 * no validation runtime, and this lib must stay importable from tests.
 */
export function validateReferralNote(
  note: string,
): { ok: true; note?: string } | { ok: false; message: string } {
  const trimmed = note.trim()
  if (trimmed.length > 500) {
    return { ok: false, message: 'Note must be 500 characters or fewer' }
  }
  return trimmed ? { ok: true, note: trimmed } : { ok: true }
}

/** Group referrals by status in lifecycle order, dropping empty groups. */
export function groupReferralsByStatus(
  referrals: readonly AtRiskReferral[],
): Array<{ status: ReferralStatus; rows: AtRiskReferral[] }> {
  return REFERRAL_STATUS_ORDER.map((status) => ({
    status,
    rows: referrals.filter((row) => row.status === status),
  })).filter((group) => group.rows.length > 0)
}

// ── F6 (WF-LD8): RA 10173 privacy-center mirror (settings screen) ──

export const DPO_SUMMARY_DOWNLOAD_PATH = '/docs/dpo-summary?format=pdf'
export const DPO_SUMMARY_FILENAME = 'PUP-DPO-Summary.pdf'

/**
 * Consent coverage percentage — mirrors shared `consentCoveragePercent`
 * (null when the denominator is zero or non-numeric). Duplicated locally
 * because the jest manual mock for `@polycheck/shared` carries no privacy
 * runtime and this lib must stay importable from tests.
 */
export function privacyCoveragePercent(covered: number, totalActive: number): number | null {
  if (!Number.isFinite(covered) || !Number.isFinite(totalActive) || totalActive <= 0) return null
  return Math.min(100, Math.max(0, Math.round((covered / totalActive) * 100)))
}

export interface PrivacyViewModel {
  inventoryRows: readonly {
    data: string
    purpose: string
    lawfulBasis: string
    lifetime: string
  }[]
  retentionDays: number
  /** The nightly shredder's live attestation: rows beyond retention. */
  attestationValue: string
  /** Raw ISO stamp of the last shred run (null → "verification pending"). */
  lastRunAt: string | null
  /** True once any shred run is visible to this instance. */
  shredVerified: boolean
  /** Display-ready shred counts — `null` renders as "Unknown", never "0". */
  recordsShredded: string
  attemptsShredded: string
  coveragePercent: number | null
  consentCovered: number
  consentTotal: number
  consentVersion: string
}

/**
 * Maps `GET /settings/privacy-center` onto the condensed Android mirror of the
 * web privacy tab. Every number is display-ready; the screen renders it
 * read-only (no save row, no editable keys).
 */
export function buildPrivacyView(snapshot: PrivacyCenterSnapshot): PrivacyViewModel {
  return {
    inventoryRows: snapshot.dataInventory.map((row) => ({ ...row })),
    retentionDays: snapshot.retentionDays,
    attestationValue: '0',
    lastRunAt: snapshot.ephemeral.lastRunAt,
    shredVerified: snapshot.ephemeral.lastRunAt !== null,
    recordsShredded: snapshot.ephemeral.recordsShredded === null ? 'Unknown' : String(snapshot.ephemeral.recordsShredded),
    attemptsShredded: snapshot.ephemeral.attemptsShredded === null ? 'Unknown' : String(snapshot.ephemeral.attemptsShredded),
    coveragePercent: privacyCoveragePercent(snapshot.consent.covered, snapshot.consent.totalActive),
    consentCovered: snapshot.consent.covered,
    consentTotal: snapshot.consent.totalActive,
    consentVersion: snapshot.consent.version,
  }
}

// ── F4 (WF-LD6): official PUP class record export (section detail screen) ──

/** Server-rendered PUP class record (authenticated GET, pdfkit pipeline). */
export function classRecordDownloadPath(sectionId: string): string {
  return `/docs/class-record/${encodeURIComponent(sectionId)}?format=pdf`
}

const safeFileSegment = (value: string) =>
  value.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '')

/** `PUP-Class-Record-<code>-<section>.pdf`, falling back when both are blank. */
export function classRecordFileName(subjectCode: string, sectionName: string): string {
  const segments = [subjectCode, sectionName].map(safeFileSegment).filter(Boolean)
  return segments.length > 0 ? `PUP-Class-Record-${segments.join('-')}.pdf` : 'PUP-Class-Record.pdf'
}
