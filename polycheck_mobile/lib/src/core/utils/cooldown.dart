/// Mirrors `shared/src/utils/device-integrity.ts`.
///
/// Formats the device-cooldown countdown: `m:ss` under an hour and `h:mm:ss`
/// at or above one hour. Fractional seconds are rounded up so a live timer
/// never shows `0:00` while the server still considers the cooldown active;
/// non-finite or elapsed values clamp to `0:00`.
String formatCooldownCountdown(num totalSeconds) {
  if (!totalSeconds.isFinite || totalSeconds <= 0) return '0:00';
  final total = totalSeconds.ceil();
  final hours = total ~/ 3600;
  final minutes = (total % 3600) ~/ 60;
  final seconds = total % 60;
  if (hours > 0) return '$hours:${_pad(minutes)}:${_pad(seconds)}';
  return '$minutes:${_pad(seconds)}';
}

String _pad(int value) => value.toString().padLeft(2, '0');
