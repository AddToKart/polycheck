import { DEFAULT_MAINTENANCE_MESSAGE } from '@polycheck/shared'

/**
 * Process-lifetime maintenance-mode store.
 *
 * The API client publishes the canonical 503 body here before throwing so the
 * root shell, login screens, and the scan screen can all react without each
 * parsing errors. The store is intentionally not persisted: a fresh process
 * re-probes `GET /maintenance/status` on boot.
 */
export interface ActiveMaintenance {
  message: string
  estimatedEnd?: string
}

let snapshot: ActiveMaintenance | null = null
const listeners = new Set<(value: ActiveMaintenance | null) => void>()

export function getMaintenanceSnapshot(): ActiveMaintenance | null {
  return snapshot
}

export function subscribeToMaintenance(listener: (value: ActiveMaintenance | null) => void): () => void {
  listeners.add(listener)
  listener(snapshot)
  return () => {
    listeners.delete(listener)
  }
}

export function setMaintenanceActive(detail: { message?: string; estimatedEnd?: string } | null): void {
  const next: ActiveMaintenance | null = detail
    ? {
        message: detail.message?.trim() || DEFAULT_MAINTENANCE_MESSAGE,
        ...(detail.estimatedEnd ? { estimatedEnd: detail.estimatedEnd } : {}),
      }
    : null
  if (next?.message === snapshot?.message && next?.estimatedEnd === snapshot?.estimatedEnd) return
  snapshot = next
  for (const listener of listeners) listener(snapshot)
}

export function clearMaintenance(): void {
  setMaintenanceActive(null)
}

/** True for the canonical `503 { code: 'system_maintenance' }` response. */
export function isMaintenanceError(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false
  const candidate = error as { status?: unknown; code?: unknown }
  return candidate.status === 503 && candidate.code === 'system_maintenance'
}

/** Extracts the announcement fields from an API error (never throws). */
export function maintenanceDetailFromError(error: unknown): { message?: string; estimatedEnd?: string } {
  const candidate = (error ?? {}) as { message?: unknown; estimatedEnd?: unknown }
  return {
    ...(typeof candidate.message === 'string' ? { message: candidate.message } : {}),
    ...(typeof candidate.estimatedEnd === 'string' ? { estimatedEnd: candidate.estimatedEnd } : {}),
  }
}

export interface MaintenanceCountdown {
  tone: 'none' | 'pending' | 'overdue'
  label: string
}

/** Formats the announced estimate (mirrors the web helper; estimate-only). */
export function formatMaintenanceRemaining(estimatedEnd: string | undefined, nowMs: number): MaintenanceCountdown {
  if (!estimatedEnd) return { tone: 'none', label: '' }
  const targetMs = Date.parse(estimatedEnd)
  if (!Number.isFinite(targetMs)) return { tone: 'none', label: '' }
  const remainingMs = targetMs - nowMs
  if (remainingMs <= 0) {
    return { tone: 'overdue', label: 'Resumption is overdue — contact the IT desk' }
  }
  const totalMinutes = Math.ceil(remainingMs / 60_000)
  if (totalMinutes < 60) {
    return { tone: 'pending', label: `Estimated resumption in ${totalMinutes} min` }
  }
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return {
    tone: 'pending',
    label: `Estimated resumption in ${hours} h${minutes > 0 ? ` ${minutes} min` : ''}`,
  }
}
