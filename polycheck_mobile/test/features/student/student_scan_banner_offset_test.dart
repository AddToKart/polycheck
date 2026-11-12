import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/student/presentation/scan/student_scan_screen.dart';

import '../../helpers/auth_harness.dart';
import 'student_test_harness.dart';

/// SW-7: the boot offline strip is an overlay above the Navigator; the
/// full-bleed scanner reserves its height so the header row never collides.
class _OnlineBanner extends OfflineBannerController {
  @override
  bool build() => false;
}

class _OfflineBanner extends OfflineBannerController {
  @override
  bool build() => true;
}

Future<void> _pumpScanner(
  WidgetTester tester, {
  required OfflineBannerController Function() banner,
}) async {
  tester.view.physicalSize = const Size(1080, 2400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

  await tester.pumpWidget(
    ProviderScope(
      overrides: <Override>[
        sessionProvider.overrideWith(() => FakeSessionController(studentUser)),
        offlineBannerProvider.overrideWith(banner),
      ],
      child: MaterialApp(
        theme: PupTheme.light,
        home: const StudentScanScreen(),
      ),
    ),
  );
  await tester.pump();
}

double _headerTop(WidgetTester tester) {
  final container = tester.widget<Container>(
    find.byKey(const ValueKey('scan-header')),
  );
  final padding = container.padding! as EdgeInsets;
  return padding.top;
}

void main() {
  testWidgets('online: the header keeps its base 8 px inset', (tester) async {
    await _pumpScanner(tester, banner: _OnlineBanner.new);
    expect(_headerTop(tester), 8);
  });

  testWidgets('offline strip visible: the header clears the strip height', (
    tester,
  ) async {
    await _pumpScanner(tester, banner: _OfflineBanner.new);
    expect(_headerTop(tester), 8 + offlineBannerHeight);
  });
}
