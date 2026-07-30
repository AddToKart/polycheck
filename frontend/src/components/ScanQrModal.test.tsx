// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted env setup (runs before module imports) ──────────────────────────
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_ALLOW_QR_FALLBACKS = 'true'
})

// ── Module mocks (vi.mock is hoisted) ──────────────────────────────────────
vi.mock('@/lib/api-client', () => ({
  api: { submitScan: vi.fn() },
}))

vi.mock('@polycheck/shared/utils', () => ({
  decodeTokenPayload: vi.fn(),
}))

vi.mock('@zxing/browser', () => ({
  BrowserQRCodeReader: class BrowserQRCodeReader {
    decodeFromVideoElement = vi.fn().mockResolvedValue({ stop: vi.fn() })
    decodeFromImageUrl = vi.fn()
  },
}))

vi.mock('@radix-ui/react-slot', () => ({
  Slot: (props: any) => <div data-testid="slot">{props.children}</div>,
}))

vi.mock('@/components/ui/button', () => ({
  Button: (props: any) => <button {...props}>{props.children}</button>,
}))

vi.mock('@/components/ui/input', () => ({
  Input: (props: any) => <input {...props} />,
}))

// Mock lucide-react icons as plain divs
vi.mock('lucide-react', () => {
  const icons: Record<string, any> = {}
  const iconNames = [
    'X', 'QrCode', 'MapPin', 'Keyboard', 'CheckCircle', 'XCircle',
    'Clock', 'AlertTriangle', 'Loader2', 'RefreshCw', 'Upload', 'Camera',
    'SwitchCamera', 'Clipboard',
  ]
  for (const name of iconNames) {
    icons[name] = (props: any) => <div data-testid={`icon-${name}`} {...props} />
    icons[name].displayName = name
  }
  return icons
})

// ── Import AFTER mocks ──────────────────────────────────────────────────────
import ScanQrModal from './ScanQrModal'
import { api } from '@/lib/api-client'
import { decodeTokenPayload } from '@polycheck/shared/utils'
import type { Student } from '@polycheck/shared'
import { render, screen, fireEvent, waitFor, act, cleanup } from '@testing-library/react'

const mockUser: Student = {
  id: 'stu-1',
  studentId: '2026-00001-MN-0',
  fullName: 'Test Student',
  role: 'student',
  program: 'BSIT',
  yearLevel: 2,
  isActive: true,
  enrolledSectionIds: [],
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
}

function stubGetMedia() {
  const fakeTrack = { stop: vi.fn(), kind: 'video' }
  const fakeStream = { getTracks: () => [fakeTrack] }
  Object.defineProperty(navigator, 'mediaDevices', {
    value: { getUserMedia: vi.fn().mockResolvedValue(fakeStream) },
    configurable: true,
  })
}

function stubGeolocation(lat = 14.5863, lon = 120.9842) {
  Object.defineProperty(navigator, 'geolocation', {
    value: {
      getCurrentPosition: vi.fn((success: PositionCallback) => {
        success({
          coords: { latitude: lat, longitude: lon, accuracy: 10 },
          timestamp: Date.now(),
        } as GeolocationPosition)
      }),
    },
    configurable: true,
  })
}

function switchToManualMode() {
  // Click the "Enter Code" tab to switch to manual mode
  const manualTab = screen.getByText('Enter Code')
  fireEvent.click(manualTab)
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  stubGetMedia()
  stubGeolocation()
  // jsdom doesn't implement HTMLMediaElement.prototype.play — startCamera
  // calls it during the camera-mode useEffect and the rejection escapes
  // React's event system, causing Vitest to fail the entire test suite.
  HTMLVideoElement.prototype.play = vi.fn().mockResolvedValue(undefined)
  // jsdom doesn't define GeolocationPositionError. The component's catch block
  // references it directly (`err instanceof GeolocationPositionError`), which
  // throws a ReferenceError. Provide a minimal shim so the instanceof check
  // evaluates without crashing.
  if (typeof (globalThis as any).GeolocationPositionError === 'undefined') {
    ;(globalThis as any).GeolocationPositionError = class GeolocationPositionError extends Error {
      static PERMISSION_DENIED = 1
      static POSITION_UNAVAILABLE = 2
      static TIMEOUT = 3
      code: number
      constructor(message: string, code: number) {
        super(message)
        this.code = code
      }
    }
  }
  ;(api.submitScan as any).mockResolvedValue({ id: 'att-1', status: 'present' })
  ;(decodeTokenPayload as any).mockReturnValue({
    sessionId: 'sess-1',
    sectionId: 'sec-1',
    teacherId: 'teacher-1',
    issuedAt: Date.now() - 5000,
    validityMinutes: 10,
    gracePeriodMinutes: 5,
  })
})

describe('ScanQrModal', () => {
  it('stops a camera stream that resolves after the modal unmounts', async () => {
    const track = { stop: vi.fn(), kind: 'video' }
    const stream = { getTracks: () => [track] }
    let resolveStream!: (value: MediaStream) => void
    const pendingStream = new Promise<MediaStream>((resolve) => {
      resolveStream = resolve
    })
    Object.defineProperty(navigator, 'mediaDevices', {
      value: { getUserMedia: vi.fn().mockReturnValue(pendingStream) },
      configurable: true,
    })

    let rendered!: ReturnType<typeof render>
    await act(async () => {
      rendered = render(<ScanQrModal user={mockUser} onClose={vi.fn()} />)
    })
    rendered.unmount()
    await act(async () => {
      resolveStream(stream as unknown as MediaStream)
      await pendingStream
    })

    expect(track.stop).toHaveBeenCalledTimes(1)
  })

  it('renders the modal dialog', async () => {
    await act(async () => {
      render(<ScanQrModal user={mockUser} onClose={vi.fn()} />)
    })
    expect(screen.getByRole('dialog')).toBeTruthy()
    expect(screen.getByLabelText('Scan attendance QR code')).toBeTruthy()
  })

  it('calls onClose when close button clicked', async () => {
    const onClose = vi.fn()
    await act(async () => {
      render(<ScanQrModal user={mockUser} onClose={onClose} />)
    })
    const closeBtn = screen.getByRole('button', { name: /close scanner/i })
    await act(async () => { fireEvent.click(closeBtn) })
    expect(onClose).toHaveBeenCalled()
  })

  it('shows tabs for camera, upload, and manual mode', async () => {
    await act(async () => {
      render(<ScanQrModal user={mockUser} onClose={vi.fn()} />)
    })
    expect(screen.getByText('Camera')).toBeTruthy()
    expect(screen.getByText('Upload QR')).toBeTruthy()
    expect(screen.getByText('Enter Code')).toBeTruthy()
  })

  it('switches to manual mode and shows token input', async () => {
    await act(async () => {
      render(<ScanQrModal user={mockUser} onClose={vi.fn()} />)
    })
    switchToManualMode()
    const input = screen.getByPlaceholderText(/paste or type.*token/i)
    expect(input).toBeTruthy()
  })

  it('submits scan when manual token is entered', async () => {
    await act(async () => {
      render(<ScanQrModal user={mockUser} onClose={vi.fn()} />)
    })
    switchToManualMode()
    const input = screen.getByPlaceholderText(/paste or type.*token/i)
    await act(async () => {
      fireEvent.change(input, { target: { value: 'test-token-123' } })
    })
    const submitBtn = screen.getByRole('button', { name: /check in/i })
    await act(async () => { fireEvent.click(submitBtn) })

    await waitFor(() => {
      expect(decodeTokenPayload).toHaveBeenCalledWith('test-token-123')
    })
    await waitFor(() => {
      expect(api.submitScan).toHaveBeenCalledWith(
        'sess-1', 'stu-1', 'Test Student', 14.5863, 120.9842,
        'web-stu-1', 'test-token-123', expect.any(String),
        expect.objectContaining({
          clientAttemptId: expect.any(String),
          accuracyMeters: 10,
          inputChannel: 'manual',
        }),
      )
    })
  })

  it('shows error for invalid QR token', async () => {
    ;(decodeTokenPayload as any).mockReturnValue(null)
    await act(async () => {
      render(<ScanQrModal user={mockUser} onClose={vi.fn()} />)
    })
    switchToManualMode()
    const input = screen.getByPlaceholderText(/paste or type.*token/i)
    await act(async () => {
      fireEvent.change(input, { target: { value: 'bad-token' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /check in/i }))
    })
    await waitFor(() => {
      expect(screen.getByText(/invalid qr code/i)).toBeTruthy()
    })
  })

  it('shows error for wrong session QR', async () => {
    ;(decodeTokenPayload as any).mockReturnValue({
      sessionId: 'other-session', sectionId: 'sec-1', teacherId: 'teacher-1',
      issuedAt: Date.now() - 5000, validityMinutes: 10, gracePeriodMinutes: 5,
    })
    await act(async () => {
      render(<ScanQrModal user={mockUser} onClose={vi.fn()} sessionId="sess-1" />)
    })
    switchToManualMode()
    const input = screen.getByPlaceholderText(/paste or type.*token/i)
    await act(async () => {
      fireEvent.change(input, { target: { value: 'wrong-token' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /check in/i }))
    })
    await waitFor(() => {
      expect(screen.getByText(/different session/i)).toBeTruthy()
    })
  })

  it('shows server rejection error', async () => {
    ;(api.submitScan as any).mockResolvedValue({ error: 'Outside geofence' })
    await act(async () => {
      render(<ScanQrModal user={mockUser} onClose={vi.fn()} />)
    })
    switchToManualMode()
    const input = screen.getByPlaceholderText(/paste or type.*token/i)
    await act(async () => {
      fireEvent.change(input, { target: { value: 'valid-token' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /check in/i }))
    })
    await waitFor(() => {
      expect(screen.getByText(/outside geofence/i)).toBeTruthy()
    })
  })

  it('shows success for accepted scan', async () => {
    await act(async () => {
      render(<ScanQrModal user={mockUser} onClose={vi.fn()} />)
    })
    switchToManualMode()
    const input = screen.getByPlaceholderText(/paste or type.*token/i)
    await act(async () => {
      fireEvent.change(input, { target: { value: 'valid-token' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /check in/i }))
    })
    await waitFor(() => {
      expect(screen.getByText(/Verified/i)).toBeTruthy()
      // Use exact match for the outcome title to avoid matching hidden elements
      expect(screen.getByText('Verified — Present')).toBeTruthy()
    })
  })

  it('shows late status', async () => {
    ;(api.submitScan as any).mockResolvedValue({ id: 'att-2', status: 'late' })
    await act(async () => {
      render(<ScanQrModal user={mockUser} onClose={vi.fn()} />)
    })
    switchToManualMode()
    const input = screen.getByPlaceholderText(/paste or type.*token/i)
    await act(async () => {
      fireEvent.change(input, { target: { value: 'late-token' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /check in/i }))
    })
    await waitFor(() => {
      expect(screen.getByText('Recorded — Late')).toBeTruthy()
    })
  })

  it('shows error when geolocation fails', async () => {
    // jsdom does not implement GeolocationPositionError as a constructor, so
    // the component's `instanceof GeolocationPositionError` check always fails
    // and the generic error message is shown.
    // The mock must call the error callback asynchronously — a synchronous
    // reject inside the Promise constructor escapes React's batching and
    // leaves the component stuck in "acquiring-location" phase.
    Object.defineProperty(navigator, 'geolocation', {
      value: {
        getCurrentPosition: vi.fn((_s: any, err: PositionErrorCallback) => {
          setTimeout(() => {
            const error = new Error('User denied Geolocation') as any
            error.code = 1
            err(error)
          }, 0)
        }),
      },
      configurable: true,
    })
    await act(async () => {
      render(<ScanQrModal user={mockUser} onClose={vi.fn()} />)
    })
    switchToManualMode()
    const input = screen.getByPlaceholderText(/paste or type.*token/i)
    await act(async () => {
      fireEvent.change(input, { target: { value: 'valid-token' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /check in/i }))
    })
    // In jsdom, GeolocationPositionError is not a real class, so the component
    // falls through to the generic error message.
    await waitFor(() => {
      expect(screen.getByText(/unable to determine your location/i)).toBeTruthy()
    }, { timeout: 5000 })
    expect(api.submitScan).not.toHaveBeenCalled()
  })

  it('handles network error during submission', async () => {
    ;(api.submitScan as any).mockRejectedValue(new Error('Network failure'))
    await act(async () => {
      render(<ScanQrModal user={mockUser} onClose={vi.fn()} />)
    })
    switchToManualMode()
    const input = screen.getByPlaceholderText(/paste or type.*token/i)
    await act(async () => {
      fireEvent.change(input, { target: { value: 'valid-token' } })
    })
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /check in/i }))
    })
    await waitFor(() => {
      expect(screen.getByText(/network failure/i)).toBeTruthy()
    })
  })

  it('does not submit empty manual token', async () => {
    await act(async () => {
      render(<ScanQrModal user={mockUser} onClose={vi.fn()} />)
    })
    switchToManualMode()
    const submitBtn = screen.getByRole('button', { name: /check in/i })
    // Button should be disabled when empty
    expect(submitBtn).toBeDisabled()
    expect(api.submitScan).not.toHaveBeenCalled()
  })

  it('disables submit button when manual input is empty', async () => {
    await act(async () => {
      render(<ScanQrModal user={mockUser} onClose={vi.fn()} />)
    })
    switchToManualMode()
    const input = screen.getByPlaceholderText(/paste or type.*token/i)
    const submitBtn = screen.getByRole('button', { name: /check in/i })
    // Initially disabled
    expect(submitBtn).toBeDisabled()
    // Type something
    await act(async () => {
      fireEvent.change(input, { target: { value: 'a' } })
    })
    // Now enabled
    expect(submitBtn).not.toBeDisabled()
    // Clear it
    await act(async () => {
      fireEvent.change(input, { target: { value: '' } })
    })
    // Disabled again
    expect(submitBtn).toBeDisabled()
  })
})
