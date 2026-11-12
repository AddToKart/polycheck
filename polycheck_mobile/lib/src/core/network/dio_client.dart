import 'dart:async';

import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../models/maintenance.dart';
import 'api_config.dart';
import 'api_events.dart';
import 'secure_token_store.dart';

/// Builds the shared Dio instance.
///
/// Interceptors mirror the RN contract:
/// * bearer auth from secure storage (same `polycheck-token` key),
/// * `X-Polycheck-Device-Id` installation identity,
/// * 401 outside login -> clear token + emit [SessionExpiredEvent],
/// * 503 `system_maintenance` -> emit [MaintenanceEvent],
/// * one retry for idempotent GETs on transport failures (mutations never
///   retry here; offline sync owns its own receipt/retry pipeline).
Dio createPolycheckDio({
  required TokenStore tokenStore,
  required DeviceIdentity deviceIdentity,
  required ApiEvents events,
  Future<void> Function()? onUnauthorized,
  String? baseUrl,
  HttpClientAdapter? adapter,
}) {
  final dio = Dio(
    BaseOptions(
      baseUrl: baseUrl ?? ApiConfig.baseUrl,
      connectTimeout: ApiConfig.connectTimeout,
      receiveTimeout: ApiConfig.receiveTimeout,
      sendTimeout: ApiConfig.sendTimeout,
      contentType: Headers.jsonContentType,
      responseType: ResponseType.json,
      headers: const <String, dynamic>{'Accept': Headers.jsonContentType},
    ),
  );
  if (adapter != null) dio.httpClientAdapter = adapter;
  dio.interceptors.add(
    PolycheckInterceptor(
      dio: dio,
      tokenStore: tokenStore,
      deviceIdentity: deviceIdentity,
      events: events,
      onUnauthorized: onUnauthorized,
    ),
  );
  return dio;
}

class PolycheckInterceptor extends Interceptor {
  PolycheckInterceptor({
    required this.dio,
    required this.tokenStore,
    required this.deviceIdentity,
    required this.events,
    this.onUnauthorized,
  });

  final Dio dio;
  final TokenStore tokenStore;
  final DeviceIdentity deviceIdentity;
  final ApiEvents events;
  final Future<void> Function()? onUnauthorized;

  static const String _retryKey = 'polycheck.retried';

  static const Set<String> _authExemptPrefixes = {
    '/auth/mobile/login',
    '/auth/login',
    '/auth/privacy-notice',
    '/auth/logout',
    '/health',
    '/maintenance/status',
  };

  /// Login requests must not carry a stale bearer token (Android sends only
  /// `Content-Type` on these calls).
  static const Set<String> _noAuthPrefixes = {
    '/auth/mobile/login',
    '/auth/login',
  };

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    if (!_isNoAuth(options.path)) {
      final token = await tokenStore.read();
      if (token != null && token.isNotEmpty) {
        options.headers['Authorization'] = 'Bearer $token';
      }
    }
    try {
      final deviceId = await deviceIdentity.getOrCreate();
      options.headers['X-Polycheck-Device-Id'] = deviceId;
    } catch (_) {
      // Identity is best-effort for ordinary requests; login/scans surface the
      // typed failure themselves when the identity is required.
    }
    handler.next(options);
  }

  @override
  Future<void> onError(
    DioException err,
    ErrorInterceptorHandler handler,
  ) async {
    final status = err.response?.statusCode;
    final path = err.requestOptions.path;

    if (status == 503 && _isMaintenance(err.response?.data)) {
      events.emitMaintenance(
        MaintenanceEvent(
          message: _maintenanceMessage(err.response?.data),
          estimatedEnd: _maintenanceEstimatedEnd(err.response?.data),
          at: DateTime.now().toUtc(),
        ),
      );
    }

    if (status == 401 && !_isAuthExempt(path)) {
      final hadToken = await _hasStoredToken();
      await tokenStore.clear();
      if (hadToken) {
        events.emitSessionExpired(
          SessionExpiredEvent(
            at: DateTime.now().toUtc(),
            method: err.requestOptions.method,
            path: path,
            message: _responseMessage(err.response?.data),
          ),
        );
        await onUnauthorized?.call();
      }
      handler.next(err);
      return;
    }

    if (await _shouldRetry(err)) {
      final retryOptions = err.requestOptions;
      retryOptions.extra = <String, dynamic>{
        ...retryOptions.extra,
        _retryKey: true,
      };
      try {
        final response = await dio.fetch<dynamic>(retryOptions);
        handler.resolve(response);
        return;
      } on DioException catch (retryError) {
        handler.next(retryError);
        return;
      }
    }

    handler.next(err);
  }

  Future<bool> _hasStoredToken() async {
    final token = await tokenStore.read();
    return token != null && token.isNotEmpty;
  }

  Future<bool> _shouldRetry(DioException error) async {
    if (error.requestOptions.method.toUpperCase() != 'GET') return false;
    if (error.requestOptions.extra[_retryKey] == true) return false;
    if (error.response != null) return false;
    return switch (error.type) {
      DioExceptionType.connectionTimeout ||
      DioExceptionType.sendTimeout ||
      DioExceptionType.receiveTimeout ||
      DioExceptionType.connectionError ||
      DioExceptionType.unknown => true,
      _ => false,
    };
  }

  bool _isAuthExempt(String path) {
    final normalized = _stripQuery(path);
    return _authExemptPrefixes.any(normalized.startsWith);
  }

  bool _isNoAuth(String path) {
    final normalized = _stripQuery(path);
    return _noAuthPrefixes.any(normalized.startsWith);
  }

  static String _stripQuery(String path) {
    final index = path.indexOf('?');
    return index == -1 ? path : path.substring(0, index);
  }

  static bool _isMaintenance(Object? data) {
    return _bodyMap(data)?['code'] == 'system_maintenance';
  }

  static String _maintenanceMessage(Object? data) {
    final body = _bodyMap(data);
    final raw = body?['message'];
    if (raw is List) {
      final joined = raw.map((part) => '$part').join('. ');
      if (joined.isNotEmpty) return joined;
    }
    if (raw is String && raw.isNotEmpty) return raw;
    return defaultMaintenanceMessage;
  }

  static String? _maintenanceEstimatedEnd(Object? data) {
    final raw = _bodyMap(data)?['estimatedEnd'];
    return raw is String ? raw : null;
  }

  static String? _responseMessage(Object? data) {
    final raw = _bodyMap(data)?['message'];
    if (raw is String) return raw;
    if (raw is List) return raw.map((part) => '$part').join('. ');
    return null;
  }

  static Map<String, dynamic>? _bodyMap(Object? data) {
    if (data is Map<String, dynamic>) return data;
    if (data is Map) return data.cast<String, dynamic>();
    return null;
  }
}

final tokenStoreProvider = Provider<TokenStore>((ref) {
  return SecureTokenStore();
});

final deviceIdentityProvider = Provider<DeviceIdentity>((ref) {
  return DeviceIdentity();
});

final apiEventsProvider = Provider<ApiEvents>((ref) {
  final events = ApiEvents();
  ref.onDispose(() => unawaited(events.dispose()));
  return events;
});

/// Dio used by every feature/API class. The auth provider listens to the same
/// [ApiEvents] stream to purge the cached profile.
final dioProvider = Provider<Dio>((ref) {
  final dio = createPolycheckDio(
    tokenStore: ref.watch(tokenStoreProvider),
    deviceIdentity: ref.watch(deviceIdentityProvider),
    events: ref.watch(apiEventsProvider),
  );
  ref.onDispose(dio.close);
  return dio;
});

final sessionExpiredEventsProvider = StreamProvider<SessionExpiredEvent>((ref) {
  return ref.watch(apiEventsProvider).sessionExpired;
});

final maintenanceEventsProvider = StreamProvider<MaintenanceEvent>((ref) {
  return ref.watch(apiEventsProvider).maintenance;
});
