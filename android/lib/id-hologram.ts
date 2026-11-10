/**
 * Android-side helpers for the F3 anti-screenshot hologram overlay
 * (plan/wow-factor-suite-plan.md §2 F3 / WF-LD5).
 *
 * RECONCILIATION: the pure contract functions (`formatLiveUtcStamp`,
 * `maskDeviceChip`, `buildWatermarkLine`) now live in
 * `shared/src/utils/id-hologram.ts` and are imported from
 * `@polycheck/shared/utils` — this file no longer mirrors them. What remains
 * here is Android-only: the sweep/watermark tuning constants (the shared
 * module ships no sweep-style constants), the reduce-motion sweep range
 * calculator, and the trusted-clock offset resolver used by
 * `components/HologramOverlay.tsx`.
 */

/** Sweep band width as a fraction of the card width (~34%). */
export const HOLOGRAM_SWEEP_WIDTH_RATIO = 0.34
/** Diagonal tilt shared by the sweep band and the watermark rows, in degrees. */
export const HOLOGRAM_SWEEP_ANGLE_DEG = 22
/** One full left→right sweep pass, in milliseconds (~5s). */
export const HOLOGRAM_SWEEP_DURATION_MS = 5000
/** Whole-overlay opacity ceiling so the photo/QR stay dominant. */
export const HOLOGRAM_MAX_OPACITY = 0.35
/** Watermark layer opacity (must stay ≤ HOLOGRAM_MAX_OPACITY). */
export const HOLOGRAM_WATERMARK_OPACITY = 0.32
/** Watermark clock tick, in milliseconds (1 Hz). */
export const HOLOGRAM_WATERMARK_TICK_MS = 1000
/** Accelerometer sheen tilt clamp, in degrees (±6°). */
export const HOLOGRAM_PARALLAX_TILT_DEG = 6

/**
 * Sweep band travel range, in pixels, for the card's measured size.
 *
 * Motionless (reduce-motion) fallback parks the band centered so the card
 * keeps a static sheen; the animated range starts fully off the left edge and
 * ends fully off the right edge — `bandOverhang` covers the horizontal
 * footprint a rotated band gains beyond its unrotated rectangle, so the loop's
 * instant reset always happens while the band is off-card (seamless sweep).
 */
export function computeSweepTranslateRange(
  cardWidth: number,
  bandWidth: number,
  bandOverhang: number,
  reduceMotion: boolean,
): [number, number] {
  if (reduceMotion) {
    const center = Math.max(0, (cardWidth - bandWidth) / 2)
    return [center, center]
  }
  return [-(bandWidth + bandOverhang), cardWidth + bandOverhang]
}

/** Async reader shaped like `services/offline-store`'s `getServerClockOffset`. */
export type ServerClockOffsetReader = () => Promise<number | null>

/**
 * Resolves the watermark's trusted-clock offset: the cached server clock
 * offset when available and finite, otherwise 0 (device-clock fallback).
 * Never rejects — a failed cache read must not break the hologram.
 */
export async function getWatermarkClockOffset(
  readOffset: ServerClockOffsetReader,
): Promise<number> {
  try {
    const offset = await readOffset()
    return typeof offset === 'number' && Number.isFinite(offset) ? offset : 0
  } catch {
    return 0
  }
}
