import 'package:flutter/material.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/student/data/student_providers.dart';
import 'package:polycheck_mobile/src/features/student/data/student_models.dart';
import 'package:polycheck_mobile/src/features/student/presentation/officer/student_session_detail_screen.dart';
import 'package:qr_flutter/qr_flutter.dart';

import 'student_test_harness.dart';

void main() {
  Future<void> pumpSession(
    WidgetTester tester,
    StudentSessionDetail detail,
  ) async {
    await pumpStudentScreen(
      tester,
      const StudentSessionDetailScreen(sectionId: 'sec-1', sessionId: 'sess-1'),
      overrides: <Override>[
        studentSessionDetailProvider.overrideWith((ref, key) async => detail),
      ],
    );
    await tester.pumpAndSettle();
  }

  testWidgets('active sessions expose the signed class token', (tester) async {
    const token = 'c2Vzc2lvbi10b2tlbi1wYXlsb2Fk.signature';
    await pumpSession(
      tester,
      StudentSessionDetail(
        session: testSession().copyWith(qrToken: token),
        section: testSection(),
        subject: testSubject,
        proofs: const <ProofOfClass>[],
        isQac: true,
      ),
    );

    expect(find.text('CLASS QR — SHARE WITH CLASSMATES'), findsOneWidget);
    expect(find.byType(QrImageView), findsOneWidget);
    expect(find.byKey(const ValueKey('class-qr-image')), findsOneWidget);
    expect(find.text(token), findsOneWidget);
    expect(find.byKey(const ValueKey('copy-class-token')), findsOneWidget);
    expect(find.text('QAC evidence upload'), findsOneWidget);
  });

  testWidgets('inactive sessions explain the instructor activation gate', (
    tester,
  ) async {
    await pumpSession(
      tester,
      StudentSessionDetail(
        session: testSession(active: false),
        section: testSection(),
        subject: testSubject,
        proofs: const <ProofOfClass>[],
      ),
    );

    expect(find.text('Not started yet'), findsOneWidget);
    expect(find.text('Attendance is open'), findsNothing);
    expect(find.text('QAC evidence upload'), findsNothing);
  });

  // The server never sends a student the QR token, so a running class used to be
  // reported as not yet started.
  testWidgets('a running class without a token says attendance is open', (
    tester,
  ) async {
    await pumpSession(
      tester,
      StudentSessionDetail(
        session: testSession(),
        section: testSection(),
        subject: testSubject,
        proofs: const <ProofOfClass>[],
        isQac: true,
      ),
    );

    expect(find.text('Active now'), findsOneWidget);
    expect(find.text('Attendance is open'), findsOneWidget);
    expect(find.byKey(const ValueKey('open-scanner')), findsOneWidget);
    expect(find.text('Not started yet'), findsNothing);
    expect(find.byType(QrImageView), findsNothing);
  });
}
