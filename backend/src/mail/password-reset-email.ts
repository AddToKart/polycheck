import { firstNameOf } from './activation-email'

export interface PasswordResetEmailInput {
  fullName: string
  link: string
  /** How long the link works, in minutes (shown as written, not as a clock time). */
  validMinutes: number
  /** Shown so the recipient can recognise the sender; omitted when unknown. */
  institutionName?: string
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function validFor(minutes: number): string {
  if (minutes % 60 === 0) {
    const hours = minutes / 60
    return hours === 1 ? '1 hour' : `${hours} hours`
  }
  return `${minutes} minutes`
}

/**
 * Deliberately minimal: a greeting, the single-use link, how long it works and an ignore-if-unexpected line.
 * No student number, grades, attendance or password.
 */
export function buildPasswordResetEmail({ fullName, link, validMinutes, institutionName }: PasswordResetEmailInput) {
  const name = firstNameOf(fullName)
  const system = institutionName ? `the ${institutionName} attendance system` : "your institution's attendance system"
  const lifetime = validFor(validMinutes)
  const subject = 'Reset your Polycheck password'
  const text = [
    `Hi ${name},`,
    '',
    `We received a request to reset the password of your Polycheck account, ${system}.`,
    'Open this link to choose a new password:',
    '',
    link,
    '',
    `The link works once and expires in ${lifetime}. After resetting, sign in again on every device.`,
    '',
    'If you did not ask for this, you can ignore this email: your password stays the same.',
  ].join('\n')
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
<table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-top:4px solid #7B1113"><tr><td style="padding:24px">
<h1 style="margin:0 0 16px;font-size:20px;color:#7B1113">Reset your Polycheck password</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.5">Hi ${escapeHtml(name)},</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5">We received a request to reset the password of your Polycheck account, ${escapeHtml(system)}.</p>
<p style="margin:0 0 20px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#7B1113;color:#ffffff;text-decoration:none;padding:12px 20px;font-size:15px;font-weight:bold">Choose a new password</a></p>
<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#555">The link works once and expires in ${escapeHtml(lifetime)}. After resetting, sign in again on every device.</p>
<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#555">Button not working? Copy this address into your browser:<br><span style="word-break:break-all">${escapeHtml(link)}</span></p>
<p style="margin:16px 0 0;font-size:12px;color:#777">If you did not ask for this, you can ignore this email: your password stays the same.</p>
</td></tr></table></body></html>`
  return { subject, text, html }
}
