import { redirect } from 'next/navigation'
import { PRIVACY_POLICY_URL } from '@/lib/legal'

/** Old links to the in-app notice land on the single, current Privacy Policy. */
export default function PrivacyPage(): never {
  redirect(PRIVACY_POLICY_URL)
}
