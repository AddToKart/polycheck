import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/system_report.dart';
import 'package:polycheck_mobile/src/features/surface/data/profile_validation.dart';
import 'package:polycheck_mobile/src/features/surface/presentation/widgets/report_widgets.dart';

void main() {
  group('report status pills', () {
    test('each status has a distinct tone', () {
      final backgrounds = <int>{};
      for (final status in ReportStatus.values) {
        final tone = reportStatusTone(status, isDark: false);
        backgrounds.add(tone.background.toARGB32());
        expect(tone.foreground, isNot(equals(tone.background)));
      }
      expect(backgrounds, hasLength(ReportStatus.values.length));
    });

    test('resolved/dismissed adapt to dark mode', () {
      final lightResolved = reportStatusTone(
        ReportStatus.resolved,
        isDark: false,
      );
      final darkResolved = reportStatusTone(
        ReportStatus.resolved,
        isDark: true,
      );
      expect(
        lightResolved.background.toARGB32(),
        isNot(equals(darkResolved.background.toARGB32())),
      );
    });

    test('report dates render compactly', () {
      expect(formatReportDate('2026-11-10T12:00:00.000Z'), startsWith('Nov'));
      expect(formatReportDate('not-a-date'), '');
    });

    test('status labels cover every enum member', () {
      for (final status in ReportStatus.values) {
        expect(reportStatusLabels[status], isNotNull);
      }
      for (final category in ReportCategory.values) {
        expect(reportCategoryLabels[category], isNotNull);
        expect(reportCategoryHints[category], isNotEmpty);
      }
    });
  });
}
