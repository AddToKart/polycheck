import { PRIVACY_POLICY_URL, TERMS_URL } from '@/lib/legal'

const LINK_CLASS = 'font-semibold underline underline-offset-2 hover:text-maroon dark:hover:text-golden'

/** Privacy Policy and Terms links for the signed-out screens. They open in a new tab. */
export function LegalLinks({ className = '' }: { className?: string }) {
  return (
    <p className={`text-center text-xs text-zinc-500 dark:text-zinc-400 ${className}`}>
      <a href={PRIVACY_POLICY_URL} target="_blank" rel="noreferrer" className={LINK_CLASS}>
        Privacy Policy
      </a>
      <span aria-hidden="true"> · </span>
      <a href={TERMS_URL} target="_blank" rel="noreferrer" className={LINK_CLASS}>
        Terms &amp; Conditions
      </a>
    </p>
  )
}
