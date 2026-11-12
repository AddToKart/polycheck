import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';

/// Bug 4: the shared month cell carries the faculty geometry (54px bordered
/// square, maroon today fill + white number, 6px dots, `+N` overflow) while
/// both callers keep their own dot palettes.
void main() {
  Future<void> pumpCell(WidgetTester tester, CampusMonthCell cell) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: PupTheme.light,
        home: Scaffold(
          body: Center(child: SizedBox(width: 60, child: cell)),
        ),
      ),
    );
    await tester.pump();
  }

  Container surfaceContainer(WidgetTester tester) => tester.widget<Container>(
    find.byKey(const ValueKey('campus-month-cell-surface')),
  );

  Container dotContainer(WidgetTester tester, int index) =>
      tester.widget<Container>(find.byKey(ValueKey('campus-month-dot-$index')));

  testWidgets('today fills maroon with a white number', (tester) async {
    await pumpCell(
      tester,
      const CampusMonthCell(dayNumber: 10, today: true, inMonth: true),
    );
    final decoration = surfaceContainer(tester).decoration! as BoxDecoration;
    expect(decoration.color, PupColors.pupMaroon);
    expect(tester.widget<Text>(find.text('10')).style?.color, Colors.white);
  });

  testWidgets('a plain day keeps the surface background', (tester) async {
    await pumpCell(
      tester,
      const CampusMonthCell(dayNumber: 10, today: false, inMonth: true),
    );
    final decoration = surfaceContainer(tester).decoration! as BoxDecoration;
    expect(decoration.color, PupColors.surfaceLight);
    expect(tester.widget<Text>(find.text('10')).style?.color, PupColors.ink);
  });

  testWidgets('out-of-month days mute the number', (tester) async {
    await pumpCell(
      tester,
      const CampusMonthCell(dayNumber: 3, today: false, inMonth: false),
    );
    expect(tester.widget<Text>(find.text('3')).style?.color, PupColors.muted);
  });

  testWidgets('selected draws the gold border and bolds the number', (
    tester,
  ) async {
    await pumpCell(
      tester,
      const CampusMonthCell(
        dayNumber: 10,
        today: false,
        inMonth: true,
        selected: true,
      ),
    );
    final decoration = surfaceContainer(tester).decoration! as BoxDecoration;
    expect(decoration.border, Border.all(color: PupColors.pupGold, width: 2));
    expect(
      tester.widget<Text>(find.text('10')).style?.fontWeight,
      FontWeight.w800,
    );
  });

  testWidgets('dots overflow collapses into the +N badge', (tester) async {
    final dot = const CampusMonthDot(fill: PupColors.pupMaroon);
    await pumpCell(
      tester,
      CampusMonthCell(
        dayNumber: 10,
        today: false,
        inMonth: true,
        dots: <CampusMonthDot>[dot, dot, dot, dot, dot],
      ),
    );
    expect(find.byKey(const ValueKey('campus-month-dot-0')), findsOneWidget);
    expect(find.byKey(const ValueKey('campus-month-dot-2')), findsOneWidget);
    expect(find.byKey(const ValueKey('campus-month-dot-3')), findsNothing);
    expect(find.text('+2'), findsOneWidget);
  });

  testWidgets('an explicit badge overrides the computed +N', (tester) async {
    final dot = const CampusMonthDot(fill: PupColors.pupMaroon);
    await pumpCell(
      tester,
      CampusMonthCell(
        dayNumber: 10,
        today: false,
        inMonth: true,
        dots: <CampusMonthDot>[dot, dot, dot, dot],
        badge: 'full',
      ),
    );
    expect(find.text('full'), findsOneWidget);
    expect(find.text('+1'), findsNothing);
  });

  testWidgets('faculty palette: white dots survive on the maroon today fill', (
    tester,
  ) async {
    await pumpCell(
      tester,
      const CampusMonthCell(
        dayNumber: 10,
        today: true,
        inMonth: true,
        dots: <CampusMonthDot>[
          CampusMonthDot(fill: Colors.white),
          CampusMonthDot(fill: PupColors.pupGold),
        ],
      ),
    );
    expect(
      (dotContainer(tester, 0).decoration! as BoxDecoration).color,
      Colors.white,
    );
    expect(
      (dotContainer(tester, 1).decoration! as BoxDecoration).color,
      PupColors.pupGold,
    );
  });

  testWidgets('student palette: status dots keep fill and border', (
    tester,
  ) async {
    // Disputed = deep maroon fill + gold border (RN parity).
    await pumpCell(
      tester,
      const CampusMonthCell(
        dayNumber: 10,
        today: false,
        inMonth: true,
        dots: <CampusMonthDot>[
          CampusMonthDot(
            fill: PupColors.pupDeepMaroon,
            border: PupColors.pupGold,
          ),
        ],
      ),
    );
    final decoration = dotContainer(tester, 0).decoration! as BoxDecoration;
    expect(decoration.color, PupColors.pupDeepMaroon);
    expect(decoration.border, Border.all(color: PupColors.pupGold));
  });

  testWidgets('a borderless dot defaults its border to the fill', (
    tester,
  ) async {
    await pumpCell(
      tester,
      const CampusMonthCell(
        dayNumber: 10,
        today: false,
        inMonth: true,
        dots: <CampusMonthDot>[CampusMonthDot(fill: PupColors.pupMaroon)],
      ),
    );
    final decoration = dotContainer(tester, 0).decoration! as BoxDecoration;
    expect(decoration.border, Border.all(color: PupColors.pupMaroon));
  });

  testWidgets('taps report the cell date through onTap', (tester) async {
    var tapped = 0;
    await pumpCell(
      tester,
      CampusMonthCell(
        dayNumber: 10,
        today: false,
        inMonth: true,
        onTap: () => tapped += 1,
      ),
    );
    await tester.tap(find.text('10'));
    expect(tapped, 1);
  });
}
