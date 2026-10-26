import type { MetadataRoute } from 'next'

export const dynamic = 'force-static'

/**
 * PWA manifest (M1). Served at /manifest.webmanifest.
 * Icons live in /public/icons and are precached by the service worker.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Polycheck',
    short_name: 'Polycheck',
    description: 'PUP Attendance Management System',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0A0A0A',
    theme_color: '#7B1113',
    categories: ['education', 'productivity'],
    icons: [
      {
        src: '/icons/icon-192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/icons/icon-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
