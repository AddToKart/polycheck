import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/core/utils/device_security.dart';
import 'package:polycheck_mobile/src/features/faculty/data/teacher_signing_key.dart';
import 'package:polycheck_mobile/src/features/student/data/student_scan_service.dart';

import '../../helpers/auth_harness.dart';
import 'student_test_harness.dart';

class FakeAttendanceApi extends AttendanceApi {
  FakeAttendanceApi({this.onSubmitScan}) : super(Dio());

  final Future<AttendanceRecord> Function({
    required String sessionId,
    required String studentId,
    required double? lat,
    required double? lon,
    required String qrToken,
    String? pin,
    ScanEvidenceInput? evidence,
  })?
  onSubmitScan;

  int calls = 0;
  ScanEvidenceInput? lastEvidence;
  String? lastPin;

  @override
  Future<AttendanceRecord> submitScan({
    required String sessionId,
    required String studentId,
    required String studentName,
    required double? lat,
    required double? lon,
    required String deviceId,
    required String qrToken,
    String? scannedAt,
    ScanEvidenceInput? evidence,
    String? pin,
  }) {
    calls += 1;
    lastEvidence = evidence;
    lastPin = pin;
    final handler = onSubmitScan;
    if (handler == null) {
      return Future<AttendanceRecord>.value(
        AttendanceRecord(
          id: 'rec-1',
          sessionId: sessionId,
          sectionId: 'sec-1',
          studentId: studentId,
          studentName: studentName,
          timestamp: DateTime.now().toUtc().toIso8601String(),
          status: AttendanceStatus.present,
          checkInStatus: AttendanceStatus.present,
          isSynced: true,
        ),
      );
    }
    return handler(
      sessionId: sessionId,
      studentId: studentId,
      lat: lat,
      lon: lon,
      qrToken: qrToken,
      pin: pin,
      evidence: evidence,
    );
  }
}

class FakeSessionsApi extends SessionsApi {
  FakeSessionsApi(this.session) : super(Dio());

  final Session session;

  @override
  Future<Session> getSession(String id) async => session;
}

class FakeLocationReader implements ScanLocationReader {
  FakeLocationReader({this.location, this.error});

  final ScanLocation? location;
  final ScanLocationException? error;
  int calls = 0;

  @override
  Future<ScanLocation> current() async {
    calls += 1;
    final failure = error;
    if (failure != null) throw failure;
    return location!;
  }
}

const double _latitude = 14.8697;
const double _longitude = 120.9991;

/// Coherent GNSS fixture: the fix epoch and the reader's device-clock stamp
/// together zero the fix age against the test's fixed `deviceNow`, matching
/// how the real reader behaves with a trusted clock.
ScanLocation locationAt({
  double? latitude,
  double? longitude,
  bool mocked = false,
  double accuracyMeters = 8,
  required DateTime deviceNow,
  Duration fixAge = Duration.zero,
}) {
  final fixAt = deviceNow.subtract(fixAge);
  return ScanLocation(
    latitude: latitude ?? _latitude,
    longitude: longitude ?? _longitude,
    accuracyMeters: accuracyMeters,
    isMocked: mocked,
    capturedAt: fixAt,
    deviceNowAtFix: deviceNow,
  );
}

typedef SignedTokenFixture = ({TeacherSigningKey key, String token});

Future<SignedTokenFixture> signTokenFor({
  required DateTime now,
  int? issuedAtMs,
  SessionMode mode = SessionMode.inPerson,
  bool pinRequired = false,
  String? pinHash,
  String sessionId = 'sess-1',
  String sectionId = 'sec-1',
  int validityMinutes = 15,
  int gracePeriodMinutes = 15,
}) async {
  final service = TeacherSigningKeyService(store: InMemorySigningKeyStore());
  final key = await service.getOrCreate('teacher-1');
  final payload = QRTokenPayload(
    version: 1,
    sessionId: sessionId,
    sectionId: sectionId,
    issuedAt: issuedAtMs ?? now.millisecondsSinceEpoch - 1000,
    validityMinutes: validityMinutes,
    gracePeriodMinutes: gracePeriodMinutes,
    teacherId: 'teacher-1',
    teacherName: 'Prof. Juan Dela Cruz',
    mode: mode,
    pinRequired: pinRequired,
    pinHash: pinHash,
  );
  final token = await service.signPayload(payload, key);
  return (key: key, token: token);
}

void main() {
  late DateTime now;
  late AppDatabase database;

  setUp(() {
    now = DateTime.utc(2026, 11, 10, 8);
    database = createTestDatabase();
  });

  tearDown(() async {
    await database.close();
  });

  StudentScanService buildService({
    required FakeAttendanceApi attendanceApi,
    required Session session,
    required ScanLocationReader locationReader,
    DeviceSecurityProber? deviceSecurityProber,
  }) {
    return StudentScanService(
      attendanceApi: attendanceApi,
      sessionsApi: FakeSessionsApi(session),
      database: database,
      trustedClock: const TrustedClock(),
      locationReader: locationReader,
      deviceId: () async => 'mobile-test-device',
      deviceNow: () => now,
      deviceSecurityProber: deviceSecurityProber,
    );
  }

  Session inPersonSession({String? teacherPublicKey}) {
    return testSession().copyWith(
      geofence: const GeofenceConfig(
        latitude: _latitude,
        longitude: _longitude,
        radiusMeters: 50,
      ),
      teacherPublicKey: teacherPublicKey,
    );
  }

  test('enqueues an offline scan with its geofence evidence', () async {
    final fixture = await signTokenFor(now: now);
    final attendance = FakeAttendanceApi(
      onSubmitScan:
          ({
            required sessionId,
            required studentId,
            required lat,
            required lon,
            required qrToken,
            pin,
            evidence,
          }) async {
            throw const ApiRequestError(message: 'offline', status: 0);
          },
    );
    final service = buildService(
      attendanceApi: attendance,
      session: inPersonSession(teacherPublicKey: fixture.key.publicKey),
      locationReader: FakeLocationReader(location: locationAt(deviceNow: now)),
    );

    final outcome = await service.submitToken(
      rawToken: '  "${fixture.token}"  ',
      student: studentUser,
      channel: ScanInputChannel.camera,
    );

    expect(outcome.kind, ScanOutcomeKind.offlineQueued);
    expect(outcome.message, contains('Pending Sync'));
    expect(attendance.calls, 1);

    final queued = await database.pendingAttendanceQueue(studentUser.id);
    expect(queued, hasLength(1));
    final row = queued.single;
    expect(row.sessionId, 'sess-1');
    expect(row.studentId, studentUser.id);
    expect(row.latitude, closeTo(_latitude, 0.000001));
    expect(row.longitude, closeTo(_longitude, 0.000001));
    expect(row.haversineDistance, lessThan(1));
    expect(row.scannedToken, isNot(contains(' ')));
  });

  test('online sessions never request location', () async {
    final fixture = await signTokenFor(now: now, mode: SessionMode.online);
    final attendance = FakeAttendanceApi();
    final reader = FakeLocationReader(location: locationAt(deviceNow: now));
    final service = buildService(
      attendanceApi: attendance,
      session: testSession(
        mode: SessionMode.online,
      ).copyWith(geofence: null, teacherPublicKey: fixture.key.publicKey),
      locationReader: reader,
    );

    final outcome = await service.submitToken(
      rawToken: fixture.token,
      student: studentUser,
      channel: ScanInputChannel.camera,
    );

    expect(reader.calls, 0);
    expect(outcome.kind, ScanOutcomeKind.success);
    expect(outcome.status, AttendanceStatus.present);
    expect(attendance.calls, 1);
  });

  test('rejects mocked locations before submitting', () async {
    final fixture = await signTokenFor(now: now);
    final attendance = FakeAttendanceApi();
    final service = buildService(
      attendanceApi: attendance,
      session: inPersonSession(teacherPublicKey: fixture.key.publicKey),
      locationReader: FakeLocationReader(
        location: locationAt(mocked: true, deviceNow: now),
      ),
    );

    final outcome = await service.submitToken(
      rawToken: fixture.token,
      student: studentUser,
      channel: ScanInputChannel.camera,
    );

    expect(outcome.kind, ScanOutcomeKind.rejected);
    expect(outcome.message, contains('Mock location'));
    expect(attendance.calls, 0);
    expect(await database.pendingAttendanceQueue(studentUser.id), isEmpty);
  });

  test('rejects a position outside the class geofence', () async {
    final fixture = await signTokenFor(now: now);
    final attendance = FakeAttendanceApi();
    final service = buildService(
      attendanceApi: attendance,
      session: inPersonSession(teacherPublicKey: fixture.key.publicKey),
      locationReader: FakeLocationReader(
        location: locationAt(latitude: _latitude + 0.01, deviceNow: now),
      ),
    );

    final outcome = await service.submitToken(
      rawToken: fixture.token,
      student: studentUser,
      channel: ScanInputChannel.camera,
    );

    expect(outcome.kind, ScanOutcomeKind.rejected);
    expect(outcome.message, contains('m from the class location'));
    expect(outcome.message, contains('50 m geofence'));
    expect(attendance.calls, 0);
  });

  test('rejects expired tokens using the trusted clock', () async {
    final fixture = await signTokenFor(
      now: now,
      issuedAtMs:
          now.millisecondsSinceEpoch - const Duration(hours: 2).inMilliseconds,
    );
    final attendance = FakeAttendanceApi();
    final service = buildService(
      attendanceApi: attendance,
      session: inPersonSession(teacherPublicKey: fixture.key.publicKey),
      locationReader: FakeLocationReader(location: locationAt(deviceNow: now)),
    );

    final outcome = await service.submitToken(
      rawToken: fixture.token,
      student: studentUser,
      channel: ScanInputChannel.camera,
    );

    expect(outcome.kind, ScanOutcomeKind.rejected);
    expect(outcome.message, contains('expired'));
    expect(attendance.calls, 0);
  });

  test('asks for the meeting PIN before any network call', () async {
    final fixture = await signTokenFor(now: now, pinRequired: true);
    final attendance = FakeAttendanceApi();
    final service = buildService(
      attendanceApi: attendance,
      session: inPersonSession(teacherPublicKey: fixture.key.publicKey),
      locationReader: FakeLocationReader(location: locationAt(deviceNow: now)),
    );

    final outcome = await service.submitToken(
      rawToken: fixture.token,
      student: studentUser,
      channel: ScanInputChannel.camera,
    );

    expect(outcome.kind, ScanOutcomeKind.pinRequired);
    expect(attendance.calls, 0);
  });

  test('verifies the PIN locally before queueing offline evidence', () async {
    final pinHash = await hashMeetingPin(
      '1234',
      iterations: 10000,
      salt: List<int>.filled(16, 7),
    );
    final fixture = await signTokenFor(
      now: now,
      pinRequired: true,
      pinHash: pinHash.serialized,
    );
    final attendance = FakeAttendanceApi(
      onSubmitScan:
          ({
            required sessionId,
            required studentId,
            required lat,
            required lon,
            required qrToken,
            pin,
            evidence,
          }) async {
            throw const ApiRequestError(message: 'offline', status: 0);
          },
    );
    final service = buildService(
      attendanceApi: attendance,
      session: inPersonSession(teacherPublicKey: fixture.key.publicKey),
      locationReader: FakeLocationReader(location: locationAt(deviceNow: now)),
    );

    final outcome = await service.submitToken(
      rawToken: fixture.token,
      student: studentUser,
      channel: ScanInputChannel.camera,
      pin: '1234',
    );

    expect(outcome.kind, ScanOutcomeKind.offlineQueued);
    final row = (await database.pendingAttendanceQueue(studentUser.id)).single;
    expect(row.pinHash, pinHash.serialized);
  });

  test('refuses to queue an unverifiable offline PIN', () async {
    final pinHash = await hashMeetingPin(
      '1234',
      iterations: 10000,
      salt: List<int>.filled(16, 9),
    );
    final fixture = await signTokenFor(
      now: now,
      pinRequired: true,
      pinHash: pinHash.serialized,
    );
    final attendance = FakeAttendanceApi(
      onSubmitScan:
          ({
            required sessionId,
            required studentId,
            required lat,
            required lon,
            required qrToken,
            pin,
            evidence,
          }) async {
            throw const ApiRequestError(message: 'offline', status: 0);
          },
    );
    final service = buildService(
      attendanceApi: attendance,
      session: inPersonSession(teacherPublicKey: fixture.key.publicKey),
      locationReader: FakeLocationReader(location: locationAt(deviceNow: now)),
    );

    final outcome = await service.submitToken(
      rawToken: fixture.token,
      student: studentUser,
      channel: ScanInputChannel.camera,
      pin: '9999',
    );

    expect(outcome.kind, ScanOutcomeKind.rejected);
    expect(outcome.message, contains('could not be verified offline'));
    expect(await database.pendingAttendanceQueue(studentUser.id), isEmpty);
  });
}
