import 'dart:convert';

import 'package:dio/dio.dart';

import '../models/device_integrity.dart';

/// Typed failure returned by every API class.
///
/// Mirrors the Android `ApiRequestError` fields plus the complete
/// `AllExceptionsFilter` surface (device-integrity, maintenance, and teacher
/// activation geofence payloads). No API method swallows an error: transport
/// failures become `ApiRequestError` with status `0`, so callers branch on the
/// same classifiers the RN clients use.
class ApiRequestError implements Exception {
  const ApiRequestError({
    required this.message,
    required this.status,
    this.code,
    this.remainingMinutes,
    this.remainingSeconds,
    this.activeDeviceKind,
    this.activeSessionLastActiveAt,
    this.estimatedEnd,
    this.distanceMeters,
    this.allowedDistanceMeters,
    this.canRequestOverride,
    this.method,
    this.path,
    this.cause,
  });

  factory ApiRequestError.fromDio(DioException error) {
    final response = error.response;
    final status = response?.statusCode ?? 0;
    final data = response?.data;
    Map<String, dynamic>? body;
    if (data is Map<String, dynamic>) {
      body = data;
    } else if (data is Map) {
      body = data.cast<String, dynamic>();
    } else if (data is String && data.trim().isNotEmpty) {
      try {
        final decoded = jsonDecode(data);
        if (decoded is Map) body = decoded.cast<String, dynamic>();
      } on FormatException {
        body = <String, dynamic>{'message': data};
      }
    }

    final rawMessage = body?['message'];
    final message = switch (rawMessage) {
      List<Object?> list => list.map((part) => '$part').join('. '),
      String value when value.isNotEmpty => value,
      _ => _transportMessage(error, status),
    };

    return ApiRequestError(
      message: message,
      status: status,
      code: body?['code'] is String ? body!['code'] as String : null,
      remainingMinutes: _asInt(body?['remainingMinutes']),
      remainingSeconds: _asInt(body?['remainingSeconds']),
      activeDeviceKind: _asDeviceKind(body?['activeDeviceKind']),
      activeSessionLastActiveAt: body?['activeSessionLastActiveAt'] is String
          ? body!['activeSessionLastActiveAt'] as String
          : null,
      estimatedEnd: body?['estimatedEnd'] is String
          ? body!['estimatedEnd'] as String
          : null,
      distanceMeters: _asDouble(body?['distanceMeters']),
      allowedDistanceMeters: _asDouble(body?['allowedDistanceMeters']),
      canRequestOverride: body?['canRequestOverride'] is bool
          ? body!['canRequestOverride'] as bool
          : null,
      method: error.requestOptions.method,
      path: error.requestOptions.path,
      cause: error,
    );
  }

  final String message;
  final int status;
  final String? code;
  final int? remainingMinutes;
  final int? remainingSeconds;
  final ActiveDeviceKind? activeDeviceKind;
  final String? activeSessionLastActiveAt;
  final String? estimatedEnd;
  final double? distanceMeters;
  final double? allowedDistanceMeters;
  final bool? canRequestOverride;
  final String? method;
  final String? path;
  final Object? cause;

  /// Transport failure or server-side failure; both activate the offline
  /// fallbacks in the RN clients (`status >= 500` counts as unavailable).
  bool get isNetworkFailure => status == 0 || status >= 500;

  bool get isUnauthorized => status == 401;

  bool get isMaintenance => status == 503 && code == 'system_maintenance';

  bool get isActiveSessionElsewhere =>
      status == 403 && code == 'active_session_elsewhere';

  bool get isDeviceCooldown =>
      status == 403 && code == 'device_cooldown_active';

  bool get isPasswordChangeRequired =>
      status == 403 && code == 'password_change_required';

  bool get isTeacherLocationRejected =>
      status == 409 && code == 'teacher_location_outside_geofence';

  /// Cooldown countdown from the server-supplied seconds (preferred) or
  /// minutes. Returns null when the payload carried neither.
  Duration? get remainingCooldown {
    final seconds = remainingSeconds;
    if (seconds != null) return Duration(seconds: seconds);
    final minutes = remainingMinutes;
    if (minutes != null) return Duration(minutes: minutes);
    return null;
  }

  /// Device-integrity payload in the shared contract shape (null for other
  /// errors or an unrecognised device kind).
  DeviceIntegrityErrorPayload? get deviceIntegrityPayload {
    final deviceCode = switch (code) {
      'device_cooldown_active' => DeviceIntegrityErrorCode.deviceCooldownActive,
      'active_session_elsewhere' =>
        DeviceIntegrityErrorCode.activeSessionElsewhere,
      _ => null,
    };
    if (deviceCode == null) return null;
    return DeviceIntegrityErrorPayload(
      code: deviceCode,
      message: message,
      remainingMinutes: remainingMinutes,
      remainingSeconds: remainingSeconds,
      activeDeviceKind: activeDeviceKind,
      activeSessionLastActiveAt: activeSessionLastActiveAt,
    );
  }

  @override
  String toString() => 'ApiRequestError($status$code): $message';

  static String _transportMessage(DioException error, int status) {
    if (status > 0) return error.response?.statusMessage ?? 'Request failed';
    return switch (error.type) {
      DioExceptionType.connectionTimeout ||
      DioExceptionType.sendTimeout ||
      DioExceptionType.receiveTimeout => 'The server took too long to respond.',
      DioExceptionType.connectionError =>
        'Cannot reach the Polycheck server. Check your connection.',
      DioExceptionType.cancel => 'The request was cancelled.',
      _ => 'Request failed',
    };
  }

  static int? _asInt(Object? value) {
    if (value is int) return value;
    if (value is num) return value.toInt();
    return null;
  }

  static double? _asDouble(Object? value) {
    if (value is num) return value.toDouble();
    return null;
  }

  static ActiveDeviceKind? _asDeviceKind(Object? value) {
    if (value is! String) return null;
    return ActiveDeviceKind.tryParse(value);
  }
}
