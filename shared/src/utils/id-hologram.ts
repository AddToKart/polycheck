/**
 * Pure helpers for the F3 anti-screenshot hologram layer rendered on every
 * surface that displays a digital student ID card (web + Android parity).
 *
 * The hologram embeds a live, server-clock-correct UTC stamp plus a masked
 * device-binding chip into the card artwork so a screenshot or forwarded
 * photo of the ID can be forensically checked for freshness and provenance:
 * a static image cannot tick its timestamp, and its device chip will not
 * match the verifier's scanner.
 *
 * All functions are pure and shared across platforms — the web overlay and
 * the Android overlay format identical watermark lines.
 */

/**
 * Fixed lead segment of every hologram watermark line.
 */
export const HOLOGRAM_WATERMARK_TEXT = 'PUP-ID-VERIFIED' as const

/**
 * Chip shown when the ID is not bound to a device installation (e.g. the
 * card is being hosted by a plain web cookie session or the field is not
 * yet loaded). Never leaks a partial device id.
 */
export const HOLOGRAM_WEB_SESSION_CHIP = 'WEB-SESSION' as const

/**
 * Masked device chip prefix; the caller appends the last 4 alphanumeric
 * characters of the bound device installation id.
 */
export const HOLOGRAM_DEVICE_CHIP_PREFIX = 'DEVICE-BOUND •·•·' as const

/**
 * Chip used when a device id technically exists but is too short to reveal
 * a 4-character tail without weakening the mask.
 */
export const HOLOGRAM_DEVICE_CHIP_FULL_MASK = 'DEVICE-BOUND •·•·•·' as const

const EPOCH_FALLBACK_STAMP = '1970-01-01 00:00:00'

function pad2(value: number): string {
  return String(value).padStart(2, '0')
}

/**
 * Formats `nowMs` (plus the trusted server-clock offset in milliseconds) as a
 * `YYYY-MM-DD HH:MM:SS` UTC timestamp, zero-padded.
 *
 * UTC getters are used deliberately so the stamp is identical on any device
 * regardless of local timezone, and `offsetMs` shifts the device clock toward
 * the server clock (the offline store's trusted-clock rule). Non-finite input
 * falls back to the Unix epoch rather than producing `NaN-NaN-NaN`.
 */
export function formatLiveUtcStamp(nowMs: number, offsetMs = 0): string {
  if (!Number.isFinite(nowMs) || !Number.isFinite(offsetMs)) {
    return EPOCH_FALLBACK_STAMP
  }
  const date = new Date(nowMs + offsetMs)
  return (
    `${pad2(date.getUTCFullYear())}` +
    `-${pad2(date.getUTCMonth() + 1)}` +
    `-${pad2(date.getUTCDate())}` +
    ` ${pad2(date.getUTCHours())}` +
    `:${pad2(date.getUTCMinutes())}` +
    `:${pad2(date.getUTCSeconds())}`
  )
}

/**
 * Derives the masked device-binding chip for the hologram watermark.
 *
 * - No device id (nullish / empty / whitespace only) → `WEB-SESSION`.
 * - A device id whose alphanumeric content has 4+ characters →
 *   `DEVICE-BOUND •·•·<last4>` (separators are ignored, only an alphanumeric
 *   tail is ever revealed).
 * - Anything shorter → the full mask `DEVICE-BOUND •·•·•·` (including ids
 *   that exist but carry no alphanumeric content), so a weak id can never
 *   leak most of its content.
 *
 * The full device id is never returned, even partially-beyond-tail.
 */
export function maskDeviceChip(deviceId?: string | null): string {
  if (typeof deviceId !== 'string' || deviceId.trim().length === 0) {
    return HOLOGRAM_WEB_SESSION_CHIP
  }
  const alphanumeric = deviceId.replace(/[^A-Za-z0-9]/g, '')
  if (alphanumeric.length < 4) {
    return HOLOGRAM_DEVICE_CHIP_FULL_MASK
  }
  const tail = alphanumeric.slice(-4)
  return `${HOLOGRAM_DEVICE_CHIP_PREFIX}${tail}`
}

/**
 * Assembles one watermark line, e.g.
 * `PUP-ID-VERIFIED • LIVE UTC: 2026-11-02 08:01:14 • DEVICE-BOUND •·•·4F2A`.
 * Rendered repeatedly in a diagonal overlay so every screenshot of the ID
 * carries the stamp within frame.
 */
export function buildWatermarkLine(stamp: string, chip: string): string {
  return `${HOLOGRAM_WATERMARK_TEXT} • LIVE UTC: ${stamp} • ${chip}`
}
