import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/theme/pup_theme.dart';
import 'package:polycheck_mobile/src/features/surface/data/outage_demo.dart';
import 'package:polycheck_mobile/src/features/surface/presentation/widgets/outage_widgets.dart';

void main() {
  test('the demo flag only accepts the exact string true', () {
    expect(OutageDemo.parseFlag('true'), isTrue);
    expect(OutageDemo.parseFlag('false'), isFalse);
    expect(OutageDemo.parseFlag('TRUE'), isFalse);
    expect(OutageDemo.parseFlag(null), isFalse);
    // Default build (no dart-define) keeps the simulator off.
    expect(OutageDemo.enabled, isFalse);
  });

  test('receipts render the sequence and operation prefix', () {
    expect(OutageDemo.receipt(104), 'Receipt #104');
    expect(
      OutageDemo.receipt(104, 'a1b2c3d4-e5f6'),
      'Receipt #104 \u00b7 a1b2c3d4',
    );
    expect(OutageDemo.receipt(0, ''), 'Receipt #0');
  });

  testWidgets('the pill renders nothing when the build flag is off', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: PupTheme.light,
        home: const Scaffold(body: OutagePill()),
      ),
    );
    await tester.pump();

    expect(find.text('OFFLINE SIMULATION'), findsNothing);
  });
}
