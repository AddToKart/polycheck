import { useRef, useCallback, useEffect, useMemo, useState } from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
import { WebView } from 'react-native-webview'
import { MaterialIcons } from '@expo/vector-icons'
import { useTheme } from '../theme/ThemeContext'
import { fonts } from '../theme/typography'
import { pupSantaMaria } from '@polycheck/shared/map'

export interface StudentMapPin {
  id: string
  latitude: number
  longitude: number
  label: string
  program?: string
  status: 'present' | 'late' | 'absent' | 'pending' | 'disputed'
  timestamp: string
  deviceId?: string
}

const EMPTY_STUDENT_PINS: StudentMapPin[] = []

interface MapViewProps {
  latitude: number
  longitude: number
  radius: number
  interactive?: boolean
  recenterSignal?: number
  onLocationChange?: (lat: number, lng: number) => void
  onRadiusChange?: (r: number) => void
  studentPins?: StudentMapPin[]
}

function html(
  lat: number,
  lng: number,
  radius: number,
  interactive: boolean,
  isDark: boolean,
  studentPins: StudentMapPin[],
) {
  const accentColor = isDark ? '#FFDF00' : '#7B1113'

  const statusColors: Record<string, string> = {
    present: '#22C55E',
    late: '#FFDF00',
    absent: '#EF4444',
    pending: '#9CA3AF',
    disputed: '#F59E0B',
  }

  const buildingsJSON = JSON.stringify(
    pupSantaMaria.buildings.map((b) => ({
      name: b.name,
      abbr: b.abbreviation,
      lng: b.center[0],
      lat: b.center[1],
      polygon: b.polygon.map((p) => ({ lng: p[0], lat: p[1] })),
    }))
  )

  const pinsJSON = JSON.stringify(
    studentPins.map((p) => ({
      id: p.id,
      lat: p.latitude,
      lng: p.longitude,
      label: p.label,
      program: p.program || '',
      status: p.status,
      timestamp: p.timestamp,
      deviceId: p.deviceId || '',
    }))
  )

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
  .student-popup { font-family: 'DM Sans', sans-serif; min-width: 160px; }
  .student-popup .name { font-weight: 700; font-size: 13px; margin-bottom: 2px; }
  .student-popup .id { font-size: 11px; color: #888; }
  .student-popup .status-row { display: flex; align-items: center; gap: 8px; margin-top: 4px; }
  .student-popup .status { font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: 2px; }
  .student-popup .time { font-size: 10px; color: #999; }
  .student-popup .device { font-size: 10px; color: #aaa; margin-top: 2px; }
  ${isDark ? `
  .leaflet-container { background: #0A0A0C !important; }
  .leaflet-popup-content-wrapper { background: #121215 !important; color: #fff !important; border: 1px solid rgba(245,168,0,0.15) !important; border-radius: 0 !important; }
  .leaflet-popup-tip { background: #121215 !important; border: 1px solid rgba(245,168,0,0.15) !important; }
  .student-popup .id { color: #999; }
  .student-popup .time { color: #666; }
  .student-popup .device { color: #666; }
  ` : ''}
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

  var tileUrl = ${isDark}
    ? 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png'
    : 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png';

  L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(map);

  var marker = L.marker([${lat}, ${lng}], { draggable: ${interactive} }).addTo(map);

  var circle = L.circle([${lat}, ${lng}], {
    radius: ${radius},
    color: '${accentColor}',
    fillColor: '${accentColor}',
    fillOpacity: 0.1,
    weight: 2,
    dashArray: '6 4'
  }).addTo(map);

  var buildings = ${buildingsJSON};
  buildings.forEach(function(b) {
    var coords = b.polygon.map(function(p) { return [p.lat, p.lng]; });
    L.polygon(coords, {
      color: '${accentColor}',
      fillColor: '${accentColor}',
      fillOpacity: 0.08,
      weight: 1.5,
      opacity: 0.4
    }).addTo(map);

    L.marker([b.lat, b.lng], {
      icon: L.divIcon({
        className: 'building-label',
        html: '<span style="font-size:10px;font-weight:700;color:${accentColor};text-shadow:0 0 3px #fff,0 0 3px #fff;white-space:nowrap">' + b.abbr + '</span>',
        iconSize: [0, 0],
        iconAnchor: [0, 0]
      })
    }).addTo(map);
  });

  var statusColors = ${JSON.stringify(statusColors)};
  var statusLabels = { present: 'Present', late: 'Late', absent: 'Absent', pending: 'Pending', disputed: 'Disputed' };

  var pinMarkers = [];
  function updatePins(pins) {
    pinMarkers.forEach(function(pin) { map.removeLayer(pin); });
    pinMarkers = [];
    pins.forEach(function(p) {
      if (p.lat === 0 && p.lng === 0) return;
      var color = statusColors[p.status] || '#9CA3AF';
      var circleMarker = L.circleMarker([p.lat, p.lng], {
        radius: 7,
        fillColor: color,
        color: '#fff',
        weight: 2,
        fillOpacity: 1
      }).addTo(map);

      var popupHtml = '<div class="student-popup">' +
        '<div class="name">' + p.label + '</div>' +
        '<div class="id">' + (p.program ? p.id + ' · ' + p.program : p.id) + '</div>' +
        '<div class="status-row">' +
          '<span class="status" style="background:' + color + ';color:' + (p.status === 'late' ? '#4A0A0B' : '#fff') + '">' + (statusLabels[p.status] || p.status) + '</span>' +
          '<span class="time">' + new Date(p.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }) + '</span>' +
        '</div>' +
        (p.deviceId && p.deviceId !== 'manual' ? '<div class="device">Device: ' + p.deviceId + '</div>' : '') +
      '</div>';

      circleMarker.bindPopup(popupHtml);
      pinMarkers.push(circleMarker);
    });
  }
  updatePins(${pinsJSON});

  function update(lat, lng, rad) {
    marker.setLatLng([lat, lng]);
    circle.setLatLng([lat, lng]);
    circle.setRadius(rad);
    document.querySelector('.radius-label').textContent = 'Geofence: ' + rad + 'm';
  }

  ${interactive ? `
  marker.on('dragend', function() {
    var pos = marker.getLatLng();
    circle.setLatLng(pos);
    window.ReactNativeWebView.postMessage(JSON.stringify({
      lat: pos.lat.toFixed(6),
      lng: pos.lng.toFixed(6)
    }));
  });

  map.on('click', function(e) {
    marker.setLatLng(e.latlng);
    circle.setLatLng(e.latlng);
    window.ReactNativeWebView.postMessage(JSON.stringify({
      lat: e.latlng.lat.toFixed(6),
      lng: e.latlng.lng.toFixed(6)
    }));
  });
  ` : ''}
</script>
</body>
</html>`
}

export default function MapView({ latitude, longitude, radius, interactive, recenterSignal, onLocationChange, onRadiusChange, studentPins = EMPTY_STUDENT_PINS }: MapViewProps) {
  const { isDark } = useTheme()
  const webRef = useRef<WebView>(null)
  const fullscreenWebRef = useRef<WebView>(null)
  const [fullscreen, setFullscreen] = useState(false)
  const sliderRef = useRef<View>(null)
  const sliderWidthRef = useRef(0)
  const sliderLeftRef = useRef(0)
  const initialMapProps = useRef({ latitude, longitude, radius, studentPins })
  const latestLocation = useRef({ latitude, longitude })
  latestLocation.current = { latitude, longitude }
  const pinsData = useMemo(() => studentPins.map((p) => ({
      id: p.id,
      lat: p.latitude,
      lng: p.longitude,
      label: p.label,
      program: p.program || '',
      status: p.status,
      timestamp: p.timestamp,
      deviceId: p.deviceId || '',
    })), [studentPins])
  const source = useMemo(() => ({
    html: html(
      initialMapProps.current.latitude,
      initialMapProps.current.longitude,
      initialMapProps.current.radius,
      !!interactive,
      isDark,
      initialMapProps.current.studentPins,
    ),
  }), [interactive, isDark])

  const syncMap = useCallback((view: WebView | null) => {
    view?.injectJavaScript(`
      update(${latitude}, ${longitude}, ${radius});
      updatePins(${JSON.stringify(pinsData)});
      true;
    `)
  }, [latitude, longitude, radius, pinsData])

  useEffect(() => {
    syncMap(webRef.current)
    syncMap(fullscreenWebRef.current)
  }, [syncMap])

  useEffect(() => {
    if (recenterSignal) {
      const next = latestLocation.current
      const script = `map.panTo([${next.latitude}, ${next.longitude}]); true;`
      webRef.current?.injectJavaScript(script)
      fullscreenWebRef.current?.injectJavaScript(script)
    }
  }, [recenterSignal])

  const measureSlider = useCallback(() => {
    sliderRef.current?.measureInWindow((x) => {
      if (x != null) sliderLeftRef.current = x
    })
  }, [])

  const handleMessage = useCallback((event: { nativeEvent: { data: string } }) => {
    try {
      const { lat, lng } = JSON.parse(event.nativeEvent.data)
      onLocationChange?.(parseFloat(lat), parseFloat(lng))
    } catch {}
  }, [onLocationChange])

  const handleSliderTouch = useCallback((pageX: number) => {
    if (sliderWidthRef.current === 0) return
    const relativeX = pageX - sliderLeftRef.current
    const fraction = Math.max(0, Math.min(1, relativeX / sliderWidthRef.current))
    const newRadius = Math.round(10 + fraction * 190)
    onRadiusChange?.(Math.round(newRadius / 5) * 5)
  }, [onRadiusChange])

  const mapWebView = () => (
    <WebView
      ref={webRef}
      accessible
      accessibilityLabel={interactive ? 'Interactive geofence map' : 'Session geofence map'}
      source={source}
      style={styles.webview}
      scrollEnabled={false}
      bounces={false}
      onMessage={handleMessage}
      onLoadEnd={() => syncMap(webRef.current)}
      javaScriptEnabled
      domStorageEnabled
      originWhitelist={['*']}
      androidLayerType="software"
      userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
    />
  )

  return (
    <>
      <View style={styles.wrapper}>
        <View style={[styles.mapContainer, isDark && styles.mapContainerDark]}>
          {mapWebView()}
          {interactive && (
            <TouchableOpacity
              style={styles.fullscreenBtn}
              onPress={() => setFullscreen(true)}
              accessibilityRole="button"
              accessibilityLabel="Full screen map"
            >
              <MaterialIcons name="fullscreen" size={20} color="#FFF" />
            </TouchableOpacity>
          )}
          {!interactive && studentPins.length === 0 && (
            <View style={styles.overlay} pointerEvents="none">
              <Text style={styles.overlayCoords}>{latitude.toFixed(4)}, {longitude.toFixed(4)}</Text>
              <Text style={styles.overlayRadius}>{radius}m geofence</Text>
            </View>
          )}
          {!interactive && studentPins.length > 0 && (
            <View style={styles.legendOverlay} pointerEvents="none">
              <Text style={styles.legendText}>
                <Text style={{color: '#22C55E'}}>●</Text> Present{'  '}
                <Text style={{color: '#FFDF00'}}>●</Text> Late{'  '}
                <Text style={{color: '#EF4444'}}>●</Text> Absent{'  '}
                <Text style={{color: '#9CA3AF'}}>●</Text> Pending
              </Text>
            </View>
          )}
        </View>

        {interactive && (
          <>
            <View style={[styles.hintRow, isDark && styles.hintRowDark]}>
              <MaterialIcons name="touch-app" size={14} color={isDark ? '#FFDF00' : '#888'} />
              <Text style={[styles.hintText, isDark && styles.hintTextDark]}>Drag the pin or tap the map to set location</Text>
            </View>

            <View style={styles.radiusSection}>
              <Text style={[styles.radiusLabel, isDark && styles.radiusLabelDark]}>
                Geofence Radius: <Text style={[styles.radiusValue, isDark && styles.radiusValueDark]}>{radius}m</Text>
              </Text>
              <View
                ref={sliderRef}
                style={styles.sliderTrack}
                accessible
                accessibilityRole="adjustable"
                accessibilityLabel="Geofence radius"
                accessibilityValue={{ min: 10, max: 200, now: radius, text: `${radius} meters` }}
                accessibilityActions={[{ name: 'increment', label: 'Increase radius' }, { name: 'decrement', label: 'Decrease radius' }]}
                onAccessibilityAction={(event) => {
                  const nextRadius = event.nativeEvent.actionName === 'increment'
                    ? Math.min(200, radius + 10)
                    : Math.max(10, radius - 10)
                  onRadiusChange?.(nextRadius)
                }}
                onLayout={(e) => {
                  sliderWidthRef.current = e.nativeEvent.layout.width
                  measureSlider()
                }}
                onStartShouldSetResponder={() => true}
                onMoveShouldSetResponder={() => true}
                onResponderGrant={(e) => handleSliderTouch(e.nativeEvent.pageX)}
                onResponderMove={(e) => handleSliderTouch(e.nativeEvent.pageX)}
              >
                <View style={[styles.sliderTrackLine, isDark && styles.sliderTrackLineDark]} />
                <View style={[styles.sliderFill, { width: `${((radius - 10) / 190) * 100}%` }, isDark && styles.sliderFillDark]} />
                <View style={[styles.sliderThumb, { left: `${((radius - 10) / 190) * 100}%` }, isDark && styles.sliderThumbDark]} />
              </View>
              <View style={styles.sliderEndLabels}>
                <Text style={[styles.sliderEndLabel, isDark && styles.sliderEndLabelDark]}>10m</Text>
                <Text style={[styles.sliderEndLabel, isDark && styles.sliderEndLabelDark]}>200m</Text>
              </View>
            </View>
          </>
        )}
      </View>

      {fullscreen && (
        <Modal visible transparent animationType="fade" onRequestClose={() => setFullscreen(false)}>
          <View style={[styles.fsOverlay, isDark && styles.fsOverlayDark]}>
            <View style={[styles.fsHeader, isDark && styles.fsHeaderDark]}>
              <TouchableOpacity onPress={() => setFullscreen(false)} style={styles.fsCloseBtn} accessibilityRole="button" accessibilityLabel="Close full screen map">
                <MaterialIcons name="close" size={24} color={isDark ? '#FFDF00' : '#7B1113'} />
              </TouchableOpacity>
              <Text style={[styles.fsTitle, isDark && styles.textWhite]}>Set Location</Text>
              <View style={{ width: 40 }} />
            </View>
            <View style={styles.fsMapContainer}>
              <WebView
                ref={fullscreenWebRef}
                accessible
                accessibilityLabel="Full-screen interactive geofence map"
                source={source}
                style={styles.webview}
                scrollEnabled={false}
                bounces={false}
                onMessage={handleMessage}
                onLoadEnd={() => syncMap(fullscreenWebRef.current)}
                javaScriptEnabled
                domStorageEnabled
                originWhitelist={['*']}
                androidLayerType="software"
                userAgent="Mozilla/5.0 (Linux; Android 10; Mobile) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36"
              />
            </View>
            <View style={[styles.fsCoords, isDark && styles.fsCoordsDark]}>
              <MaterialIcons name="location-on" size={16} color="#FFDF00" />
              <Text style={[styles.fsCoordsText, isDark && styles.textWhite]}>{latitude.toFixed(6)}, {longitude.toFixed(6)}</Text>
            </View>
          </View>
        </Modal>
      )}
    </>
  )
}

const styles = StyleSheet.create({
  wrapper: { marginBottom: 8 },
  mapContainer: { height: 280, borderWidth: 1, borderColor: '#DDD', overflow: 'hidden' },
  mapContainerDark: { borderColor: 'rgba(245, 168, 0, 0.15)' },
  webview: { flex: 1, backgroundColor: 'transparent' },
  fullscreenBtn: {
    position: 'absolute', top: 8, right: 8, zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.6)', width: 36, height: 36,
    alignItems: 'center', justifyContent: 'center',
  },
  overlay: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
  },
  overlayCoords: { color: '#FFF', fontSize: 14, fontFamily: fonts.mono, fontWeight: '600' },
  overlayRadius: { color: 'rgba(255,255,255,0.7)', fontSize: 12, fontFamily: fonts.body, marginTop: 2 },
  legendOverlay: {
    position: 'absolute', bottom: 8, left: 0, right: 0,
    alignItems: 'center',
  },
  legendText: {
    fontSize: 11, fontFamily: fonts.body, color: '#FFF',
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 10, paddingVertical: 4,
    overflow: 'hidden',
  },
  hintRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  hintRowDark: {},
  hintText: { fontSize: 12, fontFamily: fonts.body, color: '#999' },
  hintTextDark: { color: 'rgba(255,255,255,0.4)' },
  radiusSection: { marginTop: 16 },
  radiusLabel: { fontSize: 13, fontFamily: fonts.bodyMedium, color: '#666', marginBottom: 8 },
  radiusLabelDark: { color: 'rgba(255,255,255,0.5)' },
  radiusValue: { fontFamily: fonts.bodyBold, color: '#7B1113' },
  radiusValueDark: { color: '#FFDF00' },
  sliderTrack: {
    height: 32,
    justifyContent: 'center',
    position: 'relative',
  },
  sliderTrackLine: {
    height: 4,
    backgroundColor: '#E0E0E0',
    borderRadius: 2,
    position: 'absolute',
    left: 0,
    right: 0,
    top: 14,
  },
  sliderTrackLineDark: {
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  sliderFill: {
    height: 4,
    backgroundColor: '#7B1113',
    borderRadius: 2,
    position: 'absolute',
    left: 0,
    top: 14,
  },
  sliderFillDark: {
    backgroundColor: '#FFDF00',
  },
  sliderThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#7B1113',
    position: 'absolute',
    top: 4,
    marginLeft: -12,
    borderWidth: 3,
    borderColor: '#FFF',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  sliderThumbDark: {
    backgroundColor: '#FFDF00',
    borderColor: '#121215',
  },
  sliderEndLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: -4,
  },
  sliderEndLabel: { fontSize: 11, fontFamily: fonts.body, color: '#999' },
  sliderEndLabelDark: { color: 'rgba(255,255,255,0.4)' },

  // Fullscreen styles
  fsOverlay: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  fsOverlayDark: {
    backgroundColor: '#0A0A0C',
  },
  fsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 40,
    paddingBottom: 12,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#EEE',
  },
  fsHeaderDark: {
    backgroundColor: '#0A0A0C',
    borderBottomColor: '#1C1C21',
  },
  fsCloseBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  fsTitle: { fontSize: 17, fontWeight: '600', fontFamily: fonts.bodySemiBold, color: '#1A1A1A' },
  textWhite: { color: '#FFFFFF' },
  fsMapContainer: { flex: 1 },
  fsCoords: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 12,
    backgroundColor: '#FAFAFA',
    borderTopWidth: 1,
    borderTopColor: '#EEE',
  },
  fsCoordsDark: {
    backgroundColor: '#121215',
    borderTopColor: '#1C1C21',
  },
  fsCoordsText: { fontSize: 13, fontFamily: fonts.mono, color: '#333' },
})
