import 'dart:async';

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/api/api_models.dart';
import 'package:polycheck_mobile/src/core/api/sync_api.dart';
import 'package:polycheck_mobile/src/core/database/app_database.dart';
import 'package:polycheck_mobile/src/core/models/attendance.dart';
import 'package:polycheck_mobile/src/core/network/api_error.dart';
import 'package:polycheck_mobile/src/core/sync/attendance_pin_vault.dart';
import 'package:polycheck_mobile/src/core/sync/sync_engine.dart';

class _FakeSyncTransport implements SyncTransport {
  Future<SyncBatchSubmitResult> Function(
    int callIndex,
    List<Map<String, dynamic>> records,
  )?
  onSubmit;
  Future<SyncBatchStatus> Function(String receiptId)? onStatus;

  final List<List<Map<String, dynamic>>> submitted =
      <List<Map<String, dynamic>>>[];
  int statusCalls = 0;

  @override
  Future<SyncBatchSubmitResult> submitBatch(
    List<Map<String, dynamic>> records,
  ) {
    final call = submitted.length;
    submitted.add(records);
    final handler = onSubmit;
    if (handler == null) {
      throw StateError('onSubmit not configured');
    }
    return handler(call, records);
  }

  @override
  Future<SyncBatchStatus> getBatchStatus(String receiptId) {
    statusCalls++;
    final handler = onStatus;
    if (handler == null) throw StateError('onStatus not configured');
    return handler(receiptId);
  }

  @override
  Future<List<SyncRecordResult>> submitSynchronously(
    List<Map<String, dynamic>> records,
  ) {
    throw UnimplementedError();
  }
}

AttendanceRecord _recordFor(
  Map<String, dynamic> payload, {
  String status = 'present',
}) {
  return AttendanceRecord(
    id: 'rec-${payload['clientAttemptId']}',
    sessionId: payload['sessionId']! as String,
    sectionId: 'sec-1',
    studentId: 'u1',
    timestamp: payload['scannedAt']! as String,
    status: AttendanceStatus.fromWire(status),
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

void main() {
  late AppDatabase database;
  late DateTime nowUtc;
  late _FakeSyncTransport transport;
  late AttendancePinVault pinVault;

  setUp(() {
    database = AppDatabase.forTesting(NativeDatabase.memory());
    nowUtc = DateTime.utc(2026, 11, 10, 8);
    transport = _FakeSyncTransport();
    pinVault = AttendancePinVault();
  });

  tearDown(() async {
    await database.close();
  });

  SyncEngine engine({
    int batchSize = 25,
    int maxReceiptPolls = 3,
    Duration receiptPollInterval = Duration.zero,
  }) {
    return SyncEngine(
      database: database,
      transport: transport,
      deviceId: () async => 'mobile-test-device',
      pinVault: pinVault,
      batchSize: batchSize,
      maxReceiptPolls: maxReceiptPolls,
      receiptPollInterval: receiptPollInterval,
      now: () => nowUtc,
    );
  }

  Future<void> seed({
    String receipt = 'r1',
    DateTime? scannedAt,
    String? pinHash,
    double? latitude,
    double? longitude,
    double? accuracy,
    DateTime? locationCapturedAt,
    bool isMocked = false,
    String checkpoint = 'start',
    String inputChannel = 'camera',
  }) {
    return database.enqueueAttendanceScan(
      clientReceiptId: receipt,
      userId: 'u1',
      sessionId: 'sess-1',
      studentId: 'u1',
      scannedToken: 'signed-token-$receipt',
      checkpoint: checkpoint,
      inputChannel: inputChannel,
      pinHash: pinHash,
      latitude: latitude,
      longitude: longitude,
      accuracy: accuracy,
      locationCapturedAt: locationCapturedAt,
      haversineDistance: 12,
      isMocked: isMocked,
      scannedAtUtc: scannedAt ?? DateTime.utc(2026, 11, 10, 8),
    );
  }

  Future<bool> drain(SyncEngine sync) async {
    await sync.drain(userId: 'u1', isOwnerCurrent: () => true);
    return true;
  }

  group('payload builder', () {
    test('emits the exact ScanAttendanceDto whitelist', () async {
      final capturedAt = DateTime.utc(2026, 11, 10, 7, 59, 42);
      await seed(
        latitude: 14.87,
        longitude: 120.99,
        accuracy: 8,
        locationCapturedAt: capturedAt,
        inputChannel: 'manual',
      );
      final row = (await database.attendanceQueueEntry('r1'))!;

      final payload = buildAttendanceSyncPayload(
        row,
        deviceId: 'mobile-device-1',
      );

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
      });
      expect(payload['sessionId'], 'sess-1');
      expect(payload['qrToken'], 'signed-token-r1');
      expect(payload['scannedAt'], '2026-11-10T08:00:00.000Z');
      expect(payload['clientAttemptId'], 'r1');
      expect(payload['inputChannel'], 'manual');
      expect(payload['lat'], 14.87);
      expect(payload['lon'], 120.99);
      expect(payload['locationCapturedAt'], '2026-11-10T07:59:42.000Z');
      expect(payload['accuracyMeters'], 8);
      expect(payload.containsKey('studentId'), isFalse);
      expect(payload.containsKey('checkpoint'), isFalse);
      expect(payload.containsKey('pin'), isFalse);
    });

    test('online evidence omits coordinates and can include a PIN', () async {
      await seed(pinHash: 'p1\$pbkdf2-sha256\$1\$s\$d', inputChannel: 'image');
      final row = (await database.attendanceQueueEntry('r1'))!;
      pinVault.remember('r1', '1234');

      final payload = buildAttendanceSyncPayload(
        row,
        deviceId: '',
        pin: pinVault.pinFor('r1'),
      );

      expect(payload.containsKey('lat'), isFalse);
      expect(payload.containsKey('lon'), isFalse);
      expect(
        payload.containsKey('locationCapturedAt'),
        isFalse,
        reason: 'online sessions stay location-free (RA 10173)',
      );
      expect(payload['inputChannel'], 'image');
      expect(payload.containsKey('deviceId'), isFalse);
      expect(payload['pin'], '1234');
      expect(payload.containsKey('mocked'), isFalse);
    });

    test('flags mocked in-person evidence', () async {
      await seed(latitude: 14.87, longitude: 120.99, isMocked: true);
      final row = (await database.attendanceQueueEntry('r1'))!;

      final payload = buildAttendanceSyncPayload(row);

      expect(payload['mocked'], isTrue);
    });
  });

  group('receipt reconciliation', () {
    test('inline success marks CONFIRMED and caches the record', () async {
      await seed();
      transport.onSubmit = (_, records) async => _inlineSuccess(records);

      final report = await engine().drain(
        userId: 'u1',
        isOwnerCurrent: () => true,
      );

      final row = (await database.attendanceQueueEntry('r1'))!;
      expect(row.syncStatus, AttendanceSyncStatus.confirmed);
      expect(report.confirmed, 1);
      expect(report.attempted, 1);
      expect(report.remaining, 0);
      expect(await database.watchPendingQueueCount('u1').first, 0);
      final records = await database.watchMyAttendance('u1', 'u1').first;
      expect(records.single.id, 'rec-r1');
      expect(pinVault.length, 0);
    });

    test('queued receipt polls until completed', () async {
      await seed();
      transport.onSubmit = (_, _) async =>
          const SyncBatchSubmitResult(queued: true, receiptId: 'receipt-1');
      transport.onStatus = (receiptId) async {
        expect(receiptId, 'receipt-1');
        return SyncBatchStatus(
          state: 'completed',
          results: <SyncRecordResult>[
            SyncRecordSuccess(
              _recordFor(<String, dynamic>{
                'clientAttemptId': 'r1',
                'sessionId': 'sess-1',
                'scannedAt': '2026-11-10T08:00:00.000Z',
              }),
            ),
          ],
        );
      };

      final report = await engine().drain(
        userId: 'u1',
        isOwnerCurrent: () => true,
      );

      expect(transport.statusCalls, 1);
      expect(report.confirmed, 1);
      expect(
        (await database.attendanceQueueEntry('r1'))!.syncStatus,
        AttendanceSyncStatus.confirmed,
      );
    });

    test(
      'duplicate receipt marks DISPUTED_DUPLICATE (first arrival wins)',
      () async {
        await seed();
        transport.onSubmit = (_, _) async => const SyncBatchSubmitResult(
          queued: false,
          results: <SyncRecordResult>[
            SyncRecordFailure(
              error: 'Attendance was already submitted for this session',
              retryable: false,
            ),
          ],
        );

        final report = await engine().drain(
          userId: 'u1',
          isOwnerCurrent: () => true,
        );

        final row = (await database.attendanceQueueEntry('r1'))!;
        expect(row.syncStatus, AttendanceSyncStatus.disputedDuplicate);
        expect(row.serverError, contains('already submitted'));
        expect(report.duplicates, 1);
        expect(report.terminalFailed, 0);
        expect(await database.countDrainableAttendance('u1'), 0);
        expect(await database.watchPendingQueueCount('u1').first, 0);
      },
    );

    test(
      'terminal evidence is FAILED, excluded from retries and counts',
      () async {
        await seed();
        transport.onSubmit = (_, _) async => const SyncBatchSubmitResult(
          queued: false,
          results: <SyncRecordResult>[
            SyncRecordFailure(
              error: 'The QR attendance window has expired',
              retryable: false,
            ),
          ],
        );

        final report = await engine().drain(
          userId: 'u1',
          isOwnerCurrent: () => true,
        );

        final row = (await database.attendanceQueueEntry('r1'))!;
        expect(row.syncStatus, AttendanceSyncStatus.failed);
        expect(row.serverError, startsWith('terminal:'));
        expect(row.retryCount, 0);
        expect(report.terminalFailed, 1);
        expect(await database.drainableAttendanceQueue('u1'), isEmpty);
        expect(await database.watchPendingQueueCount('u1').first, 0);

        await drain(engine());
        expect(transport.submitted, hasLength(1));
      },
    );

    test(
      'retryable failure stays FAILED and backs off before retrying',
      () async {
        await seed();
        transport.onSubmit = (_, _) async => const SyncBatchSubmitResult(
          queued: false,
          results: <SyncRecordResult>[
            SyncRecordFailure(
              error: 'Sync is temporarily unavailable',
              retryable: true,
            ),
          ],
        );

        final sync = engine();
        await drain(sync);

        final failed = (await database.attendanceQueueEntry('r1'))!;
        expect(failed.syncStatus, AttendanceSyncStatus.failed);
        expect(failed.serverError, isNot(startsWith('terminal:')));
        expect(failed.retryCount, 1);
        expect(await database.countDrainableAttendance('u1'), 1);

        await drain(sync);
        expect(
          transport.submitted,
          hasLength(1),
          reason: 'backoff not elapsed',
        );

        nowUtc = nowUtc.add(const Duration(seconds: 5));
        transport.onSubmit = (_, records) async => _inlineSuccess(records);
        await drain(sync);
        expect(transport.submitted, hasLength(2));
        expect(
          (await database.attendanceQueueEntry('r1'))!.syncStatus,
          AttendanceSyncStatus.confirmed,
        );
      },
    );

    test('receipt state failed leaves retryable evidence', () async {
      await seed();
      transport.onSubmit = (_, _) async =>
          const SyncBatchSubmitResult(queued: true, receiptId: 'receipt-2');
      transport.onStatus = (_) async => const SyncBatchStatus(state: 'failed');

      final report = await engine().drain(
        userId: 'u1',
        isOwnerCurrent: () => true,
      );

      final row = (await database.attendanceQueueEntry('r1'))!;
      expect(report.abortReason, SyncAbortReason.receiptFailed);
      expect(row.syncStatus, AttendanceSyncStatus.failed);
      expect(row.serverError, contains('did not accept this batch'));
      expect(await database.countDrainableAttendance('u1'), 1);
    });

    test('receipt polling timeout leaves retryable evidence', () async {
      await seed();
      transport.onSubmit = (_, _) async =>
          const SyncBatchSubmitResult(queued: true, receiptId: 'receipt-3');
      transport.onStatus = (_) async => const SyncBatchStatus(state: 'pending');

      final report = await engine(
        maxReceiptPolls: 2,
      ).drain(userId: 'u1', isOwnerCurrent: () => true);

      final row = (await database.attendanceQueueEntry('r1'))!;
      expect(report.abortReason, SyncAbortReason.receiptTimeout);
      expect(row.syncStatus, AttendanceSyncStatus.failed);
      expect(row.serverError, contains('Awaiting server confirmation'));
      expect(transport.statusCalls, 2);
    });

    test('missing result for a claimed row is retryable', () async {
      await seed(receipt: 'r1');
      await seed(receipt: 'r2');
      transport.onSubmit = (_, records) async => SyncBatchSubmitResult(
        queued: false,
        results: <SyncRecordResult>[
          SyncRecordSuccess(_recordFor(records.first)),
        ],
      );

      final report = await engine().drain(
        userId: 'u1',
        isOwnerCurrent: () => true,
      );

      expect(report.confirmed, 1);
      expect(report.retryableFailed, 1);
      expect(
        (await database.attendanceQueueEntry('r2'))!.syncStatus,
        AttendanceSyncStatus.failed,
      );
    });
  });

  group('abort paths', () {
    test('401 aborts and releases the queue without penalty', () async {
      await seed();
      transport.onSubmit = (_, _) async =>
          throw const ApiRequestError(message: 'Session expired', status: 401);

      final report = await engine().drain(
        userId: 'u1',
        isOwnerCurrent: () => true,
      );

      final row = (await database.attendanceQueueEntry('r1'))!;
      expect(report.abortReason, SyncAbortReason.unauthorized);
      expect(row.syncStatus, AttendanceSyncStatus.pending);
      expect(row.retryCount, 0);
      expect(await database.watchPendingQueueCount('u1').first, 1);
    });

    test('maintenance 503 keeps evidence pending', () async {
      await seed();
      transport.onSubmit = (_, _) async => throw const ApiRequestError(
        message: 'Polycheck is under maintenance',
        status: 503,
        code: 'system_maintenance',
      );

      final report = await engine().drain(
        userId: 'u1',
        isOwnerCurrent: () => true,
      );

      expect(report.abortReason, SyncAbortReason.maintenance);
      expect(
        (await database.attendanceQueueEntry('r1'))!.syncStatus,
        AttendanceSyncStatus.pending,
      );
      expect(await database.countDrainableAttendance('u1'), 1);
    });

    test('4xx rejection is terminal and never retried', () async {
      await seed();
      transport.onSubmit = (_, _) async => throw const ApiRequestError(
        message: 'Validation failed',
        status: 422,
      );

      final report = await engine().drain(
        userId: 'u1',
        isOwnerCurrent: () => true,
      );

      final row = (await database.attendanceQueueEntry('r1'))!;
      expect(report.abortReason, SyncAbortReason.rejected);
      expect(row.serverError, startsWith('terminal:'));
      expect(row.syncStatus, AttendanceSyncStatus.failed);
      expect(await database.drainableAttendanceQueue('u1'), isEmpty);
    });

    test('429 is retryable, not terminal', () async {
      await seed();
      transport.onSubmit = (_, _) async => throw const ApiRequestError(
        message: 'Too many requests',
        status: 429,
      );

      final report = await engine().drain(
        userId: 'u1',
        isOwnerCurrent: () => true,
      );

      final row = (await database.attendanceQueueEntry('r1'))!;
      expect(report.abortReason, SyncAbortReason.serverError);
      expect(row.syncStatus, AttendanceSyncStatus.failed);
      expect(row.serverError, isNot(startsWith('terminal:')));
      expect(row.retryCount, 1);
    });

    test('owner switch mid-drain releases the claim and stops', () async {
      await seed(receipt: 'r1');
      await seed(receipt: 'r2', scannedAt: DateTime.utc(2026, 11, 10, 8, 1));
      var owner = 'u1';
      transport.onSubmit = (_, records) async {
        owner = 'another-user';
        return _inlineSuccess(records);
      };

      final report = await engine(
        batchSize: 1,
      ).drain(userId: 'u1', isOwnerCurrent: () => owner == 'u1');

      expect(report.abortReason, SyncAbortReason.ownerChanged);
      expect(report.confirmed, 0);
      expect(
        (await database.attendanceQueueEntry('r1'))!.syncStatus,
        AttendanceSyncStatus.pending,
      );
      expect(
        (await database.attendanceQueueEntry('r2'))!.syncStatus,
        AttendanceSyncStatus.pending,
      );
    });
  });

  group('drain mechanics', () {
    test('concurrent drain calls share one in-flight run', () async {
      await seed();
      final gate = Completer<SyncBatchSubmitResult>();
      transport.onSubmit = (_, _) => gate.future;

      final sync = engine();
      final first = sync.drain(userId: 'u1', isOwnerCurrent: () => true);
      final second = sync.drain(userId: 'u1', isOwnerCurrent: () => true);
      expect(identical(first, second), isTrue);
      await Future<void>.delayed(Duration.zero);
      expect(transport.submitted, hasLength(1));

      gate.complete(_inlineSuccess(transport.submitted.single));
      final report = await first;
      expect(report.confirmed, 1);
      expect(sync.isDraining, isFalse);
    });

    test('stale SYNCING claims are reset at drain start', () async {
      await seed();
      await database.markQueueSyncing(
        'r1',
        sentAt: nowUtc.subtract(const Duration(minutes: 5)),
      );
      transport.onSubmit = (_, records) async => _inlineSuccess(records);

      await drain(engine());

      expect(
        (await database.attendanceQueueEntry('r1'))!.syncStatus,
        AttendanceSyncStatus.confirmed,
      );
    });

    test('batch size caps each upload while draining all rows', () async {
      for (var index = 0; index < 5; index++) {
        await seed(
          receipt: 'r$index',
          scannedAt: DateTime.utc(2026, 11, 10, 8, index),
        );
      }
      transport.onSubmit = (_, records) async => _inlineSuccess(records);

      await drain(engine(batchSize: 2));

      expect(transport.submitted.map((batch) => batch.length), <int>[2, 2, 1]);
      expect(await database.countDrainableAttendance('u1'), 0);
    });

    test('rows are sent oldest-first', () async {
      await seed(
        receipt: 'later',
        scannedAt: DateTime.utc(2026, 11, 10, 8, 30),
      );
      await seed(
        receipt: 'earlier',
        scannedAt: DateTime.utc(2026, 11, 10, 8, 10),
      );
      transport.onSubmit = (_, records) async => _inlineSuccess(records);

      await drain(engine());

      expect(
        transport.submitted.single
            .map((payload) => payload['clientAttemptId'])
            .toList(),
        <String>['earlier', 'later'],
      );
    });
  });

  group('backoff math', () {
    test('grows exponentially and caps', () {
      expect(attendanceRetryBackoff(0), Duration.zero);
      expect(attendanceRetryBackoff(-1), Duration.zero);
      expect(attendanceRetryBackoff(1), const Duration(seconds: 5));
      expect(attendanceRetryBackoff(2), const Duration(seconds: 10));
      expect(attendanceRetryBackoff(3), const Duration(seconds: 20));
      expect(attendanceRetryBackoff(7), const Duration(minutes: 5));
      expect(attendanceRetryBackoff(40), const Duration(minutes: 5));
    });

    test('terminal evidence is never eligible', () {
      final row = OfflineAttendanceQueueRow(
        clientReceiptId: 'r1',
        userId: 'u1',
        sessionId: 'sess-1',
        studentId: 'u1',
        scannedToken: 'token',
        checkpoint: null,
        pinHash: null,
        latitude: null,
        longitude: null,
        accuracy: null,
        haversineDistance: null,
        isMocked: false,
        scannedAtUtc: DateTime.utc(2026, 11, 10, 8),
        syncStatus: AttendanceSyncStatus.failed,
        serverError: 'terminal: expired',
        retryCount: 9,
        lastSentAt: DateTime.utc(2026, 11, 10, 7),
        createdAt: DateTime.utc(2026, 11, 10, 8),
      );

      expect(
        isAttendanceRetryEligible(row, DateTime.utc(2026, 11, 11)),
        isFalse,
      );
    });
  });

  group('toast copy', () {
    test('describes confirmed, duplicate and abort reports', () {
      expect(
        syncDrainMessage(const SyncDrainReport(attempted: 2, confirmed: 2)),
        '2 check-ins synced.',
      );
      expect(
        syncDrainMessage(const SyncDrainReport(attempted: 1, duplicates: 1)),
        contains('duplicate'),
      );
      expect(
        syncDrainMessage(
          const SyncDrainReport(abortReason: SyncAbortReason.unauthorized),
        ),
        contains('Sign in again'),
      );
      expect(
        syncDrainMessage(
          const SyncDrainReport(abortReason: SyncAbortReason.maintenance),
        ),
        contains('maintenance'),
      );
      expect(
        syncDrainMessage(
          const SyncDrainReport(abortReason: SyncAbortReason.serverError),
        ),
        contains('retry automatically'),
      );
      expect(
        syncDrainMessage(const SyncDrainReport()),
        'Everything is already synced.',
      );
    });
  });
}
