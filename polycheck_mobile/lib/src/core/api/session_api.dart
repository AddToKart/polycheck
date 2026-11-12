import 'package:dio/dio.dart';

import '../models/user.dart';
import '../network/api_config.dart';
import '../network/api_error.dart';
import 'api_base.dart';
import 'api_models.dart';

/// Authentication and device-key endpoints (`backend/src/auth/auth.controller.ts`).
class SessionApi extends ApiBase {
  SessionApi(super.dio);

  Future<PrivacyNotice> getPrivacyNotice() async {
    final data = await getJson('/auth/privacy-notice');
    return PrivacyNotice.fromJson(asMap(data));
  }

  Future<User> acceptPrivacyConsent(String version) async {
    final data = await postJson(
      '/auth/privacy-consent',
      body: <String, dynamic>{'version': version},
    );
    return User.fromJson(asMap(data));
  }

  /// `POST /auth/mobile/login/student` -> `{ user, token }`.
  Future<LoginResult> loginStudent({
    required String studentId,
    required String password,
    String? deviceId,
  }) async {
    final data = await postJson(
      '/auth/mobile/login/student',
      body: <String, dynamic>{
        'studentId': studentId,
        'password': password,
        'deviceId': ?deviceId,
      },
    );
    return LoginResult.fromJson(asMap(data));
  }

  /// `POST /auth/mobile/login/faculty` -> `{ user, token }`.
  Future<LoginResult> loginFaculty({
    required String email,
    required String password,
    String? deviceId,
  }) async {
    final data = await postJson(
      '/auth/mobile/login/faculty',
      body: <String, dynamic>{
        'email': email,
        'password': password,
        'deviceId': ?deviceId,
      },
    );
    return LoginResult.fromJson(asMap(data));
  }

  Future<void> logout({String? deviceId, bool? armDeviceCooldown}) async {
    await postJson(
      '/auth/logout',
      body: <String, dynamic>{
        'deviceId': ?deviceId,
        'armDeviceCooldown': ?armDeviceCooldown,
      },
    );
  }

  Future<User> me({Duration? timeout}) async {
    final data = await _getProfile('/auth/me', timeout: timeout);
    return User.fromJson(asMap(data));
  }

  Future<User> _getProfile(String path, {Duration? timeout}) async {
    try {
      final response = await dio.get<dynamic>(
        path,
        options: timeout == null
            ? null
            : Options(
                connectTimeout: timeout,
                receiveTimeout: timeout,
                sendTimeout: timeout,
              ),
      );
      return User.fromJson(asMap(response.data));
    } on DioException catch (error) {
      throw ApiRequestError.fromDio(error);
    }
  }

  /// Rotates the password and returns the updated profile.
  ///
  /// `currentPassword` is optional only for forced temporary-password
  /// rotation, exactly like `ChangePasswordDto`.
  Future<User> changePassword({
    String? currentPassword,
    required String newPassword,
  }) async {
    final data = await postJson(
      '/auth/change-password',
      body: <String, dynamic>{
        'currentPassword': ?currentPassword,
        'newPassword': newPassword,
      },
    );
    return User.fromJson(asMap(data));
  }

  Future<void> provisionKey(String publicKey) async {
    await postJson(
      '/auth/provision-key',
      body: <String, dynamic>{'publicKey': publicKey},
    );
  }

  Future<void> revokeKey() async {
    await postJson('/auth/revoke-key');
  }

  /// Public trusted-clock probe used by `TrustedClock`.
  Future<DateTime> healthTimestamp() async {
    final data = await getJson(ApiConfig.healthPath);
    final raw = asMap(data)['timestamp'];
    final parsed = raw is String ? DateTime.tryParse(raw) : null;
    if (parsed == null) {
      throw FormatException('Health response is missing a valid timestamp');
    }
    return parsed.toUtc();
  }
}
