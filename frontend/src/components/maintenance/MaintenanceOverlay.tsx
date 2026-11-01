'use client'

import type { MaintenanceStatus } from '@polycheck/shared'
import { MaintenanceScreen } from './MaintenanceScreen'

/** Fixed overlay rendered above every authenticated surface while closed. */
export function MaintenanceOverlay({ status }: { status: MaintenanceStatus }) {
  return (
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label="Polycheck is under scheduled maintenance"
      className="fixed inset-0 z-[100] overflow-y-auto bg-maroon dark:bg-surface-dark"
    >
      <MaintenanceScreen
        variant="page"
        message={status.message}
        estimatedEnd={status.estimatedEnd}
        className="min-h-full"
      />
    </div>
  )
}
