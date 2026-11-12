import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
// Transitive dependency via flutter_test (used internally by its binding);
// not declared in pubspec.yaml, whose edits are out of scope for this wave —
// timer determinism for the 30-second drain test needs it.
// ignore: depend_on_referenced_packages
import 'package:fake_async/fake_async.dart';

import 'package:polycheck_mobile/src/core/api/api_models.dart';
import 'package:polycheck_mobile/src/core/api/sync_api.dart';
import 'package:polycheck_mobile/src/core/database/app_database.dart';
import 'package:polycheck_mobile/src/core/models/attendance.dart';
import 'package:polycheck_mobile/src/core/network/api_error.dart';
import 'package:polycheck_mobile/src/core/providers/session_provider.dart';
import 'package:polycheck_mobile/src/core/sync/attendance_pin_vault.dart';
import 'package:polycheck_mobile/src/core/sync/sync_engine.dart';
import 'package:polycheck_mobile/src/core/sync/sync_lifecycle_binder.dart';
import 'package:polycheck_mobile/src/core/utils/device_security.dart';

import '../../features/student/student_test_harness.dart' show studentUser;
import '../../helpers/auth_harness.dart';

class _FakeSyncTransport implements SyncTransport {
  _FakeSyncTransport();

  final List<List<Map<String, dynamic>>> submitted =
      <List<Map<String, dynamic>>>[];
  Future<SyncBatchSubmitResult> Function(List<Map<String, dynamic>> records)
  onSubmit = (records) async => SyncBatchSubmitResult(
    queued: false,
    results: <SyncRecordResult>[
      for (final payload in records)
        SyncRecordSuccess(
          AttendanceRecord(
            id: 'rec-${payload['clientAttemptId']}',
            sessionId: payload['sessionId']! as String,
            sectionId: 'sec-1',
            studentId: 'u1',
            timestamp: payload['scannedAt']! as String,
            status: AttendanceStatus.present,
            isSynced: true,
          ),
        ),
    ],
  );

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

void main() {
  late Directory workspace;
  late AppDatabase database;
  late _FakeSyncTransport transport;
  late AttendancePinVault pinVault;

  setUp(() async {
    workspace = await Directory.systemTemp.createTemp('polycheck-defense');
    database = AppDatabase.forTesting(
      NativeDatabase.memory(),
      pinCipher: InMemoryAttendancePinCipher(key: List<int>.filled(32, 7)),
    );
    transport = _FakeSyncTransport();
    pinVault = AttendancePinVault();
  });

  tearDown(() async {
    await database.close();
    await workspace.delete(recursive: true);
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
      now: () => DateTime.utc(2026, 11, 10, 8),
    );
  }

  Future<void> seed({
    String receipt = 'r1',
    String? pin,
    bool pinRequired = false,
  }) {
    return database.enqueueAttendanceScan(
      clientReceiptId: receipt,
      userId: 'u1',
      sessionId: 'sess-1',
      studentId: 'u1',
      scannedToken: 'signed-token-$receipt',
      checkpoint: 'start',
      inputChannel: 'camera',
      pinHash: pinRequired
          ? 'p1\$pbkdf2-sha256\$100000\$c2FsdA\$ZGlnZXN0'
          : null,
      pin: pin,
      latitude: 14.87,
      longitude: 120.99,
      accuracy: 8,
      locationCapturedAt: DateTime.utc(2026, 11, 10, 7, 59, 58),
      haversineDistance: 4,
      scannedAtUtc: DateTime.utc(2026, 11, 10, 8),
    );
  }

  group('deviceSecurity evidence on every replayed payload', () {
    test('the batch payload carries the probe snapshot', () async {
      await seed();
      final sync = engine(
        deviceSecurityProber: const _ScriptedProbe(
          DeviceSecurityEvidence(
            rootDetected: false,
            hookDetected: false,
            emulatorDetected: true,
          ),
        ),
      );

      final report = await sync.drain(userId: 'u1', isOwnerCurrent: () => true);

      expect(report.confirmed, 1);
      final payload = transport.submitted.single.single;
      expect(
        (payload['deviceSecurity'] as Map<String, dynamic>)['emulatorDetected'],
        isTrue,
      );
    });

    test(
      'a null prober omits the field entirely (ScanDto whitelist)',
      () async {
        await seed();
        await engine().drain(userId: 'u1', isOwnerCurrent: () => true);

        final payload = transport.submitted.single.single;
        expect(payload.containsKey('deviceSecurity'), isFalse);
      },
    );
  });

  group('PIN resolution at drain (A-j/B-7)', () {
    test('the in-memory vault wins for a live drain', () async {
      await seed(receipt: 'v1', pin: '9999', pinRequired: true);
      pinVault.remember('v1', '1111');

      await engine().drain(userId: 'u1', isOwnerCurrent: () => true);

      final payload = transport.submitted.single.single;
      expect(payload['pin'], '1111');
    });

    test('a cold start resolves the PIN from the encrypted column', () async {
      await seed(receipt: 'v2', pin: '2468', pinRequired: true);
      // The process "restarted": no vault entry, only the ciphertext.
      expect(pinVault.pinFor('v2'), isNull);

      await engine().drain(userId: 'u1', isOwnerCurrent: () => true);

      final payload = transport.submitted.single.single;
      expect(payload['pin'], '2468');
    });

    test(
      'a lost ciphertext drains WITHOUT the pin (terminally rejected later)',
      () async {
        await seed(receipt: 'v3', pin: '2468', pinRequired: true);
        await database.clearQueuePin('v3');

        await engine().drain(userId: 'u1', isOwnerCurrent: () => true);

        final payload = transport.submitted.single.single;
        expect(payload.containsKey('pin'), isFalse);
      },
    );
  });

  group('Terminal reconciliation clears the persisted PIN', () {
    test('CONFIRMED clears the ciphertext and the vault', () async {
      await seed(receipt: 't1', pin: '2468', pinRequired: true);
      pinVault.remember('t1', '2468');

      await engine().drain(userId: 'u1', isOwnerCurrent: () => true);

      final row = (await database.attendanceQueueEntry('t1'))!;
      expect(row.syncStatus, AttendanceSyncStatus.confirmed);
      expect(row.pinEncrypted, isNull);
      expect(pinVault.pinFor('t1'), isNull);
    });

    test('DISPUTED_DUPLICATE clears the ciphertext', () async {
      await seed(receipt: 't2', pin: '2468', pinRequired: true);
      transport.onSubmit = (_) async => const SyncBatchSubmitResult(
        queued: false,
        results: <SyncRecordResult>[
          SyncRecordFailure(
            error: 'Attendance was already submitted for this session',
            retryable: false,
          ),
        ],
      );

      await engine().drain(userId: 'u1', isOwnerCurrent: () => true);

      final row = (await database.attendanceQueueEntry('t2'))!;
      expect(row.syncStatus, AttendanceSyncStatus.disputedDuplicate);
      expect(row.pinEncrypted, isNull);
    });

    test(
      'terminal FAILED clears, retryable FAILED keeps the ciphertext',
      () async {
        await seed(receipt: 't3', pin: '2468', pinRequired: true);
        await seed(receipt: 't4', pin: '2468', pinRequired: true);
        transport.onSubmit = (records) async {
          final results = <SyncRecordResult>[];
          for (final payload in records) {
            results.add(
              payload['clientAttemptId'] == 't3'
                  ? const SyncRecordFailure(
                      error: 'The QR attendance window has expired',
                      retryable: false,
                    )
                  : const SyncRecordFailure(
                      error: 'Sync is temporarily unavailable',
                      retryable: true,
                    ),
            );
          }
          return SyncBatchSubmitResult(queued: false, results: results);
        };

        await engine().drain(userId: 'u1', isOwnerCurrent: () => true);

        final terminal = (await database.attendanceQueueEntry('t3'))!;
        final retryable = (await database.attendanceQueueEntry('t4'))!;
        expect(terminal.serverError, startsWith('terminal:'));
        expect(terminal.pinEncrypted, isNull);
        expect(retryable.serverError, isNot(startsWith('terminal:')));
        expect(
          retryable.pinEncrypted,
          isNotNull,
          reason: 'the replay still needs the PIN after a retryable failure',
        );
      },
    );
  });

  group('retryOne (per-row manual retry)', () {
    test(
      'releases one row to PENDING preserving evidence, then drains',
      () async {
        // Simulate a failed drain first (server down → retryable stop).
        await seed(receipt: 'w1');
        transport.onSubmit = (_) async => const SyncBatchSubmitResult(
          queued: false,
          results: <SyncRecordResult>[
            SyncRecordFailure(error: 'temporary', retryable: true),
          ],
        );
        final sync = engine();
        await sync.drain(userId: 'u1', isOwnerCurrent: () => true);
        final failed = (await database.attendanceQueueEntry('w1'))!;
        expect(failed.retryCount, 1);

        // Retry: server healed; the row should re-upload immediately (no
        // backoff wait) with its ORIGINAL clientReceiptId.
        transport.onSubmit = (records) async => SyncBatchSubmitResult(
          queued: false,
          results: <SyncRecordResult>[
            SyncRecordSuccess(
              AttendanceRecord(
                id: 'rec-w1',
                sessionId: records.single['sessionId']! as String,
                sectionId: 'sec-1',
                studentId: 'u1',
                timestamp: records.single['scannedAt']! as String,
                status: AttendanceStatus.present,
                isSynced: true,
              ),
            ),
          ],
        );

        final container = ProviderContainer(
          overrides: <Override>[
            sessionProvider.overrideWith(
              () => FakeSessionController(studentUser.copyWith(id: 'u1')),
            ),
            appDatabaseProvider.overrideWithValue(database),
            syncEngineProvider.overrideWith((ref) => sync),
          ],
        );
        addTearDown(container.dispose);

        final controller = container.read(syncControllerProvider.notifier);
        final report = await controller.retryOne('w1');

        expect(report.confirmed, 1);
        final row = (await database.attendanceQueueEntry('w1'))!;
        expect(row.syncStatus, AttendanceSyncStatus.confirmed);
        expect(row.clientReceiptId, 'w1');
        expect(transport.submitted.length, 2);
      },
    );

    test('rows of another user are ignored', () async {
      await database.enqueueAttendanceScan(
        clientReceiptId: 'foreign-1',
        userId: 'student-other',
        sessionId: 'sess-1',
        studentId: 'student-other',
        scannedToken: 't',
        inputChannel: 'camera',
        scannedAtUtc: DateTime.utc(2026, 11, 10, 8),
      );

      final container = ProviderContainer(
        overrides: <Override>[
          sessionProvider.overrideWith(
            () => FakeSessionController(studentUser.copyWith(id: 'u1')),
          ),
          appDatabaseProvider.overrideWithValue(database),
          syncEngineProvider.overrideWith((ref) => engine()),
        ],
      );
      addTearDown(container.dispose);

      final controller = container.read(syncControllerProvider.notifier);
      final report = await controller.retryOne('foreign-1');

      expect(report.isEmpty, isTrue);
      final row = (await database.attendanceQueueEntry('foreign-1'))!;
      expect(row.syncStatus, AttendanceSyncStatus.pending);
      expect(transport.submitted, isEmpty);
    });
  });

  group('30-second foreground drain timer', () {
    test(
      'ticks fire the drain callback at the RN cadence and stop cancels',
      () {
        fakeAsync((async) {
          var ticks = 0;
          final timer = SyncForegroundDrainTimer(onTick: () => ticks++);

          timer.start();
          async.elapse(const Duration(seconds: 30));
          expect(ticks, 1);
          async.elapse(const Duration(seconds: 60));
          expect(ticks, 3);

          timer.stop();
          async.elapse(const Duration(minutes: 5));
          expect(ticks, 3, reason: 'stopped timers never tick again');

          // Idempotent start.
          timer.start();
          timer.start();
          async.elapse(const Duration(seconds: 30));
          expect(ticks, 4);
        });
      },
    );
  });
}
