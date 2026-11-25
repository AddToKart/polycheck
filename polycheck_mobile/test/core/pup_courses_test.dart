import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/utils/pup_courses.dart';

void main() {
  group('PUP Santa Maria course catalog', () {
    test('lists exactly the eight official programs', () {
      expect(pupCourseCodes(), [
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
        for (final course in pupSantaMariaCourses) course.code.toLowerCase(),
      ];
      expect(codes.toSet().length, codes.length);
    });

    test('looks up courses case-insensitively', () {
      expect(
        pupCourseByCode('bsit')?.name,
        'Bachelor of Science in Information Technology',
      );
      expect(pupCourseByCode('  bscpe  ')?.code, 'BSCpE');
    });

    test('returns null for unknown, retired or blank codes', () {
      expect(pupCourseByCode('NOPE'), isNull);
      expect(pupCourseByCode('BSCS'), isNull);
      expect(pupCourseByCode(''), isNull);
      expect(pupCourseByCode(null), isNull);
    });

    test('falls back to the raw code for display when unknown', () {
      expect(
        pupCourseName('BSHM'),
        'Bachelor of Science in Hospitality Management',
      );
      expect(pupCourseName('CUSTOM'), 'CUSTOM');
      expect(pupCourseName(null), '');
    });

    test('keeps the legacy grouping wrapper as one flat bucket', () {
      final groups = pupCoursesByDepartment();
      expect(groups, hasLength(1));
      expect(groups.single.department, pupCoursesGroupLabel);
      expect(groups.single.courses, hasLength(pupSantaMariaCourses.length));
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
    final source = File('../shared/src/constants/pup-courses.ts');
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
    expect(pupCourseCodes(), tsCodes);
    expect([for (final c in pupSantaMariaCourses) c.name], tsNames);
  });
}
