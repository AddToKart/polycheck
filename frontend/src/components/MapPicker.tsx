'use client'

import { useState, useCallback, useRef } from 'react'
import { Map, MapMarker, MarkerContent, MapControls, type MapRef } from '@/components/ui/map'
import { MapPin, Maximize, Minimize, Loader2 } from 'lucide-react'
import GeofenceCircle from '@/components/GeofenceCircle'

export default function MapPicker({
  latitude = 14.8697,
  longitude = 120.9991,
  radius = 40,
  onChange,
}: {
  latitude?: number
  longitude?: number
  radius?: number
  onChange?: (lat: number, lng: number, radius: number) => void
}) {
  const [center, setCenter] = useState<[number, number]>([longitude, latitude])
  const [rad, setRad] = useState(radius)
  const [fullscreen, setFullscreen] = useState(false)
  const [locating, setLocating] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapRef>(null)

  const handleUseMyLocation = useCallback(() => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by your browser.')
      return
    }
    setLocating(true)
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false)
        const lat = pos.coords.latitude
        const lng = pos.coords.longitude
        const newCenter: [number, number] = [lng, lat]
        setCenter(newCenter)
        mapRef.current?.easeTo({ center: newCenter, duration: 500 })
        onChange?.(lat, lng, rad)
      },
      () => {
        setLocating(false)
        alert('Unable to retrieve your location. Make sure GPS access is enabled.')
      },
      { enableHighAccuracy: true, timeout: 10000 }
    )
  }, [rad, onChange])

  const handleMove = useCallback(
    (pos: { lng: number; lat: number }) => {
      const newCenter: [number, number] = [pos.lng, pos.lat]
      setCenter(newCenter)
      onChange?.(pos.lat, pos.lng, rad)
    },
    [rad, onChange],
  )

  const handleRadiusChange = useCallback(
    (val: number) => {
      setRad(val)
      onChange?.(center[1], center[0], val)
    },
    [center, onChange],
  )

  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen()
      setFullscreen(true)
    } else {
      document.exitFullscreen()
      setFullscreen(false)
    }
  }, [])

  return (
    <div className="space-y-4">
      <div
        ref={containerRef}
        className={`rounded-none overflow-hidden border border-zinc-200 dark:border-zinc-700 relative ${fullscreen ? 'fixed inset-0 z-50 h-screen w-screen' : 'h-[350px]'}`}
      >
        <Map ref={mapRef} center={center as [number, number]} zoom={16}>
          <MapControls showZoom showFullscreen position="bottom-right" />
          <GeofenceCircle latitude={center[1]} longitude={center[0]} radiusMeters={rad} />
          <MapMarker
            longitude={center[0]}
            latitude={center[1]}
            draggable
            onDragEnd={handleMove}
          >
            <MarkerContent>
              <MapPin className="fill-maroon stroke-white" size={28} />
            </MarkerContent>
          </MapMarker>
        </Map>

        {fullscreen && (
          <button
            onClick={toggleFullscreen}
            className="absolute top-3 right-3 z-10 flex items-center gap-1.5 bg-white dark:bg-zinc-800 border border-zinc-300 dark:border-zinc-600 px-3 py-1.5 text-sm text-zinc-700 dark:text-zinc-200 shadow-sm hover:bg-zinc-50 dark:hover:bg-zinc-700"
          >
            <Minimize className="size-4" />
            Exit Fullscreen
          </button>
        )}
      </div>

      <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
        <span>Drag the pin to set location</span>
        <span className="text-zinc-300 dark:text-zinc-600">|</span>
        <button
          type="button"
          disabled={locating}
          onClick={handleUseMyLocation}
          className="flex items-center gap-1 text-xs text-maroon dark:text-amber-400 hover:underline disabled:opacity-55"
        >
          {locating ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <MapPin className="size-3.5" />
          )}
          {locating ? 'Locating…' : 'Use My Location'}
        </button>
        <span className="text-zinc-300 dark:text-zinc-600">|</span>
        <span className="font-mono text-xs">
          {center[1].toFixed(4)}, {center[0].toFixed(4)}
        </span>
        <button
          onClick={toggleFullscreen}
          className="ml-auto flex items-center gap-1 text-xs text-maroon dark:text-amber-400 hover:underline"
        >
          <Maximize className="size-3.5" />
          Fullscreen
        </button>
      </div>

      <div>
        <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300 mb-1.5">
          Geofence Radius: <span className="font-mono text-maroon dark:text-white">{rad}m</span>
        </label>
        <input
          type="range"
          min={10}
          max={200}
          value={rad}
          onChange={(e) => handleRadiusChange(Number(e.target.value))}
          className="w-full accent-maroon"
        />
        <div className="flex justify-between text-xs text-zinc-400 mt-0.5">
          <span>10m</span>
          <span>200m</span>
        </div>
      </div>
    </div>
  )
}
