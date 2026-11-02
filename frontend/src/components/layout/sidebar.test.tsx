import { cleanup, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { User } from '@polycheck/shared'

vi.mock('next/navigation', () => ({
  usePathname: () => '/faculty',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
}))
vi.mock('next/image', () => ({
  default: (props: Record<string, unknown>) => {
    const { src, alt, width, height, className } = props as {
      src: string
      alt: string
      width: number
      height: number
      className?: string
    }
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={src} alt={alt} width={width} height={height} className={className} />
  },
}))
vi.mock('./NotificationBell', () => ({ NotificationBell: () => null }))
vi.mock('@/lib/hooks/use-notification-center', () => ({
  useNotificationCenter: () => ({
    notifications: [],
    unreadCount: 0,
    status: 'idle',
    error: null,
    refresh: vi.fn(),
    markAllRead: vi.fn(),
    markRead: vi.fn(),
  }),
}))
vi.mock('@/components/reports/ReportIssueDialog', () => ({ ReportIssueDialog: () => null }))
vi.mock('@/components/ThemeToggle', () => ({ default: () => null }))

import { Sidebar } from './sidebar'

const base: Omit<User, 'id' | 'fullName' | 'role'> = {
  email: 'faculty@pup.edu.ph',
  department: 'CCIS',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const plainTeacher: User = { ...base, id: 't-1', fullName: 'Prof. Plain', role: 'teacher' }
const itCoordinator: User = { ...plainTeacher, id: 't-2', isItCoordinator: true }
const head: User = { ...plainTeacher, id: 't-3', isDepartmentHead: true }
const registrar: User = { ...plainTeacher, id: 't-4', isUserRegistrar: true }
const superAdmin: User = {
  ...base,
  id: 'a-1',
  fullName: 'Dr. Admin',
  role: 'super_admin',
}

function renderSidebar(user: User) {
  return render(<Sidebar user={user} onLogout={vi.fn()} />)
}

describe('Sidebar designation suites', () => {
  afterEach(cleanup)

  it('renders only the teaching workspace for a plain teacher', () => {
    renderSidebar(plainTeacher)

    expect(screen.getByRole('link', { name: 'Class Sessions' })).toBeInTheDocument()
    expect(screen.queryByText('IT Operations Suite')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Server Status' })).not.toBeInTheDocument()
    expect(screen.queryByText('Academic Department Oversight')).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'At-Risk Students' })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'User Management' })).not.toBeInTheDocument()
  })

  it('appends the IT Operations Suite for an IT coordinator', () => {
    renderSidebar(itCoordinator)

    expect(screen.getByText('IT Operations Suite')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Server Status' })).toHaveAttribute(
      'href',
      '/faculty/server-status',
    )
    expect(screen.getByRole('link', { name: 'Issue Reports' })).toHaveAttribute(
      'href',
      '/faculty/system-reports',
    )
    expect(screen.getByRole('link', { name: 'Maintenance Controls' })).toHaveAttribute(
      'href',
      '/faculty/settings?tab=system',
    )
    expect(screen.queryByText('Academic Department Oversight')).not.toBeInTheDocument()
  })

  it('re-parents Excuses under the academic oversight group for a department head', () => {
    renderSidebar(head)

    expect(screen.getByText('Academic Department Oversight')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Department Reports' })).toHaveAttribute(
      'href',
      '/faculty/reports',
    )
    expect(screen.getByRole('link', { name: 'At-Risk Students' })).toHaveAttribute(
      'href',
      '/faculty/at-risk',
    )
    expect(screen.getAllByRole('link', { name: 'Excuses' })).toHaveLength(1)
    expect(screen.queryByText('IT Operations Suite')).not.toBeInTheDocument()
  })

  it('appends the Registrar Suite for a registrar', () => {
    renderSidebar(registrar)

    expect(screen.getByText('Registrar Suite')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'User Management' })).toHaveAttribute(
      'href',
      '/faculty/users',
    )
  })

  it('renders both suites for a dual-hat teacher', () => {
    renderSidebar({ ...itCoordinator, isDepartmentHead: true, isUserRegistrar: true })

    expect(screen.getByText('IT Operations Suite')).toBeInTheDocument()
    expect(screen.getByText('Academic Department Oversight')).toBeInTheDocument()
    expect(screen.getByText('Registrar Suite')).toBeInTheDocument()
  })

  it('keeps the super-admin console list unchanged (no designee groups)', () => {
    renderSidebar(superAdmin)

    expect(screen.queryByText('IT Operations Suite')).not.toBeInTheDocument()
    expect(screen.queryByText('Academic Department Oversight')).not.toBeInTheDocument()
    expect(screen.queryByText('Registrar Suite')).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'User Management' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Institution Settings' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Server Status' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Global Search' })).toBeInTheDocument()
  })
})
