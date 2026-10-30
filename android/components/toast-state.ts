// Pure queue/timer logic for the in-house CampusToast system.
// Kept framework-free so it can be unit-tested without a renderer.

export type ToastType = 'success' | 'error' | 'info' | 'warning'

export interface ToastItem {
  id: string
  type: ToastType
  title: string
  message?: string
  /** Auto-dismiss delay in milliseconds. */
  durationMs: number
}

export interface ToastQueueState {
  /** Newest first. */
  visible: ToastItem[]
}

export const MAX_VISIBLE_TOASTS = 2

export const TOAST_DURATION_MS: Record<ToastType, number> = {
  success: 3_500,
  info: 3_500,
  error: 5_000,
  warning: 5_000,
}

let toastSequence = 0

export function toastDuration(type: ToastType): number {
  return TOAST_DURATION_MS[type]
}

export function createToast(type: ToastType, title: string, message?: string, id?: string): ToastItem {
  toastSequence += 1
  return {
    id: id ?? `toast-${Date.now()}-${toastSequence}`,
    type,
    title,
    message,
    durationMs: toastDuration(type),
  }
}

/**
 * Adds a toast to the top of the queue and drops any overflow from the
 * bottom. Returns the evicted items so callers can cancel their timers.
 */
export function enqueueToast(state: ToastQueueState, toast: ToastItem): { state: ToastQueueState; evicted: ToastItem[] } {
  const next = [toast, ...state.visible]
  return {
    state: { visible: next.slice(0, MAX_VISIBLE_TOASTS) },
    evicted: next.slice(MAX_VISIBLE_TOASTS),
  }
}

export function dismissToast(state: ToastQueueState, id: string): ToastQueueState {
  const visible = state.visible.filter((toast) => toast.id !== id)
  return visible.length === state.visible.length ? state : { visible }
}

export interface ToastTimers {
  set: (callback: () => void, delayMs: number) => unknown
  clear: (handle: unknown) => void
}

export const defaultToastTimers: ToastTimers = {
  set: (callback, delayMs) => setTimeout(callback, delayMs),
  clear: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
}

/**
 * Schedules a toast's auto-dismissal. Returns a cancel function that clears
 * the pending timer (used when the toast is dismissed early or evicted).
 */
export function scheduleToastExpiry(
  toast: ToastItem,
  onExpire: (id: string) => void,
  timers: ToastTimers = defaultToastTimers,
): () => void {
  const handle = timers.set(() => onExpire(toast.id), toast.durationMs)
  return () => timers.clear(handle)
}
