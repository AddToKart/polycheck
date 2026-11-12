import '../models/api.dart';
import '../models/session.dart';
import 'api_base.dart';

/// Session CRUD and dual-checkpoint activation.
///
/// The local Ed25519 signing/offline-cache portions of the RN
/// `generateQrCode`/`generateCheckpointQrCode` methods live in the signing and
/// sync slices (Phase 4). These methods take the already-signed token and are
/// strictly network operations, matching `POST /sessions/:id/activate` and
/// `POST /sessions/:id/end`.
class SessionsApi extends ApiBase {
  SessionsApi(super.dio);

  Future<List<Session>> getSessions({String? sectionId}) async {
    final data = await getJson('/sessions', query: {'sectionId': sectionId});
    return asList(data)
        .whereType<Map>()
        .map((item) => Session.fromJson(asMap(item)))
        .toList(growable: false);
  }

  Future<List<Session>> getSectionSessions(String sectionId) {
    return getSessions(sectionId: sectionId);
  }

  Future<Session> getSession(String id) async {
    final data = await getJson('/sessions/$id');
    return Session.fromJson(asMap(data));
  }

  Future<Session> createSession(CreateSessionInput input) async {
    final body = input.toJson()..remove('teacherId');
    final data = await postJson('/sessions', body: body);
    return Session.fromJson(asMap(data));
  }

  Future<List<Session>> createBulkSessions(BulkSessionInput input) async {
    final body = input.toJson()..remove('teacherId');
    final data = await postJson('/sessions/bulk', body: body);
    return asList(data)
        .whereType<Map>()
        .map((item) => Session.fromJson(asMap(item)))
        .toList(growable: false);
  }

  /// Legacy in-person activation (`validityMinutes` + optional grace).
  Future<Session> activateSession(
    String sessionId, {
    required int validityMinutes,
    int? gracePeriodMinutes,
    required String token,
    TeacherActivationLocation? teacherLocation,
  }) async {
    if (validityMinutes < 1 || validityMinutes > 15) {
      throw ArgumentError.value(
        validityMinutes,
        'validityMinutes',
        'QR validity must be 1-15 minutes',
      );
    }
    if (gracePeriodMinutes != null &&
        (gracePeriodMinutes < 0 || gracePeriodMinutes > 60)) {
      throw ArgumentError.value(
        gracePeriodMinutes,
        'gracePeriodMinutes',
        'QR grace must be 0-60 minutes',
      );
    }
    final data = await postJson(
      '/sessions/$sessionId/activate',
      body: <String, dynamic>{
        'validityMinutes': validityMinutes,
        'gracePeriodMinutes': ?gracePeriodMinutes,
        'token': token,
        ..._teacherLocation(teacherLocation),
      },
    );
    return Session.fromJson(asMap(data));
  }

  /// Online dual-checkpoint activation (`start`/`end`).
  ///
  /// [input] carries the locally hashed PIN material for the token; the
  /// plaintext `pin` field is never transmitted (the backend verifies against
  /// `pinHash` inside the signed token).
  Future<Session> activateCheckpoint(
    GenerateCheckpointQrInput input, {
    required String token,
  }) async {
    if (input.validitySeconds < 60 || input.validitySeconds > 300) {
      throw ArgumentError.value(
        input.validitySeconds,
        'validitySeconds',
        'Checkpoint QR validity must be 60-300 seconds',
      );
    }
    if (input.checkpoint == CheckpointType.start &&
        input.graceMinutes != null &&
        (input.graceMinutes! < 0 || input.graceMinutes! > 60)) {
      throw ArgumentError.value(
        input.graceMinutes,
        'graceMinutes',
        'Check-in grace must be 0-60 minutes',
      );
    }
    final data = await postJson(
      '/sessions/${input.sessionId}/activate',
      body: <String, dynamic>{
        'checkpoint': input.checkpoint.wire,
        'validitySeconds': input.validitySeconds,
        if (input.checkpoint == CheckpointType.start)
          'gracePeriodMinutes': input.graceMinutes ?? 10,
        if (input.regenerate == true) 'regenerate': true,
        'token': token,
        ..._teacherLocation(input.teacherLocation),
      },
    );
    return Session.fromJson(asMap(data));
  }

  Future<Session> endSession(String sessionId) async {
    final data = await postJson('/sessions/$sessionId/end');
    return Session.fromJson(asMap(data));
  }

  Map<String, dynamic> _teacherLocation(TeacherActivationLocation? location) {
    if (location?.latitude == null || location?.longitude == null) {
      return const <String, dynamic>{};
    }
    return <String, dynamic>{
      'latitude': location!.latitude,
      'longitude': location.longitude,
      if (location.overrideFlag == true) 'overrideTeacherLocation': true,
    };
  }
}
