import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/utils/ai_terms.dart';

void main() {
  final shared = File(
    '../shared/src/constants/ai-terms.ts',
  ).readAsStringSync().replaceAll('\r\n', '\n');

  /// Every quoted sentence in the shared terms block, in order.
  List<String> sharedSentences() {
    final start = shared.indexOf('export const AI_TERMS_SECTIONS');
    final end = shared.indexOf('export const AI_TERMS_ACCEPT_LABEL');
    return <String>[
      for (final match in RegExp(
        "'([^'\n]+)'",
      ).allMatches(shared.substring(start, end)))
        match.group(1)!,
    ];
  }

  test('the app shows exactly the terms the website shows', () {
    expect(<String>[
      for (final section in aiTermsSections) ...<String>[
        section.heading,
        ...section.points,
      ],
    ], sharedSentences());
    for (final sentence in <String>[
      aiTermsTitle,
      aiTermsIntro,
      aiTermsAcceptLabel,
      aiTermsRequiredCode,
    ]) {
      expect(shared, contains("'$sentence'"));
    }
  });

  test('uses the same version and limit defaults as the server', () {
    expect(
      shared,
      contains("export const AI_TERMS_VERSION = '$aiTermsVersion'"),
    );
    expect(shared, contains('student: $aiDailyLimitStudentDefault,'));
    expect(shared, contains('teacher: $aiDailyLimitTeacherDefault,'));
    expect(shared, contains('super_admin: $aiDailyLimitSuperAdminDefault,'));
    expect(shared, contains('AI_DAILY_LIMIT_MAX = $aiDailyLimitMax'));
  });
}
