import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const routerMock = vi.hoisted(() => ({ replace: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => routerMock }))
vi.mock('@/lib/api-config', () => ({ API_BASE: 'https://api.polycheck.test/api' }))
vi.mock('@/lib/signing-key', () => ({
  getOrCreateTeacherSigningKey: vi.fn(),
  isSigningKeyProvisioned: vi.fn(),
  markSigningKeyProvisioned: vi.fn(),
}))

import { api } from '@/lib/api-client'
import { SessionGuard } from './SessionGuard'

const teacher = { id: 'teacher-1', fullName: 'Prof. Test', role: 'teacher' as const }
const response = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json' },
})

describe('SessionGuard storage failure handling', () => {
  beforeEach(() => {
    routerMock.replace.mockReset()
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(teacher)))
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('hides protected content after a 401 even when localStorage removal is blocked', async () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError')
    })
    vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => {
      throw new DOMException('Storage blocked', 'SecurityError')
    })

    render(<SessionGuard area="faculty"><div>Protected QR content</div></SessionGuard>)
    expect(await screen.findByText('Protected QR content')).toBeInTheDocument()

    vi.mocked(fetch).mockResolvedValueOnce(response({ message: 'Session expired' }, 401))

    await expect(api.getSubjects()).rejects.toThrow('Session expired')

    await waitFor(() => expect(routerMock.replace).toHaveBeenCalledWith('/'))
    expect(screen.queryByText('Protected QR content')).not.toBeInTheDocument()
  })

  it('periodically revalidates over HTTP and hides content after session replacement', async () => {
    vi.useFakeTimers()
    render(<SessionGuard area="faculty"><div>Protected QR content</div></SessionGuard>)
    await act(async () => { await Promise.resolve() })
    expect(screen.getByText('Protected QR content')).toBeInTheDocument()

    vi.mocked(fetch).mockResolvedValueOnce(response({ message: 'Session replaced' }, 401))
    await act(async () => {
      vi.advanceTimersByTime(60_000)
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(routerMock.replace).toHaveBeenCalledWith('/')
    expect(screen.queryByText('Protected QR content')).not.toBeInTheDocument()
  })

  it('revalidates on focus while preserving ready content on a transient HTTP failure', async () => {
    render(<SessionGuard area="faculty"><div>Protected QR content</div></SessionGuard>)
    expect(await screen.findByText('Protected QR content')).toBeInTheDocument()

    vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Network unavailable'))
    await act(async () => {
      window.dispatchEvent(new Event('focus'))
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(screen.getByText('Protected QR content')).toBeInTheDocument()
    expect(screen.queryByText('We couldn’t verify your session')).not.toBeInTheDocument()
  })
})
