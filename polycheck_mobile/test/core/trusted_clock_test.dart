import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/providers/trusted_clock.dart';

void main() {
  group('TrustedClock', () {
    test('applies the persisted server offset to device UTC', () {
      final deviceNow = DateTime.utc(2026, 11, 10, 8);
      final clock = const TrustedClock(offsetMs: 1500);

      expect(
        clock.nowMs(deviceNow: () => deviceNow),
        deviceNow.millisecondsSinceEpoch + 1500,
      );
      expect(
        clock.now(deviceNow: () => deviceNow).toIso8601String(),
        '2026-11-10T08:00:01.500Z',
      );
    });

    test('supports a negative offset without touching the device clock', () {
      final deviceNow = DateTime.utc(2026, 11, 10, 8);
      final clock = const TrustedClock(offsetMs: -2500);

      expect(
        clock.now(deviceNow: () => deviceNow).toIso8601String(),
        '2026-11-10T07:59:57.500Z',
      );
    });

    test('returns a new immutable clock when the offset is updated', () {
      const original = TrustedClock(offsetMs: 10);
      final updated = original.withOffset(20);

      expect(original.offsetMs, 10);
      expect(updated.offsetMs, 20);
    });
  });

  group('computeServerClockOffsetMs', () {
    test('uses the request midpoint', () {
      final offset = computeServerClockOffsetMs(
        serverTimestamp: DateTime.utc(2026, 11, 10, 12, 0, 10),
        requestStartedAt: DateTime.utc(2026, 11, 10, 12, 0, 0),
        requestCompletedAt: DateTime.utc(2026, 11, 10, 12, 0, 2),
      );

      expect(offset, 9000);
    });

    test('handles a server clock behind the device', () {
      final offset = computeServerClockOffsetMs(
        serverTimestamp: DateTime.utc(2026, 11, 10, 12, 0, 8),
        requestStartedAt: DateTime.utc(2026, 11, 10, 12, 0, 0),
        requestCompletedAt: DateTime.utc(2026, 11, 10, 12, 0, 4),
      );

      expect(offset, 6000);
    });

    test('is zero when the server time equals the midpoint', () {
      final offset = computeServerClockOffsetMs(
        serverTimestamp: DateTime.utc(2026, 11, 10, 12, 0, 1),
        requestStartedAt: DateTime.utc(2026, 11, 10, 12, 0, 0),
        requestCompletedAt: DateTime.utc(2026, 11, 10, 12, 0, 2),
      );

      expect(offset, 0);
    });
  });
}
