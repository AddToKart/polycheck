import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/section_role.dart';
import 'package:polycheck_mobile/src/core/theme/brand_theme.dart';
import 'package:polycheck_mobile/src/features/faculty/presentation/widgets/president_permission_tile.dart';

void main() {
  /// Opens the dialog and records what it returns.
  Future<List<PermissionChoice?>> open(WidgetTester tester) async {
    tester.view.physicalSize = const Size(1080, 2400);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(tester.view.reset);
    final results = <PermissionChoice?>[];
    await tester.pumpWidget(
      MaterialApp(
        theme: BrandTheme.light,
        home: Scaffold(
          body: Builder(
            builder: (context) => TextButton(
              onPressed: () async =>
                  results.add(await askPermission(context, 'Test Pres')),
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

  Finder field(String key) => find.descendant(
    of: find.byKey(ValueKey(key)),
    matching: find.byType(TextField),
  );

  Future<void> tap(WidgetTester tester, String label) async {
    await tester.ensureVisible(find.text(label));
    await tester.tap(find.text(label));
    await tester.pumpAndSettle();
  }

  for (final hours in const [8, 24]) {
    testWidgets('offers $hours hours with one session by default', (
      tester,
    ) async {
      final results = await open(tester);

      await tap(tester, '$hours hours');

      expect(results, <PermissionChoice?>[(hours: hours, sessions: 1)]);
    });
  }

  testWidgets('takes a custom time and number of sessions within limits', (
    tester,
  ) async {
    final results = await open(tester);

    await tester.enterText(field('permission-sessions'), '25');
    await tap(tester, '8 hours');
    expect(find.textContaining('sessions from 1 to 20'), findsOneWidget);

    await tester.enterText(field('permission-sessions'), '2');
    await tester.enterText(field('permission-custom-hours'), '200');
    await tap(tester, 'Use custom hours');
    expect(find.textContaining('hours from 1 to 168'), findsOneWidget);
    expect(results, isEmpty);

    await tester.enterText(field('permission-custom-hours'), '3');
    await tap(tester, 'Use custom hours');
    expect(results, <PermissionChoice?>[(hours: 3, sessions: 2)]);
  });

  testWidgets('shows the count, and offers a new permission once used up', (
    tester,
  ) async {
    Future<void> show(int used) => tester.pumpWidget(
      MaterialApp(
        theme: BrandTheme.light,
        home: Scaffold(
          body: PresidentPermissionTile(
            studentName: 'Test Pres',
            permission: SessionPermission(
              id: 'p1',
              sectionId: 's1',
              studentId: 'u1',
              expiresAt: '2026-11-28T09:00:00Z',
              isActive: true,
              sessionLimit: 2,
              sessionsUsed: used,
            ),
            onGrant: () {},
            onRevoke: () {},
          ),
        ),
      ),
    );

    await show(1);
    expect(find.textContaining('used 1 of 2 sessions'), findsOneWidget);
    expect(find.text('Revoke'), findsOneWidget);
    expect(find.text('Give permission'), findsNothing);

    await show(2);
    expect(find.text('Revoke'), findsOneWidget);
    expect(find.text('Give permission'), findsOneWidget);
  });
}
