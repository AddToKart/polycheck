'use client'

import { useRef, useState, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

const markerIcon = new L.DivIcon({
  className: '',
  html: `<svg width="32" height="32" viewBox="0 0 24 24" fill="#7B1113" stroke="white" stroke-width="1.5"><path d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

function LocationMarker({
  position,
  onMove,
}: {
  position: [number, number]
  onMove: (pos: [number, number]) => void
}) {
  const markerRef = useRef<L.Marker>(null)

  const eventHandlers = {
    dragend() {
      const marker = markerRef.current
      if (marker) {
        const latlng = marker.getLatLng()
        onMove([latlng.lat, latlng.lng])
      }
    },
  }

  return (
    <Marker
      ref={markerRef}
      position={position}
      draggable={true}
      icon={markerIcon}
      eventHandlers={eventHandlers}
    />
  )
}

export default function MapPickerInner({
  latitude,
  longitude,
  radius,
  onChange,
}: {
  latitude: number
  longitude: number
  radius: number
  onChange?: (lat: number, lng: number, radius: number) => void
}) {
  const [center, setCenter] = useState<[number, number]>([latitude, longitude])
  const [rad, setRad] = useState(radius)

  const handleMove = useCallback(
    (pos: [number, number]) => {
      setCenter(pos)
      onChange?.(pos[0], pos[1], rad)
    },
    [rad, onChange],
  )

  const handleRadiusChange = useCallback(
    (val: number) => {
      setRad(val)
      onChange?.(center[0], center[1], val)
    },
    [center, onChange],
  )

  return (
    <div className="space-y-4">
      <div className="h-[350px] rounded-none overflow-hidden border border-zinc-300 dark:border-zinc-700">
        <MapContainer center={center} zoom={16} className="h-full w-full" zoomControl={true}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Circle
            center={center}
            radius={rad}
            pathOptions={{
              color: '#7B1113',
              fillColor: '#7B1113',
              fillOpacity: 0.1,
              weight: 2,
              dashArray: '6 4',
            }}
          />
          <LocationMarker position={center} onMove={handleMove} />
        </MapContainer>
      </div>

      <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
        <span>Drag the pin to set location</span>
        <span className="text-zinc-300 dark:text-zinc-600">|</span>
        <span className="font-mono text-xs">
          {center[0].toFixed(4)}, {center[1].toFixed(4)}
        </span>
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
