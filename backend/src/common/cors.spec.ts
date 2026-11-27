import { corsOptionsFor, splitOrigins } from './cors'

const app = ['https://app.polycheck.live']
const landing = ['https://polycheck.live', 'https://www.polycheck.live']

describe('corsOptionsFor', () => {
  it.each(['/api/registrations/public', '/api/registrations/public/status', '/api/registrations/public/status?x=1'])(
    'lets the landing page call %s without cookies',
    (url) => {
      const options = corsOptionsFor(url, app, landing)
      expect(options.origin).toEqual([...landing, ...app])
      expect(options.credentials).toBe(false)
    },
  )

  it.each([
    '/api/auth/login/faculty',
    '/api/registrations',
    '/api/registrations/approve',
    '/api/registrations/publicity',
    '/api/registrations/public/../approve',
    '/api/users/students?next=/api/registrations/public',
  ])('keeps the landing page away from %s', (url) => {
    const options = corsOptionsFor(url, app, landing)
    expect(options.origin).toEqual(app)
    expect(options.credentials).toBe(true)
  })

  it('reads a comma separated list', () => {
    expect(splitOrigins(' https://a.example , ,https://b.example')).toEqual(['https://a.example', 'https://b.example'])
    expect(splitOrigins(undefined)).toEqual([])
  })
})
