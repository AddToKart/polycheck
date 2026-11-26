/**
 * Whether outbound mail can actually be delivered with the given environment: `resend` needs both a key and a
 * sender, `log` always works (development), anything else is disabled. Mirrors the driver choice in
 * `MailService`, but without needing the service, so modules the mail module itself depends on can ask.
 */
export function isMailDeliverable(read: (key: string) => string | undefined): boolean {
  const requested = (read('MAIL_DRIVER') ?? 'disabled').trim().toLowerCase()
  if (requested === 'log') return true
  if (requested === 'resend') return Boolean(read('RESEND_API_KEY')?.trim() && read('MAIL_FROM')?.trim())
  return false
}
