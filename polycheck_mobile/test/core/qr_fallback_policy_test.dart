import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/session.dart';
import 'package:polycheck_mobile/src/core/rules/qr_fallback_policy.dart';

void main() {
  group('QR fallback policy', () {
    test('online checkpoints always allow image/manual fallbacks', () {
      expect(shouldShowScanFallbacks(SessionMode.online), isTrue);
      expect(
        shouldShowScanFallbacks(
          SessionMode.online,
          inPersonFallbackEnabled: false,
        ),
        isTrue,
      );
    });

    test('in-person fallbacks are opt-in and default off', () {
      expect(qrFallbacksOptIn, isFalse);
      expect(shouldShowScanFallbacks(SessionMode.inPerson), isFalse);
      expect(
        shouldShowScanFallbacks(
          SessionMode.inPerson,
          inPersonFallbackEnabled: true,
        ),
        isTrue,
      );
    });
  });
}
