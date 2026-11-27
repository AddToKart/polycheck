import 'package:dio/dio.dart';

import '../models/user.dart';
import '../network/api_config.dart';
import '../network/api_error.dart';
import 'api_base.dart';
import 'api_models.dart';

/// Outcome of a self-service password-reset request.
///
/// [email]: a reset link was sent (or one was sent moments ago) to the email
/// the student bound on their profile. [unavailable]: no usable bound email
/// for that student number; the unknown-number and nothing-bound cases are
/// indistinguishable by design, so the student is pointed at their instructor.
enum PasswordResetDelivery { email, unavailable }

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

  /// `POST /password-reset/request` -> `{ ok, delivery }`. Public. The reset
  /// itself happens on the web page the emailed link opens.
  Future<PasswordResetDelivery> requestPasswordReset(String studentId) async {
    final data = await postJson(
      '/password-reset/request',
      body: <String, dynamic>{'studentId': studentId},
    );
    final delivery = asMap(data)['delivery'];
    return delivery == 'email'
        ? PasswordResetDelivery.email
        : PasswordResetDelivery.unavailable;
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

  /// `_getProfile` already returns a parsed [User]. Parsing its result again
  /// reads an empty map and throws, which broke every profile reload.
  Future<User> me({Duration? timeout}) =>
      _getProfile('/auth/me', timeout: timeout);

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
