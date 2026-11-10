import type { User } from '@polycheck/shared'
import { canAccessAcademicOversight, canAccessItOperations, canAccessUserAdmin } from '@polycheck/shared'

/**
 * Pure derivation of the faculty "More" sheet. Extracted from the tab layout
 * so designation gating is unit-testable without rendering React Native.
 */
export interface FacultyMoreItem {
  /** MaterialIcons glyph name (typed at the call site). */
  icon: string
  label: string
  sub: string
  route: string
  badge?: number
}

export interface FacultyMoreInput {
  user: Pick<User, 'role' | 'isItCoordinator' | 'isDepartmentHead' | 'isUserRegistrar'> | null
  showAssistant: boolean
  pendingExcuses: number
  /**
   * F7 demo killswitch — env-gated (`EXPO_PUBLIC_ENABLE_OUTAGE_SIMULATOR`),
   * default off. Passed in as a plain boolean so this derivation stays pure.
   */
  outageSimulatorEnabled?: boolean
}

/**
 * Strict env parsing for the outage-simulator flag, mirroring the
 * qr-fallback-policy pattern: only the exact string "true" enables it.
 * Production builds pin "false" (eas.json production env).
 */
export function isOutageSimulatorEnabled(value: string | undefined): boolean {
  return value === 'true'
}

/** Sentinel route for the More-sheet simulator entry (never navigated). */
export const OUTAGE_SIMULATOR_ROUTE = 'outage-simulator'

export function buildFacultyMoreItems({ user, showAssistant, pendingExcuses, outageSimulatorEnabled = false }: FacultyMoreInput): FacultyMoreItem[] {
  const isSuper = user?.role === 'super_admin'
  const items: FacultyMoreItem[] = isSuper
    ? [
        { icon: 'search', label: 'Global Search', sub: 'Find users and sections', route: '/(faculty)/search' },
        {
          icon: 'settings',
          label: 'Institution Settings',
          sub: 'Configure institution defaults',
          route: '/(faculty)/settings',
        },
        { icon: 'history', label: 'Audit Log', sub: 'Review administrative changes', route: '/(faculty)/audit-logs' },
        {
          icon: 'receipt-long',
          label: 'System Reports',
          sub: 'Triage campus issue reports',
          route: '/(faculty)/system-reports',
        },
        { icon: 'manage-accounts', label: 'Profile & security', sub: 'Your account, password and devices', route: '/profile' },
        {
          icon: 'smart-toy',
          label: 'Assistant',
          sub: 'Oversight, accounts & exports',
          route: '/(faculty)/assistant',
        },
      ]
    : [
        { icon: 'calendar-today', label: 'Schedule', sub: 'Weekly class schedule', route: '/(faculty)/schedule' },
        { icon: 'assignment', label: 'Attendance', sub: 'Overview & export', route: '/(faculty)/attendance' },
        {
          icon: 'assignment-turned-in',
          label: 'Excuses',
          sub: pendingExcuses > 0 ? `${pendingExcuses} waiting · Review excuse requests` : 'Review student excuse requests',
          route: '/(faculty)/excuses',
          badge: pendingExcuses,
        },
        { icon: 'flag', label: 'Report an Issue', sub: 'Bugs, GPS quirks, or ideas', route: '/report-issue' },
        { icon: 'search', label: 'Search', sub: 'Find students and sections', route: '/(faculty)/search' },
        { icon: 'manage-accounts', label: 'Profile & security', sub: 'Your account, password and devices', route: '/profile' },
        {
          icon: 'smart-toy',
          label: 'Assistant',
          sub: 'Ask about your sections and exports',
          route: '/(faculty)/assistant',
        },
        // F7 demo killswitch — appended last so the production order is
        // untouched; only visible when the env flag explicitly enables it.
        ...(outageSimulatorEnabled
          ? [{
              icon: 'bolt',
              label: 'Outage Simulator',
              sub: 'Demo: cut the network, keep attendance',
              route: OUTAGE_SIMULATOR_ROUTE,
            }]
          : []),
      ]

  if (!isSuper) {
    if (canAccessItOperations(user)) {
      items.push(
        { icon: 'dns', label: 'Server Status', sub: 'Live server health metrics', route: '/(faculty)/server-status' },
        { icon: 'receipt-long', label: 'Issue Reports', sub: 'Triage campus issue reports', route: '/(faculty)/system-reports' },
        {
          icon: 'build',
          label: 'Maintenance Controls',
          sub: 'Close or reopen the campus system',
          route: '/(faculty)/settings',
        },
      )
    }
    if (canAccessAcademicOversight(user)) {
      items.push(
        { icon: 'assessment', label: 'Department Reports', sub: 'Department-wide attendance & exports', route: '/(faculty)/reports' },
        { icon: 'warning', label: 'At-Risk Students', sub: 'Students near the attendance floor', route: '/(faculty)/at-risk' },
      )
    }
    if (canAccessUserAdmin(user)) {
      items.push(
        { icon: 'people', label: 'User Management', sub: 'Accounts, resets & roster imports', route: '/(faculty)/users' },
      )
    }
  }

  return items.filter((item) => showAssistant || item.route !== '/(faculty)/assistant')
}
