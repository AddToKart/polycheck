import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/features/surface/data/device_binding_view.dart';

void main() {
  group('device cooldown presentation', () {
    final now = DateTime.utc(2026, 11, 10, 12);

    test('renders a live trusted-clock countdown', () {
      final status = deviceCooldownStatus(
        now: now,
        cooldownUntil: '2026-11-10T12:01:30.000Z',
      );
      expect(status.active, isTrue);
      expect(status.countdown, '1:30');
      expect(status.exempt, isFalse);
    });

    test('elapsed cooldowns are inactive and clamp to 0:00', () {
      final status = deviceCooldownStatus(
        now: now,
        cooldownUntil: '2026-11-10T11:00:00.000Z',
      );
      expect(status.active, isFalse);
      expect(status.countdown, '0:00');
    });

    test('marks the exempt installation during a cooldown', () {
      final status = deviceCooldownStatus(
        now: now,
        cooldownUntil: '2026-11-10T14:00:00.000Z',
        cooldownDeviceId: 'mobile-abc',
        currentDeviceId: 'mobile-abc',
      );
      expect(status.active, isTrue);
      expect(status.exempt, isTrue);
      expect(status.countdown, '2:00:00');
    });

    test('missing cooldown rows never fake a countdown', () {
      final status = deviceCooldownStatus(now: now);
      expect(status.active, isFalse);
      expect(status.exempt, isFalse);
      expect(status.countdown, '0:00');
    });

    test('bound device labels expose only the tail', () {
      expect(boundDeviceLabel('mobile-0123456789abcdef'), contains('.abcdef'));
      expect(boundDeviceLabel('  '), 'No device bound');
    });
  });
}
