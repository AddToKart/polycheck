import 'dart:io';

import 'package:drift/drift.dart' hide isNull, isNotNull;
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;

import 'package:polycheck_mobile/src/core/database/app_database.dart';
import 'package:polycheck_mobile/src/core/sync/attendance_pin_vault.dart';

/// Full AES-GCM over an in-memory key — hermetic while exercising the real
/// crypto path (a lost/tampered ciphertext is simulated by mutating bytes).
InMemoryAttendancePinCipher _cipher() =>
    InMemoryAttendancePinCipher(key: List<int>.filled(32, 4));

AppDatabase _databaseFor(String path) =>
    AppDatabase.forTesting(NativeDatabase(File(path)), pinCipher: _cipher());

Future<OfflineAttendanceQueueRow> _enqueueRow(
  AppDatabase database, {
  required String receipt,
  required String pin,
}) async {
  await database.enqueueAttendanceScan(
    clientReceiptId: receipt,
    userId: 'u1',
    sessionId: 'sess-1',
    studentId: 'u1',
    scannedToken: 'signed-token',
    checkpoint: 'start',
    inputChannel: 'camera',
    pinHash: 'p1\$pbkdf2-sha256\$100000\$c2FsdA\$ZGlnZXN0',
    pin: pin,
    latitude: 14.87,
    longitude: 120.99,
    accuracy: 8,
    locationCapturedAt: DateTime.utc(2026, 11, 10, 7, 59, 55),
    haversineDistance: 4,
    scannedAtUtc: DateTime.utc(2026, 11, 10, 8),
  );
  return (await database.attendanceQueueEntry(receipt))!;
}

/// Overwrites one row's persisted pin ciphertext (tamper simulation).
Future<OfflineAttendanceQueueRow> _rowWithPin(
  AppDatabase database,
  String receipt,
  String? pinEncrypted,
) async {
  if (pinEncrypted == null) {
    await (database.update(database.offlineAttendanceQueue)
          ..where((candidate) => candidate.clientReceiptId.equals(receipt)))
        .write(driftNullPinCiphertext);
  } else {
    await (database.update(
      database.offlineAttendanceQueue,
    )..where((candidate) => candidate.clientReceiptId.equals(receipt))).write(
      OfflineAttendanceQueueCompanion(pinEncrypted: Value(pinEncrypted)),
    );
  }
  return (await database.attendanceQueueEntry(receipt))!;
}

/// Alias to dodge the `isNull` clash between drift and the matchers, and to
/// satisfy drift's `Insertable` contract for a full-column write.
final Insertable<OfflineAttendanceQueueRow> driftNullPinCiphertext =
    const OfflineAttendanceQueueCompanion(pinEncrypted: Value(null));

Future<List<String>> _pinColumnNames(AppDatabase database) async {
  final rows = await database
      .customSelect(
        "SELECT name FROM pragma_table_info('offline_attendance_queue')",
      )
      .get();
  return <String>[for (final row in rows) row.data['name'] as String];
}

void main() {
  late Directory workspace;
  late AppDatabase database;

  setUp(() async {
    workspace = await Directory.systemTemp.createTemp('polycheck-pin-rest');
    database = _databaseFor(p.join(workspace.path, 'store.sqlite'));
  });

  tearDown(() async {
    await database.close();
    await workspace.delete(recursive: true);
  });

  group('PIN encrypted at rest (A-j/B-7)', () {
    test('enqueue encrypts the pin and never stores plaintext', () async {
      final row = await _enqueueRow(database, receipt: 'r1', pin: '4321');

      expect(row.pinEncrypted, isNotNull);
      expect(row.pinEncrypted, isNot(contains('4321')));
      expect(row.pinEncrypted, startsWith('v1.'));
    });

    test('the drain decrypt helper round-trips the pin', () async {
      final row = await _enqueueRow(database, receipt: 'r2', pin: '1234');

      expect(await database.decryptQueuePin(row), '1234');
    });

    test(
      'a tampered ciphertext decrypts to null (drain without pin)',
      () async {
        final row = await _enqueueRow(database, receipt: 'r3', pin: '1234');
        final persisted = row.pinEncrypted!;
        final tampered = '${persisted.substring(0, persisted.length - 3)}xyz';

        expect(
          await database.decryptQueuePin(
            await _rowWithPin(database, 'r3', tampered),
          ),
          isNull,
        );
        expect(
          await database.decryptQueuePin(
            await _rowWithPin(database, 'r3', null),
          ),
          isNull,
        );
      },
    );

    test('a row encrypted under a foreign key decrypts to null', () async {
      final row = await _enqueueRow(database, receipt: 'r4', pin: '7777');
      final fromAnotherInstallation = await InMemoryAttendancePinCipher(
        key: List<int>.filled(32, 42),
      ).encrypt('8888');
      expect(await database.decryptQueuePin(row), '7777');

      await (database.update(
        database.offlineAttendanceQueue,
      )..where((candidate) => candidate.clientReceiptId.equals('r4'))).write(
        OfflineAttendanceQueueCompanion(
          pinEncrypted: Value(fromAnotherInstallation),
        ),
      );
      final foreignRow = (await database.attendanceQueueEntry('r4'))!;

      expect(await database.decryptQueuePin(foreignRow), isNull);
    });

    test('rows queued without a pin carry no ciphertext', () async {
      final row = await _enqueueRow(database, receipt: 'r5', pin: '');

      expect(row.pinEncrypted, isNull);
      expect(await database.decryptQueuePin(row), isNull);
    });

    test(
      'clearQueuePin wipes the ciphertext on terminal reconciliation',
      () async {
        final row = await _enqueueRow(database, receipt: 'r6', pin: '5555');
        expect(row.pinEncrypted, isNotNull);

        await database.clearQueuePin('r6');

        final cleared = (await database.attendanceQueueEntry('r6'))!;
        expect(cleared.pinEncrypted, isNull);
        expect(await database.decryptQueuePin(cleared), isNull);
      },
    );
  });

  test(
    'cold start: a PIN-protected scan survives a full close + reopen',
    () async {
      // Process run 1: queue the encrypted scan, then end the process.
      final firstRun = _databaseFor(p.join(workspace.path, 'app.sqlite'));
      final row = await _enqueueRow(firstRun, receipt: 'cold-1', pin: '2468');
      final persistedCiphertext = row.pinEncrypted!;
      expect(persistedCiphertext, isNotNull);
      await firstRun.close();

      // Process run 2: fresh vault state, fresh database instance. The
      // secure-storage key (`polycheck.offline-encryption-key.v1`) is the
      // installation's fixed key, mirrored here by the same cipher key, and
      // the persisted ciphertext rebuilds the PIN for the replay batch.
      final secondRun = _databaseFor(p.join(workspace.path, 'app.sqlite'));
      final restored = (await secondRun.attendanceQueueEntry('cold-1'))!;
      expect(restored.pinEncrypted, persistedCiphertext);
      expect(await secondRun.decryptQueuePin(restored), '2468');
      await secondRun.close();
    },
  );

  test(
    'schema v2 upgrade: the v1→2 branch restores the column idempotently',
    () async {
      // Start from the v2 shape, then simulate the pre-upgrade v1 table by
      // dropping the v2-only column (SQLite 3.35+ ALTER TABLE DROP COLUMN).
      await database.customStatement(
        'ALTER TABLE offline_attendance_queue DROP COLUMN pin_encrypted',
      );
      expect(await _pinColumnNames(database), isNot(contains('pin_encrypted')));

      // Replay the exact v1→2 migration branch through the real callback.
      final migrator = Migrator(database);
      await database.migration.onUpgrade(migrator, 1, 2);
      expect(await _pinColumnNames(database), contains('pin_encrypted'));

      // Idempotent re-run: a duplicate ALTER is absorbed by the pragma check
      // the way a dirty database (or a re-run) would be.
      await database.migration.onUpgrade(migrator, 1, 2);
      expect(await _pinColumnNames(database), contains('pin_encrypted'));
    },
  );
}
