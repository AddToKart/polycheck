import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/theme/brand_theme.dart';
import 'package:polycheck_mobile/src/core/widgets/campus_header.dart';

/// The header once reserved more height than its toolbar used, which showed as
/// an empty maroon strip under the title on every screen with a subtitle.
void main() {
  Future<void> pump(WidgetTester tester, CampusHeader header) =>
      tester.pumpWidget(
        MaterialApp(
          theme: BrandTheme.light,
          home: Scaffold(appBar: header, body: const SizedBox.expand()),
        ),
      );

  for (final subtitle in <String?>[null, 'Welcome back, Prof. Cruz']) {
    testWidgets('reserves exactly the height it draws (subtitle: $subtitle)', (
      tester,
    ) async {
      final header = CampusHeader(title: 'Dashboard', subtitle: subtitle);
      await pump(tester, header);

      final bar = tester.widget<AppBar>(find.byType(AppBar));
      expect(bar.toolbarHeight, header.preferredSize.height);
      // The title block is centred in the whole bar: equal space above and
      // below it.
      final area = tester.getRect(find.byType(AppBar));
      final top = tester.getRect(find.text('Dashboard')).top - area.top;
      final bottom =
          area.bottom -
          tester.getRect(find.text(subtitle ?? 'Dashboard')).bottom;
      expect((top - bottom).abs(), lessThanOrEqualTo(2));
      expect(tester.takeException(), isNull);
    });
  }
}
