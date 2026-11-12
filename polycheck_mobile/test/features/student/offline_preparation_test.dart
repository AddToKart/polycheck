import 'package:dio/dio.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/api/attendance_api.dart';
import 'package:polycheck_mobile/src/core/api/sections_api.dart';
import 'package:polycheck_mobile/src/core/api/sessions_api.dart';
import 'package:polycheck_mobile/src/core/api/subjects_api.dart';
import 'package:polycheck_mobile/src/core/database/app_database.dart';
import 'package:polycheck_mobile/src/core/models/models.dart';
import 'package:polycheck_mobile/src/core/network/api_error.dart';
import 'package:polycheck_mobile/src/core/sync/sync_engine.dart';
import 'package:polycheck_mobile/src/features/student/data/offline_readiness.dart';

AppDatabase _memoryDatabase() =>
    AppDatabase.forTesting(NativeDatabase.memory());

// Every transport stub subclasses the real API and overrides only the method
// the orchestrator calls, so the production signatures stay wired up.
class _StubSubjectsApi extends SubjectsApi {
  _StubSubjectsApi({this.result}) : super(Dio());

  final List<Subject>? result;

  @override
  Future<List<Subject>> getSubjects() async {
    return result ?? const <Subject>[];
  }
}

class _StubSectionsApi extends SectionsApi {
  _StubSectionsApi({this.result, this.error}) : super(Dio());

  final List<Section>? result;
  final ApiRequestError? error;

  @override
  Future<List<Section>> getStudentSections(String studentId) async {
    final failure = error;
    if (failure != null) throw failure;
    return result ?? const <Section>[];
  }
}

class _StubSessionsApi extends SessionsApi {
  _StubSessionsApi({this.result, this.perSection, this.error}) : super(Dio());

  int sectionSessionCalls = 0;

  final List<Session>? result;
  final Map<String, List<Session>>? perSection;
  final ApiRequestError? error;

  @override
  Future<List<Session>> getSessions({String? sectionId}) async {
    if (sectionId != null) return const <Session>[];
    final failure = error;
    if (failure != null) throw failure;
    return result ?? const <Session>[];
  }

  @override
  Future<List<Session>> getSectionSessions(String sectionId) async {
    sectionSessionCalls += 1;
    return perSection?[sectionId] ?? const <Session>[];
  }
}

class _StubAttendanceApi extends AttendanceApi {
  _StubAttendanceApi({this.result, this.error}) : super(Dio());

  final List<AttendanceRecord>? result;
  final ApiRequestError? error;

  @override
  Future<List<AttendanceRecord>> getAttendanceForStudent(String id) async {
    final failure = error;
    if (failure != null) throw failure;
    return result ?? const <AttendanceRecord>[];
  }
}

const User _student = User(
  id: 'student-1',
  fullName: 'Maria Santos',
  role: UserRole.student,
  enrolledSectionIds: <String>['sec-old'],
);

const Subject _subject = Subject(id: 'subj-1', name: 'ITP', code: 'ITP-301');
const Section _section = Section(
  id: 'sec-1',
  subjectId: 'subj-1',
  section: '3-1',
  teacherId: 'teacher-1',
);

/// Base64url of 32 zero bytes — a decodable Ed25519-shaped public key.
const String _publicKey32 = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

const Session _session = Session(
  id: 'sess-1',
  sectionId: 'sec-1',
  date: '2026-11-10',
  startTime: '09:00',
  endTime: '10:30',
  teacherId: 'teacher-1',
  teacherPublicKey: _publicKey32,
);
const AttendanceRecord _record = AttendanceRecord(
  id: 'rec-1',
  sessionId: 'sess-1',
  sectionId: 'sec-1',
  studentId: 'student-1',
  status: AttendanceStatus.present,
);

OfflinePreparation _preparation({
  required AppDatabase database,
  SubjectsApi? subjectsApi,
  SectionsApi? sectionsApi,
  SessionsApi? sessionsApi,
  AttendanceApi? attendanceApi,
  Future<bool> Function()? refreshClock,
  Future<SyncDrainReport> Function()? drain,
}) {
  return OfflinePreparation(
    database: database,
    subjectsApi: subjectsApi ?? _StubSubjectsApi(),
    sectionsApi: sectionsApi ?? _StubSectionsApi(),
    sessionsApi: sessionsApi ?? _StubSessionsApi(),
    attendanceApi: attendanceApi ?? _StubAttendanceApi(),
    refreshClock: refreshClock,
    drain: drain,
    now: () => DateTime.utc(2026, 11, 10, 12),
  );
}

void main() {
  setUpAll(() {
    TestWidgetsFlutterBinding.ensureInitialized();
  });

  test(
    'prepare caches everything and persists the preparation stamp',
    () async {
      final database = _memoryDatabase();
      addTearDown(database.close);
      var clockRefreshes = 0;
      var drainRuns = 0;
      final preparation = _preparation(
        database: database,
        subjectsApi: _StubSubjectsApi(result: [_subject]),
        sectionsApi: _StubSectionsApi(result: [_section]),
        sessionsApi: _StubSessionsApi(result: [_session]),
        attendanceApi: _StubAttendanceApi(result: [_record]),
        refreshClock: () async {
          clockRefreshes += 1;
          await database.writeClockOffset(120);
          return true;
        },
        drain: () async {
          drainRuns += 1;
          return const SyncDrainReport(attempted: 2, confirmed: 2, batches: 1);
        },
      );

      final result = await preparation.prepareForOfflineClass(_student);

      expect(result.isComplete, isTrue);
      expect(result.subjectsCached, 1);
      expect(result.sectionsCached, 1);
      expect(result.sessionsCached, 1);
      expect(result.attendanceCached, 1);
      expect(result.enrolledSectionIds, <String>['sec-1']);
      expect(result.clockOffsetPresent, isTrue);
      expect(result.drainReport?.confirmed, 2);
      expect(clockRefreshes, 1);
      expect(drainRuns, 1);

      final stamp = await readOfflineLastPreparedAt(database, _student.id);
      expect(stamp, DateTime.utc(2026, 11, 10, 12));
      expect(await database.readEnrolledSectionIds(_student.id), ['sec-1']);
      expect(await database.watchSubjects(_student.id).first, [_subject]);
    },
  );

  test(
    'network failures never swallow: caches stay, failures get typed',
    () async {
      final database = _memoryDatabase();
      addTearDown(database.close);
      // Pre-existing cache: subjects + sections + per-section sessions.
      await database.replaceSubjects(_student.id, [_subject]);
      await database.replaceSections(_student.id, [_section]);
      await database.upsertSessions(_student.id, [_session]);
      await database.writeEnrolledSectionIds(_student.id, ['sec-old']);
      await database.writeClockOffset(97);

      const offline = ApiRequestError(
        message: 'Cannot reach the Polycheck server. Check your connection.',
        status: 0,
      );
      final sectionsApi = _StubSectionsApi(error: offline);
      final sessionsApi = _StubSessionsApi(
        error: offline,
        perSection: {
          'sec-old': [_session],
        },
      );
      final result = await _preparation(
        database: database,
        subjectsApi: _StubSubjectsApi(result: [_subject]),
        sectionsApi: sectionsApi,
        sessionsApi: sessionsApi,
        attendanceApi: _StubAttendanceApi(error: offline),
      ).prepareForOfflineClass(_student);

      expect(result.isComplete, isFalse);
      expect(
        {for (final failure in result.failures) failure.step},
        containsAll(<OfflinePrepStep>[
          OfflinePrepStep.sections,
          OfflinePrepStep.attendance,
        ]),
      );
      expect(result.failures.first.error.status, 0);
      // The global session fetch failed → the per-section fallback ran for the
      // cached enrollment ids.
      expect(sessionsApi.sectionSessionCalls, greaterThanOrEqualTo(1));
      expect(result.sessionsCached, 1);
      // Subjects stayed cached even though the section refresh failed.
      expect(await database.watchSubjects(_student.id).first, [_subject]);
    },
  );

  test('non-network rejections are reported in-band, never thrown', () async {
    final database = _memoryDatabase();
    addTearDown(database.close);
    const rejected = ApiRequestError(
      message: 'Not enrolled in this section.',
      status: 403,
      code: 'student_blocked_from_section',
    );
    final result = await _preparation(
      database: database,
      attendanceApi: _StubAttendanceApi(error: rejected),
    ).prepareForOfflineClass(_student);

    expect(result.isComplete, isFalse);
    expect(result.failures.single.step, OfflinePrepStep.attendance);
    expect(result.failures.single.error.status, 403);
    expect(
      await readOfflineLastPreparedAt(database, _student.id),
      DateTime.utc(2026, 11, 10, 12),
    );
  });

  test(
    'keyless today/tomorrow sessions record a typed teacher_key failure',
    () async {
      final database = _memoryDatabase();
      addTearDown(database.close);
      const keyless = Session(
        id: 'sess-keyless',
        sectionId: 'sec-1',
        date: '2026-11-11',
        startTime: '09:00',
        endTime: '10:30',
        teacherId: 'teacher-1',
      );
      final result = await _preparation(
        database: database,
        sectionsApi: _StubSectionsApi(result: [_section]),
        sessionsApi: _StubSessionsApi(result: [_session, keyless]),
      ).prepareForOfflineClass(_student);

      final keyFailure = result.failures
          .where((failure) => failure.step == OfflinePrepStep.teacherKey)
          .single;
      expect(keyFailure.error.status, 0);
      expect(keyFailure.error.message, contains('no offline verification key'));
      // Not thrown: the rest of the preparation still landed.
      expect(
        await readOfflineLastPreparedAt(database, _student.id),
        DateTime.utc(2026, 11, 10, 12),
      );
    },
  );

  test('queue kind labels map the RN queue kinds', () {
    expect(offlineQueueIssueLabel('attendance_scan'), 'Check-in');
    expect(offlineQueueIssueLabel('scan_attempt'), 'Check-in');
    expect(offlineQueueIssueLabel('attendance_manual'), 'Manual attendance');
    expect(offlineQueueIssueLabel('attendance_status'), 'Manual attendance');
    expect(offlineQueueIssueLabel('session_activation'), 'QR activation');
    expect(offlineQueueIssueLabel('session_end'), 'Session end');
    // The drift queue stores attendance kinds only.
    expect(offlineQueueIssueLabel('attendance_queue'), 'Check-in');
    expect(offlineQueueIssueLabel(null), 'Check-in');
    expect(offlineQueueIssueLabel('something_new'), 'Check-in');
  });

  test('last-sync line formats web-parity copy', () {
    expect(formatOfflineLastSync(null), 'Not synced yet');
    final label = formatOfflineLastSync(DateTime.utc(2026, 11, 10, 13, 5));
    expect(label, startsWith('Last sync '));
  });
}
