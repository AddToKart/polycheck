import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/features/surface/data/profile_validation.dart';

void main() {
  group('password form validation', () {
    test('accepts a compliant password with matching confirmation', () {
      final errors = validatePasswordForm(
        currentPassword: 'OldPassw0rd!',
        newPassword: 'StrongPassw0rd!',
        confirmation: 'StrongPassw0rd!',
      );
      expect(errors.isEmpty, isTrue);
    });

    test('requires the current password', () {
      final errors = validatePasswordForm(
        currentPassword: '',
        newPassword: 'StrongPassw0rd!',
        confirmation: 'StrongPassw0rd!',
      );
      expect(errors.currentPassword, 'Enter your current password.');
      expect(errors.isEmpty, isFalse);
    });

    test('reports the first unmet policy rule inline', () {
      final short = validatePasswordForm(
        currentPassword: 'OldPassw0rd!',
        newPassword: 'Short1!',
        confirmation: 'Short1!',
      );
      expect(short.newPassword, 'Use at least 12 characters.');

      final missingSymbol = validatePasswordForm(
        currentPassword: 'OldPassw0rd!',
        newPassword: 'LongPassw0rdNoSymbol',
        confirmation: 'LongPassw0rdNoSymbol',
      );
      expect(missingSymbol.newPassword, 'Include a special character.');
    });

    test('rejects a mismatched confirmation', () {
      final errors = validatePasswordForm(
        currentPassword: 'OldPassw0rd!',
        newPassword: 'StrongPassw0rd!',
        confirmation: 'DifferentPassw0rd!',
      );
      expect(errors.confirmation, 'The password confirmation does not match.');
    });
  });

  group('system report validation', () {
    test('enforces the 5-120 title window', () {
      expect(validateReportTitle('Hi'), isNotNull);
      expect(validateReportTitle('Valid title'), isNull);
      expect(validateReportTitle('x' * 121), isNotNull);
    });

    test('enforces the description window', () {
      expect(validateReportDescription('short'), isNotNull);
      expect(validateReportDescription('A descriptive issue report.'), isNull);
      expect(validateReportDescription('x' * 4001), isNotNull);
    });
  });

  group('telemetry helpers', () {
    test('device/app labels are always present', () {
      expect(buildSurfaceDeviceLabel(), isNotEmpty);
      expect(buildSurfaceAppVersion(), startsWith('Flutter v'));
      expect(surfaceNetworkType, 'unknown');
    });
  });
}
