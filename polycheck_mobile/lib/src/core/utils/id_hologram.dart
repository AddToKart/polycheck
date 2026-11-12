/// Mirrors `shared/src/utils/id-hologram.ts`.
///
/// The hologram embeds a live, server-clock-correct UTC stamp plus a masked
/// device-binding chip into the ID card artwork so a screenshot can be
/// forensically checked for freshness and provenance.
const String hologramWatermarkText = 'PUP-ID-VERIFIED';

/// Chip shown when the ID is not bound to a device installation.
const String hologramWebSessionChip = 'WEB-SESSION';

/// Masked device chip prefix; the caller appends the last 4 alphanumeric
/// characters of the bound device installation id.
const String hologramDeviceChipPrefix = 'DEVICE-BOUND \u2022\u00B7\u2022\u00B7';

/// Chip used when a device id exists but is too short to reveal a safe tail.
const String hologramDeviceChipFullMask =
    'DEVICE-BOUND \u2022\u00B7\u2022\u00B7\u2022\u00B7';

const String _epochFallbackStamp = '1970-01-01 00:00:00';

String _pad2(int value) => value.toString().padLeft(2, '0');

/// Formats `nowMs` (+ trusted server offset) as `YYYY-MM-DD HH:MM:SS` UTC.
///
/// Non-finite input falls back to the Unix epoch rather than producing
/// `NaN-NaN-NaN`.
String formatLiveUtcStamp(num nowMs, [num offsetMs = 0]) {
  if (!nowMs.isFinite || !offsetMs.isFinite) return _epochFallbackStamp;
  final date = DateTime.fromMillisecondsSinceEpoch(
    (nowMs + offsetMs).round(),
    isUtc: true,
  );
  return '${date.year.toString().padLeft(4, '0')}'
      '-${_pad2(date.month)}'
      '-${_pad2(date.day)}'
      ' ${_pad2(date.hour)}'
      ':${_pad2(date.minute)}'
      ':${_pad2(date.second)}';
}

/// Derives the masked device-binding chip for the hologram watermark.
///
/// - No device id (nullish / empty / whitespace only) → `WEB-SESSION`.
/// - 4+ alphanumeric characters → `DEVICE-BOUND •·•·<last4>`.
/// - Anything shorter → the full mask, so a weak id can never leak.
///
/// The full device id is never returned, even partially beyond the tail.
String maskDeviceChip(String? deviceId) {
  if (deviceId == null || deviceId.trim().isEmpty) {
    return hologramWebSessionChip;
  }
  final alphanumeric = deviceId.replaceAll(RegExp('[^A-Za-z0-9]'), '');
  if (alphanumeric.length < 4) return hologramDeviceChipFullMask;
  final tail = alphanumeric.substring(alphanumeric.length - 4);
  return '$hologramDeviceChipPrefix$tail';
}

/// Assembles one watermark line, e.g.
/// `PUP-ID-VERIFIED • LIVE UTC: 2026-11-02 08:01:14 • DEVICE-BOUND •·•·4F2A`.
String buildWatermarkLine(String stamp, String chip) =>
    '$hologramWatermarkText \u2022 LIVE UTC: $stamp \u2022 $chip';
