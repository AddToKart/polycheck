'use client'

import { useEffect, useId, useRef, useState } from 'react'
import MapLibreGL from 'maplibre-gl'
import { Map, useMap, MapMarker, MarkerContent, MarkerPopup, type MapRef } from '@/components/ui/map'
import GeofenceCircle from '@/components/GeofenceCircle'
import { pupSantaMaria, type CampusConfig } from '@polycheck/shared/map'
import type { Session, AttendanceRecord, AttendanceStatus } from '@polycheck/shared'
import { MapPin } from 'lucide-react'

const STATUS_MARKER_COLORS: Record<string, string> = {
  present: '#22C55E',
  late: '#FFDF00',
  absent: '#EF4444',
  pending: '#9CA3AF',
  disputed: '#F59E0B',
}

const STATUS_TEXT_CLASSES: Record<string, string> = {
  present: 'text-green-600 dark:text-green-400',
  late: 'text-yellow-600 dark:text-yellow-300',
  absent: 'text-red-600 dark:text-red-400',
  pending: 'text-gray-400 dark:text-gray-500',
  disputed: 'text-amber-500 dark:text-amber-300',
}

function CampusBuildingsLayer({ campus }: { campus: CampusConfig }) {
  const { map, isLoaded } = useMap()
  const id = useId()
  const polygonSourceId = `campus-polygons-${id}`
  const labelSourceId = `campus-labels-${id}`
  const fillLayerId = `campus-fill-${id}`
  const outlineLayerId = `campus-outline-${id}`
  const labelLayerId = `campus-labels-layer-${id}`

  const polygonGeoJSON: GeoJSON.FeatureCollection<GeoJSON.Polygon> = {
    type: 'FeatureCollection',
    features: campus.buildings.map((b) => ({
      type: 'Feature',
      properties: { name: b.name, abbr: b.abbreviation },
      geometry: { type: 'Polygon', coordinates: [b.polygon] },
    })),
  }

  const labelGeoJSON: GeoJSON.FeatureCollection<GeoJSON.Point> = {
    type: 'FeatureCollection',
    features: campus.buildings.map((b) => ({
      type: 'Feature',
      properties: { name: b.name, abbr: b.abbreviation },
      geometry: { type: 'Point', coordinates: b.center },
    })),
  }

  useEffect(() => {
    if (!isLoaded || !map) return

    map.addSource(polygonSourceId, { type: 'geojson', data: polygonGeoJSON })
    map.addSource(labelSourceId, { type: 'geojson', data: labelGeoJSON })

    map.addLayer({
      id: fillLayerId,
      type: 'fill',
      source: polygonSourceId,
      paint: {
        'fill-color': '#7B1113',
        'fill-opacity': 0.08,
      },
    })

    map.addLayer({
      id: outlineLayerId,
      type: 'line',
      source: polygonSourceId,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#7B1113',
        'line-width': 1.5,
        'line-opacity': 0.4,
      },
    })

    map.addLayer({
      id: labelLayerId,
      type: 'symbol',
      source: labelSourceId,
      layout: {
        'text-field': ['get', 'abbr'],
        'text-font': ['Open Sans Semibold', 'Open Sans Bold', 'Arial Unicode MS Bold'],
        'text-size': 11,
        'text-offset': [0, -1.2],
        'text-anchor': 'bottom',
        'text-allow-overlap': false,
      },
      paint: {
        'text-color': '#7B1113',
        'text-halo-color': '#FFFFFF',
        'text-halo-width': 2,
        'text-opacity': 0.85,
      },
    })

    return () => {
      try {
        if (map.getLayer(labelLayerId)) map.removeLayer(labelLayerId)
        if (map.getLayer(outlineLayerId)) map.removeLayer(outlineLayerId)
        if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId)
        if (map.getSource(labelSourceId)) map.removeSource(labelSourceId)
        if (map.getSource(polygonSourceId)) map.removeSource(polygonSourceId)
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, map])

  return null
}

interface StudentPopoverCardProps {
  studentName: string
  studentId: string
  studentProgram?: string
  status: AttendanceStatus
  timestamp: string
  deviceId?: string
}

function StudentPopoverCard({ studentName, studentId, studentProgram, status, timestamp, deviceId }: StudentPopoverCardProps) {
  return (
    <div className="min-w-[180px]">
      <p className="text-sm font-bold text-[#4A0A0B] dark:text-white">{studentName}</p>
      <p className="text-xs text-gray-500 dark:text-gray-400">{studentId}{studentProgram ? ` · ${studentProgram}` : ''}</p>
      <div className="flex items-center gap-2 mt-1.5">
        <span className={`px-1.5 py-0.5 text-[10px] font-semibold rounded ${STATUS_TEXT_CLASSES[status] || ''}`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </span>
        <span className="text-[10px] text-gray-400 dark:text-gray-500">
          {new Date(timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>
      {deviceId && deviceId !== 'manual' && (
        <p className="text-[10px] text-gray-400 dark:text-gray-500 mt-1">Device: {deviceId}</p>
      )}
    </div>
  )
}

function getMarkerColor(status: AttendanceStatus): string {
  return STATUS_MARKER_COLORS[status] || STATUS_MARKER_COLORS.pending
}

interface CampusMapProps {
  session: Session
  records: AttendanceRecord[]
  isActive: boolean
  refreshLabel: string
}

export default function CampusMap({ session, records, isActive, refreshLabel }: CampusMapProps) {
  const mapRef = useRef<MapRef>(null)
  const [mapReady, setMapReady] = useState(false)
  const initialViewport = {
    center: [session.geofence.longitude, session.geofence.latitude] as [number, number],
    zoom: 17,
    bearing: 0,
    pitch: 0,
  }

  const recordsWithCoords = records.filter(
    (r) => r.coordinates && (r.coordinates.latitude !== 0 || r.coordinates.longitude !== 0)
  )

  useEffect(() => {
    if (!mapRef.current || !mapReady) return
    if (!session.geofence) return

    const bounds = new MapLibreGL.LngLatBounds()
    bounds.extend([session.geofence.longitude, session.geofence.latitude])

    for (const r of recordsWithCoords) {
      bounds.extend([r.coordinates.longitude, r.coordinates.latitude])
    }

    try {
      mapRef.current.fitBounds(bounds, { padding: 60, maxZoom: 18, duration: 800 })
    } catch {
      /* ignore if bounds are invalid */
    }
  }, [mapReady, recordsWithCoords, session.geofence])

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <MapPin className="w-5 h-5 text-[#7B1113] dark:text-[#FFDF00]" />
          <h2 className="text-base font-bold dark:text-white">Campus Map</h2>
        </div>
        {isActive && (
          <span className="text-xs text-green-600 dark:text-green-400 font-medium">{refreshLabel}</span>
        )}
      </div>

      <div className="h-[420px] rounded-lg overflow-hidden border border-gray-200 dark:border-[rgba(245,168,0,0.15)]">
        <Map
          ref={mapRef}
          viewport={initialViewport}
          onViewportChange={() => {
            if (!mapReady) setMapReady(true)
          }}
          className="w-full h-full"
        >
          <CampusBuildingsLayer campus={pupSantaMaria} />
          <GeofenceCircle
            latitude={session.geofence.latitude}
            longitude={session.geofence.longitude}
            radiusMeters={session.geofence.radiusMeters}
          />

          {recordsWithCoords.map((record) => {
            const color = getMarkerColor(record.status)
            return (
              <MapMarker
                key={record.id}
                latitude={record.coordinates.latitude}
                longitude={record.coordinates.longitude}
              >
                <MarkerContent>
                  <div
                    className="w-4 h-4 rounded-full border-2 border-white shadow-lg cursor-pointer"
                    style={{ backgroundColor: color }}
                  />
                </MarkerContent>
                <MarkerPopup closeButton>
                  <StudentPopoverCard
                    studentName={record.studentName}
                    studentId={record.studentId}
                    studentProgram={record.studentProgram}
                    status={record.status}
                    timestamp={record.timestamp}
                    deviceId={record.deviceId}
                  />
                </MarkerPopup>
              </MapMarker>
            )
          })}
        </Map>
      </div>

      <div className="flex items-center gap-4 text-xs">
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_MARKER_COLORS.present }} />
          Present
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_MARKER_COLORS.late }} />
          Late
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_MARKER_COLORS.absent }} />
          Absent
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STATUS_MARKER_COLORS.pending }} />
          Pending
        </span>
      </div>
    </div>
  )
}
