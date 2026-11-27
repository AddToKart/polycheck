import type { Metadata } from 'next'

// The reset link carries a single-use token in the URL fragment. Never leak the page address through the
// Referer header, and keep it out of search indexes.
export const metadata: Metadata = {
  title: 'Reset your password · PolyCheck',
  referrer: 'no-referrer',
  robots: { index: false, follow: false },
}

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children
}
