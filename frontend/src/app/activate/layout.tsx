import type { Metadata } from 'next'

// The activation link carries a single-use token in the URL fragment. Never leak
// the page address through the Referer header, and keep it out of search indexes.
export const metadata: Metadata = {
  title: 'Activate your account · Polycheck',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
}

export default function ActivateLayout({ children }: { children: React.ReactNode }) {
  return children
}
