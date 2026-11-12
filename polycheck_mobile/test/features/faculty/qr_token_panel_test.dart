import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/faculty/presentation/widgets/qr_token_panel.dart';
import 'package:qr_flutter/qr_flutter.dart';

void main() {
  test('signed tokens fit a medium-error-correction QR code', () {
    final payload = createQRTokenData(
      'sess-8f2c0d4e-2f6f-4b72-9f9a-1d2c3b4a5e6f',
      'sec-1a2b3c4d-5e6f-7a8b-9c0d-1e2f3a4b5c6d',
      'teacher-12345678-1234-4321-8765-123456789012',
      'Prof. Juan Dela Cruz (CCIS)',
      15,
      60,
      issuedAtMs: DateTime.utc(2026, 11, 10, 8).millisecondsSinceEpoch,
    );
    final signed = '$payload.${'A' * 86}';

    final validation = QrValidator.validate(
      data: signed,
      version: QrVersions.auto,
      errorCorrectionLevel: QrErrorCorrectLevel.M,
    );
    expect(validation.isValid, isTrue);
  });

  testWidgets('cockpit token panel renders a QR plus manual-entry fallback', (
    tester,
  ) async {
    final now = DateTime.utc(2026, 11, 10, 8);
    final expiresAt = now.add(const Duration(minutes: 2));
    final token = createQRTokenData(
      'sess-1',
      'sec-1',
      'teacher-1',
      'Prof. Juan Dela Cruz',
      15,
      60,
      issuedAtMs: now.millisecondsSinceEpoch,
    );

    await tester.pumpWidget(
      MaterialApp(
        theme: PupTheme.light,
        home: Scaffold(
          body: SingleChildScrollView(
            child: QrTokenPanel(
              label: 'Attendance token',
              token: token,
              expiresAtIso: expiresAt.toIso8601String(),
              clock: const TrustedClock(),
              deviceNow: () => now,
              onCopy: () {},
              onShare: () {},
              onFullscreen: () {},
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.byType(QrImageView), findsOneWidget);
    expect(find.byKey(const ValueKey('cockpit-qr-image')), findsOneWidget);
    expect(find.text('MANUAL ENTRY TOKEN'), findsOneWidget);
    expect(find.text(token), findsOneWidget);
    expect(find.text('Expires in 02:00'), findsOneWidget);
    expect(find.text('Copy'), findsOneWidget);
    expect(find.text('Share'), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
    await tester.pump(const Duration(seconds: 2));
  });
}
