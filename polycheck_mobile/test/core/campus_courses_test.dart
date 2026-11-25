import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/utils/campus_courses.dart';

void main() {
  group('Campus course catalog', () {
    test('lists exactly the eight official programs', () {
      expect(campusCourseCodes(), [
        'BSA',
        'BSCpE',
        'BSENTREP',
        'BSHM',
        'BSIT',
        'BSEDEN',
        'BSEDMT',
        'DOMTLOM',
      ]);
    });

    test('exposes unique course codes', () {
      final codes = [
        for (final course in campusCourses) course.code.toLowerCase(),
      ];
      expect(codes.toSet().length, codes.length);
    });

    test('looks up courses case-insensitively', () {
      expect(
        campusCourseByCode('bsit')?.name,
        'Bachelor of Science in Information Technology',
      );
      expect(campusCourseByCode('  bscpe  ')?.code, 'BSCpE');
    });

    test('returns null for unknown, retired or blank codes', () {
      expect(campusCourseByCode('NOPE'), isNull);
      expect(campusCourseByCode('BSCS'), isNull);
      expect(campusCourseByCode(''), isNull);
      expect(campusCourseByCode(null), isNull);
    });

    test('falls back to the raw code for display when unknown', () {
      expect(
        campusCourseName('BSHM'),
        'Bachelor of Science in Hospitality Management',
      );
      expect(campusCourseName('CUSTOM'), 'CUSTOM');
      expect(campusCourseName(null), '');
    });

    test('keeps the legacy grouping wrapper as one flat bucket', () {
      final groups = campusCoursesByDepartment();
      expect(groups, hasLength(1));
      expect(groups.single.department, campusCoursesGroupLabel);
      expect(groups.single.courses, hasLength(campusCourses.length));
    });
  });

  group('normalizeCourse', () {
    const cases = <String, String>{
      'BSIT': 'BSIT',
      'bsit': 'BSIT',
      'B.S.I.T.': 'BSIT',
      '  bs information technology ': 'BSIT',
      'Bachelor of Science in Information Technology': 'BSIT',
      'BSCPE': 'BSCpE',
      'BS Computer Engineering': 'BSCpE',
      'BSEntrep': 'BSENTREP',
      'BS Hospitality Management': 'BSHM',
      'BS Accountancy': 'BSA',
      'BSED-EN': 'BSEDEN',
      'BSEd English': 'BSEDEN',
      'BSED-MT': 'BSEDMT',
      'bsed math': 'BSEDMT',
      'DOMT': 'DOMTLOM',
    };
    cases.forEach((input, code) {
      test('maps "$input" to $code', () {
        final result = normalizeCourse(input);
        expect(result.matched, isTrue);
        expect(result.code, code);
        expect(result.raw, input.trim());
      });
    });

    test(
      'never drops an unmatched value; ambiguous legacy BSEd is unmatched',
      () {
        for (final legacy in ['BSEd', 'BSCS', 'BSIS', 'BEEd', 'BIT']) {
          expect(normalizeCourse(legacy).matched, isFalse, reason: legacy);
        }
        final unknown = normalizeCourse('BS Basket Weaving');
        expect(unknown.matched, isFalse);
        expect(unknown.raw, 'BS Basket Weaving');
        expect(normalizeCourse(null).matched, isFalse);
      },
    );
  });

  test('stays in lockstep with the shared TypeScript catalog', () {
    final source = File('../shared/src/constants/campus-courses.ts');
    if (!source.existsSync()) {
      markTestSkipped('shared catalog not reachable from this working dir');
      return;
    }
    final text = source.readAsStringSync();
    final tsCodes = RegExp(
      r"code:\s*'([^']+)'",
    ).allMatches(text).map((m) => m.group(1)!).toList();
    final tsNames = RegExp(
      r"name:\s*'([^']+)'",
    ).allMatches(text).map((m) => m.group(1)!).toList();
    expect(campusCourseCodes(), tsCodes);
    expect([for (final c in campusCourses) c.name], tsNames);
  });
}
