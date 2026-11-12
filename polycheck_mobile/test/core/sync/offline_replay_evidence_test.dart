import 'dart:async';

import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';

import 'package:polycheck_mobile/src/core/api/api_models.dart';
import 'package:polycheck_mobile/src/core/api/sync_api.dart';
import 'package:polycheck_mobile/src/core/database/app_database.dart';
import 'package:polycheck_mobile/src/core/models/attendance.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';
import 'package:polycheck_mobile/src/core/network/api_error.dart';
import 'package:polycheck_mobile/src/core/providers/session_provider.dart';
import 'package:polycheck_mobile/src/core/sync/attendance_pin_vault.dart';
import 'package:polycheck_mobile/src/core/sync/sync_engine.dart';
import 'package:polycheck_mobile/src/core/utils/device_security.dart';

class _FakeSyncTransport implements SyncTransport {
  Future<SyncBatchSubmitResult> Function(List<Map<String, dynamic>> records)
  onSubmit = (records) async => _inlineSuccess(records);

  final List<List<Map<String, dynamic>>> submitted =
      <List<Map<String, dynamic>>>[];

  @override
  Future<SyncBatchSubmitResult> submitBatch(
    List<Map<String, dynamic>> records,
  ) async {
    submitted.add(records);
    return onSubmit(records);
  }

  @override
  Future<SyncBatchStatus> getBatchStatus(String receiptId) async {
    throw const ApiRequestError(message: 'not queued', status: 200);
  }

  @override
  Future<List<SyncRecordResult>> submitSynchronously(
    List<Map<String, dynamic>> records,
  ) async {
    throw UnimplementedError();
  }
}

class _ScriptedProbe implements DeviceSecurityProber {
  const _ScriptedProbe(this.evidence);

  final DeviceSecurityEvidence evidence;

  @override
  Future<DeviceSecurityEvidence> probe() async => evidence;
}

AttendanceRecord _recordFor(
  Map<String, dynamic> payload, {
  AttendanceStatus status = AttendanceStatus.present,
  DisputeReason? disputeReason,
}) {
  return AttendanceRecord(
    id: 'rec-${payload['clientAttemptId']}',
    sessionId: payload['sessionId']! as String,
    sectionId: 'sec-1',
    studentId: 'u1',
    timestamp: payload['scannedAt']! as String,
    status: status,
    disputeReason: disputeReason,
    isSynced: true,
  );
}

SyncBatchSubmitResult _inlineSuccess(List<Map<String, dynamic>> records) {
  return SyncBatchSubmitResult(
    queued: false,
    results: <SyncRecordResult>[
      for (final payload in records) SyncRecordSuccess(_recordFor(payload)),
    ],
  );
}

/// Session notifier whose owner can change mid-test (account switch).
class _SwitchableSession extends SessionController {
  _SwitchableSession(this.currentUser);

  User? currentUser;

  void switchTo(User user) {
    currentUser = user;
    state = SessionState(status: SessionStatus.signedIn, user: user);
  }

  @override
  SessionState build() =>
      SessionState(status: SessionStatus.signedIn, user: currentUser);
}

Future<void> _waitUntil(bool Function() condition, {String? reason}) async {
  for (var tick = 0; tick < 2000; tick++) {
    if (condition()) return;
    await Future<void>.delayed(Duration.zero);
  }
  fail('condition never became true${reason == null ? '' : ': $reason'}');
}

void main() {
  late AppDatabase database;
  late _FakeSyncTransport transport;
  late AttendancePinVault pinVault;
  late DateTime nowUtc;

  const studentA = User(
    id: 'u1',
    fullName: 'Student One',
    role: UserRole.student,
  );
  const studentB = User(
    id: 'u2',
    fullName: 'Student Two',
    role: UserRole.student,
  );

  setUp(() {
    database = AppDatabase.forTesting(NativeDatabase.memory());
    transport = _FakeSyncTransport();
    pinVault = AttendancePinVault();
    nowUtc = DateTime.utc(2026, 11, 10, 8);
  });

  tearDown(() async {
    await database.close();
  });

  SyncEngine engine({DeviceSecurityProber? deviceSecurityProber}) {
    return SyncEngine(
      database: database,
      transport: transport,
      deviceId: () async => 'mobile-device',
      pinVault: pinVault,
      deviceSecurityProber: deviceSecurityProber,
      batchSize: 25,
      receiptPollInterval: Duration.zero,
      now: () => nowUtc,
    );
  }

  Future<void> seed({
    required String receipt,
    String userId = 'u1',
    String inputChannel = 'camera',
    bool inPerson = true,
    bool pinRequired = false,
    bool mocked = false,
    DateTime? scannedAt,
  }) {
    final scannedAtUtc = scannedAt ?? DateTime.utc(2026, 11, 10, 8);
    return database.enqueueAttendanceScan(
      clientReceiptId: receipt,
      userId: userId,
      sessionId: 'sess-1',
      studentId: userId,
      scannedToken: 'signed-token-$receipt',
      checkpoint: inPerson ? null : 'start',
      inputChannel: inputChannel,
      pinHash: pinRequired ? 'p1\$pbkdf2-sha256\$1\$c2FsdA\$ZGlnZXN0' : null,
      pin: pinRequired ? '1234' : null,
      latitude: inPerson ? 14.87 : null,
      longitude: inPerson ? 120.99 : null,
      accuracy: inPerson ? 8 : null,
      locationCapturedAt: inPerson
          ? scannedAtUtc.subtract(const Duration(seconds: 4))
          : null,
      haversineDistance: inPerson ? 12 : null,
      isMocked: mocked,
      scannedAtUtc: scannedAtUtc,
    );
  }

  group('replay payload fingerprint (DD-F1/F2/F4)', () {
    test('every replayed row carries inputChannel; in-person rows carry '
        'locationCapturedAt and online rows stay location-free', () async {
      await seed(
        receipt: 'camera-in-person',
        inputChannel: 'camera',
        scannedAt: DateTime.utc(2026, 11, 10, 8),
      );
      await seed(
        receipt: 'image-in-person',
        inputChannel: 'image',
        scannedAt: DateTime.utc(2026, 11, 10, 8, 1),
      );
      await seed(
        receipt: 'manual-online',
        inputChannel: 'manual',
        inPerson: false,
        pinRequired: true,
        scannedAt: DateTime.utc(2026, 11, 10, 8, 2),
      );

      await engine().drain(userId: 'u1', isOwnerCurrent: () => true);

      final payloads = transport.submitted.single;
      expect(payloads, hasLength(3));

      final byAttempt = <String, Map<String, dynamic>>{
        for (final payload in payloads)
          payload['clientAttemptId']! as String: payload,
      };

      for (final payload in payloads) {
        expect(
          payload.containsKey('inputChannel'),
          isTrue,
          reason: 'the backend stamps missing_scan_evidence without it',
        );
      }

      final inPersonCamera = byAttempt['camera-in-person']!;
      expect(inPersonCamera['inputChannel'], 'camera');
      expect(inPersonCamera['lat'], 14.87);
      expect(inPersonCamera['lon'], 120.99);
      expect(inPersonCamera['accuracyMeters'], 8);
      expect(inPersonCamera['locationCapturedAt'], '2026-11-10T07:59:56.000Z');

      expect(byAttempt['image-in-person']!['inputChannel'], 'image');

      final online = byAttempt['manual-online']!;
      expect(online['inputChannel'], 'manual');
      expect(
        online.containsKey('locationCapturedAt'),
        isFalse,
        reason: 'online checkpoints stay location-free (RA 10173)',
      );
      expect(online.containsKey('lat'), isFalse);
      expect(online.containsKey('lon'), isFalse);
      expect(online.containsKey('accuracyMeters'), isFalse);
    });

    test(
      'a fully evidenced replay mirrors the live POST /attendance/scan body',
      () async {
        await seed(receipt: 'full', inputChannel: 'manual', mocked: true);

        await engine(
          deviceSecurityProber: const _ScriptedProbe(
            DeviceSecurityEvidence(
              rootDetected: false,
              hookDetected: false,
              emulatorDetected: true,
            ),
          ),
        ).drain(userId: 'u1', isOwnerCurrent: () => true);

        final payload = transport.submitted.single.single;
        expect(payload.keys.toSet(), <String>{
          'sessionId',
          'qrToken',
          'scannedAt',
          'clientAttemptId',
          'inputChannel',
          'lat',
          'lon',
          'locationCapturedAt',
          'deviceId',
          'accuracyMeters',
          'mocked',
          'deviceSecurity',
        });
        expect(payload['clientAttemptId'], 'full');
        expect(
          (payload['deviceSecurity']
              as Map<String, dynamic>)['emulatorDetected'],
          isTrue,
        );
        // Still off the wire whitelist: both derive from the signed token /
        // authenticated user, and `forbidNonWhitelisted` would 400.
        expect(payload.containsKey('checkpoint'), isFalse);
        expect(payload.containsKey('studentId'), isFalse);
      },
    );
  });

  group('disputed receipts are surfaced, not masked (DD-F3)', () {
    test('a disputed record marks the row CONFIRMED_FLAGGED', () async {
      await seed(receipt: 'late', inPerson: false);
      transport.onSubmit = (records) async => SyncBatchSubmitResult(
        queued: false,
        results: <SyncRecordResult>[
          SyncRecordSuccess(
            _recordFor(
              records.single,
              status: AttendanceStatus.disputed,
              disputeReason: DisputeReason.delayedOfflineSync,
            ),
          ),
        ],
      );

      final report = await engine().drain(
        userId: 'u1',
        isOwnerCurrent: () => true,
      );

      expect(report.confirmed, 0);
      expect(report.flagged, 1);

      final row = (await database.attendanceQueueEntry('late'))!;
      expect(row.syncStatus, AttendanceSyncStatus.confirmedFlagged);
      expect(row.serverError, 'flagged: delayed_offline_sync');

      // Synced: never re-queued.
      expect(await database.countDrainableAttendance('u1'), 0);
      expect(await database.watchPendingQueueCount('u1').first, 0);

      final cached = await database.watchMyAttendance('u1', 'u1').first;
      expect(cached.single.status, AttendanceStatus.disputed);

      expect(
        syncDrainMessage(report),
        '1 check-in synced — flagged for instructor review.',
      );

      // A second drain does not re-upload the flagged row.
      await engine().drain(userId: 'u1', isOwnerCurrent: () => true);
      expect(transport.submitted, hasLength(1));
    });
  });

  group('batch-level 4xx classification (DD-F19)', () {
    test('a privacy-consent 403 keeps every row retryable and a later drain '
        'succeeds', () async {
      await seed(receipt: 'c1', scannedAt: DateTime.utc(2026, 11, 10, 8));
      await seed(receipt: 'c2', scannedAt: DateTime.utc(2026, 11, 10, 8, 1));
      transport.onSubmit = (_) async => throw const ApiRequestError(
        message:
            'Privacy consent is required before submitting location evidence',
        status: 403,
      );

      final first = await engine().drain(
        userId: 'u1',
        isOwnerCurrent: () => true,
      );

      expect(first.abortReason, SyncAbortReason.privacyConsent);
      expect(first.terminalFailed, 0);
      expect(first.retryableFailed, 0);
      for (final receipt in <String>['c1', 'c2']) {
        final row = (await database.attendanceQueueEntry(receipt))!;
        expect(row.syncStatus, AttendanceSyncStatus.pending);
        expect(row.serverError, isNull);
        expect(row.retryCount, 0);
      }
      expect(await database.countDrainableAttendance('u1'), 2);
      expect(
        syncDrainMessage(first),
        contains('privacy notice'),
        reason: 'the block must be actionable, not a dead end',
      );
      expect(syncDrainMessage(first), isNot(contains('already synced')));

      // Consent accepted: the very next drain replays the original rows.
      transport.onSubmit = (records) async => _inlineSuccess(records);
      final second = await engine().drain(
        userId: 'u1',
        isOwnerCurrent: () => true,
      );
      expect(second.confirmed, 2);
      expect(second.terminalFailed, 0);
      expect(await database.countDrainableAttendance('u1'), 0);
    });

    test('a 400 still terminalizes (positive control)', () async {
      await seed(receipt: 'bad');
      transport.onSubmit = (_) async => throw const ApiRequestError(
        message: 'records.0.inputChannel must be one of the following values',
        status: 400,
      );

      final report = await engine().drain(
        userId: 'u1',
        isOwnerCurrent: () => true,
      );

      expect(report.abortReason, SyncAbortReason.rejected);
      expect(report.terminalFailed, 1);
      expect(report.retryableFailed, 0);

      final row = (await database.attendanceQueueEntry('bad'))!;
      expect(row.syncStatus, AttendanceSyncStatus.failed);
      expect(row.serverError, startsWith('terminal: '));
      expect(row.retryCount, 0);
      expect(await database.drainableAttendanceQueue('u1'), isEmpty);

      await engine().drain(userId: 'u1', isOwnerCurrent: () => true);
      expect(transport.submitted, hasLength(1));
    });

    test('a 422 still terminalizes (positive control)', () async {
      await seed(receipt: 'unprocessable');
      transport.onSubmit = (_) async => throw const ApiRequestError(
        message: 'Unprocessable attendance records',
        status: 422,
      );

      final report = await engine().drain(
        userId: 'u1',
        isOwnerCurrent: () => true,
      );

      expect(report.abortReason, SyncAbortReason.rejected);
      expect(
        (await database.attendanceQueueEntry('unprocessable'))!.serverError,
        startsWith('terminal: '),
      );
    });

    test('a 413 stays retryable with backoff', () async {
      await seed(receipt: 'too-large');
      transport.onSubmit = (_) async => throw const ApiRequestError(
        message: 'Payload too large',
        status: 413,
      );

      final report = await engine().drain(
        userId: 'u1',
        isOwnerCurrent: () => true,
      );

      expect(report.abortReason, SyncAbortReason.serverError);
      expect(report.terminalFailed, 0);
      expect(report.retryableFailed, 1);

      final row = (await database.attendanceQueueEntry('too-large'))!;
      expect(row.syncStatus, AttendanceSyncStatus.failed);
      expect(row.serverError, isNot(startsWith('terminal:')));
      expect(row.retryCount, 1);
      expect(await database.countDrainableAttendance('u1'), 1);

      // The backoff, not a terminal stamp, postpones the next attempt.
      await engine().drain(userId: 'u1', isOwnerCurrent: () => true);
      expect(transport.submitted, hasLength(1));
      nowUtc = nowUtc.add(const Duration(seconds: 5));
      transport.onSubmit = (records) async => _inlineSuccess(records);
      await engine().drain(userId: 'u1', isOwnerCurrent: () => true);
      expect(
        (await database.attendanceQueueEntry('too-large'))!.syncStatus,
        AttendanceSyncStatus.confirmed,
      );
    });

    test('a 404 stays retryable (never terminalizes the batch)', () async {
      await seed(receipt: 'gone');
      transport.onSubmit = (_) async =>
          throw const ApiRequestError(message: 'Not found', status: 404);

      final report = await engine().drain(
        userId: 'u1',
        isOwnerCurrent: () => true,
      );

      expect(report.terminalFailed, 0);
      expect(
        (await database.attendanceQueueEntry('gone'))!.serverError,
        isNot(startsWith('terminal:')),
      );
      expect(await database.countDrainableAttendance('u1'), 1);
    });
  });

  group('per-owner drain futures (DD-F21)', () {
    test('an account switch mid-drain reports ownerChanged honestly', () async {
      await seed(receipt: 'old-owner', userId: 'u1');
      final gate = Completer<void>();
      transport.onSubmit = (records) async {
        if (records.first['clientAttemptId'] == 'old-owner') {
          await gate.future;
        }
        return _inlineSuccess(records);
      };

      final sync = engine();
      var owner = 'u1';
      final firstDrain = sync.drain(
        userId: 'u1',
        isOwnerCurrent: () => owner == 'u1',
      );
      await _waitUntil(() => transport.submitted.isNotEmpty);

      // The account switches: the new student's "Sync now" must not join the
      // previous owner's future.
      owner = 'u2';
      await seed(receipt: 'new-owner', userId: 'u2');
      final secondReport = await sync.drain(
        userId: 'u2',
        isOwnerCurrent: () => owner == 'u2',
      );

      expect(secondReport.confirmed, 1, reason: "u2's own queue was drained");
      expect(secondReport.abortReason, SyncAbortReason.none);
      expect(sync.isDrainingFor('u2'), isFalse);

      gate.complete();
      final firstReport = await firstDrain;

      expect(firstReport.abortReason, SyncAbortReason.ownerChanged);
      expect(firstReport.confirmed, 0);
      expect(
        (await database.attendanceQueueEntry('old-owner'))!.syncStatus,
        AttendanceSyncStatus.pending,
        reason: 'the previous owner keeps the evidence',
      );
      expect(
        syncDrainMessage(firstReport),
        isNot(contains('already synced')),
        reason: 'the message must never claim a foreign queue is synced',
      );
      expect(syncDrainMessage(firstReport), contains('Account changed'));
    });

    test(
      'SyncController.drainNow drains the new owner instead of joining',
      () async {
        final session = _SwitchableSession(studentA);
        final sync = engine();
        final gate = Completer<void>();
        transport.onSubmit = (records) async {
          if (records.first['clientAttemptId'] == 'a-row') {
            await gate.future;
          }
          return _inlineSuccess(records);
        };

        final container = ProviderContainer(
          overrides: <Override>[
            sessionProvider.overrideWith(() => session),
            appDatabaseProvider.overrideWithValue(database),
            syncEngineProvider.overrideWith((ref) => sync),
          ],
        );
        addTearDown(container.dispose);

        await seed(receipt: 'a-row', userId: 'u1');
        final controller = container.read(syncControllerProvider.notifier);

        final firstDrain = controller.drainNow();
        await _waitUntil(() => transport.submitted.isNotEmpty);

        await seed(receipt: 'b-row', userId: 'u2');
        session.switchTo(studentB);

        final secondReport = await controller.drainNow();
        expect(secondReport.confirmed, 1);
        expect(secondReport.abortReason, SyncAbortReason.none);

        gate.complete();
        final firstReport = await firstDrain;
        expect(firstReport.abortReason, SyncAbortReason.ownerChanged);
        expect(
          syncDrainMessage(firstReport),
          isNot(contains('already synced')),
        );
        expect(
          (await database.attendanceQueueEntry('a-row'))!.syncStatus,
          AttendanceSyncStatus.pending,
        );
      },
    );
  });

  group('retryOne during a drain (DD-F9)', () {
    test(
      'waits for the in-flight drain, then re-drains the reset row',
      () async {
        await seed(receipt: 'mid-drain');
        final gate = Completer<void>();
        var batch = 0;
        transport.onSubmit = (records) async {
          if (batch++ == 0) {
            await gate.future;
            return const SyncBatchSubmitResult(
              queued: false,
              results: <SyncRecordResult>[
                SyncRecordFailure(
                  error: 'Sync is temporarily unavailable',
                  retryable: true,
                ),
              ],
            );
          }
          return _inlineSuccess(records);
        };

        final container = ProviderContainer(
          overrides: <Override>[
            sessionProvider.overrideWith(() => _SwitchableSession(studentA)),
            appDatabaseProvider.overrideWithValue(database),
            syncEngineProvider.overrideWith((ref) => engine()),
          ],
        );
        addTearDown(container.dispose);
        final controller = container.read(syncControllerProvider.notifier);

        final firstDrain = controller.drainNow();
        await _waitUntil(() => transport.submitted.isNotEmpty);

        // The row is claimed by the running batch; the manual retry must not
        // be a no-op that just returns the in-flight report.
        final retryFuture = controller.retryOne('mid-drain');
        gate.complete();

        final firstReport = await firstDrain;
        expect(firstReport.retryableFailed, 1);
        expect(firstReport.confirmed, 0);

        final retryReport = await retryFuture;
        expect(retryReport.confirmed, 1);
        expect(transport.submitted, hasLength(2));
        expect(
          (await database.attendanceQueueEntry('mid-drain'))!.syncStatus,
          AttendanceSyncStatus.confirmed,
        );
      },
    );
  });
}
