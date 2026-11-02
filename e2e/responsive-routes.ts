/**
 * Canonical route inventory for responsive coverage.
 *
 * Every rendered page in `frontend/src/app` appears here so the responsive
 * harness (`responsive.spec.ts`) and the mobile screenshot capture stay in
 * sync with the app surface. Redirect-only routes (`/student`) are excluded.
 * Add new pages here when they ship — the spec fails nothing silently.
 *
 * A few paths appear in more than one group on purpose: the same page renders
 * different role-scoped data (e.g. `/faculty/reports` for a department head vs.
 * a super admin, `/faculty/users` for a registrar vs. an institution admin), so
 * each audience is audited separately. Designation groups cover surfaces that
 * are not reachable from the default faculty/student seed accounts.
 */

export interface RouteCase {
  name: string
  path: string
  /** Extra settle time for routes that render async data/heavy canvases. */
  settleMs?: number
}

export const ANONYMOUS_ROUTES: RouteCase[] = [
  { name: 'landing', path: '/' },
  { name: 'login-choice', path: '/login' },
  { name: 'login-faculty', path: '/login/faculty' },
  { name: 'login-student', path: '/login/student' },
  { name: 'privacy', path: '/privacy' },
  { name: 'offline-fallback', path: '/offline' },
]

export const FACULTY_ROUTES: RouteCase[] = [
  { name: 'dashboard', path: '/faculty', settleMs: 1200 },
  { name: 'profile', path: '/profile', settleMs: 1200 },
  { name: 'subjects', path: '/faculty/subjects' },
  { name: 'subject-create', path: '/faculty/subjects/create' },
  { name: 'subject-detail', path: '/faculty/subjects/subj-001' },
  { name: 'subject-sessions', path: '/faculty/subjects/subj-001/sessions' },
  { name: 'section-create', path: '/faculty/sections/create' },
  { name: 'section-detail', path: '/faculty/sections/sec-001', settleMs: 1200 },
  { name: 'student-detail', path: '/faculty/students/s-001', settleMs: 1000 },
  { name: 'sessions', path: '/faculty/sessions' },
  { name: 'session-create', path: '/faculty/sessions/create', settleMs: 1000 },
  { name: 'session-cockpit', path: '/faculty/sessions/sess-001', settleMs: 1500 },
  { name: 'attendance', path: '/faculty/attendance', settleMs: 1200 },
  { name: 'schedule', path: '/faculty/schedule' },
  { name: 'disputes', path: '/faculty/disputes' },
  { name: 'excuses', path: '/faculty/excuses' },
  { name: 'assistant', path: '/faculty/assistant' },
]

export const SUPER_ADMIN_ROUTES: RouteCase[] = [
  { name: 'dashboard', path: '/faculty', settleMs: 1200 },
  { name: 'profile', path: '/profile', settleMs: 1200 },
  { name: 'users', path: '/faculty/users', settleMs: 1200 },
  { name: 'reports', path: '/faculty/reports', settleMs: 1500 },
  { name: 'audit-logs', path: '/faculty/audit-logs', settleMs: 1200 },
  { name: 'server-status', path: '/faculty/server-status', settleMs: 1200 },
  { name: 'settings', path: '/faculty/settings' },
  { name: 'search', path: '/faculty/search' },
]

/**
 * Department heads (`isDepartmentHead`) get the Academic Oversight suite:
 * department-pinned reports and the at-risk students view.
 */
export const DEPARTMENT_HEAD_ROUTES: RouteCase[] = [
  { name: 'reports', path: '/faculty/reports', settleMs: 1500 },
  { name: 'at-risk', path: '/faculty/at-risk', settleMs: 1500 },
]

/**
 * IT coordinators (`isItCoordinator`) get the IT Operations suite. The settings
 * route is captured with the `system` tab because that is the only tab their
 * per-key write policy allows.
 */
export const IT_COORDINATOR_ROUTES: RouteCase[] = [
  { name: 'system-reports', path: '/faculty/system-reports', settleMs: 1800 },
  { name: 'server-status', path: '/faculty/server-status', settleMs: 1500 },
  { name: 'settings-system', path: '/faculty/settings?tab=system', settleMs: 1500 },
]

/** Registrars (`isUserRegistrar`) get department-pinned account administration. */
export const REGISTRAR_ROUTES: RouteCase[] = [
  { name: 'users', path: '/faculty/users', settleMs: 1500 },
]

export const STUDENT_ROUTES: RouteCase[] = [
  { name: 'dashboard', path: '/student/dashboard', settleMs: 1200 },
  { name: 'dashboard-subjects', path: '/student/dashboard?tab=subjects', settleMs: 1000 },
  { name: 'dashboard-attendance', path: '/student/dashboard?tab=attendance', settleMs: 1000 },
  { name: 'schedule', path: '/student/schedule' },
  { name: 'subject-detail', path: '/student/subjects/sec-001', settleMs: 1000 },
  { name: 'session-detail', path: '/student/subjects/sec-001/sessions/sess-001', settleMs: 1000 },
  { name: 'session-create', path: '/student/subjects/sec-001/create-session', settleMs: 1000 },
  { name: 'assistant', path: '/student/assistant' },
  { name: 'profile', path: '/profile', settleMs: 1200 },
]
