import { useCallback, useState } from 'react'

export type LoadState = 'loading' | 'ready' | 'error'

/**
 * Shared load-state for screens backed by async fetches.
 *
 * - `loading` renders a skeleton immediately (no blank/white first frame).
 * - `error` renders a retry affordance instead of a silently empty screen.
 * - `retry()` forces a re-render and increments `reloadToken`, so a screen's
 *   fetch effect can depend on it and re-run while the screen stays focused.
 *
 * Screens must call `markReady()` on success and `markError()` on failure —
 * silent catches that leave the screen empty are not allowed.
 */
export function useLoadState() {
  const [state, setState] = useState<LoadState>('loading')
  const [reloadToken, setReloadToken] = useState(0)

  const markReady = useCallback(() => setState('ready'), [])
  const markError = useCallback(() => setState('error'), [])
  const retry = useCallback(() => {
    setState('loading')
    setReloadToken((token) => token + 1)
  }, [])

  return { state, reloadToken, markReady, markError, retry }
}
