'use client'

import { useEffect, useState } from 'react'
import { UserPlus } from 'lucide-react'
import { API_BASE } from '@/lib/api-config'
import { SIGN_UP_URL } from '@/lib/legal'
import { Button } from '@/components/ui/button'

/**
 * Sends people without an account to the sign-up form on the landing page.
 * Shown only while the institution has sign-up open.
 */
export function SignUpButton() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    let active = true
    // Without cookies: the server's public sign-up routes do not accept them.
    fetch(`${API_BASE}/registrations/public/status`, { credentials: 'omit', cache: 'no-store' })
      .then((response) => (response.ok ? response.json() : null))
      .then((status: { open?: boolean } | null) => {
        if (active) setOpen(status?.open === true)
      })
      .catch(() => undefined)
    return () => {
      active = false
    }
  }, [])

  if (!open) return null

  return (
    <div className="mt-6 text-center">
      <p className="mb-2 text-sm text-zinc-500 dark:text-zinc-400">No account yet?</p>
      <Button
        asChild
        variant="outline"
        className="h-12 w-full rounded-none border-maroon text-base font-bold uppercase tracking-wide text-maroon dark:border-golden dark:text-golden"
      >
        <a href={SIGN_UP_URL}>
          <UserPlus className="w-4 h-4" /> Sign up
        </a>
      </Button>
    </div>
  )
}
