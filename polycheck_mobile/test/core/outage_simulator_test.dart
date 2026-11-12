import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/utils/outage_simulator.dart';

void main() {
  tearDown(OutageSimulator.disarm);

  group('outage-simulator flag store', () {
    test('starts disarmed', () {
      expect(OutageSimulator.isArmed, isFalse);
    });

    test('arm/disarm toggles the flag and notifies subscribers', () {
      final transitions = <bool>[];
      final unsubscribe = OutageSimulator.subscribe(transitions.add);

      OutageSimulator.arm();
      expect(OutageSimulator.isArmed, isTrue);

      OutageSimulator.disarm();
      expect(OutageSimulator.isArmed, isFalse);

      expect(transitions, [true, false]);
      unsubscribe();
    });

    test('duplicate arm/disarm stay idempotent and never re-notify', () {
      var calls = 0;
      final transitions = <bool>[];
      final unsubscribe = OutageSimulator.subscribe((armed) {
        calls += 1;
        transitions.add(armed);
      });

      OutageSimulator.arm();
      OutageSimulator.arm();
      OutageSimulator.disarm();
      OutageSimulator.disarm();

      expect(calls, 2);
      expect(transitions, [true, false]);
      unsubscribe();
    });

    test('unsubscribe stops notifications and is idempotent', () {
      var calls = 0;
      final unsubscribe = OutageSimulator.subscribe((_) => calls += 1);
      unsubscribe();
      unsubscribe();
      OutageSimulator.arm();
      OutageSimulator.disarm();
      expect(calls, 0);
    });

    test('isolates listeners: a throwing subscriber cannot break others', () {
      var goodCalls = 0;
      final unsubscribeBad = OutageSimulator.subscribe((_) {
        throw StateError('listener blew up');
      });
      final unsubscribeGood = OutageSimulator.subscribe((_) => goodCalls += 1);

      OutageSimulator.arm();

      expect(goodCalls, 1);
      unsubscribeBad();
      unsubscribeGood();
    });

    test('the simulated failure carries the contractual message', () {
      final failure = OutageSimulator.createFailure();
      expect(failure, isA<SimulatedNetworkOutage>());
      expect(failure.toString(), OutageSimulator.simulatedMessage);
      expect(
        OutageSimulator.simulatedMessage,
        contains('Simulated network outage'),
      );
    });
  });

  group('formatReceipt', () {
    test('renders queue position plus the first 8 characters', () {
      expect(
        OutageSimulator.formatReceipt(104, 'a1b2c3d4-19f7-4a0e'),
        'Receipt #104 \u00B7 a1b2c3d4',
      );
    });

    test('truncates ids to 8 characters', () {
      expect(
        OutageSimulator.formatReceipt(3, 'a1b2c3d4e5f6'),
        'Receipt #3 \u00B7 a1b2c3d4',
      );
    });

    test('falls back to Receipt #0 with no prefix when empty', () {
      expect(OutageSimulator.formatReceipt(0), 'Receipt #0');
      expect(OutageSimulator.formatReceipt(0, ''), 'Receipt #0');
      expect(OutageSimulator.formatReceipt(-5), 'Receipt #0');
    });
  });
}
