import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { User } from '@polycheck/shared'

vi.mock('next/navigation', () => ({
  usePathname: () => '/student/assistant',
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({ push: vi.fn() }),
}))
vi.mock('next/link', () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string
    children?: React.ReactNode
    className?: string
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}))
vi.mock('next/image', () => ({
  default: () => <span data-testid="next-image" />,
}))
vi.mock('@/lib/api-client', () => ({
  api: {
    getUnreadNotificationCount: vi.fn().mockResolvedValue(3),
    getNotifications: vi.fn().mockResolvedValue([]),
    markNotificationsRead: vi.fn().mockResolvedValue(0),
  },
}))
vi.mock('@/lib/realtime', () => ({
  subscribeToNotifications: vi.fn(() => vi.fn()),
}))

import { Sidebar } from './sidebar'

const student: User = {
  id: 'student-1',
  studentId: '2026-00001-MN-0',
  fullName: 'Test Student',
  email: 'student@pup.edu.ph',
  role: 'student',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

describe('Sidebar student navigation', () => {
  it('includes the assistant destination and marks it active on its route', () => {
    render(<Sidebar user={student} onLogout={vi.fn()} />)

    const assistantLink = screen.getByRole('link', { name: /assistant/i })
    expect(assistantLink).toHaveAttribute('href', '/student/assistant')
    expect(assistantLink).toHaveClass('border-maroon')
  })

  it('renders the notification bell with the unread count', async () => {
    render(<Sidebar user={student} onLogout={vi.fn()} />)

    const bells = await screen.findAllByRole('button', { name: /notifications, 3 unread/i })
    expect(bells.length).toBeGreaterThan(0)
  })
})
