import '../models/session.dart';

/// Compile-time opt-in for non-camera QR check-in in **in-person** classes.
///
/// Mirrors the React Native policy (`EXPO_PUBLIC_ALLOW_QR_FALLBACKS`):
/// enable with `--dart-define=ALLOW_QR_FALLBACKS=true`. Default is `false`.
const bool qrFallbacksOptIn = bool.fromEnvironment(
  'ALLOW_QR_FALLBACKS',
  defaultValue: false,
);

/// Whether a non-camera channel (uploaded image / manual entry) may be used.
///
/// Online checkpoints carry no geofence/location evidence, so image upload is
/// always available for them (the compliance field already ships screenshot
/// fallbacks on Android). In-person sessions keep the hardened opt-in default.
bool shouldShowScanFallbacks(
  SessionMode mode, {
  bool? inPersonFallbackEnabled,
}) {
  final enabled = inPersonFallbackEnabled ?? qrFallbacksOptIn;
  return mode == SessionMode.online || enabled;
}
