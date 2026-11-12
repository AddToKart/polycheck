import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/database/app_database.dart';
import 'package:polycheck_mobile/src/core/models/attendance.dart';
import 'package:polycheck_mobile/src/core/models/notification.dart';
import 'package:polycheck_mobile/src/core/models/session.dart';
import 'package:polycheck_mobile/src/core/models/subject.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';

void main() {
  late AppDatabase database;

  setUp(() {
    database = AppDatabase.forTesting(NativeDatabase.memory());
  });

  tearDown(() async {
    await database.close();
  });

  const student = User(
    id: 'u1',
    fullName: 'Student One',
    role: UserRole.student,
    enrolledSectionIds: ['sec-1'],
  );

  const subject = Subject(id: 'subj-1', name: 'Data Structures', code: 'CS201');
  const section = Section(
    id: 'sec-1',
    subjectId: 'subj-1',
    section: '1-A',
    course: 'BSIT',
    teacherId: 't1',
  );
  const session = Session(
    id: 'sess-1',
    sectionId: 'sec-1',
    date: '2026-11-10',
    startTime: '08:00',
    endTime: '09:00',
    teacherId: 't1',
  );
  const record = AttendanceRecord(
    id: 'rec-1',
    sessionId: 'sess-1',
    sectionId: 'sec-1',
    studentId: 'u1',
    status: AttendanceStatus.present,
    isSynced: true,
  );
  const notification = AppNotification(
    id: 'n1',
    type: NotificationType.disputeResolved,
    title: 'Dispute resolved',
    body: 'Your dispute was accepted.',
    createdAt: '2026-11-10T08:00:00.000Z',
  );

  test('round-trips the read caches and watches the decoded models', () async {
    await database.replaceSubjects('u1', [subject]);
    await database.replaceSections('u1', [section]);
    await database.upsertSessions('u1', [session]);
    await database.replaceRoster('u1', 'sec-1', [student]);
    await database.upsertAttendance('u1', [record]);
    await database.upsertNotifications('u1', [notification]);
    await database.writeProfile(student);
    await database.writeEnrolledSectionIds('u1', ['sec-1']);

    expect(await database.watchSubjects('u1').first, [subject]);
    expect(await database.watchSections('u1', subjectId: 'subj-1').first, [
      section,
    ]);
    expect(await database.watchSessionsForSection('u1', 'sec-1').first, [
      session,
    ]);
    expect(await database.watchRoster('u1', 'sec-1').first, [student]);
    expect(await database.watchMyAttendance('u1', 'u1').first, [record]);
    expect(await database.watchNotifications('u1').first, [notification]);
    expect(await database.watchUnreadNotificationCount('u1').first, 1);

    final profile = await database.readActiveProfile();
    expect(profile?.userId, 'u1');
    expect(profile?.user.fullName, 'Student One');
    expect(await database.readEnrolledSectionIds('u1'), ['sec-1']);
  });

  test('notification read stamps survive a refresh upsert', () async {
    await database.upsertNotifications('u1', [notification]);
    await database.markNotificationRead(
      'u1',
      'n1',
      readAt: DateTime.utc(2026, 11, 11),
    );
    expect(await database.watchUnreadNotificationCount('u1').first, 0);

    await database.upsertNotifications('u1', [
      notification.copyWith(title: 'Updated title'),
    ]);
    expect(await database.watchUnreadNotificationCount('u1').first, 0);
    final rows = await database.watchNotifications('u1').first;
    expect(rows.single.title, 'Updated title');
  });

  test(
    'attendance queue transitions PENDING -> SYNCING -> CONFIRMED',
    () async {
      await database.enqueueAttendanceScan(
        clientReceiptId: 'receipt-1',
        userId: 'u1',
        sessionId: 'sess-1',
        studentId: 'u1',
        scannedToken: 'token',
        checkpoint: 'start',
        inputChannel: 'camera',
        latitude: 14.87,
        longitude: 120.99,
        accuracy: 8,
        locationCapturedAt: DateTime.utc(2026, 11, 10, 7, 59, 50),
        haversineDistance: 12,
        scannedAtUtc: DateTime.utc(2026, 11, 10, 8),
      );

      expect(await database.watchPendingQueueCount('u1').first, 1);
      var rows = await database.pendingAttendanceQueue('u1');
      expect(rows.single.syncStatus, AttendanceSyncStatus.pending);

      await database.markQueueSyncing('receipt-1');
      final syncing = await database.attendanceQueueEntry('receipt-1');
      expect(syncing?.syncStatus, AttendanceSyncStatus.syncing);
      expect(await database.drainableAttendanceQueue('u1'), isEmpty);
      expect(await database.watchPendingQueueCount('u1').first, 0);

      await database.markQueueConfirmed('receipt-1');
      rows = await database.drainableAttendanceQueue('u1');
      expect(rows, isEmpty);
      expect((await database.pendingAttendanceQueue('u1')), isEmpty);
    },
  );

  test('failed and duplicate receipts keep terminal evidence', () async {
    await database.enqueueAttendanceScan(
      clientReceiptId: 'receipt-2',
      userId: 'u1',
      sessionId: 'sess-1',
      studentId: 'u1',
      scannedToken: 'token',
      inputChannel: 'camera',
      scannedAtUtc: DateTime.utc(2026, 11, 10, 8),
    );
    await database.markQueueFailed(
      'receipt-2',
      serverError: 'Outside the geofence',
    );
    final failed = await database.drainableAttendanceQueue('u1');
    expect(failed.single.syncStatus, AttendanceSyncStatus.failed);
    expect(failed.single.retryCount, 1);
    expect(failed.single.serverError, 'Outside the geofence');

    await database.markQueueDisputedDuplicate(
      'receipt-2',
      serverError: 'Duplicate token+student pair',
    );
    final duplicate = await database.drainableAttendanceQueue('u1');
    expect(duplicate, isEmpty);
  });

  test(
    'clearOwner purges every owner row but keeps the global clock',
    () async {
      await database.writeClockOffset(
        1250,
        updatedAt: DateTime.utc(2026, 11, 10),
      );
      await database.writeProfile(student);
      await database.replaceSubjects('u1', [subject]);
      await database.replaceSections('u1', [section]);
      await database.upsertSessions('u1', [session]);
      await database.replaceRoster('u1', 'sec-1', [student]);
      await database.upsertAttendance('u1', [record]);
      await database.upsertNotifications('u1', [notification]);
      await database.enqueueAttendanceScan(
        clientReceiptId: 'receipt-3',
        userId: 'u1',
        sessionId: 'sess-1',
        studentId: 'u1',
        scannedToken: 'token',
        inputChannel: 'camera',
        scannedAtUtc: DateTime.utc(2026, 11, 10, 8),
      );

      await database.clearOwner('u1');

      expect(await database.readClockOffsetMs(), 1250);
      expect(await database.readProfile('u1'), isNull);
      expect(await database.readActiveProfile(), isNull);
      expect(await database.watchSubjects('u1').first, isEmpty);
      expect(await database.watchSections('u1').first, isEmpty);
      expect(
        await database.watchSessionsForSection('u1', 'sec-1').first,
        isEmpty,
      );
      expect(await database.watchRoster('u1', 'sec-1').first, isEmpty);
      expect(await database.watchMyAttendance('u1', 'u1').first, isEmpty);
      expect(await database.watchNotifications('u1').first, isEmpty);
      expect(await database.watchPendingQueueCount('u1').first, 0);
    },
  );

  test('session-expiry purge preserves queued attendance evidence', () async {
    await database.enqueueAttendanceScan(
      clientReceiptId: 'receipt-expiry',
      userId: 'u1',
      sessionId: 'sess-1',
      studentId: 'u1',
      scannedToken: 'token',
      inputChannel: 'camera',
      scannedAtUtc: DateTime.utc(2026, 11, 10, 8),
    );

    await database.clearOwner('u1', preserveAttendanceQueue: true);

    expect(await database.pendingAttendanceQueue('u1'), hasLength(1));
    expect(await database.readProfile('u1'), isNull);

    await database.clearOwner('u1');
    expect(await database.pendingAttendanceQueue('u1'), isEmpty);
  });
}
