// Banner copy/outcome mapping for the F9 "Verify Ledger Integrity" action on
// the audit-logs screen. The screen module is imported so the helper and its
// token class maps stay locked to what the banner actually renders.
jest.mock('expo-router', () => ({
  router: { back: jest.fn(), push: jest.fn(), replace: jest.fn() },
  useRouter: () => ({ back: jest.fn(), push: jest.fn(), replace: jest.fn() }),
}))
jest.mock('react-native-safe-area-context', () => ({
  SafeAreaView: 'SafeAreaView',
  SafeAreaProvider: 'SafeAreaProvider',
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}))
jest.mock('@expo/vector-icons', () => ({ MaterialIcons: 'MaterialIcons' }))
jest.mock('react-native', () => ({
  Platform: { OS: 'android', select: (obj: Record<string, unknown>) => obj.android ?? obj.default },
  StyleSheet: { create: (styles: unknown) => styles, flatten: (style: unknown) => style },
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  ActivityIndicator: 'ActivityIndicator',
  Image: 'Image',
}))
jest.mock('../services/api-client', () => ({
  api: { getCurrentUser: jest.fn(() => null), getAuditLogs: jest.fn(), verifyLedger: jest.fn() },
}))

import type { LedgerVerifyResult } from '@polycheck/shared'
import {
  ledgerBannerFor,
  LEDGER_BANNER_DETAIL_TONE_CLASSES,
  LEDGER_BANNER_TEXT_TONE_CLASSES,
  LEDGER_BANNER_TONE_CLASSES,
  type LedgerBannerTone,
  type LedgerVerifyState,
} from '../app/(faculty)/audit-logs'

const verified: LedgerVerifyResult = {
  verified: true,
  recordsChecked: 1204,
  sessionsChecked: 42,
  lastAnchorDate: '2026-11-01',
}

const verifiedWithoutAnchor: LedgerVerifyResult = { verified: true, recordsChecked: 12, sessionsChecked: 3 }

const broken: LedgerVerifyResult = {
  verified: false,
  recordsChecked: 900,
  sessionsChecked: 40,
  brokenAt: { sessionId: 'sess-9', recordId: 'rec-77', reason: 'hash_mismatch' },
}

describe('ledgerBannerFor', () => {
  it('renders nothing while idle', () => {
    expect(ledgerBannerFor({ phase: 'idle' })).toBeNull()
  })

  it('shows a read-only busy state while scanning', () => {
    const banner = ledgerBannerFor({ phase: 'busy' })
    expect(banner?.tone).toBe('busy')
    expect(banner?.title).toBe('Verifying ledger integrity…')
    expect(banner?.detail).toContain('read-only')
  })

  it('announces an intact ledger with counts and the last anchor date', () => {
    const banner = ledgerBannerFor({ phase: 'done', result: verified })
    expect(banner?.tone).toBe('verified')
    expect(banner?.title).toBe('✓ Ledger intact — 1,204 records across 42 sessions verified')
    expect(banner?.detail).toBe('Last published anchor: 2026-11-01')
  })

  it('explains the anchor convention when no anchor has been published yet', () => {
    const banner = ledgerBannerFor({ phase: 'done', result: verifiedWithoutAnchor })
    expect(banner?.title).toBe('✓ Ledger intact — 12 records across 3 sessions verified')
    expect(banner?.detail).toBe('Daily chain heads are published to the audit trail.')
  })

  it('points at the broken record and its session', () => {
    const banner = ledgerBannerFor({ phase: 'done', result: broken })
    expect(banner?.tone).toBe('broken')
    expect(banner?.title).toBe('✗ Chain broken at rec-77')
    expect(banner?.detail).toBe('Investigate session sess-9 — the stored hash no longer matches the recomputed chain.')
  })

  it('humanizes every break reason', () => {
    const link = ledgerBannerFor({
      phase: 'done',
      result: { verified: false, recordsChecked: 1, sessionsChecked: 1, brokenAt: { sessionId: 's', recordId: 'r', reason: 'link_mismatch' } },
    })
    expect(link?.detail).toContain('wrong predecessor record')

    const anchor = ledgerBannerFor({
      phase: 'done',
      result: { verified: false, recordsChecked: 1, sessionsChecked: 1, brokenAt: { sessionId: 's', recordId: 'r', reason: 'anchor_mismatch' } },
    })
    expect(anchor?.detail).toContain('published daily anchor')

    const coverage = ledgerBannerFor({
      phase: 'done',
      result: { verified: false, recordsChecked: 1, sessionsChecked: 1, brokenAt: { sessionId: 's', recordId: 'r', reason: 'coverage_incomplete' } },
    })
    expect(coverage?.detail).toContain('finalized attendance row has no ledger hash')
  })

  it('keeps a usable message when the scanner cannot name the break', () => {
    const banner = ledgerBannerFor({ phase: 'done', result: { verified: false, recordsChecked: 0, sessionsChecked: 0 } })
    expect(banner?.tone).toBe('broken')
    expect(banner?.title).toBe('✗ Chain verification failed')
    expect(banner?.detail).toContain('check server logs and retry')
  })

  it('maps request failures to a retryable error banner', () => {
    const banner = ledgerBannerFor({ phase: 'error', message: 'Network request failed' })
    expect(banner?.tone).toBe('error')
    expect(banner?.title).toBe('Ledger verification failed')
    expect(banner?.detail).toBe('Network request failed')
  })
})

describe('ledger banner tone classes', () => {
  const toneOf = (state: LedgerVerifyState): LedgerBannerTone => {
    const banner = ledgerBannerFor(state)
    if (!banner) throw new Error(`no banner for phase ${state.phase}`)
    return banner.tone
  }

  it('renders verified in emerald, broken/error in red, busy neutral', () => {
    expect(LEDGER_BANNER_TONE_CLASSES[toneOf({ phase: 'done', result: verified })]).toContain('emerald')
    expect(LEDGER_BANNER_TONE_CLASSES[toneOf({ phase: 'done', result: broken })]).toContain('red')
    expect(LEDGER_BANNER_TONE_CLASSES[toneOf({ phase: 'error', message: 'x' })]).toContain('red')
    expect(LEDGER_BANNER_TONE_CLASSES[toneOf({ phase: 'busy' })]).toContain('bg-white')
    expect(LEDGER_BANNER_TONE_CLASSES[toneOf({ phase: 'busy' })]).toContain('surface-dark')
  })

  it('pairs every tone with title and detail text classes', () => {
    for (const tone of ['busy', 'verified', 'broken', 'error'] as const) {
      expect(LEDGER_BANNER_TEXT_TONE_CLASSES[tone]).toContain('text-')
      expect(LEDGER_BANNER_DETAIL_TONE_CLASSES[tone]).toContain('text-')
    }
  })
})
