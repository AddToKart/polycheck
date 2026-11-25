export interface ActivationEmailInput {
  fullName: string
  link: string
  expiresAt: Date
}

const escapeHtml = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

/** "Dela Cruz, Juan Miguel" → "Juan"; "Juan Miguel Dela Cruz" → "Juan". */
export function firstNameOf(fullName: string): string {
  const trimmed = fullName.trim()
  if (!trimmed) return 'there'
  const afterComma = trimmed.includes(',') ? trimmed.split(',')[1]?.trim() : trimmed
  return (afterComma?.split(/\s+/)[0] || 'there').slice(0, 40)
}

/**
 * Deliberately minimal: no student number, grades, attendance or password —
 * only a greeting, the single-use link, its expiry and an ignore-if-unexpected
 * line.
 */
export function buildActivationEmail({ fullName, link, expiresAt }: ActivationEmailInput) {
  const name = firstNameOf(fullName)
  const expires = expiresAt.toLocaleDateString('en-PH', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
  const subject = 'Activate your Polycheck account'
  const text = [
    `Hi ${name},`,
    '',
    'An account was prepared for you on Polycheck, the PUP Santa Maria attendance system.',
    'Open this link to choose your password and activate it:',
    '',
    link,
    '',
    `The link works once and expires on ${expires}. You will be asked for your student number.`,
    'If it expires, open the link again and request a new one.',
    '',
    'If you did not expect this email, you can ignore it.',
  ].join('\n')
  const html = `<!doctype html><html><body style="margin:0;padding:24px;background:#f6f6f6;font-family:Arial,Helvetica,sans-serif;color:#1a1a1a">
<table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-top:4px solid #7B1113"><tr><td style="padding:24px">
<h1 style="margin:0 0 16px;font-size:20px;color:#7B1113">Activate your Polycheck account</h1>
<p style="margin:0 0 12px;font-size:15px;line-height:1.5">Hi ${escapeHtml(name)},</p>
<p style="margin:0 0 20px;font-size:15px;line-height:1.5">An account was prepared for you on Polycheck, the PUP Santa Maria attendance system. Choose your password to activate it.</p>
<p style="margin:0 0 20px"><a href="${escapeHtml(link)}" style="display:inline-block;background:#7B1113;color:#ffffff;text-decoration:none;padding:12px 20px;font-size:15px;font-weight:bold">Activate account</a></p>
<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#555">The link works once and expires on ${escapeHtml(expires)}. You will be asked for your student number. If it expires, open it and request a new one.</p>
<p style="margin:0 0 8px;font-size:13px;line-height:1.5;color:#555">Button not working? Copy this address into your browser:<br><span style="word-break:break-all">${escapeHtml(link)}</span></p>
<p style="margin:16px 0 0;font-size:12px;color:#777">If you did not expect this email, you can ignore it.</p>
</td></tr></table></body></html>`
  return { subject, text, html }
}
