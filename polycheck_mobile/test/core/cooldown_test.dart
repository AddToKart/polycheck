import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/utils/cooldown.dart';

void main() {
  group('formatCooldownCountdown', () {
    test('renders m:ss below one hour', () {
      expect(formatCooldownCountdown(1), '0:01');
      expect(formatCooldownCountdown(59), '0:59');
      expect(formatCooldownCountdown(60), '1:00');
      expect(formatCooldownCountdown(125), '2:05');
      expect(formatCooldownCountdown(3599), '59:59');
    });

    test('renders h:mm:ss at or above one hour', () {
      expect(formatCooldownCountdown(3600), '1:00:00');
      expect(formatCooldownCountdown(3661), '1:01:01');
      expect(formatCooldownCountdown(7200), '2:00:00');
      expect(formatCooldownCountdown(90000), '25:00:00');
      expect(formatCooldownCountdown(86399), '23:59:59');
    });

    test('clamps elapsed, zero, negative, and non-finite values to 0:00', () {
      expect(formatCooldownCountdown(0), '0:00');
      expect(formatCooldownCountdown(-5), '0:00');
      expect(formatCooldownCountdown(double.nan), '0:00');
      expect(formatCooldownCountdown(double.infinity), '0:00');
    });

    test('rounds fractional seconds up so active never reads 0:00', () {
      expect(formatCooldownCountdown(0.4), '0:01');
      expect(formatCooldownCountdown(59.2), '1:00');
    });
  });
}
