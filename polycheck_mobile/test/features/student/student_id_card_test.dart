import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/student/data/student_providers.dart';
import 'package:polycheck_mobile/src/features/student/presentation/id_card/student_id_card_screen.dart';

import 'student_test_harness.dart';

void main() {
  List<Override> idOverrides() {
    return <Override>[
      studentSectionsProvider.overrideWith(
        (ref) => Stream.value(<Section>[testSection()]),
      ),
    ];
  }

  testWidgets('flips to the back face and back to the front', (tester) async {
    await pumpStudentScreen(
      tester,
      const StudentIdCardScreen(),
      overrides: idOverrides(),
    );
    await tester.pump();

    expect(find.text('STUDENT NUMBER'), findsOneWidget);
    expect(find.textContaining('PUP-ID-VERIFIED'), findsOneWidget);
    expect(find.textContaining('DEVICE-BOUND'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('student-id-card')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('CONDITIONS OF USE'), findsOneWidget);
    expect(find.text('SCAN TO VERIFY'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('student-id-card')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 500));
    expect(find.text('STUDENT NUMBER'), findsOneWidget);

    await tester.pumpWidget(const SizedBox());
  });

  testWidgets('honors reduce-motion by flipping without an animation', (
    tester,
  ) async {
    await pumpStudentScreen(
      tester,
      const StudentIdCardScreen(),
      overrides: idOverrides(),
      reduceMotion: true,
    );
    await tester.pump();

    await tester.tap(find.byKey(const ValueKey('student-id-card')));
    await tester.pump();

    expect(find.text('CONDITIONS OF USE'), findsOneWidget);
    await tester.pumpWidget(const SizedBox());
  });
}
