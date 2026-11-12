import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:polycheck_mobile/src/core/models/attendance.dart';
import 'package:polycheck_mobile/src/core/network/dio_client.dart';
import 'package:polycheck_mobile/src/features/faculty/data/teacher_signing_key.dart';
import 'package:polycheck_mobile/src/features/student/data/student_scan_service.dart';

import 'support/fixtures.dart';
import 'support/harness.dart';

/// The queue-survival contract (DD-W25, Flutter side).
///
/// `AppDatabase.clearOwner` documents the split the backend plan asks for:
///
/// > [preserveAttendanceQueue] keeps queued offline check-ins through an
/// > authoritative 401/expiry so re-authentication can still drain evidence;
/// > an explicit sign-out uses the default purge.
///
/// So the regression guard is: an authoritative/programmatic sign-out
/// (`handleSessionExpired`, the "replaced session" path) must purge the owner's
/// cache **without** destroying queued check-ins or the owner's secure-storage
/// keys — and the re-authenticated account must then drain them successfully.
/// The explicit user sign-out is pinned as the deliberate counterpart.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  late AttendanceFixture fixture;

  setUpAll(() async {
    fixture = await AttendanceFixture.create();
  });

  tearDownAll(() async {
    await fixture.dispose();
  });

  test(
    'authoritative sign-out keeps the queue and the owner keys, then drains',
    () async {
      final harness = await AppHarness.boot();
      try {
        final student = await harness.signInStudent(
          studentId: fixture.studentId,
          password: fixture.studentPassword,
        );
        await harness.acceptPrivacyNotice();
        await harness.cacheSession(student.id, fixture.sessionId);

        // ── Queue one scan while the network is down ──────────────────────
        harness.armOutage();
        final outcome = await harness.scan(
          rawToken: fixture.qrToken,
          student: student,
        );
        expect(
          outcome.kind,
          ScanOutcomeKind.offlineQueued,
          reason:
              'expected an offline queue, got '
              '${outcome.kind} — "${outcome.title}: ${outcome.message}"',
        );
        harness.disarmOutage();

        final before = await harness.queueRows(student.id);
        expect(before, hasLength(1));
        final queued = before.single;
        expect(queued.syncStatus.wire, 'PENDING');
        debugPrint(
          'QUEUED BEFORE SIGNOUT: ${queued.clientReceiptId} '
          '(${queued.inputChannel}, locationCapturedAt='
          '${queued.locationCapturedAt?.toIso8601String()})',
        );

        // Owner-scoped secure-storage keys exist before the purge.
        final keys = TeacherSigningKeyService();
        final ownerKey = await keys.read(fixture.teacher.id);
        expect(
          ownerKey,
          isNotNull,
          reason: 'the teacher signing key must be in secure storage',
        );
        expect(ownerKey!.publicKey, fixture.signingKey.publicKey);

        // ── Authoritative sign-out (replaced session / forced re-auth) ─────
        await harness.expireSession();

        // The purge really ran: the bearer token and the cached profile are gone.
        expect(await harness.container.read(tokenStoreProvider).read(), isNull);
        expect(await harness.database.readProfile(student.id), isNull);

        // …but the evidence and the owner's keys survived.
        final after = await harness.allQueueRows(student.id);
        expect(
          after,
          hasLength(1),
          reason: 'a programmatic sign-out must not destroy queued evidence',
        );
        final survivor = after.single;
        expect(survivor.clientReceiptId, queued.clientReceiptId);
        expect(survivor.userId, student.id);
        expect(survivor.scannedToken, queued.scannedToken);
        expect(survivor.syncStatus.wire, 'PENDING');
        expect(survivor.locationCapturedAt, queued.locationCapturedAt);
        expect(survivor.inputChannel, 'camera');
        debugPrint(
          'QUEUE SURVIVED SIGNOUT: ${survivor.clientReceiptId} '
          'owner=${survivor.userId} channel=${survivor.inputChannel} '
          'locationCapturedAt=${survivor.locationCapturedAt?.toIso8601String()} '
          'status=${survivor.syncStatus.wire}',
        );

        final survivingKey = await keys.read(fixture.teacher.id);
        expect(survivingKey, isNotNull);
        expect(survivingKey!.publicKey, fixture.signingKey.publicKey);

        // ── Re-authenticate and drain the surviving row ───────────────────
        final again = await harness.signInStudent(
          studentId: fixture.studentId,
          password: fixture.studentPassword,
        );
        expect(again.id, student.id);
        // The session cache was purged, so the offline verification key has to be
        // re-established before any further offline action; the drain itself only
        // needs the bearer token.
        await harness.cacheSession(again.id, fixture.sessionId);

        final report = await harness.drain(again.id);
        debugPrint(
          'DRAIN AFTER RE-AUTH: attempted=${report.attempted} '
          'confirmed=${report.confirmed} flagged=${report.flagged} '
          'terminal=${report.terminalFailed} remaining=${report.remaining} '
          'abort=${report.abortReason}',
        );
        expect(report.attempted, 1);
        expect(report.confirmed, 1);
        expect(report.remaining, 0);

        final reconciled = await harness.queueRow(queued.clientReceiptId);
        expect(reconciled!.syncStatus.wire, 'CONFIRMED');

        // ── The server took the replayed evidence ────────────────────────
        final serverRows = await fixture.serverAttendance();
        final mine = serverRows
            .where((row) => row['studentId'] == fixture.student.id)
            .toList(growable: false);
        expect(mine, hasLength(1));
        debugPrint('SERVER ROW AFTER RE-AUTH: ${jsonEncode(mine.single)}');
        final record = AttendanceRecord.fromJson(mine.single);
        expect(record.status, isNot(AttendanceStatus.disputed));
        expect(record.disputeReason, isNot(DisputeReason.missingScanEvidence));
        expect(record.isSynced, isTrue);
      } finally {
        await harness.dispose();
      }
    },
  );

  test('explicit user sign-out still purges the offline queue', () async {
    final harness = await AppHarness.boot();
    try {
      final student = await harness.signInStudent(
        studentId: fixture.studentId,
        password: fixture.studentPassword,
      );

      // A locally queued row that never reaches the server: enough to prove the
      // purge path without creating a duplicate submission.
      final receiptId = 'e2e-purge-${fixture.runId}';
      await harness.database.enqueueAttendanceScan(
        clientReceiptId: receiptId,
        userId: student.id,
        sessionId: fixture.sessionId,
        studentId: student.id,
        scannedToken: fixture.qrToken,
        inputChannel: 'manual',
        scannedAtUtc: DateTime.now().toUtc(),
      );
      expect(await harness.queueRow(receiptId), isNotNull);

      await harness.signOut();

      expect(
        await harness.queueRow(receiptId),
        isNull,
        reason: 'the destructive, user-confirmed sign-out clears the owner',
      );
      expect(await harness.allQueueRows(student.id), isEmpty);
      expect(await harness.database.readProfile(student.id), isNull);
    } finally {
      await harness.dispose();
    }
  });
}
