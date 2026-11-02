import {
  MAX_VISIBLE_TOASTS,
  TOAST_DURATION_MS,
  createToast,
  dismissToast,
  enqueueToast,
  scheduleToastExpiry,
  toastDuration,
  type ToastItem,
  type ToastTimers,
  type ToastType,
} from '../components/toast-state'

const queue = (...toasts: ToastItem[]) => ({ visible: toasts })

describe('toast-state', () => {
  it('enqueues the newest toast on top', () => {
    const first = createToast('info', 'First')
    const second = createToast('success', 'Second')

    const { state, evicted } = enqueueToast(enqueueToast(queue(), first).state, second)

    expect(state.visible.map((toast) => toast.title)).toEqual(['Second', 'First'])
    expect(evicted).toEqual([])
  })

  it(`keeps at most ${MAX_VISIBLE_TOASTS} visible and evicts the oldest`, () => {
    const first = createToast('info', 'First')
    const second = createToast('info', 'Second')
    const third = createToast('info', 'Third')

    const afterFirst = enqueueToast(queue(), first).state
    const afterSecond = enqueueToast(afterFirst, second).state
    const { state, evicted } = enqueueToast(afterSecond, third)

    expect(state.visible.map((toast) => toast.title)).toEqual(['Third', 'Second'])
    expect(evicted.map((toast) => toast.title)).toEqual(['First'])
  })

  it('dismisses a toast by id and ignores unknown ids', () => {
    const first = createToast('info', 'First')
    const second = createToast('warning', 'Second')
    const state = queue(second, first)

    expect(dismissToast(state, first.id).visible).toEqual([second])
    expect(dismissToast(state, 'missing').visible).toHaveLength(2)
  })

  it('uses variant durations and applies them to created toasts', () => {
    expect(TOAST_DURATION_MS).toEqual({ success: 3_500, info: 3_500, error: 5_000, warning: 5_000 })
    ;(['success', 'info', 'error', 'warning'] as ToastType[]).forEach((type) => {
      expect(toastDuration(type)).toBe(TOAST_DURATION_MS[type])
      expect(createToast(type, 'Title').durationMs).toBe(TOAST_DURATION_MS[type])
    })
  })

  it('creates unique ids even within the same millisecond', () => {
    const ids = new Set(Array.from({ length: 10 }, () => createToast('info', 'Same title').id))
    expect(ids.size).toBe(10)
  })

  it('auto-expires after the variant duration and can be cancelled', () => {
    const toast = createToast('error', 'Upload failed')
    const scheduled: Array<{ callback: () => void; delayMs: number }> = []
    const timers: ToastTimers = {
      set: (callback, delayMs) => {
        scheduled.push({ callback, delayMs })
        return scheduled.length
      },
      clear: jest.fn(),
    }
    const onExpire = jest.fn()

    const cancel = scheduleToastExpiry(toast, onExpire, timers)

    expect(scheduled).toHaveLength(1)
    expect(scheduled[0].delayMs).toBe(5_000)
    scheduled[0].callback()
    expect(onExpire).toHaveBeenCalledWith(toast.id)

    cancel()
    expect(timers.clear).toHaveBeenCalled()
  })

  it('does not expire short-lived variants late', () => {
    const toast = createToast('success', 'Saved')
    const delays: number[] = []
    const timers: ToastTimers = { set: (_callback, delayMs) => { delays.push(delayMs) }, clear: jest.fn() }

    scheduleToastExpiry(toast, jest.fn(), timers)

    expect(delays).toEqual([3_500])
  })
})
