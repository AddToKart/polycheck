import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { api } from '@/lib/api-client'
import { BRANDING_CHANGED_EVENT, BrandLogo, BrandingProvider, useBranding } from './BrandingProvider'

vi.mock('@/lib/api-client', () => ({ api: { getBranding: vi.fn() } }))

function Probe() {
  const branding = useBranding()
  return (
    <div>
      <span data-testid="name">{branding.name}</span>
      <span data-testid="short">{branding.shortName}</span>
      <BrandLogo size={32} />
    </div>
  )
}

const PNG = 'data:image/png;base64,iVBORw0KGgo='

afterEach(() => {
  cleanup()
  window.localStorage.clear()
  vi.mocked(api.getBranding).mockReset()
})

describe('BrandingProvider', () => {
  it('shows the neutral defaults and the Polycheck mark before anything is configured', async () => {
    vi.mocked(api.getBranding).mockResolvedValue(null)
    render(
      <BrandingProvider>
        <Probe />
      </BrandingProvider>,
    )
    expect(screen.getByTestId('name')).toHaveTextContent('Your Institution')
    expect(screen.getByAltText('Your Institution logo').getAttribute('src')).toContain('brand-mark')
  })

  it('uses the server-rendered value immediately, then applies the fresh one', async () => {
    vi.mocked(api.getBranding).mockResolvedValue({ name: 'Newer University', shortName: 'NU', campus: '', logoDataUrl: null })
    render(
      <BrandingProvider initial={{ name: 'First University', shortName: 'FU', campus: '', logoDataUrl: null }}>
        <Probe />
      </BrandingProvider>,
    )
    expect(screen.getByTestId('name')).toHaveTextContent('First University')
    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('Newer University'))
    expect(screen.getByTestId('short')).toHaveTextContent('NU')
  })

  it('renders an uploaded logo and caches branding for the next offline start', async () => {
    vi.mocked(api.getBranding).mockResolvedValue({ name: 'A University', shortName: 'AU', campus: 'Main', logoDataUrl: PNG })
    render(
      <BrandingProvider>
        <Probe />
      </BrandingProvider>,
    )
    await waitFor(() => expect(screen.getByAltText('A University logo').getAttribute('src')).toBe(PNG))
    expect(JSON.parse(window.localStorage.getItem('polycheck-branding') ?? '{}')).toMatchObject({ name: 'A University' })
  })

  it('falls back to the cached copy when the API is unreachable', async () => {
    window.localStorage.setItem(
      'polycheck-branding',
      JSON.stringify({ name: 'Cached University', shortName: 'CU', campus: '', logoDataUrl: null }),
    )
    vi.mocked(api.getBranding).mockResolvedValue(null)
    render(
      <BrandingProvider>
        <Probe />
      </BrandingProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('Cached University'))
  })

  it('refreshes when a settings change is announced', async () => {
    vi.mocked(api.getBranding).mockResolvedValueOnce({ name: 'Old Name', shortName: 'ON', campus: '', logoDataUrl: null })
    render(
      <BrandingProvider>
        <Probe />
      </BrandingProvider>,
    )
    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('Old Name'))
    vi.mocked(api.getBranding).mockResolvedValueOnce({ name: 'New Name', shortName: 'NN', campus: '', logoDataUrl: null })
    await act(async () => {
      window.dispatchEvent(new Event(BRANDING_CHANGED_EVENT))
    })
    await waitFor(() => expect(screen.getByTestId('name')).toHaveTextContent('New Name'))
  })
})
