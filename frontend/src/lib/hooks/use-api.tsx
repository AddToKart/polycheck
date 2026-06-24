import { useState, useCallback } from 'react'

interface UseApiState<T> {
  data: T | null
  loading: boolean
  error: string | null
  execute: (...args: any[]) => Promise<T | null>
  reset: () => void
}

export function useApi<T>(
  apiFn: (...args: any[]) => T | null,
  ...args: any[]
): UseApiState<T> {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const execute = useCallback(async (...executeArgs: any[]) => {
    setLoading(true)
    setError(null)
    try {
      const result = await new Promise<T | null>((resolve) => {
        setTimeout(() => {
          try {
            const res = apiFn(...(executeArgs.length ? executeArgs : args))
            resolve(res)
          } catch (e) {
            throw e
          }
        }, 200)
      })
      setData(result)
      return result
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'An error occurred'
      setError(msg)
      return null
    } finally {
      setLoading(false)
    }
  }, [apiFn, args])

  const reset = useCallback(() => {
    setData(null)
    setLoading(false)
    setError(null)
  }, [])

  return { data, loading, error, execute, reset }
}

export function LoadingSpinner({ size = 'md', className = '' }: { size?: 'sm' | 'md' | 'lg', className?: string }) {
  const sizeMap = { sm: 'w-4 h-4', md: 'w-8 h-8', lg: 'w-12 h-12' }
  return (
    <div className={`flex items-center justify-center ${className}`}>
      <div className={`${sizeMap[size]} border-2 border-maroon/20 border-t-maroon dark:border-golden/20 dark:border-t-golden rounded-full animate-spin`} />
    </div>
  )
}

export function ErrorDisplay({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center">
      <p className="text-maroon-dark dark:text-golden font-bold text-sm mb-2">Something went wrong</p>
      <p className="text-xs text-zinc-500 mb-4">{message}</p>
      {onRetry && (
        <button onClick={onRetry} className="text-[10px] uppercase tracking-widest font-bold text-maroon dark:text-golden hover:underline">
          Try Again
        </button>
      )}
    </div>
  )
}
