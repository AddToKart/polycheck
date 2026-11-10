import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AccessibilityInfo,
  Animated,
  Easing,
  StyleSheet,
  Text,
  View,
} from 'react-native'
import type { LayoutChangeEvent } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
// Pure watermark contract lives in the shared package (web + Android parity).
import { buildWatermarkLine, formatLiveUtcStamp, maskDeviceChip } from '@polycheck/shared/utils'
import {
  computeSweepTranslateRange,
  getWatermarkClockOffset,
  HOLOGRAM_MAX_OPACITY,
  HOLOGRAM_PARALLAX_TILT_DEG,
  HOLOGRAM_SWEEP_ANGLE_DEG,
  HOLOGRAM_SWEEP_DURATION_MS,
  HOLOGRAM_SWEEP_WIDTH_RATIO,
  HOLOGRAM_WATERMARK_OPACITY,
  HOLOGRAM_WATERMARK_TICK_MS,
} from '../lib/id-hologram'
import { getServerClockOffset } from '../services/offline-store'
import { pupColors } from '../theme/colors'

/**
 * F3 — Anti-screenshot hologram overlay for the digital ID card
 * (plan/wow-factor-suite-plan.md §2 F3 / WF-LD5).
 *
 * A pointer-transparent layer rendered inside each ID-card face:
 *  - a diagonal golden → transparent → maroon sheen band sweeping every ~5s
 *    (parked as a static sheen when the OS reduce-motion setting is on),
 *  - repeating diagonal watermark rows carrying a live, server-clock-correct
 *    UTC stamp plus the masked device-binding chip, re-rendered every second —
 *    a static screenshot can't tick and its chip won't match the guard's scan.
 *
 * Optional accelerometer parallax (±6° sheen tilt) is resolved through a
 * guarded dynamic require: `expo-sensors` is deliberately NOT a package.json
 * dependency, and Metro compiles non-literal requires to a runtime throw
 * (`dynamicDepsInPackages: 'throwAtRuntime'`), which the catch below turns
 * into the sweep-only fallback — the overlay never crashes without it.
 */

type HologramOverlayProps = {
  /** Dark tone renders golden-on-maroon; light renders maroon-on-white. */
  isDark: boolean
  /** Bound installation id — only its last 4 characters are ever rendered. */
  deviceId?: string | null
}

type AccelerometerListener = (event: { x: number; y: number; z: number }) => void

type AccelerometerModule = {
  addListener?: (listener: AccelerometerListener) => { remove: () => void }
  setUpdateInterval?: (intervalMs: number) => void
}

const E2E_MODE = process.env.EXPO_PUBLIC_E2E_MODE === 'true'

// Nominal card size used until the first onLayout fires (a card is 1.586:1).
const DEFAULT_CARD_WIDTH = 360
const DEFAULT_CARD_HEIGHT = 227
// Vertical watermark rhythm: gap between rows plus one row's estimated height.
const WATERMARK_ROW_GAP = 24
const WATERMARK_ROW_HEIGHT_ESTIMATE = 12
const WATERMARK_ROW_PITCH = WATERMARK_ROW_GAP + WATERMARK_ROW_HEIGHT_ESTIMATE
// Throttle for accelerometer-driven tilt updates.
const PARALLAX_MIN_INTERVAL_MS = 50

let accelerometerModule: AccelerometerModule | null = null
try {
  // Non-literal specifier on purpose: Metro statically resolves literal
  // `require('expo-sensors')` and would fail the whole bundle while the
  // optional package is absent. A variable specifier compiles to a runtime
  // throw, which is caught here and degrades to sweep-only.
  const sensorModuleId = 'expo-sensors'
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const sensors = require(sensorModuleId) as { Accelerometer?: AccelerometerModule } | undefined
  accelerometerModule = sensors?.Accelerometer ?? null
} catch {
  accelerometerModule = null
} finally {
  if (!accelerometerModule) {
    // Logged once per app session (module scope evaluates a single time).
    if (__DEV__) {
      console.debug(
        '[polycheck:hologram] expo-sensors unavailable — accelerometer parallax disabled (sweep-only)',
      )
    }
  }
}

/** Token-derived rgba string so no raw hex appears outside `theme/colors.ts`. */
const withAlpha = (hex: string, alpha: number): string => {
  const value = hex.replace('#', '')
  const red = parseInt(value.slice(0, 2), 16)
  const green = parseInt(value.slice(2, 4), 16)
  const blue = parseInt(value.slice(4, 6), 16)
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`
}

export function HologramOverlay({ isDark, deviceId }: HologramOverlayProps) {
  const [cardSize, setCardSize] = useState({
    width: DEFAULT_CARD_WIDTH,
    height: DEFAULT_CARD_HEIGHT,
  })
  const [reduceMotion, setReduceMotion] = useState(false)
  const [offsetMs, setOffsetMs] = useState(0)
  const [nowMs, setNowMs] = useState(() => Date.now())

  const sweep = useRef(new Animated.Value(0)).current
  const tilt = useRef(new Animated.Value(0)).current

  const handleLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout
    if (width <= 0 || height <= 0) return
    setCardSize((current) =>
      current.width === width && current.height === height ? current : { width, height },
    )
  }

  // OS reduce-motion: checked on mount and followed live, so the sweep stops
  // the moment the user enables the accessibility setting.
  useEffect(() => {
    let active = true
    AccessibilityInfo.isReduceMotionEnabled()
      .then((enabled) => {
        if (active) setReduceMotion(enabled)
      })
      .catch(() => {
        /* Default to animated; the query is best-effort. */
      })
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion)
    return () => {
      active = false
      subscription.remove()
    }
  }, [])

  // Trusted clock: the cached /health offset is read once; the 1 Hz tick then
  // stamps locally with `Date.now() + offset` (never the raw device clock).
  useEffect(() => {
    let active = true
    getWatermarkClockOffset(getServerClockOffset).then((offset) => {
      if (active) setOffsetMs(offset)
    })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), HOLOGRAM_WATERMARK_TICK_MS)
    return () => clearInterval(timer)
  }, [])

  // Diagonal sheen sweep: one linear left→right pass every ~5s. The loop's
  // instant reset lands while the band is off-card, so the sweep is seamless.
  // Fully disabled under reduce-motion — the band parks centered (static sheen).
  useEffect(() => {
    if (reduceMotion) return
    const animation = Animated.loop(
      Animated.timing(sweep, {
        toValue: 1,
        duration: HOLOGRAM_SWEEP_DURATION_MS,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    )
    animation.start()
    return () => animation.stop()
  }, [reduceMotion, sweep])

  // Optional accelerometer parallax: tilts the sheen plane ±6° with device
  // tilt. Disabled under reduce-motion and in E2E mode; skipped entirely when
  // the module is absent (sweep-only). Unsubscribed on unmount.
  useEffect(() => {
    if (!accelerometerModule?.addListener || reduceMotion || E2E_MODE) return
    let subscription: { remove: () => void } | null = null
    let lastUpdate = 0
    try {
      accelerometerModule.setUpdateInterval?.(100)
      subscription = accelerometerModule.addListener(({ x }) => {
        const timestamp = Date.now()
        if (timestamp - lastUpdate < PARALLAX_MIN_INTERVAL_MS) return
        lastUpdate = timestamp
        tilt.setValue(Math.max(-1, Math.min(1, x)))
      })
    } catch {
      // Native sensor module missing in this build — sweep-only, never crash.
      subscription = null
    }
    return () => subscription?.remove()
  }, [reduceMotion, tilt])

  const watermarkLine = useMemo(
    () => buildWatermarkLine(formatLiveUtcStamp(nowMs + offsetMs), maskDeviceChip(deviceId)),
    [nowMs, offsetMs, deviceId],
  )

  const { width: cardWidth, height: cardHeight } = cardSize
  const angleRad = (HOLOGRAM_SWEEP_ANGLE_DEG * Math.PI) / 180
  const bandWidth = Math.max(1, cardWidth * HOLOGRAM_SWEEP_WIDTH_RATIO)
  const diagonal = Math.sqrt(cardWidth * cardWidth + cardHeight * cardHeight)
  // The band is taller than the card so its rotated corners still cover it.
  const bandHeight = diagonal * 1.25
  const bandTop = (cardHeight - bandHeight) / 2
  // Horizontal footprint a rotated band gains beyond its unrotated rectangle.
  const bandOverhang = (bandWidth * (1 - Math.cos(angleRad)) + bandHeight * Math.sin(angleRad)) / 2 + 8

  const [sweepStart, sweepEnd] = computeSweepTranslateRange(
    cardWidth,
    bandWidth,
    bandOverhang,
    reduceMotion,
  )
  const sweepTranslate = sweep.interpolate({ inputRange: [0, 1], outputRange: [sweepStart, sweepEnd] })
  const tiltRotate = tilt.interpolate({
    inputRange: [-1, 1],
    outputRange: [`-${HOLOGRAM_PARALLAX_TILT_DEG}deg`, `${HOLOGRAM_PARALLAX_TILT_DEG}deg`],
  })

  // Gold edge → transparent middle → maroon edge, along the band's own axis.
  const sweepColors: [string, string, string] = isDark
    ? [
        withAlpha(pupColors.golden, 0.16),
        'transparent',
        withAlpha(pupColors.maroonDark, 0.24),
      ]
    : [
        withAlpha(pupColors.golden, 0.2),
        'transparent',
        withAlpha(pupColors.maroon, 0.12),
      ]

  // The watermark field is sized to the card's rotated bounding box so its
  // rows cover every corner once the field itself is rotated by the sweep angle.
  const fieldWidth = cardWidth * Math.cos(angleRad) + cardHeight * Math.sin(angleRad) + 16
  const fieldHeight = cardWidth * Math.sin(angleRad) + cardHeight * Math.cos(angleRad) + 16
  const rowCount = Math.min(24, Math.ceil(fieldHeight / WATERMARK_ROW_PITCH) + 1)
  const rows = Array.from({ length: rowCount }, (_, index) => (
    <Text
      key={index}
      numberOfLines={1}
      className="font-sans-bold text-[7px] uppercase tracking-[1px] text-maroon dark:text-golden"
    >
      {watermarkLine}
    </Text>
  ))

  return (
    <View
      pointerEvents="none"
      className="absolute inset-0 overflow-hidden"
      accessible={false}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      onLayout={handleLayout}
    >
      <Animated.View style={[StyleSheet.absoluteFill, { transform: [{ rotate: tiltRotate }] }]}>
        <Animated.View
          style={[
            styles.band,
            {
              top: bandTop,
              width: bandWidth,
              height: bandHeight,
              transform: [{ translateX: sweepTranslate }],
            },
          ]}
        >
          <LinearGradient
            style={StyleSheet.absoluteFill}
            start={{ x: 0, y: 0.5 }}
            end={{ x: 1, y: 0.5 }}
            colors={sweepColors}
          />
        </Animated.View>
      </Animated.View>
      <View
        style={[
          styles.watermarkField,
          {
            left: (cardWidth - fieldWidth) / 2,
            top: (cardHeight - fieldHeight) / 2,
            width: fieldWidth,
            height: fieldHeight,
            transform: [{ rotate: `${HOLOGRAM_SWEEP_ANGLE_DEG}deg` }],
          },
        ]}
      >
        {rows}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  band: {
    position: 'absolute',
    left: 0,
  },
  watermarkField: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
    rowGap: WATERMARK_ROW_GAP,
    opacity: Math.min(HOLOGRAM_WATERMARK_OPACITY, HOLOGRAM_MAX_OPACITY),
  },
})
