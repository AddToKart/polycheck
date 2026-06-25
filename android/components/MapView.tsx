import { useRef, useCallback, useEffect, useState } from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native'
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

function html(lat: number, lng: number, radius: number, interactive: boolean, isDark: boolean) {
  const accentColor = isDark ? '#FFDF00' : '#7B1113'
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
  ${isDark ? `
  .leaflet-container {
    background: #0A0A0C !important;
  }
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

  L.tileLayer(tileUrl, {
    maxZoom: 19
  }).addTo(map);

  var marker = L.marker([${lat}, ${lng}], {
    draggable: ${interactive}
  }).addTo(map);

  var circle = L.circle([${lat}, ${lng}], {
    radius: ${radius},
    color: '${accentColor}',
    fillColor: '${accentColor}',
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

export default function MapView({ latitude, longitude, radius, interactive, onLocationChange, onRadiusChange }: MapViewProps) {
  const { isDark } = useTheme()
  const webRef = useRef<WebView>(null)
  const prevRadiusRef = useRef(radius)
  const [fullscreen, setFullscreen] = useState(false)
  const sliderRef = useRef<View>(null)
  const sliderWidthRef = useRef(0)
  const sliderLeftRef = useRef(0)

  useEffect(() => {
    if (prevRadiusRef.current !== radius && webRef.current) {
      webRef.current.injectJavaScript(`
        update(${latitude}, ${longitude}, ${radius});
        true;
      `)
      prevRadiusRef.current = radius
    }
  }, [radius, latitude, longitude])

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
      source={{ html: html(latitude, longitude, radius, !!interactive, isDark) }}
      style={styles.webview}
      scrollEnabled={false}
      bounces={false}
      onMessage={handleMessage}
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
              accessibilityLabel="Full screen map"
            >
              <MaterialIcons name="fullscreen" size={20} color="#FFF" />
            </TouchableOpacity>
          )}
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
              <TouchableOpacity onPress={() => setFullscreen(false)} style={styles.fsCloseBtn} accessibilityLabel="Close full screen map">
                <MaterialIcons name="close" size={24} color={isDark ? '#FFDF00' : '#7B1113'} />
              </TouchableOpacity>
              <Text style={[styles.fsTitle, isDark && styles.textWhite]}>Set Location</Text>
              <View style={{ width: 40 }} />
            </View>
            <View style={styles.fsMapContainer}>
              <WebView
                source={{ html: html(latitude, longitude, radius, !!interactive, isDark) }}
                style={styles.webview}
                scrollEnabled={false}
                bounces={false}
                onMessage={handleMessage}
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
