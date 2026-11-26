import { redirect } from 'next/navigation'
import { TERMS_URL } from '@/lib/legal'

export default function TermsPage(): never {
  redirect(TERMS_URL)
}
