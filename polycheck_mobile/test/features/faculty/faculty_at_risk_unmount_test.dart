import 'dart:async';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/faculty/presentation/faculty_at_risk_screen.dart';

import '../../helpers/auth_harness.dart';

const StudentAtRisk _row = StudentAtRisk(
  studentId: 'stu-1',
  studentName: 'Dela Cruz, Juan',
  sectionId: 'sec-1',
  sectionName: '4-1',
  subjectName: 'Software Engineering',
  professorName: 'Prof. Cruz',
  status: AttendanceStandingStatus.belowThreshold,
  attendanceRate: 62,
);

/// DD-F10: the referral flow awaits three calls in a row. This stub lets the
/// test unmount the screen in the middle of the last two so the old
/// unguarded `setState`/`_load` path is exercised.
class _DeferredAttendanceApi extends AttendanceApi {
  _DeferredAttendanceApi() : super(Dio());

  final Completer<AtRiskReferral> referral = Completer<AtRiskReferral>();
  int generateCalls = 0;

  @override
  Future<List<StudentAtRisk>> getAtRiskStudents({
    String? sectionId,
    int? limit,
  }) async => const <StudentAtRisk>[_row];

  @override
  Future<List<AtRiskReferral>> getAtRiskReferrals({
    ReferralStatus? status,
    String? sectionId,
  }) async => const <AtRiskReferral>[];

  @override
  Future<AtRiskReferral> generateAtRiskReferral({
    required String studentId,
    required String sectionId,
    String? note,
  }) {
    generateCalls += 1;
    return referral.future;
  }
}

class _DeferredDocsApi extends DocsApi {
  _DeferredDocsApi() : super(Dio());

  final Completer<DocumentDownload> notice = Completer<DocumentDownload>();
  int noticeCalls = 0;

  @override
  Future<DocumentDownload> atRiskNotice(
    String referralId, {
    String format = 'pdf',
  }) {
    noticeCalls += 1;
    return notice.future;
  }
}

void main() {
  testWidgets('a CHED referral that lands after unmount writes no state '
      '(DD-F10)', (tester) async {
    final attendance = _DeferredAttendanceApi();
    final docs = _DeferredDocsApi();

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[
          sessionProvider.overrideWith(
            () => FakeSessionController(testFaculty),
          ),
          attendanceApiProvider.overrideWithValue(attendance),
          docsApiProvider.overrideWithValue(docs),
        ],
        child: MaterialApp(
          theme: PupTheme.light,
          home: const FacultyAtRiskScreen(),
        ),
      ),
    );
    await tester.pumpAndSettle();
    expect(find.text('Dela Cruz, Juan'), findsOneWidget);

    await tester.tap(find.text('File CHED notice'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('File notice'));
    await tester.pump();

    // The referral resolves while mounted; the screen then awaits the notice
    // download, which is where it gets unmounted.
    attendance.referral.complete(
      const AtRiskReferral(
        id: 'ref-1',
        studentId: 'stu-1',
        studentName: 'Dela Cruz, Juan',
        sectionId: 'sec-1',
        status: ReferralStatus.generated,
      ),
    );
    await tester.pump();
    expect(
      attendance.generateCalls,
      1,
      reason: 'confirming the dialog must start the referral',
    );

    await tester.pumpWidget(const SizedBox.shrink());
    expect(find.byType(FacultyAtRiskScreen), findsNothing);
    expect(
      docs.noticeCalls,
      1,
      reason: 'the notice download must be in flight when the screen unmounts',
    );

    docs.notice.complete(
      DocumentDownload(
        bytes: Uint8List(0),
        filename: 'at-risk-notice.pdf',
        contentType: 'application/pdf',
      ),
    );
    await tester.pumpAndSettle();
    // Drain the toast's dismissal timer.
    await tester.pump(const Duration(seconds: 5));

    expect(
      tester.takeException(),
      isNull,
      reason: 'no setState/refresh may run against the unmounted screen',
    );
  });
}
