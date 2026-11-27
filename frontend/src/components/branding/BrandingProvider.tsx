'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import Image from 'next/image'
import { DEFAULT_BRANDING, resolveBranding, type InstitutionBranding } from '@polycheck/shared'
import { api } from '@/lib/api-client'

const CACHE_KEY = 'polycheck-branding'
/** Dispatched by the settings page after a branding change so every open surface refreshes. */
export const BRANDING_CHANGED_EVENT = 'polycheck-branding-changed'
export const DEFAULT_BRAND_MARK = '/brand-mark.png'

const BrandingContext = createContext<InstitutionBranding>(DEFAULT_BRANDING)

function readCache(): InstitutionBranding | null {
  try {
    const raw = window.localStorage.getItem(CACHE_KEY)
    return raw ? resolveBranding(JSON.parse(raw) as Partial<InstitutionBranding>) : null
  } catch {
    return null
  }
}

function writeCache(branding: InstitutionBranding) {
  try {
    window.localStorage.setItem(CACHE_KEY, JSON.stringify(branding))
  } catch {
    // Storage can be unavailable (private windows); branding simply refetches next time.
  }
}

/**
 * Institution identity for the whole app. `initial` is fetched on the server so the first paint already shows the
 * right name and logo; afterwards the provider keeps a local copy (offline start) and refreshes it from the public
 * `/branding` endpoint. A failed refresh keeps whatever was last known.
 */
export function BrandingProvider({ initial, children }: { initial?: InstitutionBranding | null; children: ReactNode }) {
  const [branding, setBranding] = useState<InstitutionBranding>(() => resolveBranding(initial))

  const refresh = useCallback(async () => {
    const fresh = await api.getBranding()
    if (fresh) {
      const resolved = resolveBranding(fresh)
      setBranding(resolved)
      writeCache(resolved)
    }
  }, [])

  useEffect(() => {
    // With no server-side value (API unreachable from the web server), fall back to the cached copy first.
    if (!initial) {
      const cached = readCache()
      if (cached) setBranding(cached)
    }
    void refresh()
    const onChanged = () => void refresh()
    window.addEventListener(BRANDING_CHANGED_EVENT, onChanged)
    return () => window.removeEventListener(BRANDING_CHANGED_EVENT, onChanged)
  }, [initial, refresh])

  return <BrandingContext.Provider value={branding}>{children}</BrandingContext.Provider>
}

export function useBranding(): InstitutionBranding {
  return useContext(BrandingContext)
}

/** The institution's uploaded logo, or the neutral PolyCheck mark when none is set. */
export function BrandLogo({ size, className, alt }: { size: number; className?: string; alt?: string }) {
  const { logoDataUrl, name } = useBranding()
  const label = useMemo(() => alt ?? `${name} logo`, [alt, name])
  return (
    <Image
      src={logoDataUrl ?? DEFAULT_BRAND_MARK}
      width={size}
      height={size}
      alt={label}
      unoptimized={Boolean(logoDataUrl)}
      className={className}
    />
  )
}
