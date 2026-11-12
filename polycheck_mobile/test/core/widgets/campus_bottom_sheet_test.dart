import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';

/// Bug 2 regression: `showCampusBottomSheet` used to grow to full screen
/// height for long content (the course catalog). The body is now capped at
/// 65% of the screen and scrolls inside the cap.
void main() {
  Widget harness(WidgetBuilderCallback onOpen) {
    return MaterialApp(
      theme: PupTheme.light,
      home: Scaffold(
        body: Builder(
          builder: (context) => Center(
            child: CampusButton(
              label: 'open',
              onPressed: () => onOpen(context),
            ),
          ),
        ),
      ),
    );
  }

  Future<void> openSheet(WidgetTester tester) async {
    await tester.pump();
    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();
  }

  testWidgets('default cap keeps a long sheet under 65% of the screen', (
    tester,
  ) async {
    tester.view.physicalSize = const Size(400, 800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      harness(
        (context) => showCampusBottomSheet<void>(
          context,
          title: 'Long list',
          child: Column(
            children: <Widget>[
              for (var index = 0; index < 60; index += 1)
                ListTile(title: Text('Item $index')),
            ],
          ),
        ),
      ),
    );
    await openSheet(tester);

    const cap = 800 * 0.65;
    final sheetRect = tester.getRect(find.byType(CampusBottomSheet));
    // No longer a full-screen sheet.
    expect(sheetRect.height, lessThan(800));
    // Body + chrome (handle/title/padding) stays within the cap plus chrome.
    expect(sheetRect.height, lessThanOrEqualTo(cap + 80));

    final scrollRect = tester.getRect(
      find.descendant(
        of: find.byType(CampusBottomSheet),
        matching: find.byType(SingleChildScrollView),
      ),
    );
    expect(scrollRect.height, lessThanOrEqualTo(cap));
  });

  testWidgets('explicit maxHeight overrides the default cap', (tester) async {
    tester.view.physicalSize = const Size(400, 800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      harness(
        (context) => showCampusBottomSheet<void>(
          context,
          title: 'Short cap',
          maxHeight: 200,
          child: Column(
            children: <Widget>[
              for (var index = 0; index < 30; index += 1)
                ListTile(title: Text('Item $index')),
            ],
          ),
        ),
      ),
    );
    await openSheet(tester);

    final scrollRect = tester.getRect(
      find.descendant(
        of: find.byType(CampusBottomSheet),
        matching: find.byType(SingleChildScrollView),
      ),
    );
    expect(scrollRect.height, lessThanOrEqualTo(200.0));
  });

  testWidgets('short content is never stretched by the cap', (tester) async {
    tester.view.physicalSize = const Size(400, 800);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    await tester.pumpWidget(
      harness(
        (context) => showCampusBottomSheet<void>(
          context,
          title: 'Short',
          child: const Text('Only one line'),
        ),
      ),
    );
    await openSheet(tester);

    final scrollRect = tester.getRect(
      find.descendant(
        of: find.byType(CampusBottomSheet),
        matching: find.byType(SingleChildScrollView),
      ),
    );
    // A one-line body stays content-sized (mainAxisSize.min behavior kept).
    expect(scrollRect.height, lessThan(120));
  });
}

typedef WidgetBuilderCallback = void Function(BuildContext context);
