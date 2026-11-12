import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';
import 'package:polycheck_mobile/src/core/models/attendance.dart';
import 'package:polycheck_mobile/src/core/models/session.dart';
import 'package:polycheck_mobile/src/core/sync/sync_engine.dart';
import 'package:polycheck_mobile/src/core/sync/attendance_pin_vault.dart';
import 'package:polycheck_mobile/src/features/student/data/student_scan_service.dart';

import 'support/fixtures.dart';
import 'support/harness.dart';

/// End-to-end proof of the offline in-person arc, on a real device against a
/// live backend:
///
/// 1. a disposable teacher signs an in-person QR token **locally** with the
///    app's own Ed25519 key, provisions the matching public key, and arms the
///    session with that exact token;
/// 2. the student's device caches the session (the offline verification key);
/// 3. the outage simulator is armed, so every Dio request is rejected exactly
///    like a campus network failure, and the student scans — the scan lands in
///    the encrypted Drift queue with its full evidence;
/// 4. the simulator is disarmed and the real `SyncEngine` drains the queue;
/// 5. the **server** record is read back over HTTP and must be accepted.
void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  late AppHarness harness;
  late AttendanceFixture fixture;

  setUpAll(() async {
    fixture = await AttendanceFixture.create();
  });

  tearDownAll(() async {
    await fixture.dispose();
  });

  setUp(() async {
    harness = await AppHarness.boot();
  });

  tearDown(() async {
    await harness.dispose();
  });

  test(
    'offline in-person scan queues locally and is accepted server-side',
    () async {
      // ── 1. Prepared device: sign in + cache the session's public key ──────
      final student = await harness.signInStudent(
        studentId: fixture.studentId,
        password: fixture.studentPassword,
      );
      expect(student.id, fixture.student.id);

      await harness.acceptPrivacyNotice();

      final cached = await harness.cacheSession(student.id, fixture.sessionId);
      expect(
        cached.teacherPublicKey,
        fixture.signingKey.publicKey,
        reason:
            'the cached session must carry the teacher key the token was '
            'signed with, otherwise the offline path fails closed',
      );
      // The student-facing session payload deliberately omits the armed
      // `qrToken`; what the offline verifier needs is the public key above.
      expect(cached.isActive, isTrue);
      expect(cached.mode, SessionMode.inPerson);
      expect(cached.geofence, isNotNull);

      // ── 2. Arm the outage, then scan ─────────────────────────────────────
      harness.armOutage();
      final outcome = await harness.scan(
        rawToken: fixture.qrToken,
        student: student,
      );
      expect(
        outcome.kind,
        ScanOutcomeKind.offlineQueued,
        reason:
            'expected the outage to drive the encrypted queue, got '
            '${outcome.kind} — "${outcome.title}: ${outcome.message}"',
      );

      final queued = await harness.queueRows(student.id);
      expect(queued, hasLength(1));
      final row = queued.single;

      // The v3 evidence the backend's `missingCoreEvidence` gate demands.
      expect(row.inputChannel, 'camera');
      expect(row.locationCapturedAt, isNotNull);
      expect(row.latitude, closeTo(14.5995, 1e-6));
      expect(row.longitude, closeTo(120.9842, 1e-6));
      expect(row.isMocked, isFalse);
      expect(row.syncStatus.wire, 'PENDING');
      expect(row.sessionId, fixture.sessionId);
      expect(row.studentId, fixture.student.id);

      // The exact JSON the drain will replay must carry both fields.
      final payload = buildAttendanceSyncPayload(row);
      expect(payload['clientAttemptId'], row.clientReceiptId);
      expect(payload['inputChannel'], 'camera');
      expect(payload['locationCapturedAt'], isNotNull);
      expect(payload['sessionId'], fixture.sessionId);
      expect(
        payload.containsKey('studentId'),
        isFalse,
        reason:
            'forbidNonWhitelisted: the server derives studentId from the '
            'bearer token, so the replay must omit it',
      );
      debugPrint('REPLAY PAYLOAD: ${jsonEncode(payload)}');

      // ── 3. Disarm and drain ──────────────────────────────────────────────
      harness.disarmOutage();
      final report = await harness.drain(student.id);
      debugPrint(
        'DRAIN: attempted=${report.attempted} confirmed=${report.confirmed} '
        'flagged=${report.flagged} duplicates=${report.duplicates} '
        'retryable=${report.retryableFailed} terminal=${report.terminalFailed} '
        'remaining=${report.remaining} abort=${report.abortReason}',
      );
      expect(report.attempted, 1);
      expect(
        report.confirmed,
        1,
        reason: 'the server must accept the replayed scan as a clean record',
      );
      expect(report.flagged, 0);
      expect(report.terminalFailed, 0);
      expect(report.remaining, 0);

      final reconciled = await harness.queueRow(row.clientReceiptId);
      expect(reconciled, isNotNull);
      expect(reconciled!.syncStatus.wire, 'CONFIRMED');
      expect(
        harness.container
            .read(attendancePinVaultProvider)
            .pinFor(row.clientReceiptId),
        isNull,
      );

      // ── 4. The authoritative server row ──────────────────────────────────
      final serverRows = await fixture.serverAttendance();
      final mine = serverRows
          .where((candidate) => candidate['studentId'] == fixture.student.id)
          .toList(growable: false);
      expect(
        mine,
        hasLength(1),
        reason:
            'expected exactly one server record for the fixture student, '
            'got ${serverRows.length} row(s) in the session',
      );
      final serverRow = mine.single;
      debugPrint('SERVER ROW: ${jsonEncode(serverRow)}');

      final record = AttendanceRecord.fromJson(serverRow);
      expect(record.status, isNot(AttendanceStatus.disputed));
      expect(record.disputeReason, isNot(DisputeReason.missingScanEvidence));
      expect(record.disputeReason, isNot(DisputeReason.delayedOfflineSync));
      expect(
        record.status,
        anyOf(AttendanceStatus.present, AttendanceStatus.late),
        reason: 'the accepted row must be a real presence verdict',
      );
      expect(record.isSynced, isTrue);
      expect(record.sessionId, fixture.sessionId);
      expect(record.sectionId, fixture.sectionId);
      expect(record.studentId, fixture.student.id);

      // ── 5. Offline mode is fully unwound ─────────────────────────────────
      expect(await harness.allQueueRows(student.id), hasLength(1));
    },
  );
}
