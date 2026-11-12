import 'dart:collection';

/// Mirrors `shared/src/utils/outage-simulator.ts`.
///
/// Arming flips a process-wide flag that the API client consults FIRST inside
/// its request wrapper: every request then fails with the same shape as a real
/// network failure, so all existing downstream paths (offline queue enqueue,
/// error classification, offline banners) behave exactly as in a campus
/// outage. Nothing here touches storage or timers; the store is plain isolate
/// state.
abstract final class OutageSimulator {
  static bool _armed = false;
  static final LinkedHashSet<void Function(bool armed)> _listeners =
      LinkedHashSet<void Function(bool armed)>();

  /// Exact message of the simulated failure thrown by guarded clients.
  static const String simulatedMessage =
      'Simulated network outage (Polycheck simulator)';

  static void _notify() {
    for (final listener in List<void Function(bool)>.of(_listeners)) {
      try {
        listener(_armed);
      } on Object {
        // A broken listener must never wedge the flag store.
      }
    }
  }

  /// Starts simulating a network outage (idempotent).
  static void arm() {
    if (_armed) return;
    _armed = true;
    _notify();
  }

  /// Stops the simulation and lets requests through again (idempotent).
  static void disarm() {
    if (!_armed) return;
    _armed = false;
    _notify();
  }

  static bool get isArmed => _armed;

  /// Subscribes to arm/disarm transitions. Intentionally does NOT fire on
  /// registration: callers seed their own initial state from [isArmed].
  /// Returns an idempotent unsubscribe function.
  static void Function() subscribe(void Function(bool armed) listener) {
    _listeners.add(listener);
    var active = true;
    return () {
      if (!active) return;
      active = false;
      _listeners.remove(listener);
    };
  }

  /// The simulated network failure client guards throw while armed.
  static SimulatedNetworkOutage createFailure() => SimulatedNetworkOutage();

  /// Renders the local receipt chip: `Receipt #104 · a1b2c3d4`.
  static String formatReceipt(int sequence, [String? operationId]) {
    final safeSequence = sequence > 0 ? sequence : 0;
    final prefix = operationId == null
        ? ''
        : operationId.substring(
            0,
            operationId.length < 8 ? operationId.length : 8,
          );
    return prefix.isEmpty
        ? 'Receipt #$safeSequence'
        : 'Receipt #$safeSequence \u00B7 $prefix';
  }
}

/// Error raised by guarded clients while the outage simulator is armed.
final class SimulatedNetworkOutage extends Error {
  @override
  String toString() => OutageSimulator.simulatedMessage;
}
