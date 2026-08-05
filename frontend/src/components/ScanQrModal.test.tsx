// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'

// ── Hoisted env setup (runs before module imports) ──────────────────────────
vi.hoisted(() => {
  process.env.NEXT_PUBLIC_ALLOW_QR_FALLBACKS = 'true'
})

// Shared state for the @zxing/browser mock — lets tests fire the video-decoder
// result callback (simulating a QR detected in the live camera feed) and
// control what decodeFromImageUrl resolves to for the upload path.
const zxingMock = vi.hoisted(() => ({
  state: {
    decodeCb: null as ((result: { getText: () => string }) => void) | null,
    imageToken: '',
  },
}))

// ── Module mocks (vi.mock is hoisted) ──────────────────────────────────────
vi.mock('@/lib/api-client', () => ({
  api: { submitScan: vi.fn() },
}))

vi.mock('@/lib/device-id', () => ({
  getOrCreateWebInstallationId: vi.fn(() => 'web-test-installation'),
}))

vi.mock('@polycheck/shared/utils', () => ({
  decodeTokenPayload: vi.fn(),
}))

vi.mock('@zxing/browser', () => ({
  BrowserQRCodeReader: class BrowserQRCodeReader {
    decodeFromVideoElement: (
      video: unknown,
      cb: (result: { getText: () => string }) => void,
    ) => Promise<{ stop: () => void }>
    decodeFromImageUrl: (url: string) => Promise<{ getText: () => string }>
    constructor() {
      // Capture the result callback instead of resolving it: the real decoder
      // is async, so tests can fire it later with a fake QR result.
      this.decodeFromVideoElement = vi.fn().mockImplementation(
        (_video: unknown, cb: (result: { getText: () => string }) => void) => {
          zxingMock.state.decodeCb = cb
          return Promise.resolve({ stop: vi.fn() })
        },
      )
      this.decodeFromImageUrl = vi.fn().mockImplementation(() =>
        Promise.resolve({ getText: () => zxingMock.state.imageToken }),
      )
    }
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
  zxingMock.state.decodeCb = null
  zxingMock.state.imageToken = ''
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
        'web-test-installation', 'test-token-123', expect.any(String),
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

  // ── Camera decode path (real zxing flow) ──────────────────────────────────

  it('submits a scan with inputChannel "camera" when the live camera decodes a QR', async () => {
    await act(async () => {
      render(<ScanQrModal user={mockUser} onClose={vi.fn()} />)
    })

    // Wait for the zxing reader to attach to the video element and capture
    // its result callback.
    await waitFor(() => {
      expect(zxingMock.state.decodeCb).not.toBeNull()
    })

    const token = 'camera-token-456'
    await act(async () => {
      zxingMock.state.decodeCb!({ getText: () => token })
    })

    await waitFor(() => {
      expect(api.submitScan).toHaveBeenCalledWith(
        'sess-1', 'stu-1', 'Test Student', 14.5863, 120.9842,
        'web-test-installation', token, expect.any(String),
        expect.objectContaining({
          clientAttemptId: expect.any(String),
          accuracyMeters: 10,
          inputChannel: 'camera',
        }),
      )
    })
    await waitFor(() => {
      expect(screen.getByText('Verified — Present')).toBeTruthy()
    })
  })

  it('rejects a camera QR that belongs to a different session', async () => {
    vi.mocked(decodeTokenPayload).mockReturnValue({
      version: 1,
      sessionId: 'other-session',
      sectionId: 'sec-1',
      issuedAt: Date.now() - 5000,
      validityMinutes: 10,
      gracePeriodMinutes: 5,
      teacherId: 'teacher-1',
      teacherName: 'Teacher One',
    })
    await act(async () => {
      render(<ScanQrModal user={mockUser} onClose={vi.fn()} sessionId="sess-1" />)
    })
    await waitFor(() => {
      expect(zxingMock.state.decodeCb).not.toBeNull()
    })
    await act(async () => {
      zxingMock.state.decodeCb!({ getText: () => 'wrong-session-token' })
    })
    await waitFor(() => {
      expect(screen.getByText(/different session/i)).toBeTruthy()
    })
    expect(api.submitScan).not.toHaveBeenCalled()
  })

  // ── Camera denied fallback ────────────────────────────────────────────────

  it('falls back to the upload tab when camera permission is denied', async () => {
    Object.defineProperty(navigator, 'mediaDevices', {
      value: {
        getUserMedia: vi.fn().mockRejectedValue(
          Object.assign(new Error('Permission denied'), { name: 'NotAllowedError' }),
        ),
      },
      configurable: true,
    })
    await act(async () => {
      render(<ScanQrModal user={mockUser} onClose={vi.fn()} />)
    })

    // The upload tab becomes the active input mode.
    await waitFor(() => {
      expect(screen.getByText('Upload QR image')).toBeTruthy()
    })
    const decodeBtn = screen.getByRole('button', { name: /read qr & check in/i })
    expect(decodeBtn).toBeTruthy()
    expect(decodeBtn).toBeDisabled()
    // The camera viewfinder is no longer shown.
    expect(screen.queryByText(/point camera at the qr code/i)).toBeNull()
  })

  // ── Image upload decode path ──────────────────────────────────────────────

  it('submits a scan with inputChannel "image" from an uploaded QR image', async () => {
    zxingMock.state.imageToken = 'upload-token-789'
    await act(async () => {
      render(<ScanQrModal user={mockUser} onClose={vi.fn()} />)
    })

    await act(async () => {
      fireEvent.click(screen.getByText('Upload QR'))
    })

    const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement
    expect(fileInput).not.toBeNull()
    const file = new File(['qr-image-bytes'], 'qr.png', { type: 'image/png' })
    await act(async () => {
      fireEvent.change(fileInput, { target: { files: [file] } })
    })

    await waitFor(() => {
      expect(screen.getByAltText('Uploaded QR')).toBeTruthy()
    })

    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /read qr & check in/i }))
    })

    await waitFor(() => {
      expect(api.submitScan).toHaveBeenCalledWith(
        'sess-1', 'stu-1', 'Test Student', 14.5863, 120.9842,
        'web-test-installation', 'upload-token-789', expect.any(String),
        expect.objectContaining({
          clientAttemptId: expect.any(String),
          accuracyMeters: 10,
          inputChannel: 'image',
        }),
      )
    })
    await waitFor(() => {
      expect(screen.getByText('Verified — Present')).toBeTruthy()
    })
  })
})
