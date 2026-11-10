/**
 * Formats the device-cooldown countdown: `m:ss` under an hour and `h:mm:ss`
 * at or above one hour. Fractional seconds are rounded up so a live timer
 * never shows `0:00` while the server still considers the cooldown active;
 * non-finite or elapsed values clamp to `0:00`.
 */
export function formatCooldownCountdown(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '0:00'
  const total = Math.ceil(totalSeconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const seconds = total % 60
  if (hours > 0) return `${hours}:${pad(minutes)}:${pad(seconds)}`
  return `${minutes}:${pad(seconds)}`
}

function pad(value: number): string {
  return value.toString().padStart(2, '0')
}
