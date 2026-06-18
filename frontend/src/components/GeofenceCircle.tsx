'use client'

import { useEffect, useId } from 'react'
import type MapLibreGL from 'maplibre-gl'
import { useMap } from '@/components/ui/map'

function computeCirclePoints(
  lat: number,
  lng: number,
  radiusMeters: number,
  segments = 64,
): [number, number][] {
  const coords: [number, number][] = []
  const km = radiusMeters / 1000
  const latR = (lat * Math.PI) / 180
  const degPerKmLat = 1 / 111.32
  const degPerKmLng = 1 / (111.32 * Math.cos(latR))

  for (let i = 0; i <= segments; i++) {
    const angle = ((i % segments) / segments) * 2 * Math.PI
    const dx = km * degPerKmLng * Math.cos(angle)
    const dy = km * degPerKmLat * Math.sin(angle)
    coords.push([lng + dx, lat + dy])
  }
  return coords
}

export default function GeofenceCircle({
  latitude,
  longitude,
  radiusMeters,
}: {
  latitude: number
  longitude: number
  radiusMeters: number
}) {
  const { map, isLoaded } = useMap()
  const id = useId()
  const sourceId = `geofence-source-${id}`
  const fillLayerId = `geofence-fill-${id}`
  const outlineLayerId = `geofence-outline-${id}`

  const coords = computeCirclePoints(latitude, longitude, radiusMeters)

  const geojson: GeoJSON.Feature<GeoJSON.Polygon> = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
  }

  useEffect(() => {
    if (!isLoaded || !map) return

    map.addSource(sourceId, { type: 'geojson', data: geojson })

    map.addLayer({
      id: fillLayerId,
      type: 'fill',
      source: sourceId,
      paint: {
        'fill-color': '#7B1113',
        'fill-opacity': 0.1,
      },
    })

    map.addLayer({
      id: outlineLayerId,
      type: 'line',
      source: sourceId,
      layout: { 'line-join': 'round', 'line-cap': 'round' },
      paint: {
        'line-color': '#7B1113',
        'line-width': 2,
        'line-opacity': 0.6,
        'line-dasharray': [4, 3],
      },
    })

    return () => {
      try {
        if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId)
        if (map.getLayer(outlineLayerId)) map.removeLayer(outlineLayerId)
        if (map.getSource(sourceId)) map.removeSource(sourceId)
      } catch {
        /* ignore */
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoaded, map])

  useEffect(() => {
    if (!isLoaded || !map) return
    const source = map.getSource(sourceId) as MapLibreGL.GeoJSONSource | undefined
    if (source) source.setData(geojson)
  }, [isLoaded, map, sourceId, latitude, longitude, radiusMeters])

  return null
}
