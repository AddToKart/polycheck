import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { SuperAdmin } from '@polycheck/shared'
import { TAB_SETTING_KEYS } from './settings-config'

const apiMock = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
  getSettings: vi.fn(),
  setSetting: vi.fn(),
  getAiCapabilities: vi.fn(),
  logout: vi.fn(),
}))

const navMock = vi.hoisted(() => ({
  replace: vi.fn(),
  push: vi.fn(),
  tab: null as string | null,
}))

vi.mock('@/lib/api-client', () => ({ api: apiMock }))
vi.mock('next/navigation', () => {
  const router = { replace: navMock.replace, push: navMock.push }
  return {
    useRouter: () => router,
    useSearchParams: () => new URLSearchParams(navMock.tab ? `tab=${navMock.tab}` : ''),
  }
})
vi.mock('@/components/layout/sidebar', () => ({ Sidebar: () => <aside data-testid="sidebar" /> }))

import InstitutionSettingsPage from './page'

const admin: SuperAdmin = {
  id: 'admin-1',
  fullName: 'Dr. Test Admin',
  email: 'admin@pup.edu.ph',
  role: 'super_admin',
  scope: 'institution',
  isActive: true,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

const departmentAdmin: SuperAdmin = {
  ...admin,
  id: 'admin-2',
  scope: 'department',
}

const SETTING_VALUES: Record<string, string> = {
  institution_name: 'PUP Santa Maria Campus',
  default_geofence_radius_meters: '40',
  default_qr_validity_minutes: '5',
  default_grace_period_minutes: '15',
  enrollment_code_expiry_days: '14',
  attendance_min_rate_percent: '75',
  allow_teacher_student_provisioning: 'false',
  ai_assistant_enabled: 'true',
  ai_assistant_teacher_enabled: 'true',
  ai_assistant_student_enabled: 'true',
  ai_base_url: 'https://opencode.ai/inference/go/openai/v1',
  ai_model: 'deepseek-v4.1-flash',
}

function settingsRows(overrides: Record<string, string> = {}) {
  return Object.entries({ ...SETTING_VALUES, ...overrides }).map(([key, value]) => ({
    key,
    value,
    updatedAt: '2026-10-27T00:00:00.000Z',
  }))
}

async function renderLoaded() {
  render(<InstitutionSettingsPage />)
  await waitFor(() =>
    expect(screen.getByLabelText('Institution name')).toHaveValue('PUP Santa Maria Campus'),
  )
}

describe('Institution Settings tabs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    navMock.tab = null
    apiMock.getCurrentUser.mockReturnValue(admin)
    apiMock.getSettings.mockResolvedValue(settingsRows())
    apiMock.getAiCapabilities.mockResolvedValue({
      enabled: true,
      policyBlocked: false,
      model: 'deepseek-v4.1-flash',
      maxMessageChars: 2_000,
    })
    apiMock.setSetting.mockImplementation(
      async (key: string, value: string) => ({
        key,
        value,
        updatedAt: '2026-10-27T00:00:00.000Z',
      }),
    )
  })

  afterEach(cleanup)

  it('renders the four categories with Institution selected by default', async () => {
    await renderLoaded()

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Institution',
      'Sessions & attendance',
      'Accounts & access',
      'AI Assistant',
    ])
    expect(screen.getByRole('tab', { name: 'Institution' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(
      screen.queryByLabelText('Default geofence radius (meters)'),
    ).not.toBeInTheDocument()
    expect(
      screen.queryByRole('switch', { name: 'AI assistant enabled' }),
    ).not.toBeInTheDocument()
  })

  it('falls back to Institution for an invalid tab deep link', async () => {
    navMock.tab = 'not-a-tab'

    await renderLoaded()

    expect(screen.getByRole('tab', { name: 'Institution' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
    expect(navMock.replace).not.toHaveBeenCalled()
  })

  it('opens a deep-linked tab and updates the URL when switching', async () => {
    navMock.tab = 'sessions'

    render(<InstitutionSettingsPage />)

    expect(await screen.findByLabelText('Default geofence radius (meters)')).toHaveValue(40)
    expect(screen.getByRole('tab', { name: 'Sessions & attendance' })).toHaveAttribute(
      'aria-selected',
      'true',
    )

    fireEvent.click(screen.getByRole('tab', { name: 'Institution' }))

    expect(navMock.replace).toHaveBeenCalledWith('/faculty/settings?tab=institution', {
      scroll: false,
    })
    expect(await screen.findByLabelText('Institution name')).toBeInTheDocument()
  })

  it('moves selection with the arrow keys', async () => {
    await renderLoaded()

    fireEvent.keyDown(screen.getByRole('tablist'), { key: 'ArrowRight' })

    expect(navMock.replace).toHaveBeenCalledWith('/faculty/settings?tab=sessions', {
      scroll: false,
    })
    expect(screen.getByRole('tab', { name: 'Sessions & attendance' })).toHaveAttribute(
      'aria-selected',
      'true',
    )
  })

  it('marks only the edited tab as unsaved and clears the dot after saving', async () => {
    await renderLoaded()

    fireEvent.change(screen.getByLabelText('Institution name'), {
      target: { value: 'Polycheck University' },
    })

    expect(
      screen.getByRole('tab', { name: /Institution.*Unsaved changes/ }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole('tab', { name: /Sessions & attendance.*Unsaved changes/ }),
    ).not.toBeInTheDocument()
    expect(screen.getByText('Save changes')).toBeEnabled()

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect(await screen.findByText('Institution settings saved.')).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Institution' })).toBeInTheDocument()
  })

  it("saves only the active tab's keys", async () => {
    navMock.tab = 'sessions'

    render(<InstitutionSettingsPage />)

    fireEvent.change(await screen.findByLabelText('Default geofence radius (meters)'), {
      target: { value: '55' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(apiMock.setSetting).toHaveBeenCalledTimes(TAB_SETTING_KEYS.sessions.length),
    )

    const savedKeys = apiMock.setSetting.mock.calls.map(([key]) => key as string)
    expect(new Set(savedKeys)).toEqual(new Set(TAB_SETTING_KEYS.sessions))
    expect(apiMock.setSetting).toHaveBeenCalledWith('default_geofence_radius_meters', '55')
    expect(apiMock.setSetting).not.toHaveBeenCalledWith(
      'institution_name',
      expect.anything(),
    )
    expect(apiMock.setSetting).not.toHaveBeenCalledWith('ai_model', expect.anything())
    expect(apiMock.getAiCapabilities).toHaveBeenCalledTimes(1)

    expect(await screen.findByText('Session and attendance defaults saved.')).toBeInTheDocument()
  })

  it('round-trips the accounts provisioning switch through its own save', async () => {
    navMock.tab = 'accounts'

    render(<InstitutionSettingsPage />)

    const provisioning = await screen.findByRole('switch', {
      name: 'Allow teacher student provisioning',
    })
    expect(provisioning).toHaveAttribute('aria-checked', 'false')

    fireEvent.click(provisioning)
    expect(provisioning).toHaveAttribute('aria-checked', 'true')

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(apiMock.setSetting).toHaveBeenCalledWith(
        'allow_teacher_student_provisioning',
        'true',
      ),
    )
    expect(apiMock.setSetting).toHaveBeenCalledTimes(1)
    expect(await screen.findByText('Account access settings saved.')).toBeInTheDocument()
  })

  it('dims role switches when the AI master switch is off and saves the whole AI tab', async () => {
    navMock.tab = 'ai'

    render(<InstitutionSettingsPage />)

    const master = await screen.findByRole('switch', { name: 'AI assistant enabled' })
    const teachers = screen.getByRole('switch', { name: 'Available to teachers' })
    const students = screen.getByRole('switch', { name: 'Available to students' })
    expect(master).toHaveAttribute('aria-checked', 'true')
    expect(teachers).toBeEnabled()
    expect(students).toBeEnabled()

    fireEvent.click(master)

    expect(master).toHaveAttribute('aria-checked', 'false')
    expect(teachers).toBeDisabled()
    expect(students).toBeDisabled()
    expect(
      screen.getByText('Unsaved availability changes — save to apply.'),
    ).toBeInTheDocument()

    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() =>
      expect(apiMock.setSetting).toHaveBeenCalledTimes(TAB_SETTING_KEYS.ai.length),
    )

    const savedKeys = apiMock.setSetting.mock.calls.map(([key]) => key as string)
    expect(new Set(savedKeys)).toEqual(new Set(TAB_SETTING_KEYS.ai))
    expect(apiMock.setSetting).toHaveBeenCalledWith('ai_assistant_enabled', 'false')
    expect(apiMock.setSetting).toHaveBeenCalledWith('ai_assistant_teacher_enabled', 'true')
    expect(apiMock.setSetting).toHaveBeenCalledWith('ai_assistant_student_enabled', 'true')
    expect(apiMock.setSetting).not.toHaveBeenCalledWith('ai_api_key', expect.anything())

    await waitFor(() => expect(apiMock.getAiCapabilities).toHaveBeenCalledTimes(2))
    expect(await screen.findByText('Disabled for everyone.')).toBeInTheDocument()
  })

  it('keeps department administrators read-only across tabs', async () => {
    apiMock.getCurrentUser.mockReturnValue(departmentAdmin)
    navMock.tab = 'accounts'

    render(<InstitutionSettingsPage />)

    expect(
      await screen.findByText(/Department administrators can view these institution-wide defaults/),
    ).toBeInTheDocument()

    const provisioning = await screen.findByRole('switch', {
      name: 'Allow teacher student provisioning',
    })
    expect(provisioning).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Save changes' })).toBeDisabled()

    fireEvent.click(screen.getByRole('tab', { name: 'Institution' }))
    expect(await screen.findByLabelText('Institution name')).toBeDisabled()
  })
})
