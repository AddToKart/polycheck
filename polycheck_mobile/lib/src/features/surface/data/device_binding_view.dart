import '../../../core/utils/cooldown.dart';

/// Device-binding presentation helpers (trusted-clock driven).
class DeviceCooldownStatus {
  const DeviceCooldownStatus({
    required this.active,
    required this.countdown,
    required this.exempt,
    this.until,
  });

  final bool active;
  final String countdown;

  /// True when this installation is the one allowed to sign in during the
  /// cooldown window.
  final bool exempt;
  final DateTime? until;
}

DeviceCooldownStatus deviceCooldownStatus({
  required DateTime now,
  String? cooldownUntil,
  String? cooldownDeviceId,
  String? currentDeviceId,
}) {
  final until = cooldownUntil == null || cooldownUntil.isEmpty
      ? null
      : DateTime.tryParse(cooldownUntil)?.toUtc();
  final remaining = until == null ? Duration.zero : until.difference(now);
  final active = remaining > Duration.zero;
  final exempt =
      active &&
      cooldownDeviceId != null &&
      cooldownDeviceId.isNotEmpty &&
      currentDeviceId != null &&
      cooldownDeviceId == currentDeviceId;

  return DeviceCooldownStatus(
    active: active,
    countdown: active
        ? formatCooldownCountdown(remaining.inMilliseconds / 1000)
        : '0:00',
    exempt: exempt,
    until: until,
  );
}

/// Short device chip: the last six characters of the installation id.
String boundDeviceLabel(String deviceId) {
  final trimmed = deviceId.trim();
  if (trimmed.isEmpty) return 'No device bound';
  final tail = trimmed.length <= 6
      ? trimmed
      : trimmed.substring(trimmed.length - 6);
  return 'Android device \u00b7 .$tail';
}
