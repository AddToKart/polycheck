import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/api/api_models.dart';
import 'package:polycheck_mobile/src/core/api/attendance_api.dart';
import 'package:polycheck_mobile/src/core/api/session_api.dart';
import 'package:polycheck_mobile/src/core/api/sessions_api.dart';
import 'package:polycheck_mobile/src/core/models/api.dart';
import 'package:polycheck_mobile/src/core/models/session.dart';

void main() {
  group('request builders send the exact Android paths and bodies', () {
    late RecordingAdapter adapter;
    late Dio dio;

    setUp(() {
      adapter = RecordingAdapter();
      dio = Dio(
        BaseOptions(
          baseUrl: 'https://example.test/api',
          contentType: Headers.jsonContentType,
          responseType: ResponseType.json,
        ),
      )..httpClientAdapter = adapter;
    });

    tearDown(() {
      dio.close(force: true);
    });

    test('student login includes the installation deviceId', () async {
      final api = SessionApi(dio);
      final result = await api.loginStudent(
        studentId: '2024-00001-MN-0',
        password: 'Secret123!',
        deviceId: 'mobile-test-device',
      );

      final request = adapter.requests.single;
      expect(request.uri.path, endsWith('/auth/mobile/login/student'));
      expect(request.method, 'POST');
      expect(bodyOf(request), {
        'studentId': '2024-00001-MN-0',
        'password': 'Secret123!',
        'deviceId': 'mobile-test-device',
      });
      expect(result.token, 'test-token');
      expect(result.user.role.wire, 'student');
    });

    test('faculty login includes email, password, and deviceId', () async {
      final api = SessionApi(dio);
      await api.loginFaculty(
        email: 'teacher1@pup.edu.ph',
        password: 'Secret123!',
        deviceId: 'mobile-test-device',
      );

      expect(bodyOf(adapter.requests.single), {
        'email': 'teacher1@pup.edu.ph',
        'password': 'Secret123!',
        'deviceId': 'mobile-test-device',
      });
    });

    test('logout arms the cooldown flag and carries the device id', () async {
      final api = SessionApi(dio);
      await api.logout(
        deviceId: 'mobile-test-device',
        armDeviceCooldown: false,
      );

      final request = adapter.requests.single;
      expect(request.uri.path, endsWith('/auth/logout'));
      expect(bodyOf(request), {
        'deviceId': 'mobile-test-device',
        'armDeviceCooldown': false,
      });
    });

    test('scan flattens evidence and never sends sectionId', () async {
      final api = AttendanceApi(dio);
      final record = await api.submitScan(
        sessionId: 'sess-1',
        studentId: 'u1',
        studentName: 'Student One',
        lat: 14.87,
        lon: 120.99,
        deviceId: 'mobile-test-device',
        qrToken: 'signed-token',
        scannedAt: '2026-11-10T00:00:00.000Z',
        evidence: const ScanEvidenceInput(
          clientAttemptId: 'attempt-1',
          accuracyMeters: 8,
          locationCapturedAt: '2026-11-10T00:00:00.000Z',
          mocked: false,
          inputChannel: ScanInputChannel.camera,
          deviceSecurity: DeviceSecurityEvidence(
            rootDetected: false,
            hookDetected: false,
            emulatorDetected: false,
          ),
        ),
        pin: '1234',
      );

      expect(record.id, 'rec-1');
      final body = bodyOf(adapter.requests.single);
      expect(body, {
        'sessionId': 'sess-1',
        'lat': 14.87,
        'lon': 120.99,
        'deviceId': 'mobile-test-device',
        'qrToken': 'signed-token',
        'scannedAt': '2026-11-10T00:00:00.000Z',
        'clientAttemptId': 'attempt-1',
        'accuracyMeters': 8,
        'locationCapturedAt': '2026-11-10T00:00:00.000Z',
        'mocked': false,
        'inputChannel': 'camera',
        'deviceSecurity': {
          'rootDetected': false,
          'hookDetected': false,
          'emulatorDetected': false,
        },
        'pin': '1234',
      });
      expect(body.containsKey('sectionId'), isFalse);
    });

    test('bulk creation sends slots and strips teacherId', () async {
      final api = SessionsApi(dio);
      await api.createBulkSessions(
        const BulkSessionInput(
          sectionId: 'sec-1',
          subjectName: 'Data Structures',
          startDate: '2026-11-10',
          endDate: '2026-11-30',
          slots: [
            BulkSessionSlot(day: 'Mon', startTime: '08:00', endTime: '09:30'),
            BulkSessionSlot(day: 'Wed', startTime: '13:00', endTime: '14:30'),
          ],
          teacherId: 't1',
        ),
      );

      final body = bodyOf(adapter.requests.single);
      expect(body['slots'], [
        {'day': 'Mon', 'startTime': '08:00', 'endTime': '09:30'},
        {'day': 'Wed', 'startTime': '13:00', 'endTime': '14:30'},
      ]);
      expect(body.containsKey('teacherId'), isFalse);
      expect(body.containsKey('daysOfWeek'), isFalse);
    });

    test(
      'online checkpoint activation sends the signed token, not the PIN',
      () async {
        final api = SessionsApi(dio);
        await api.activateCheckpoint(
          const GenerateCheckpointQrInput(
            sessionId: 'sess-1',
            checkpoint: CheckpointType.start,
            validitySeconds: 120,
            graceMinutes: 10,
            regenerate: true,
            pin: '1234',
            teacherLocation: TeacherActivationLocation(
              latitude: 14.87,
              longitude: 120.99,
            ),
          ),
          token: 'signed-token',
        );

        final request = adapter.requests.single;
        expect(request.uri.path, endsWith('/sessions/sess-1/activate'));
        final body = bodyOf(request);
        expect(body, {
          'checkpoint': 'start',
          'validitySeconds': 120,
          'gracePeriodMinutes': 10,
          'regenerate': true,
          'token': 'signed-token',
          'latitude': 14.87,
          'longitude': 120.99,
        });
        expect(body.containsKey('pin'), isFalse);
      },
    );

    test(
      'legacy in-person activation sends validity minutes and grace',
      () async {
        final api = SessionsApi(dio);
        await api.activateSession(
          'sess-1',
          validityMinutes: 10,
          gracePeriodMinutes: 15,
          token: 'signed-token',
        );

        expect(bodyOf(adapter.requests.single), {
          'validityMinutes': 10,
          'gracePeriodMinutes': 15,
          'token': 'signed-token',
        });
      },
    );

    test(
      'section listing forwards the subject filter as a query param',
      () async {
        final api = SessionsApi(dio);
        await api.getSessions(sectionId: 'sec-1');

        final request = adapter.requests.single;
        expect(request.uri.path, endsWith('/sessions'));
        expect(request.uri.queryParameters['sectionId'], 'sec-1');
      },
    );
  });
}

Map<String, dynamic> bodyOf(RequestOptions request) {
  final data = request.data;
  if (data is Map<String, dynamic>) return data;
  if (data is Map) return data.cast<String, dynamic>();
  if (data is String) {
    final decoded = jsonDecode(data);
    if (decoded is Map) return decoded.cast<String, dynamic>();
  }
  throw StateError('Request had no JSON object body: $data');
}

class RecordingAdapter implements HttpClientAdapter {
  final List<RequestOptions> requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return ResponseBody.fromString(
      jsonEncode(_responseFor(options)),
      200,
      headers: <String, List<String>>{
        Headers.contentTypeHeader: <String>[Headers.jsonContentType],
      },
    );
  }

  Object _responseFor(RequestOptions options) {
    final path = options.uri.path;
    if (path.endsWith('/auth/mobile/login/student') ||
        path.endsWith('/auth/mobile/login/faculty')) {
      return <String, dynamic>{
        'user': _userJson(
          role: path.endsWith('student') ? 'student' : 'teacher',
        ),
        'token': 'test-token',
      };
    }
    if (path.endsWith('/auth/logout')) {
      return <String, dynamic>{'message': 'Logged out successfully'};
    }
    if (path.endsWith('/attendance/scan')) {
      return _recordJson();
    }
    if (path.endsWith('/sessions/bulk')) {
      return <Object>[_sessionJson()];
    }
    if (path.endsWith('/activate') || path.endsWith('/end')) {
      return _sessionJson();
    }
    if (path.endsWith('/sessions')) {
      return <Object>[_sessionJson()];
    }
    return <String, dynamic>{};
  }

  Map<String, dynamic> _userJson({required String role}) => {
    'id': 'u1',
    'fullName': 'Student One',
    'role': role,
    'isActive': true,
  };

  Map<String, dynamic> _sessionJson() => {
    'id': 'sess-1',
    'sectionId': 'sec-1',
    'date': '2026-11-10',
    'startTime': '08:00',
    'endTime': '09:00',
    'teacherId': 't1',
  };

  Map<String, dynamic> _recordJson() => {
    'id': 'rec-1',
    'sessionId': 'sess-1',
    'sectionId': 'sec-1',
    'studentId': 'u1',
    'status': 'present',
    'coordinates': {'latitude': 14.87, 'longitude': 120.99},
    'isSynced': true,
  };

  @override
  void close({bool force = false}) {}
}
