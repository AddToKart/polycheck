import 'package:dio/dio.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';

import 'env.dart';

/// A disposable fixture could not be created; carries the server's own body so
/// a failing run names the exact validator that rejected it.
class FixtureApiException implements Exception {
  const FixtureApiException({
    required this.method,
    required this.path,
    required this.statusCode,
    required this.body,
  });

  final String method;
  final String path;
  final int statusCode;
  final Object? body;

  @override
  String toString() =>
      'FixtureApiException: $method $path failed with HTTP $statusCode\n'
      'Response: $body';
}

/// `{ user, token }` as returned by `POST /auth/mobile/login/{student,faculty}`.
class FixtureSession {
  const FixtureSession({required this.user, required this.token});

  final User user;
  final String token;

  String get id => user.id;
}

/// Plain-HTTP helpers for building and inspecting fixtures.
///
/// This talks to the same backend the app under test talks to, over the app's
/// own HTTP client (`dio`), but deliberately keeps its own token jar: fixture
/// setup must not disturb (or depend on) the token the app's Dio interceptor
/// reads out of secure storage.
class FixtureApi {
  FixtureApi({Dio? dio})
    : _dio =
          dio ??
          Dio(
            BaseOptions(
              baseUrl: IntegrationEnv.baseUrl,
              connectTimeout: const Duration(seconds: 15),
              receiveTimeout: const Duration(seconds: 20),
              sendTimeout: const Duration(seconds: 20),
              contentType: Headers.jsonContentType,
              responseType: ResponseType.json,
              headers: const <String, dynamic>{
                'Accept': Headers.jsonContentType,
              },
            ),
          );

  final Dio _dio;

  /// Transport-level failures are retried once: two sibling agents share this
  /// backend, so a single refused/timed-out connection is not evidence.
  static const List<DioExceptionType> _retryableTypes = <DioExceptionType>[
    DioExceptionType.connectionError,
    DioExceptionType.connectionTimeout,
    DioExceptionType.sendTimeout,
    DioExceptionType.receiveTimeout,
  ];

  Future<Object?> _send(
    String method,
    String path, {
    String? token,
    Object? body,
    Map<String, dynamic>? query,
  }) async {
    for (var attempt = 0; ; attempt++) {
      try {
        final response = await _dio.request<Object?>(
          path,
          data: body,
          queryParameters: query,
          options: Options(
            method: method,
            headers: <String, dynamic>{
              if (token != null) 'Authorization': 'Bearer $token',
            },
          ),
        );
        return response.data;
      } on DioException catch (error) {
        if (attempt == 0 && _retryableTypes.contains(error.type)) {
          continue;
        }
        throw FixtureApiException(
          method: method,
          path: path,
          statusCode: error.response?.statusCode ?? 0,
          body: error.response?.data ?? error.message,
        );
      }
    }
  }

  Map<String, dynamic> _map(Object? value) {
    if (value is Map<String, dynamic>) return value;
    if (value is Map) return value.cast<String, dynamic>();
    throw FixtureApiException(
      method: 'PARSE',
      path: '(response)',
      statusCode: 0,
      body: value,
    );
  }

  List<Map<String, dynamic>> _list(Object? value) {
    if (value is List) {
      return value
          .whereType<Map>()
          .map((e) => e.cast<String, dynamic>())
          .toList();
    }
    // Some endpoints paginate: `{ items: [...] }`.
    if (value is Map) {
      final items = value['items'];
      if (items is List) {
        return items
            .whereType<Map>()
            .map((e) => e.cast<String, dynamic>())
            .toList();
      }
    }
    throw FixtureApiException(
      method: 'PARSE',
      path: '(response)',
      statusCode: 0,
      body: value,
    );
  }

  // ── Auth ────────────────────────────────────────────────────────────────

  /// `GET /health` — the server's own UTC clock, used to stamp the signed QR
  /// token so emulator clock skew can never invalidate the fixture token.
  Future<DateTime> serverNow() async {
    final data = _map(await _send('GET', '/health'));
    return DateTime.parse(data['timestamp']! as String).toUtc();
  }

  Future<FixtureSession> loginFaculty({
    required String email,
    required String password,
  }) async {
    final data = _map(
      await _send(
        'POST',
        '/auth/mobile/login/faculty',
        body: <String, dynamic>{'email': email, 'password': password},
      ),
    );
    return FixtureSession(
      user: User.fromJson(_map(data['user'])),
      token: data['token']! as String,
    );
  }

  Future<FixtureSession> loginStudent({
    required String studentId,
    required String password,
    String? deviceId,
  }) async {
    final data = _map(
      await _send(
        'POST',
        '/auth/mobile/login/student',
        body: <String, dynamic>{
          'studentId': studentId,
          'password': password,
          'deviceId': ?deviceId,
        },
      ),
    );
    return FixtureSession(
      user: User.fromJson(_map(data['user'])),
      token: data['token']! as String,
    );
  }

  /// `GET /auth/privacy-notice` — public, so no token is needed.
  Future<String> privacyNoticeVersion() async {
    final data = _map(await _send('GET', '/auth/privacy-notice'));
    return data['version']! as String;
  }

  /// `POST /auth/privacy-consent` — `SyncController` is consent-gated, so a
  /// freshly created student must accept the notice before it can drain.
  Future<void> acceptPrivacyConsent({
    required String token,
    required String version,
  }) async {
    await _send(
      'POST',
      '/auth/privacy-consent',
      token: token,
      body: <String, dynamic>{'version': version},
    );
  }

  // ── Accounts ────────────────────────────────────────────────────────────

  Future<Map<String, dynamic>> createTeacher({
    required String token,
    required String fullName,
    required String email,
    required String password,
  }) async {
    return _map(
      await _send(
        'POST',
        '/users/teachers',
        token: token,
        body: <String, dynamic>{
          'fullName': fullName,
          'email': email,
          'password': password,
          'department': IntegrationEnv.department,
        },
      ),
    );
  }

  Future<Map<String, dynamic>> createStudent({
    required String token,
    required String fullName,
    required String studentId,
    required String password,
  }) async {
    return _map(
      await _send(
        'POST',
        '/users/students',
        token: token,
        body: <String, dynamic>{
          'fullName': fullName,
          'studentId': studentId,
          'password': password,
          'program': 'BSIT',
          'yearLevel': 1,
          'department': IntegrationEnv.department,
        },
      ),
    );
  }

  // ── Teaching fixtures ───────────────────────────────────────────────────

  Future<Map<String, dynamic>> createSubject({
    required String token,
    required String name,
    required String code,
  }) async {
    return _map(
      await _send(
        'POST',
        '/subjects',
        token: token,
        body: <String, dynamic>{'name': name, 'code': code},
      ),
    );
  }

  Future<Map<String, dynamic>> createSection({
    required String token,
    required String subjectId,
    required String section,
    required String room,
    required String semester,
  }) async {
    return _map(
      await _send(
        'POST',
        '/sections',
        token: token,
        body: <String, dynamic>{
          'subjectId': subjectId,
          'section': section,
          'course': 'BSIT',
          'room': room,
          'semester': semester,
          'schedule': <Map<String, dynamic>>[
            <String, dynamic>{
              'day': 'Mon',
              'startTime': '08:00',
              'endTime': '09:00',
              'room': room,
            },
          ],
        },
      ),
    );
  }

  Future<void> enrollStudent({
    required String token,
    required String sectionId,
    required String studentId,
    required String studentName,
  }) async {
    await _send(
      'POST',
      '/sections/$sectionId/enroll-student',
      token: token,
      body: <String, dynamic>{
        'studentId': studentId,
        'studentName': studentName,
      },
    );
  }

  Future<Map<String, dynamic>> createSession({
    required String token,
    required String sectionId,
    required String subjectName,
    required String date,
    required String startTime,
    required String endTime,
    required String room,
    int qrValidityMinutes = 15,
    int gracePeriodMinutes = 60,
  }) async {
    return _map(
      await _send(
        'POST',
        '/sessions',
        token: token,
        body: <String, dynamic>{
          'sectionId': sectionId,
          'subjectName': subjectName,
          'mode': 'in_person',
          'date': date,
          'startTime': startTime,
          'endTime': endTime,
          'room': room,
          'qrValidityMinutes': qrValidityMinutes,
          'gracePeriodMinutes': gracePeriodMinutes,
          'geofence': <String, dynamic>{
            'latitude': IntegrationEnv.campusLatitude,
            'longitude': IntegrationEnv.campusLongitude,
            'radiusMeters': IntegrationEnv.campusRadiusMeters,
          },
        },
      ),
    );
  }

  /// `POST /auth/provision-key` — installs the teacher's Ed25519 public key,
  /// which is what the server verifies every scanned token against.
  Future<void> provisionTeacherKey({
    required String token,
    required String publicKey,
  }) async {
    await _send(
      'POST',
      '/auth/provision-key',
      token: token,
      body: <String, dynamic>{'publicKey': publicKey},
    );
  }

  /// `POST /sessions/:id/activate` — arms the session with the exact token the
  /// teacher signed locally. The server re-verifies the signature here.
  Future<Map<String, dynamic>> activateSession({
    required String token,
    required String sessionId,
    required String qrToken,
    int validityMinutes = 15,
    int gracePeriodMinutes = 60,
  }) async {
    return _map(
      await _send(
        'POST',
        '/sessions/$sessionId/activate',
        token: token,
        body: <String, dynamic>{
          'token': qrToken,
          'validityMinutes': validityMinutes,
          'gracePeriodMinutes': gracePeriodMinutes,
        },
      ),
    );
  }

  Future<Map<String, dynamic>> getSession({
    required String token,
    required String sessionId,
  }) async {
    return _map(await _send('GET', '/sessions/$sessionId', token: token));
  }

  /// `GET /attendance?sessionId=...` — the authoritative server rows.
  Future<List<Map<String, dynamic>>> readAttendance({
    required String token,
    required String sessionId,
  }) async {
    return _list(
      await _send(
        'GET',
        '/attendance',
        token: token,
        query: <String, dynamic>{'sessionId': sessionId},
      ),
    );
  }

  void close() => _dio.close(force: true);
}
