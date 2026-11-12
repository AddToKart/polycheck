import '../../../core/utils/outage_simulator.dart';

/// Strict outage-simulator build gate.
///
/// Only `--dart-define=ENABLE_OUTAGE_SIMULATOR=true` enables the dev tools;
/// production builds keep the default `false` exactly like the Android
/// `EXPO_PUBLIC_ENABLE_OUTAGE_SIMULATOR` opt-in.
abstract final class OutageDemo {
  static const bool enabled = bool.fromEnvironment(
    'ENABLE_OUTAGE_SIMULATOR',
    defaultValue: false,
  );

  /// Strict parser mirrored by tests (only the exact string `true`).
  static bool parseFlag(String? value) => value == 'true';

  static bool get armed => OutageSimulator.isArmed;

  static void arm() => OutageSimulator.arm();

  static void disarm() => OutageSimulator.disarm();

  /// Network-shaped failure used by the surface-owned Dio interceptor.
  static SimulatedNetworkOutage createFailure() =>
      OutageSimulator.createFailure();

  static void Function() subscribe(void Function(bool armed) listener) =>
      OutageSimulator.subscribe(listener);

  static String receipt(int sequence, [String? operationId]) =>
      OutageSimulator.formatReceipt(sequence, operationId);

  static const String armedCopy =
      'Requests fail immediately and existing offline paths handle the '
      'failure exactly like a real campus outage.';
  static const String disarmedCopy =
      'Requests pass through to the Polycheck API again.';
  static const String replayNotice =
      'Reconnect simulated. Attendance saved on this device will sync when '
      'the offline sync worker next drains the queue.';
}
