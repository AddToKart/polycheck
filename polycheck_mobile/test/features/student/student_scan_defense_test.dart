import 'dart:convert';

import 'package:dio/dio.dart';
import 'package:drift/native.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/core/utils/device_security.dart';
import 'package:polycheck_mobile/src/features/faculty/data/teacher_signing_key.dart';
import 'package:polycheck_mobile/src/features/student/data/student_scan_service.dart';

import '../../helpers/auth_harness.dart';
import 'student_test_harness.dart';

class _FailingAttendanceApi extends AttendanceApi {
  _FailingAttendanceApi() : super(Dio());

  int calls = 0;
  ScanEvidenceInput? lastEvidence;

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
  }) async {
    calls += 1;
    lastEvidence = evidence;
    throw const ApiRequestError(message: 'offline', status: 0);
  }
}

class _RecordingAttendanceApi extends AttendanceApi {
  _RecordingAttendanceApi() : super(Dio());

  int calls = 0;
  ScanEvidenceInput? lastEvidence;

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
  }) async {
    calls += 1;
    lastEvidence = evidence;
    return AttendanceRecord(
      id: 'rec-1',
      sessionId: sessionId,
      sectionId: 'sec-1',
      studentId: studentId,
      studentName: studentName,
      timestamp: scannedAt ?? DateTime.now().toUtc().toIso8601String(),
      status: AttendanceStatus.present,
      checkInStatus: AttendanceStatus.present,
      isSynced: true,
    );
  }
}

class _FakeSessionsApi extends SessionsApi {
  _FakeSessionsApi(this.session) : super(Dio());

  final Session session;

  @override
  Future<Session> getSession(String id) async => session;
}

class _FakeLocationReader implements ScanLocationReader {
  _FakeLocationReader({this.location});

  final ScanLocation? location;

  @override
  Future<ScanLocation> current() async {
    return location!;
  }
}

class _ScriptedProbe implements DeviceSecurityProber {
  const _ScriptedProbe(this.evidence);

  final DeviceSecurityEvidence evidence;

  @override
  Future<DeviceSecurityEvidence> probe() async => evidence;
}

/// A probe whose platform sweep crashes — the pipeline must close safe.
class _ThrowingProbe implements DeviceSecurityProber {
  @override
  Future<DeviceSecurityEvidence> probe() async => throw StateError('fs gone');
}

const double _latitude = 14.8697;
const double _longitude = 120.9991;

ScanLocation _location({
  required DateTime deviceNow,
  double accuracyMeters = 8,
  Duration fixAge = Duration.zero,
  bool mocked = false,
}) {
  final fixAt = deviceNow.subtract(fixAge);
  return ScanLocation(
    latitude: _latitude,
    longitude: _longitude,
    accuracyMeters: accuracyMeters,
    isMocked: mocked,
    capturedAt: fixAt,
    deviceNowAtFix: deviceNow,
  );
}

Session _inPersonSession({String? teacherPublicKey, bool active = true}) {
  return testSession(active: active).copyWith(
    geofence: const GeofenceConfig(
      latitude: _latitude,
      longitude: _longitude,
      radiusMeters: 50,
    ),
    teacherPublicKey: teacherPublicKey,
  );
}

Future<({TeacherSigningKey key, String token})> _signToken(
  DateTime now, {
  int? issuedAtMs,
  SessionMode mode = SessionMode.inPerson,
  bool tamper = false,
  String sessionId = 'sess-1',
  bool pinRequired = false,
  String? pinHash,
}) async {
  final service = TeacherSigningKeyService(store: InMemorySigningKeyStore());
  final key = await service.getOrCreate('teacher-1');
  final payload = QRTokenPayload(
    version: 1,
    sessionId: sessionId,
    sectionId: 'sec-1',
    issuedAt: issuedAtMs ?? now.millisecondsSinceEpoch - 1000,
    validityMinutes: 15,
    gracePeriodMinutes: 15,
    teacherId: 'teacher-1',
    teacherName: 'Prof. Juan Dela Cruz',
    mode: mode,
    pinRequired: pinRequired,
    pinHash: pinHash,
  );
  var token = await service.signPayload(payload, key);
  if (tamper) {
    // Mutate a non-structural field so the payload still decodes/passes the
    // window but the signature no longer matches (local Ed25519 check lands).
    final parts = token.split('.');
    final decoded =
        jsonDecode(utf8.decode(decodeBase64Url(parts[0])))
            as Map<String, dynamic>;
    decoded['teacherName'] = 'Prof. Someone Else';
    token = '${encodeBase64Url(utf8.encode(jsonEncode(decoded)))}.${parts[1]}';
  }
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
    required AttendanceApi attendanceApi,
    required Session session,
    required ScanLocationReader locationReader,
    DeviceSecurityProber? deviceSecurityProber,
    AppDatabase? target,
  }) {
    return StudentScanService(
      attendanceApi: attendanceApi,
      sessionsApi: _FakeSessionsApi(session),
      database: target ?? database,
      trustedClock: const TrustedClock(),
      locationReader: locationReader,
      deviceId: () async => 'mobile-test-device',
      deviceNow: () => now,
      deviceSecurityProber: deviceSecurityProber,
    );
  }

  group('A-x device security capture', () {
    test('a flagged probe rides the submitted evidence', () async {
      final api = _RecordingAttendanceApi();
      final fixture = await _signToken(now);
      final service = buildService(
        attendanceApi: api,
        session: _inPersonSession(teacherPublicKey: fixture.key.publicKey),
        locationReader: _FakeLocationReader(
          location: _location(deviceNow: now),
        ),
        deviceSecurityProber: _ScriptedProbe(
          const DeviceSecurityEvidence(
            rootDetected: false,
            hookDetected: true,
            emulatorDetected: false,
          ),
        ),
      );

      await service.submitToken(
        rawToken: fixture.token,
        student: studentUser,
        channel: ScanInputChannel.camera,
      );

      expect(api.lastEvidence!.deviceSecurity!.toJson(), <String, dynamic>{
        'rootDetected': false,
        'hookDetected': true,
        'emulatorDetected': false,
      });
    });

    test('a clean probe sends all three booleans', () async {
      final api = _RecordingAttendanceApi();
      final fixture = await _signToken(now);
      final service = buildService(
        attendanceApi: api,
        session: _inPersonSession(teacherPublicKey: fixture.key.publicKey),
        locationReader: _FakeLocationReader(
          location: _location(deviceNow: now),
        ),
        deviceSecurityProber: _ScriptedProbe(
          const DeviceSecurityEvidence(
            rootDetected: false,
            hookDetected: false,
            emulatorDetected: false,
          ),
        ),
      );

      await service.submitToken(
        rawToken: fixture.token,
        student: studentUser,
        channel: ScanInputChannel.camera,
      );

      expect(api.lastEvidence!.deviceSecurity!.toJson(), <String, dynamic>{
        'rootDetected': false,
        'hookDetected': false,
        'emulatorDetected': false,
      });
    });

    test('a probe failure is closed safe (no evidence field)', () async {
      final api = _RecordingAttendanceApi();
      final fixture = await _signToken(now);
      final service = buildService(
        attendanceApi: api,
        session: _inPersonSession(teacherPublicKey: fixture.key.publicKey),
        locationReader: _FakeLocationReader(
          location: _location(deviceNow: now),
        ),
        deviceSecurityProber: _ThrowingProbe(),
      );

      await service.submitToken(
        rawToken: fixture.token,
        student: studentUser,
        channel: ScanInputChannel.camera,
      );

      expect(api.lastEvidence!.deviceSecurity, isNull);
      expect(api.calls, 1);
    });

    test('a flagged offline queue keeps the flagged wording', () async {
      final api = _FailingAttendanceApi();
      final fixture = await _signToken(now);
      final service = buildService(
        attendanceApi: api,
        session: _inPersonSession(teacherPublicKey: fixture.key.publicKey),
        locationReader: _FakeLocationReader(
          location: _location(deviceNow: now),
        ),
        deviceSecurityProber: _ScriptedProbe(
          const DeviceSecurityEvidence(rootDetected: true),
        ),
      );

      final outcome = await service.submitToken(
        rawToken: fixture.token,
        student: studentUser,
        channel: ScanInputChannel.camera,
      );

      expect(outcome.kind, ScanOutcomeKind.offlineQueued);
      expect(outcome.message, contains('flagged for review'));
      expect(
        await database.pendingAttendanceQueue(studentUser.id),
        hasLength(1),
        reason: 'the server stays authoritative after replay',
      );
    });
  });

  group('A-h offline signature verification', () {
    test('a tampered offline token is refused and never queued', () async {
      final api = _FailingAttendanceApi();
      final fixture = await _signToken(now, tamper: true);
      final service = buildService(
        attendanceApi: api,
        session: _inPersonSession(teacherPublicKey: fixture.key.publicKey),
        locationReader: _FakeLocationReader(
          location: _location(deviceNow: now),
        ),
      );

      final outcome = await service.submitToken(
        rawToken: fixture.token,
        student: studentUser,
        channel: ScanInputChannel.camera,
      );

      expect(outcome.kind, ScanOutcomeKind.rejected);
      expect(outcome.message, 'QR token signature is invalid');
      expect(
        api.calls,
        1,
        reason: 'the POST still happened first (live attempt)',
      );
      expect(
        await database.pendingAttendanceQueue(studentUser.id),
        isEmpty,
        reason: 'nothing without a valid signature is enqueueable',
      );
    });

    test(
      'a session without a cached public key fails closed offline',
      () async {
        final api = _FailingAttendanceApi();
        final fixture = await _signToken(now);
        final service = buildService(
          attendanceApi: api,
          session: _inPersonSession(),
          locationReader: _FakeLocationReader(
            location: _location(deviceNow: now),
          ),
        );

        final outcome = await service.submitToken(
          rawToken: fixture.token,
          student: studentUser,
          channel: ScanInputChannel.camera,
        );

        expect(outcome.kind, ScanOutcomeKind.rejected);
        expect(outcome.message, offlineVerificationKeyMissingMessage);
        expect(
          outcome.message,
          contains('no offline verification key on this device'),
        );
        expect(outcome.message, isNot(qrTokenSignatureInvalidMessage));
        expect(await database.pendingAttendanceQueue(studentUser.id), isEmpty);
      },
    );

    test('a valid offline token still queues (RN unchanged path)', () async {
      final api = _FailingAttendanceApi();
      final fixture = await _signToken(now);
      final service = buildService(
        attendanceApi: api,
        session: _inPersonSession(teacherPublicKey: fixture.key.publicKey),
        locationReader: _FakeLocationReader(
          location: _location(deviceNow: now),
        ),
      );

      final outcome = await service.submitToken(
        rawToken: fixture.token,
        student: studentUser,
        channel: ScanInputChannel.camera,
      );

      expect(outcome.kind, ScanOutcomeKind.offlineQueued);
      expect(
        await database.pendingAttendanceQueue(studentUser.id),
        hasLength(1),
      );
    });
  });

  group('A-a accuracy parity (50 m)', () {
    test('a 51 m fix is rejected with the server copy at the queue gate '
        "(RN's 50 m offline pre-check parity)", () async {
      final api = _FailingAttendanceApi();
      final fixture = await _signToken(now);
      final service = buildService(
        attendanceApi: api,
        session: _inPersonSession(teacherPublicKey: fixture.key.publicKey),
        locationReader: _FakeLocationReader(
          location: _location(deviceNow: now, accuracyMeters: 51),
        ),
      );

      final outcome = await service.submitToken(
        rawToken: fixture.token,
        student: studentUser,
        channel: ScanInputChannel.camera,
      );

      expect(outcome.kind, ScanOutcomeKind.rejected);
      expect(
        outcome.message,
        'Location accuracy is too poor to verify attendance',
      );
      expect(api.calls, 1, reason: 'the live attempt happens first');
      expect(
        await database.pendingAttendanceQueue(studentUser.id),
        isEmpty,
        reason: 'no 50–100 m fix is enqueueable',
      );
    });

    test('a 50 m fix passes the live gate (server boundary parity)', () async {
      final api = _RecordingAttendanceApi();
      final fixture = await _signToken(now);
      final service = buildService(
        attendanceApi: api,
        session: _inPersonSession(teacherPublicKey: fixture.key.publicKey),
        locationReader: _FakeLocationReader(
          location: _location(deviceNow: now, accuracyMeters: 50),
        ),
      );

      final outcome = await service.submitToken(
        rawToken: fixture.token,
        student: studentUser,
        channel: ScanInputChannel.camera,
      );

      expect(outcome.kind, ScanOutcomeKind.success);
      expect(api.calls, 1);
    });
  });

  group('A-b staleness gate', () {
    test('a fix older than 2 min is rejected with RN copy', () async {
      final api = _RecordingAttendanceApi();
      final fixture = await _signToken(now);
      final service = buildService(
        attendanceApi: api,
        session: _inPersonSession(teacherPublicKey: fixture.key.publicKey),
        locationReader: _FakeLocationReader(
          location: _location(
            deviceNow: now,
            fixAge: const Duration(minutes: 3),
          ),
        ),
      );

      final outcome = await service.submitToken(
        rawToken: fixture.token,
        student: studentUser,
        channel: ScanInputChannel.camera,
      );

      expect(outcome.kind, ScanOutcomeKind.rejected);
      expect(
        outcome.message,
        'Location fix is stale. Acquire a fresh location and try again.',
      );
      expect(api.calls, 0);
    });

    test('matches the server: 2 min is the hard age ceiling, −30 s tolerance '
        'applies to the clock-ahead side only', () {
      // Server parity (`scan-validator.service.ts:243`): age > 2 min is
      // stale — the 30 s tolerance is NOT added to the age bound, so a fix
      // aged 120–150 s is rejected locally instead of being disputed
      // server-side as `stale_location` (DD-F20).
      expect(
        isLocationFixStale(
          trustedReference: now,
          locationCapturedAt: now.subtract(
            const Duration(minutes: 2, seconds: 30),
          ),
        ),
        isTrue,
      );
      expect(
        isLocationFixStale(
          trustedReference: now,
          locationCapturedAt: now.subtract(const Duration(minutes: 2)),
        ),
        isFalse,
        reason: 'the boundary itself is still inside the window',
      );
      expect(
        isLocationFixStale(
          trustedReference: now,
          locationCapturedAt: now.subtract(const Duration(minutes: 2)),
          tolerance: Duration.zero,
        ),
        isFalse,
      );
      // Clock-ahead side keeps its −30 s tolerance.
      expect(
        isLocationFixStale(
          trustedReference: now,
          locationCapturedAt: now.add(const Duration(seconds: 30)),
        ),
        isFalse,
      );
      expect(
        isLocationFixStale(
          trustedReference: now,
          locationCapturedAt: now.add(const Duration(seconds: 31)),
        ),
        isTrue,
      );
      expect(
        isLocationFixStale(
          trustedReference: now,
          locationCapturedAt: now.subtract(const Duration(minutes: 3)),
        ),
        isTrue,
      );
      expect(
        isLocationFixStale(
          trustedReference: now,
          locationCapturedAt: now.add(const Duration(minutes: 1)),
        ),
        isTrue,
      );
    });
  });

  group('A-k trusted locationCapturedAt', () {
    test(
      'derives trusted capture time from the device-clock fix age',
      () async {
        final api = _RecordingAttendanceApi();
        final fixture = await _signToken(now);
        final service = buildService(
          attendanceApi: api,
          session: _inPersonSession(teacherPublicKey: fixture.key.publicKey),
          locationReader: _FakeLocationReader(
            location: _location(
              deviceNow: now,
              fixAge: const Duration(seconds: 4),
            ),
          ),
        );

        await service.submitToken(
          rawToken: fixture.token,
          student: studentUser,
          channel: ScanInputChannel.camera,
        );

        final captured = DateTime.parse(api.lastEvidence!.locationCapturedAt!);
        expect(captured.toUtc(), now.subtract(const Duration(seconds: 4)));
      },
    );

    test('fakes without a device anchor trust the captured value', () {
      final fixAt = DateTime.utc(2026, 11, 10, 7, 58);
      final trusted = trustedLocationCapturedAt(
        location: ScanLocation(
          latitude: _latitude,
          longitude: _longitude,
          accuracyMeters: 8,
          isMocked: false,
          capturedAt: fixAt,
        ),
        trustedNow: now,
      );
      expect(trusted, fixAt);
    });
  });

  group('A-f already-saved guard (web parity)', () {
    test(
      'in-person: any cached record for the student short-circuits',
      () async {
        final api = _RecordingAttendanceApi();
        final fixture = await _signToken(now);
        await database.upsertAttendance(studentUser.id, <AttendanceRecord>[
          AttendanceRecord(
            id: 'rec-cached-1',
            sessionId: 'sess-1',
            sectionId: 'sec-1',
            studentId: studentUser.id,
            timestamp: DateTime.utc(2026, 11, 10, 7).toIso8601String(),
            status: AttendanceStatus.pending,
          ),
        ]);
        final service = buildService(
          attendanceApi: api,
          session: _inPersonSession(teacherPublicKey: fixture.key.publicKey),
          locationReader: _FakeLocationReader(
            location: _location(deviceNow: now),
          ),
        );

        final outcome = await service.submitToken(
          rawToken: fixture.token,
          student: studentUser,
          channel: ScanInputChannel.camera,
        );

        expect(outcome.kind, ScanOutcomeKind.rejected);
        expect(
          outcome.message,
          'Attendance for this session was already saved on this device.',
        );
        expect(api.calls, 0);
        expect(await database.pendingAttendanceQueue(studentUser.id), isEmpty);
      },
    );

    test(
      'online start checkpoint: only an existing check-in blocks it',
      () async {
        final fixture = await _signToken(
          now,
          mode: SessionMode.online,
          sessionId: sessIdOnline,
        );
        await database.upsertAttendance(studentUser.id, <AttendanceRecord>[
          AttendanceRecord(
            id: 'rec-cached-2',
            sessionId: sessIdOnline,
            sectionId: 'sec-1',
            studentId: studentUser.id,
            timestamp: DateTime.utc(2026, 11, 10, 7).toIso8601String(),
            status: AttendanceStatus.pending,
            mode: SessionMode.online,
            checkOutTime: DateTime.utc(2026, 11, 10, 7).toIso8601String(),
            checkOutStatus: AttendanceStatus.pending,
          ),
        ]);
        final api = _RecordingAttendanceApi();
        final service = buildService(
          attendanceApi: api,
          session: testSession(mode: SessionMode.online).copyWith(
            geofence: null,
            teacherPublicKey: fixture.key.publicKey,
            id: sessIdOnline,
          ),
          locationReader: _FakeLocationReader(),
        );

        final outcome = await service.submitToken(
          rawToken: fixture.token,
          student: studentUser,
          channel: ScanInputChannel.camera,
        );

        // The cached record only has an end leg: a start checkpoint still
        // proceeds to the live POST.
        expect(outcome.kind, ScanOutcomeKind.success);
        expect(api.calls, 1);
      },
    );
  });

  group('B-7 encrypted PIN persistence through the scan pipeline', () {
    test('a PIN-protected offline scan persists an encrypted copy', () async {
      final cipher = InMemoryAttendancePinCipher(key: List<int>.filled(32, 9));
      final encryptedDatabase = AppDatabase.forTesting(
        NativeDatabase.memory(),
        pinCipher: cipher,
      );
      addTearDown(encryptedDatabase.close);

      final api = _FailingAttendanceApi();
      final pinHash = await hashMeetingPin(
        '5678',
        iterations: 10000,
        salt: List<int>.filled(16, 3),
      );
      final fixture = await _signToken(
        now,
        pinRequired: true,
        pinHash: pinHash.serialized,
      );
      final service = buildService(
        attendanceApi: api,
        session: _inPersonSession(teacherPublicKey: fixture.key.publicKey),
        locationReader: _FakeLocationReader(
          location: _location(deviceNow: now),
        ),
        target: encryptedDatabase,
      );

      final outcome = await service.submitToken(
        rawToken: fixture.token,
        student: studentUser,
        channel: ScanInputChannel.camera,
        pin: '5678',
      );

      expect(outcome.kind, ScanOutcomeKind.offlineQueued);
      final row = (await encryptedDatabase.pendingAttendanceQueue(
        studentUser.id,
      )).single;
      expect(row.pinEncrypted, isNotNull);
      expect(row.pinEncrypted, isNot(contains('5678')));
      expect(await encryptedDatabase.decryptQueuePin(row), '5678');
    });
  });

  group('offline replay evidence persisted by the scan pipeline', () {
    test(
      'an in-person queue row stores the capture channel and the trusted fix '
      'timestamp, and the replay payload emits both',
      () async {
        final database = AppDatabase.forTesting(NativeDatabase.memory());
        addTearDown(database.close);
        final api = _FailingAttendanceApi();
        final fixture = await _signToken(now);
        final service = buildService(
          attendanceApi: api,
          session: _inPersonSession(teacherPublicKey: fixture.key.publicKey),
          locationReader: _FakeLocationReader(
            location: _location(
              deviceNow: now,
              fixAge: const Duration(seconds: 4),
            ),
          ),
          target: database,
        );

        final outcome = await service.submitToken(
          rawToken: fixture.token,
          student: studentUser,
          channel: ScanInputChannel.manual,
        );

        expect(outcome.kind, ScanOutcomeKind.offlineQueued);
        final row = (await database.pendingAttendanceQueue(
          studentUser.id,
        )).single;

        // DD-F1: the channel the student actually used.
        expect(row.inputChannel, 'manual');
        // DD-F2: the trusted-clock fix timestamp, in-person only.
        expect(
          row.locationCapturedAt,
          now.subtract(const Duration(seconds: 4)),
        );
        expect(row.accuracy, 8);
        expect(row.latitude, _latitude);

        // DD-F4: the replayed payload carries exactly that evidence.
        final payload = buildAttendanceSyncPayload(row);
        expect(payload['inputChannel'], 'manual');
        expect(
          payload['locationCapturedAt'],
          now.subtract(const Duration(seconds: 4)).toUtc().toIso8601String(),
        );
        expect(payload['accuracyMeters'], 8);
      },
    );
  });
}

/// Online session id used by the already-saved online-leg test.
const String sessIdOnline = 'sess-online';
