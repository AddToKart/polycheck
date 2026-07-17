import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { useApi } from './use-api'

describe('useApi', () => {
  it('awaits a real asynchronous API call and stores its result', async () => {
    const api = vi.fn().mockResolvedValue({ id: 'subject-1' })
    const { result } = renderHook(() => useApi(api))

    await act(async () => {
      await expect(result.current.execute()).resolves.toEqual({ id: 'subject-1' })
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.data).toEqual({ id: 'subject-1' })
    expect(result.current.error).toBeNull()
  })

  it('captures rejected requests instead of leaking an unhandled exception', async () => {
    const api = vi.fn().mockRejectedValue(new Error('Backend unavailable'))
    const { result } = renderHook(() => useApi(api))

    await act(async () => {
      await expect(result.current.execute()).resolves.toBeNull()
    })

    expect(result.current.loading).toBe(false)
    expect(result.current.error).toBe('Backend unavailable')
  })

  it('forwards execute-time arguments and resets state', async () => {
    const api = vi.fn((id: string) => Promise.resolve(id))
    const { result } = renderHook(() => useApi(api, 'default'))

    await act(async () => {
      await result.current.execute('override')
    })
    expect(api).toHaveBeenCalledWith('override')

    act(() => result.current.reset())
    expect(result.current.data).toBeNull()
    expect(result.current.error).toBeNull()
  })
})
