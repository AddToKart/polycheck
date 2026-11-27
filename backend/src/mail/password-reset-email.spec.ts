import { buildPasswordResetEmail } from './password-reset-email'

const LINK = 'https://app.polycheck.live/reset-password#token=abc123'

describe('buildPasswordResetEmail', () => {
  it('greets by first name, carries the link in both parts and states the lifetime', () => {
    const email = buildPasswordResetEmail({ fullName: 'Dela Cruz, Maria Elena', link: LINK, validMinutes: 60 })
    expect(email.subject).toBe('Reset your PolyCheck password')
    expect(email.text).toContain('Hi Maria,')
    expect(email.text).toContain(LINK)
    expect(email.text).toContain('expires in 1 hour')
    expect(email.html).toContain(`href="${LINK}"`)
  })

  it('formats lifetimes that are not whole hours in minutes, and plural hours', () => {
    expect(buildPasswordResetEmail({ fullName: 'A B', link: LINK, validMinutes: 45 }).text).toContain(
      'expires in 45 minutes',
    )
    expect(buildPasswordResetEmail({ fullName: 'A B', link: LINK, validMinutes: 120 }).text).toContain(
      'expires in 2 hours',
    )
  })

  it('names the institution when known and tells an unexpected recipient to ignore it', () => {
    const email = buildPasswordResetEmail({
      fullName: 'Maria Cruz',
      link: LINK,
      validMinutes: 60,
      institutionName: 'Example Polytechnic',
    })
    expect(email.text).toContain('the Example Polytechnic attendance system')
    expect(email.text).toContain('If you did not ask for this, you can ignore this email')
  })

  it('never includes a password or student number, and escapes the name in the HTML', () => {
    const email = buildPasswordResetEmail({ fullName: '<script>x</script> Maria', link: LINK, validMinutes: 60 })
    expect(email.html).not.toContain('<script>')
    expect(email.text.toLowerCase()).not.toContain('student number')
  })
})
