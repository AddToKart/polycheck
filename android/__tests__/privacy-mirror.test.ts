import type { PrivacyCenterSnapshot } from '@polycheck/shared'
import {
  DPO_SUMMARY_DOWNLOAD_PATH,
  DPO_SUMMARY_FILENAME,
  SETTINGS_TABS,
  SETTING_DEFAULTS,
  TAB_SETTING_KEYS,
  buildPrivacyView,
  classRecordDownloadPath,
  classRecordFileName,
  fieldsForTab,
  isTabDirty,
  isTabSaveable,
  privacyCoveragePercent,
  switchesForTab,
  visibleSettingsTabs,
  type SettingsTabId,
} from '../lib/institution-settings'

// F6 (WF-LD8): the Android settings mirror of the RA 10173 privacy center.

const snapshot = (overrides: Partial<PrivacyCenterSnapshot> = {}): PrivacyCenterSnapshot => ({
  retentionDays: 30,
  consent: { covered: 340, totalActive: 400, version: '2026-08-01' },
  ephemeral: {
    coordinatesBeyondRetention: 2,
    lastRunAt: '2026-11-01T03:00:00.000Z',
    recordsShredded: 12,
    attemptsShredded: 3,
  },
  dataInventory: [
    {
      data: 'Attendance record',
      purpose: 'The official attendance record of record',
      lawfulBasis: 'RA 10173 §13',
      lifetime: 'Retained with academic-year records',
    },
  ],
  breaches: [],
  ...overrides,
})

describe('privacy tab shape', () => {
  it('adds the read-only privacy tab after system', () => {
    const ids = SETTINGS_TABS.map((tab) => tab.id)
    expect(ids).toContain('privacy')
    expect(ids.indexOf('privacy')).toBe(ids.indexOf('system') + 1)
    const privacy = SETTINGS_TABS.find((tab) => tab.id === 'privacy')
    expect(privacy?.label).toBe('Privacy (RA 10173)')
    expect(privacy?.shortLabel).toBe('Privacy')
    expect(privacy?.accessibilityLabel).toBe('Privacy RA 10173 settings')
  })

  it('owns no setting keys — the tab is read-only', () => {
    expect(TAB_SETTING_KEYS.privacy).toEqual([])
    expect(fieldsForTab('privacy')).toEqual([])
    expect(switchesForTab('privacy')).toEqual([])
  })

  it('is never dirty and always saveable (no keys to save)', () => {
    const values = { ...SETTING_DEFAULTS, institution_name: 'changed' }
    expect(isTabDirty('privacy', values, SETTING_DEFAULTS)).toBe(false)
    expect(isTabSaveable('privacy', values)).toBe(true)
  })

  it('leaves every other tab untouched (system gains the F6 retention key)', () => {
    expect(TAB_SETTING_KEYS.institution).toEqual(['institution_name'])
    expect(TAB_SETTING_KEYS.system).toEqual([
      'maintenance_mode_enabled',
      'maintenance_message',
      'maintenance_until',
      'geolocation_retention_days',
    ])
    expect(SETTING_DEFAULTS.maintenance_mode_enabled).toBe('false')
    expect(SETTING_DEFAULTS.geolocation_retention_days).toBe('30')
  })
})

describe('privacy tab visibility', () => {
  it('shows super admins the full console including privacy', () => {
    expect(visibleSettingsTabs({ role: 'super_admin' }).map((tab) => tab.id)).toEqual([
      'institution',
      'sessions',
      'accounts',
      'ai',
      'system',
      'privacy',
    ])
  })

  it('shows IT coordinators system plus privacy', () => {
    expect(
      visibleSettingsTabs({ role: 'teacher', isItCoordinator: true }).map((tab) => tab.id),
    ).toEqual(['system', 'privacy'])
  })

  it('answers defensively with system plus privacy for anyone else', () => {
    expect(visibleSettingsTabs({ role: 'teacher' }).map((tab) => tab.id)).toEqual([
      'system',
      'privacy',
    ])
    expect(visibleSettingsTabs(null).map((tab) => tab.id)).toEqual(['system', 'privacy'])
  })
})

describe('privacyCoveragePercent', () => {
  it('computes and clamps coverage', () => {
    expect(privacyCoveragePercent(340, 400)).toBe(85)
    expect(privacyCoveragePercent(400, 400)).toBe(100)
    expect(privacyCoveragePercent(500, 400)).toBe(100)
    expect(privacyCoveragePercent(0, 400)).toBe(0)
  })

  it('returns null when the denominator is meaningless', () => {
    expect(privacyCoveragePercent(0, 0)).toBeNull()
    expect(privacyCoveragePercent(10, -5)).toBeNull()
    expect(privacyCoveragePercent(Number.NaN, 10)).toBeNull()
    expect(privacyCoveragePercent(10, Number.POSITIVE_INFINITY)).toBeNull()
  })
})

describe('buildPrivacyView', () => {
  it('maps a live snapshot onto the condensed mirror', () => {
    const view = buildPrivacyView(snapshot())
    expect(view.attestationValue).toBe('2')
    expect(view.retentionDays).toBe(30)
    expect(view.lastRunAt).toBe('2026-11-01T03:00:00.000Z')
    expect(view.shredVerified).toBe(true)
    expect(view.recordsShredded).toBe('12')
    expect(view.attemptsShredded).toBe('3')
    expect(view.coveragePercent).toBe(85)
    expect(view.consentCovered).toBe(340)
    expect(view.consentTotal).toBe(400)
    expect(view.consentVersion).toBe('2026-08-01')
    expect(view.inventoryRows).toHaveLength(1)
    expect(view.inventoryRows[0]).toEqual(snapshot().dataInventory[0])
  })

  it('renders missing shred counts as Unknown, never zero', () => {
    const view = buildPrivacyView(
      snapshot({
        ephemeral: {
          coordinatesBeyondRetention: null,
          lastRunAt: null,
          recordsShredded: null,
          attemptsShredded: null,
        },
      }),
    )
    expect(view.recordsShredded).toBe('Unknown')
    expect(view.attemptsShredded).toBe('Unknown')
    expect(view.lastRunAt).toBeNull()
    expect(view.shredVerified).toBe(false)
  })

  it('keeps zero shred counts visible as zero', () => {
    const view = buildPrivacyView(
      snapshot({
        ephemeral: {
          coordinatesBeyondRetention: 0,
          lastRunAt: '2026-11-01T03:00:00.000Z',
          recordsShredded: 0,
          attemptsShredded: 0,
        },
      }),
    )
    expect(view.recordsShredded).toBe('0')
    expect(view.attemptsShredded).toBe('0')
  })

  it('drops to a null coverage when no accounts are active', () => {
    const view = buildPrivacyView(snapshot({ consent: { covered: 0, totalActive: 0, version: 'v1' } }))
    expect(view.coveragePercent).toBeNull()
    expect(view.consentTotal).toBe(0)
    expect(view.consentVersion).toBe('v1')
  })

  it('carries the full shared inventory rows', () => {
    const view = buildPrivacyView(
      snapshot({
        dataInventory: [
          { data: 'A', purpose: 'P', lawfulBasis: 'L', lifetime: 'T' },
          { data: 'B', purpose: 'P', lawfulBasis: 'L', lifetime: 'T' },
        ],
      }),
    )
    expect(view.inventoryRows.map((row) => row.data)).toEqual(['A', 'B'])
  })
})

describe('DPO summary share target', () => {
  it('targets the authenticated DPO document endpoint', () => {
    expect(DPO_SUMMARY_DOWNLOAD_PATH).toBe('/docs/dpo-summary?format=pdf')
    expect(DPO_SUMMARY_FILENAME).toBe('PUP-DPO-Summary.pdf')
  })
})

describe('class record share target (F4)', () => {
  it('targets the authenticated class-record endpoint', () => {
    expect(classRecordDownloadPath('sec-001')).toBe('/docs/class-record/sec-001?format=pdf')
    expect(classRecordDownloadPath('sec/1')).toBe('/docs/class-record/sec%2F1?format=pdf')
  })

  it('builds the PUP class-record filename from code and section', () => {
    expect(classRecordFileName('IT 101', '1-1')).toBe('PUP-Class-Record-IT-101-1-1.pdf')
    expect(classRecordFileName('', '2-2')).toBe('PUP-Class-Record-2-2.pdf')
    expect(classRecordFileName('IT 101', '')).toBe('PUP-Class-Record-IT-101.pdf')
    expect(classRecordFileName('', '')).toBe('PUP-Class-Record.pdf')
  })
})

describe('settings tab ids stay exhaustive', () => {
  it('covers every tab id in the key map', () => {
    const ids = SETTINGS_TABS.map((tab) => tab.id) as SettingsTabId[]
    for (const id of ids) {
      expect(Array.isArray(TAB_SETTING_KEYS[id])).toBe(true)
    }
    expect(ids).toHaveLength(6)
  })
})
