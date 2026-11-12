import 'dart:io';

import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:path/path.dart' as p;

import 'package:polycheck_mobile/src/core/database/app_database.dart';

/// Legacy `offline_attendance_queue` DDL as drift v2 created it (snake_case
/// columns; UTC datetimes are ISO-8601 text because the project sets
/// `store_date_time_values_as_text: true`). v1 is identical minus the
/// encrypted-PIN column.
String _legacyQueueDdl({required bool withPinEncrypted}) =>
    '''
CREATE TABLE "offline_attendance_queue" (
  "client_receipt_id" TEXT NOT NULL,
  "user_id" TEXT NOT NULL,
  "session_id" TEXT NOT NULL,
  "student_id" TEXT NOT NULL,
  "scanned_token" TEXT NOT NULL,
  "checkpoint" TEXT NULL,
  "pin_hash" TEXT NULL,${withPinEncrypted ? '\n  "pin_encrypted" TEXT NULL,' : ''}
  "latitude" REAL NULL,
  "longitude" REAL NULL,
  "accuracy" REAL NULL,
  "haversine_distance" REAL NULL,
  "is_mocked" INTEGER NOT NULL DEFAULT 0,
  "scanned_at_utc" TEXT NOT NULL,
  "sync_status" TEXT NOT NULL,
  "server_error" TEXT NULL,
  "retry_count" INTEGER NOT NULL DEFAULT 0,
  "last_sent_at" TEXT NULL,
  "created_at" TEXT NOT NULL,
  PRIMARY KEY ("client_receipt_id")
);
''';

/// Opens [file] as a legacy (pre-v3) database and seeds one queued check-in.
AppDatabase _openLegacy(File file, {required int version}) {
  final withPin = version >= 2;
  return AppDatabase.forTesting(
    NativeDatabase(
      file,
      setup: (legacy) {
        legacy.execute(_legacyQueueDdl(withPinEncrypted: withPin));
        final columns = <String>[
          'client_receipt_id',
          'user_id',
          'session_id',
          'student_id',
          'scanned_token',
          'checkpoint',
          'pin_hash',
          if (withPin) 'pin_encrypted',
          'latitude',
          'longitude',
          'accuracy',
          'haversine_distance',
          'is_mocked',
          'scanned_at_utc',
          'sync_status',
          'server_error',
          'retry_count',
          'last_sent_at',
          'created_at',
        ];
        legacy.execute(
          'INSERT INTO offline_attendance_queue '
          '(${columns.join(', ')}) VALUES '
          '(${List<String>.filled(columns.length, '?').join(', ')})',
          <Object?>[
            'legacy-1',
            'u1',
            'sess-1',
            'u1',
            'signed-token-legacy',
            'start',
            null,
            if (withPin) null,
            14.87,
            120.99,
            8.0,
            12.0,
            0,
            '2026-11-10T08:00:00.000Z',
            'PENDING',
            null,
            0,
            null,
            '2026-11-10T08:00:00.000Z',
          ],
        );
        legacy.userVersion = version;
      },
    ),
  );
}

Future<Set<String>> _queueColumns(AppDatabase database) async {
  final rows = await database
      .customSelect(
        "SELECT name FROM pragma_table_info('offline_attendance_queue')",
      )
      .get();
  return <String>{for (final row in rows) row.data['name']! as String};
}

Future<int> _userVersion(AppDatabase database) async {
  final row = await database.customSelect('PRAGMA user_version').getSingle();
  return (row.data.values.single! as num).toInt();
}

void main() {
  late Directory workspace;

  setUp(() async {
    workspace = await Directory.systemTemp.createTemp('polycheck-migration');
  });

  tearDown(() async {
    await workspace.delete(recursive: true);
  });

  File legacyFile(String name) => File(p.join(workspace.path, '$name.sqlite'));

  test(
    'v2 -> v3 adds the replayed-evidence columns and keeps the queue',
    () async {
      final database = _openLegacy(legacyFile('v2'), version: 2);
      addTearDown(database.close);

      final columns = await _queueColumns(database);
      expect(
        columns,
        containsAll(<String>['input_channel', 'location_captured_at']),
      );
      expect(columns, contains('pin_encrypted'));
      expect(await _userVersion(database), 3);

      // The v2 evidence survives untouched; the new columns are truthfully
      // empty (the channel and fix timestamp were never captured back then).
      final row = (await database.attendanceQueueEntry('legacy-1'))!;
      expect(row.syncStatus, AttendanceSyncStatus.pending);
      expect(row.scannedToken, 'signed-token-legacy');
      expect(row.latitude, 14.87);
      expect(row.accuracy, 8.0);
      expect(row.scannedAtUtc, DateTime.utc(2026, 11, 10, 8));
      expect(row.inputChannel, isNull);
      expect(row.locationCapturedAt, isNull);
      expect(await database.countDrainableAttendance('u1'), 1);

      // And the migrated database accepts the new evidence for new scans.
      await database.enqueueAttendanceScan(
        clientReceiptId: 'post-migration',
        userId: 'u1',
        sessionId: 'sess-1',
        studentId: 'u1',
        scannedToken: 'signed-token-new',
        inputChannel: 'manual',
        latitude: 14.87,
        longitude: 120.99,
        accuracy: 8,
        locationCapturedAt: DateTime.utc(2026, 11, 10, 7, 59, 55),
        scannedAtUtc: DateTime.utc(2026, 11, 10, 8),
      );

      final fresh = (await database.attendanceQueueEntry('post-migration'))!;
      expect(fresh.inputChannel, 'manual');
      expect(fresh.locationCapturedAt, DateTime.utc(2026, 11, 10, 7, 59, 55));
    },
  );

  test('v1 -> v3 applies the v2 and v3 steps in one open', () async {
    final database = _openLegacy(legacyFile('v1'), version: 1);
    addTearDown(database.close);

    final columns = await _queueColumns(database);
    expect(
      columns,
      containsAll(<String>[
        'pin_encrypted',
        'input_channel',
        'location_captured_at',
      ]),
    );
    expect(await _userVersion(database), 3);

    final row = (await database.attendanceQueueEntry('legacy-1'))!;
    expect(row.syncStatus, AttendanceSyncStatus.pending);
    expect(row.pinEncrypted, isNull);
    expect(row.inputChannel, isNull);
    expect(row.locationCapturedAt, isNull);
  });

  test('reopening a migrated database is a no-op', () async {
    final file = legacyFile('reopen');
    final first = _openLegacy(file, version: 2);
    await first.attendanceQueueEntry('legacy-1');
    await first.close();

    // A second open finds user_version 3 and skips the migration steps.
    final second = AppDatabase.forTesting(NativeDatabase(file));
    addTearDown(second.close);

    expect(await _userVersion(second), 3);
    final row = (await second.attendanceQueueEntry('legacy-1'))!;
    expect(row.inputChannel, isNull);
    expect(await second.countDrainableAttendance('u1'), 1);
  });
}
