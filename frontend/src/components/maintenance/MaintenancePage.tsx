'use client'

import { MaintenanceScreen } from './MaintenanceScreen'

/** Page-level maintenance surface (login embeds and route fallbacks). */
export function MaintenancePage({
  message,
  estimatedEnd,
  embedded = false,
  showAdminLogin = true,
}: {
  message?: string
  estimatedEnd?: string
  embedded?: boolean
  showAdminLogin?: boolean
}) {
  return (
    <MaintenanceScreen
      variant={embedded ? 'embedded' : 'page'}
      message={message}
      estimatedEnd={estimatedEnd}
      showAdminLogin={showAdminLogin}
    />
  )
}
