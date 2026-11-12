/// Network configuration for the NestJS Polycheck API.
///
/// The defaults mirror the Android client (`android/services/api-config.ts`
/// plus the staging URL pinned in `android/eas.json`). Override at build time:
/// `--dart-define=PUP_API_BASE_URL=https://host/api` and, when the realtime
/// endpoint is not derivable, `--dart-define=PUP_WS_BASE_URL=https://host/attendance`.
class ApiConfig {
  const ApiConfig._();

  /// Staging API used by the released React Native app.
  static const String baseUrl = String.fromEnvironment(
    'PUP_API_BASE_URL',
    defaultValue: 'https://polycheck-api.addtokart.tech/api',
  );

  /// Optional explicit Socket.IO namespace URL (`.../attendance`).
  static const String socketBaseUrl = String.fromEnvironment(
    'PUP_WS_BASE_URL',
    defaultValue: '',
  );

  /// Socket.IO namespace used by the attendance/realtime gateway.
  static const String socketNamespace = '/attendance';

  static const Duration connectTimeout = Duration(seconds: 10);
  static const Duration receiveTimeout = Duration(seconds: 10);
  static const Duration sendTimeout = Duration(seconds: 10);
  static const Duration coldStartVerificationTimeout = Duration(seconds: 4);

  /// Public trusted-clock probe (see `backend/src/health.controller.ts`).
  static const String healthPath = '/health';

  /// Derived Socket.IO URL: strips the `/api` suffix and appends the namespace,
  /// exactly like `android/services/realtime.ts`.
  static String get socketUrl {
    if (socketBaseUrl.trim().isNotEmpty) {
      return _trimTrailingSlashes(socketBaseUrl.trim());
    }
    final normalizedBase = _trimTrailingSlashes(baseUrl);
    final withoutApi = normalizedBase.replaceFirst(RegExp(r'/api/?$'), '');
    return '$withoutApi$socketNamespace';
  }

  /// Socket.IO connects to the origin; `path` stays the default `/socket.io`.
  static String get socketOrigin {
    final uri = Uri.tryParse(socketUrl);
    if (uri == null) return socketUrl;
    return uri.replace(path: '', query: null, fragment: null).toString();
  }

  static String _trimTrailingSlashes(String value) {
    return value.replaceFirst(RegExp(r'/+$'), '');
  }
}
