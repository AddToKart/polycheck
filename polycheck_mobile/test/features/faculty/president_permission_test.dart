import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/theme/brand_theme.dart';
import 'package:polycheck_mobile/src/features/faculty/presentation/widgets/president_permission_tile.dart';

void main() {
  /// Opens the dialog and records what it returns.
  Future<List<int?>> open(WidgetTester tester) async {
    final results = <int?>[];
    await tester.pumpWidget(
      MaterialApp(
        theme: BrandTheme.light,
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () async =>
                  results.add(await askPermissionHours(context, 'Test Pres')),
              child: const Text('open'),
            ),
          ),
        ),
      ),
    );
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
    return results;
  }

  for (final hours in const [8, 24]) {
    testWidgets('offers $hours hours', (tester) async {
      final results = await open(tester);

      await tester.tap(find.text('$hours hours'));
      await tester.pumpAndSettle();

      expect(results, <int?>[hours]);
    });
  }

  testWidgets('takes a custom time between 1 and 168 hours', (tester) async {
    final results = await open(tester);

    await tester.enterText(find.byType(TextField), '200');
    await tester.tap(find.text('Use custom hours'));
    await tester.pumpAndSettle();
    expect(find.textContaining('from 1 to 168'), findsOneWidget);
    expect(results, isEmpty);

    await tester.enterText(find.byType(TextField), '3');
    await tester.tap(find.text('Use custom hours'));
    await tester.pumpAndSettle();
    expect(results, <int?>[3]);
  });
}
