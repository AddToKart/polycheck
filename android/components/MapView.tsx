import { useRef, useCallback, useEffect } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { WebView } from 'react-native-webview'
import { MaterialIcons } from '@expo/vector-icons'
import { useTheme } from '../theme/ThemeContext'
import { fonts } from '../theme/typography'

interface MapViewProps {
  latitude: number
  longitude: number
  radius: number
  interactive?: boolean
  onLocationChange?: (lat: number, lng: number) => void
  onRadiusChange?: (r: number) => void
}

function html(lat: number, lng: number, radius: number, interactive: boolean) {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
<link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
<script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
<style>
  body { margin: 0; padding: 0; }
  #map { width: 100vw; height: 100vh; }
  .leaflet-control-attribution { display: none !important; }
  .radius-label {
    position: absolute;
    bottom: 16px;
    left: 50%;
    transform: translateX(-50%);
    background: rgba(0,0,0,0.75);
    color: #fff;
    padding: 6px 16px;
    font: 13px 'DM Sans', sans-serif;
    border-radius: 0;
    z-index: 1000;
    pointer-events: none;
  }
</style>
</head>
<body>
<div id="map"></div>
<div class="radius-label">Geofence: ${radius}m</div>
<script>
  var map = L.map('map', {
    center: [${lat}, ${lng}],
    zoom: 17,
    zoomControl: true,
    attributionControl: false
  });

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19
  }).addTo(map);

  var marker = L.marker([${lat}, ${lng}], {
    draggable: ${interactive}
  }).addTo(map);

  var circle = L.circle([${lat}, ${lng}], {
    radius: ${radius},
    color: '#7B1113',
    fillColor: '#7B1113',
    fillOpacity: 0.1,
    weight: 2,
    dashArray: '6 4'
  }).addTo(map);

  function update(lat, lng, rad) {
    marker.setLatLng([lat, lng]);
    circle.setLatLng([lat, lng]);
    circle.setRadius(rad);
    document.querySelector('.radius-label').textContent = 'Geofence: ' + rad + 'm';
  }

  ${interactive ? `
  marker.on('dragend', function() {
    var pos = marker.getLatLng();
    window.ReactNativeWebView.postMessage(JSON.stringify({
      lat: pos.lat.toFixed(6),
      lng: pos.lng.toFixed(6),
      radius: ${radius}
    }));
  });

  map.on('click', function(e) {
    marker.setLatLng(e.latlng);
    circle.setLatLng(e.latlng);
    window.ReactNativeWebView.postMessage(JSON.stringify({
      lat: e.latlng.lat.toFixed(6),
      lng: e.latlng.lng.toFixed(6),
      radius: ${radius}
    }));
  });
  ` : ''}
</script>
</body>
</html>`
}

export default function MapView({ latitude, longitude, radius, interactive, onLocationChange, onRadiusChange }: MapViewProps) {
  const { isDark } = useTheme()
  const webRef = useRef<WebView>(null)
  const prevRadiusRef = useRef(radius)

  useEffect(() => {
    if (prevRadiusRef.current !== radius && webRef.current) {
      webRef.current.injectJavaScript(`
        update(${latitude}, ${longitude}, ${radius});
        true;
      `)
      prevRadiusRef.current = radius
    }
  }, [radius, latitude, longitude])

  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const { lat, lng } = JSON.parse(event.nativeEvent.data)
      onLocationChange?.(parseFloat(lat), parseFloat(lng))
    } catch {}
  }, [onLocationChange])

  const RADIUS_STEPS = [10, 20, 30, 40, 50, 60, 80, 100, 150, 200]

  return (
    <View style={styles.wrapper}>
      <View style={[styles.mapContainer, isDark && styles.mapContainerDark]}>
        <WebView
          ref={webRef}
          source={{ html: html(latitude, longitude, radius, !!interactive) }}
          style={styles.webview}
          scrollEnabled={false}
          bounces={false}
          onMessage={handleMessage}
          javaScriptEnabled
          domStorageEnabled
          originWhitelist={['*']}
          androidLayerType="hardware"
        />
        {!interactive && (
          <View style={styles.overlay} pointerEvents="none">
            <Text style={styles.overlayCoords}>{latitude.toFixed(4)}, {longitude.toFixed(4)}</Text>
            <Text style={styles.overlayRadius}>{radius}m geofence</Text>
          </View>
        )}
      </View>

      {interactive && (
        <>
          <View style={[styles.hintRow, isDark && styles.hintRowDark]}>
            <MaterialIcons name="touch-app" size={14} color="#888" />
            <Text style={[styles.hintText, isDark && styles.hintTextDark]}>Drag the pin or tap the map to set location</Text>
          </View>

          <View style={styles.radiusSection}>
            <Text style={[styles.radiusLabel, isDark && styles.radiusLabelDark]}>Geofence Radius: <Text style={styles.radiusValue}>{radius}m</Text></Text>
            <View style={styles.sliderTrack}>
              <View style={[styles.sliderFill, { width: `${((radius - 10) / 190) * 100}%` }]} />
              <View style={[styles.sliderThumb, { left: `${((radius - 10) / 190) * 100}%` }]} />
            </View>
            <View style={styles.sliderLabels}>
              <Text style={[styles.sliderLabel, isDark && styles.sliderLabelDark]}>10m</Text>
              <TouchableOpacity
                style={styles.sliderMinus}
                onPress={() => onRadiusChange?.(Math.max(10, radius - 10))}
              >
                <MaterialIcons name="remove" size={16} color="#7B1113" />
              </TouchableOpacity>
              <Text style={[styles.sliderValue, isDark && styles.sliderValueDark]}>{radius}m</Text>
              <TouchableOpacity
                style={styles.sliderPlus}
                onPress={() => onRadiusChange?.(Math.min(200, radius + 10))}
              >
                <MaterialIcons name="add" size={16} color="#7B1113" />
              </TouchableOpacity>
              <Text style={[styles.sliderLabel, isDark && styles.sliderLabelDark]}>200m</Text>
            </View>
            <View style={styles.radiusChips}>
              {RADIUS_STEPS.map((r) => (
                <TouchableOpacity
                  key={r}
                  style={[styles.chip, radius === r && styles.chipActive, isDark && styles.chipDark, radius === r && isDark && styles.chipActiveDark]}
                  onPress={() => onRadiusChange?.(r)}
                >
                  <Text style={[styles.chipText, radius === r && styles.chipTextActive]}>{r}m</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 8 },
  mapContainer: { height: 280, borderWidth: 1, borderColor: '#DDD', overflow: 'hidden' },
  mapContainerDark: { borderColor: '#333' },
  webview: { flex: 1, backgroundColor: 'transparent' },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  overlayCoords: { color: '#FFF', fontSize: 14, fontFamily: fonts.mono, fontWeight: '600' },
  overlayRadius: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: fonts.body, marginTop: 2 },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  hintRowDark: {},
  hintText: { fontSize: 12, fontFamily: fonts.body, color: '#999' },
  hintTextDark: { color: 'rgba(255,255,255,0.4)' },
  radiusSection: { marginTop: 16 },
  radiusLabel: { fontSize: 13, fontFamily: fonts.bodyMedium, color: '#666', marginBottom: 8 },
  radiusLabelDark: { color: 'rgba(255,255,255,0.5)' },
  radiusValue: { fontFamily: fonts.bodyBold, color: '#7B1113' },
  sliderTrack: {
    height: 4,
    backgroundColor: '#DDD',
    borderRadius: 2,
    position: 'relative',
    marginBottom: 8,
  },
  sliderFill: {
    height: 4,
    backgroundColor: '#7B1113',
    borderRadius: 2,
    position: 'absolute',
    left: 0,
    top: 0,
  },
  sliderThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#7B1113',
    position: 'absolute',
    top: -7,
    marginLeft: -9,
  },
  sliderLabels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 12,
  },
  sliderLabel: { fontSize: 11, fontFamily: fonts.body, color: '#999' },
  sliderLabelDark: { color: 'rgba(255,255,255,0.4)' },
  sliderValue: { fontSize: 16, fontFamily: fonts.bodyBold, color: '#333', minWidth: 40, textAlign: 'center' },
  sliderValueDark: { color: '#FFF' },
  sliderMinus: { width: 28, height: 28, borderRadius: 0, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#DDD' },
  sliderPlus: { width: 28, height: 28, borderRadius: 0, backgroundColor: '#F5F5F5', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: '#DDD' },
  radiusChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: '#DDD',
    backgroundColor: '#FFFFFF',
  },
  chipActive: { borderColor: '#7B1113', backgroundColor: '#7B1113' },
  chipDark: { borderColor: '#444', backgroundColor: '#1A1A1A' },
  chipActiveDark: { borderColor: '#F5A800', backgroundColor: '#F5A800' },
  chipText: { fontSize: 12, fontFamily: fonts.bodyMedium, color: '#666' },
  chipTextActive: { color: '#FFFFFF' },
})
