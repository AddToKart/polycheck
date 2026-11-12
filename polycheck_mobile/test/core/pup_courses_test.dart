import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/utils/pup_courses.dart';

void main() {
  group('PUP Santa Maria course catalog', () {
    test('exposes unique course codes', () {
      final codes = [
        for (final course in pupSantaMariaCourses) course.code.toLowerCase(),
      ];
      expect(codes.toSet().length, codes.length);
    });

    test('looks up courses case-insensitively', () {
      expect(pupCourseByCode('bsit')?.name, 'BS Information Technology');
      expect(pupCourseByCode('  BSCS  ')?.name, 'BS Computer Science');
      expect(pupCourseByCode('bsma')?.department, 'Business');
    });

    test('returns null for unknown or blank codes', () {
      expect(pupCourseByCode('NOPE'), isNull);
      expect(pupCourseByCode(''), isNull);
      expect(pupCourseByCode(null), isNull);
    });

    test('falls back to the raw code for display when unknown', () {
      expect(pupCourseName('BSIT'), 'BS Information Technology');
      expect(pupCourseName('CUSTOM'), 'CUSTOM');
      expect(pupCourseName(null), '');
      expect(
        pupCourseName('  BTVTE  '),
        'Bachelor of Technical-Vocational Teacher Education',
      );
    });

    test('groups courses by department without dropping entries', () {
      final groups = pupCoursesByDepartment();
      final total = groups.fold<int>(
        0,
        (sum, group) => sum + group.courses.length,
      );
      expect(total, pupSantaMariaCourses.length);
      expect(groups.map((group) => group.department), contains('CCIS'));
      // Order-preserving grouping: the first group is the first list entry's
      // department.
      expect(groups.first.department, 'CCIS');
    });
  });
}
