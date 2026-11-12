import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/privacy.dart';
import 'package:polycheck_mobile/src/core/theme/pup_theme.dart';
import 'package:polycheck_mobile/src/features/surface/presentation/privacy_panel.dart';

void main() {
  Widget wrap(Widget child) {
    return MaterialApp(
      theme: PupTheme.light,
      home: Scaffold(body: SingleChildScrollView(child: child)),
    );
  }

  testWidgets('renders the live attestation metrics', (tester) async {
    const snapshot = PrivacyCenterSnapshot(
      retentionDays: 45,
      consent: PrivacyConsentSnapshot(
        covered: 150,
        totalActive: 200,
        version: 'v2',
      ),
      ephemeral: PrivacyEphemeralSnapshot(
        lastRunAt: '2026-11-10T03:00:00.000Z',
        recordsShredded: 12,
        attemptsShredded: 7,
      ),
    );

    await tester.pumpWidget(
      wrap(const PrivacySnapshotView(snapshot: snapshot)),
    );
    await tester.pumpAndSettle();

    expect(find.text('Geolocation retention: 45 days'), findsOneWidget);
    expect(find.text('75%'), findsOneWidget);
    expect(find.text('150/200 active accounts'), findsOneWidget);
    expect(find.text('0'), findsOneWidget);
    expect(find.textContaining('12 attendance rows'), findsOneWidget);
  });

  testWidgets('handles an empty consent ledger', (tester) async {
    const snapshot = PrivacyCenterSnapshot(
      retentionDays: 30,
      consent: PrivacyConsentSnapshot(),
      ephemeral: PrivacyEphemeralSnapshot(),
    );

    await tester.pumpWidget(
      wrap(const PrivacySnapshotView(snapshot: snapshot)),
    );
    await tester.pumpAndSettle();

    expect(find.text('Geolocation retention: 30 days'), findsOneWidget);
    expect(find.text('-'), findsOneWidget);
    expect(find.text('No shred run has been recorded yet.'), findsOneWidget);
  });
}
