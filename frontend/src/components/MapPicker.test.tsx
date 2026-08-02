// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ReactNode } from 'react'
import { render, screen, fireEvent, act, cleanup } from '@testing-library/react'

// ── Hoisted mock state ──────────────────────────────────────────────────────
// The real @/components/ui/map mounts maplibre-gl, which needs WebGL and is
// unusable in jsdom. These mocks record the props MapPicker passes so tests
// can assert center/zoom wiring, and expose easeTo on the forwarded ref so
// MapPicker's mapRef.current?.easeTo(...) call is observable.
const mapMock = vi.hoisted(() => ({
  easeTo: vi.fn(),
  mapPropsList: [] as { center: [number, number]; zoom: number }[],
  markerPropsList: [] as { longitude: number; latitude: number }[],
}))
const geofenceMock = vi.hoisted(() => ({
  propsList: [] as { latitude: number; longitude: number; radiusMeters: number }[],
}))

// ── Module mocks (vi.mock is hoisted) ──────────────────────────────────────
vi.mock('@/components/ui/map', () => ({
  Map: (props: {
    center: [number, number]
    zoom: number
    ref?: { current: unknown }
    children?: ReactNode
  }) => {
    mapMock.mapPropsList.push({ center: props.center, zoom: props.zoom })
    // React 19 passes `ref` as a prop. Populate it like the real Map does so
    // MapPicker's mapRef.current?.easeTo(...) reaches the mock.
    if (props.ref && typeof props.ref === 'object' && 'current' in props.ref) {
      props.ref.current = { easeTo: mapMock.easeTo }
    }
    return <div data-testid="map">{props.children}</div>
  },
  MapMarker: (props: { longitude: number; latitude: number }) => {
    mapMock.markerPropsList.push({ longitude: props.longitude, latitude: props.latitude })
    return <div data-testid="map-marker" />
  },
  MarkerContent: ({ children }: { children?: ReactNode }) => (
    <div data-testid="marker-content">{children}</div>
  ),
  MapControls: () => <div data-testid="map-controls" />,
}))

vi.mock('@/components/GeofenceCircle', () => ({
  default: (props: { latitude: number; longitude: number; radiusMeters: number }) => {
    geofenceMock.propsList.push(props)
    return <div data-testid="geofence-circle" />
  },
}))

vi.mock('lucide-react', () => {
  const icons: Record<string, unknown> = {}
  for (const name of ['MapPin', 'Maximize', 'Minimize', 'Loader2']) {
    icons[name] = () => <div data-testid={`icon-${name}`} />
  }
  return icons
})

// ── Import AFTER mocks ──────────────────────────────────────────────────────
import MapPicker from './MapPicker'

function stubGeolocationSuccess(lat: number, lng: number) {
  Object.defineProperty(navigator, 'geolocation', {
    value: {
      getCurrentPosition: vi.fn((success: PositionCallback) => {
        success({
          coords: { latitude: lat, longitude: lng, accuracy: 5 },
          timestamp: Date.now(),
        } as GeolocationPosition)
      }),
    },
    configurable: true,
  })
}

function stubGeolocationFailure() {
  Object.defineProperty(navigator, 'geolocation', {
    value: {
      getCurrentPosition: vi.fn((_success: PositionCallback, error: PositionErrorCallback) => {
        error({
          code: 2,
          message: 'Position unavailable',
          PERMISSION_DENIED: 1,
          POSITION_UNAVAILABLE: 2,
          TIMEOUT: 3,
        } as GeolocationPositionError)
      }),
    },
    configurable: true,
  })
}

beforeEach(() => {
  cleanup()
  vi.clearAllMocks()
  mapMock.mapPropsList.length = 0
  mapMock.markerPropsList.length = 0
  geofenceMock.propsList.length = 0
})

describe('MapPicker', () => {
  it('renders with the default Santa Maria center and zoom', () => {
    render(<MapPicker />)

    expect(screen.getByTestId('map')).toBeTruthy()
    const mapProps = mapMock.mapPropsList[mapMock.mapPropsList.length - 1]
    expect(mapProps.center).toEqual([120.9991, 14.8697])
    expect(mapProps.zoom).toBe(16)

    // Geofence circle and coordinate readout reflect the default center
    const circleProps = geofenceMock.propsList[geofenceMock.propsList.length - 1]
    expect(circleProps).toEqual({ latitude: 14.8697, longitude: 120.9991, radiusMeters: 40 })
    expect(screen.getByText('14.8697, 120.9991')).toBeTruthy()
  })

  it('pans the map and reports the new location when "Use My Location" succeeds', () => {
    const onChange = vi.fn()
    stubGeolocationSuccess(14.87, 121.0)

    render(<MapPicker onChange={onChange} />)
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /use my location/i }))
    })

    expect(onChange).toHaveBeenCalledWith(14.87, 121.0, 40)
    expect(mapMock.easeTo).toHaveBeenCalledWith({ center: [121.0, 14.87], duration: 500 })

    // Marker and geofence circle follow the new center
    const markerProps = mapMock.markerPropsList[mapMock.markerPropsList.length - 1]
    expect(markerProps.longitude).toBe(121.0)
    expect(markerProps.latitude).toBe(14.87)
    const circleProps = geofenceMock.propsList[geofenceMock.propsList.length - 1]
    expect(circleProps).toEqual({ latitude: 14.87, longitude: 121.0, radiusMeters: 40 })
  })

  it('alerts when geolocation fails', () => {
    const alertSpy = vi.spyOn(window, 'alert').mockImplementation(() => {})
    stubGeolocationFailure()

    render(<MapPicker />)
    act(() => {
      fireEvent.click(screen.getByRole('button', { name: /use my location/i }))
    })

    expect(alertSpy).toHaveBeenCalledWith(
      'Unable to retrieve your location. Make sure GPS access is enabled.',
    )
  })
})
