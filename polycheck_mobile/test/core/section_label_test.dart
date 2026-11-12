import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/utils/section_label.dart';

void main() {
  group('formatSectionHeading', () {
    test('appends the course when the section carries one', () {
      expect(
        formatSectionHeading(section: '4-1', course: 'BSIT'),
        'Section 4-1 \u00B7 BSIT',
      );
    });

    test('renders the original label for legacy sections without a course', () {
      expect(formatSectionHeading(section: '4-1'), 'Section 4-1');
    });

    test('ignores blank course values', () {
      expect(
        formatSectionHeading(section: '2-2', course: '   '),
        'Section 2-2',
      );
    });

    test('trims surrounding whitespace from the course', () {
      expect(
        formatSectionHeading(section: '1-1', course: ' BSA '),
        'Section 1-1 \u00B7 BSA',
      );
    });
  });

  group('sectionCourseLabel', () {
    test('returns a trimmed course label', () {
      expect(sectionCourseLabel(' BSIT '), 'BSIT');
    });

    test('returns empty string when absent', () {
      expect(sectionCourseLabel(null), '');
      expect(sectionCourseLabel('  '), '');
    });
  });
}
