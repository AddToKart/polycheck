export interface AuthUser {
  id: string
  fullName: string
  email?: string | null
  studentId?: string | null
  role: string
  program?: string | null
  yearLevel?: number | null
  department?: string | null
  photoUrl?: string | null
}

export interface AuthResult {
  token: string
  user: AuthUser
}

export class AuthClient {
  private baseUrl: string
  private token: string | null = null
  private onTokenChange: ((token: string | null) => void) | null = null

  constructor(baseUrl: string = 'http://localhost:4000/api') {
    this.baseUrl = baseUrl
  }

  setToken(token: string | null) {
    this.token = token
    if (this.onTokenChange) this.onTokenChange(token)
  }

  getToken(): string | null {
    return this.token
  }

  onTokenChanged(cb: (token: string | null) => void) {
    this.onTokenChange = cb
  }

  async loginStudent(studentId: string, password: string): Promise<AuthResult> {
    const res = await fetch(`${this.baseUrl}/auth/login/student`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ studentId, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Login failed' }))
      throw new Error(err.message || 'Login failed')
    }
    const data = await res.json()
    this.setToken(data.token)
    return data as AuthResult
  }

  async loginFaculty(email: string, password: string): Promise<AuthResult> {
    const res = await fetch(`${this.baseUrl}/auth/login/faculty`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ message: 'Login failed' }))
      throw new Error(err.message || 'Login failed')
    }
    const data = await res.json()
    this.setToken(data.token)
    return data as AuthResult
  }

  async getProfile(token: string): Promise<AuthUser> {
    const res = await fetch(`${this.baseUrl}/auth/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    if (!res.ok) throw new Error('Failed to get profile')
    return res.json()
  }

  async provisionKey(publicKey: string, token: string): Promise<void> {
    const res = await fetch(`${this.baseUrl}/auth/provision-key`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ publicKey }),
    })
    if (!res.ok) throw new Error('Failed to provision key')
  }
}
