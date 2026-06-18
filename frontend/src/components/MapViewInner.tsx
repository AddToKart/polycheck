'use client'

import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

const markerIcon = new L.DivIcon({
  className: '',
  html: `<svg width="32" height="32" viewBox="0 0 24 24" fill="#7B1113" stroke="white" stroke-width="1.5"><path d="M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /><path d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1 1 15 0Z" /></svg>`,
  iconSize: [32, 32],
  iconAnchor: [16, 32],
})

export default function MapViewInner({
  latitude,
  longitude,
  radius,
}: {
  latitude: number
  longitude: number
  radius: number
}) {
  const center: [number, number] = [latitude, longitude]

  return (
    <div className="h-[200px] rounded-none overflow-hidden border border-zinc-200 dark:border-zinc-700">
      <MapContainer center={center} zoom={16} className="h-full w-full" zoomControl={false} scrollWheelZoom={false} dragging={false}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Circle
          center={center}
          radius={radius}
          pathOptions={{
            color: '#7B1113',
            fillColor: '#7B1113',
            fillOpacity: 0.1,
            weight: 2,
            dashArray: '6 4',
          }}
        />
        <Marker position={center} icon={markerIcon} />
      </MapContainer>
    </div>
  )
}
