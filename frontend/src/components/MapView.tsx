'use client'

import { Map, MapMarker, MarkerContent } from '@/components/ui/map'
import { MapPin } from 'lucide-react'
import GeofenceCircle from '@/components/GeofenceCircle'

export default function MapView({
  latitude,
  longitude,
  radius,
}: {
  latitude: number
  longitude: number
  radius: number
}) {
  const center: [number, number] = [longitude, latitude]

  return (
    <div className="h-[200px] rounded-none overflow-hidden border border-zinc-200 dark:border-zinc-700">
      <Map center={center} zoom={16} scrollZoom={false} dragPan={false} touchZoomRotate={false} doubleClickZoom={false}>
        <MapMarker longitude={center[0]} latitude={center[1]}>
          <MarkerContent>
            <MapPin className="fill-maroon stroke-white" size={28} />
          </MarkerContent>
        </MapMarker>
        <GeofenceCircle latitude={latitude} longitude={longitude} radiusMeters={radius} />
      </Map>
    </div>
  )
}
