import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/device_integrity.dart';
import 'package:polycheck_mobile/src/core/network/api_error.dart';

void main() {
  group('typed 403/503 shapes mirror the backend filter', () {
    test('active_session_elsewhere carries the active device kind', () {
      final error = ApiRequestError.fromDio(
        _dioError(403, <String, dynamic>{
          'statusCode': 403,
          'message': 'This account is already signed in on another device.',
          'code': 'active_session_elsewhere',
          'activeDeviceKind': 'mobile',
          'activeSessionLastActiveAt': '2026-11-10T08:00:00.000Z',
        }),
      );

      expect(error.status, 403);
      expect(error.isActiveSessionElsewhere, isTrue);
      expect(error.isDeviceCooldown, isFalse);
      expect(error.isNetworkFailure, isFalse);
      expect(error.activeDeviceKind, ActiveDeviceKind.mobile);
      expect(error.activeSessionLastActiveAt, '2026-11-10T08:00:00.000Z');
      expect(
        error.deviceIntegrityPayload?.code,
        DeviceIntegrityErrorCode.activeSessionElsewhere,
      );
    });

    test('device_cooldown_active exposes seconds and a duration', () {
      final error = ApiRequestError.fromDio(
        _dioError(403, <String, dynamic>{
          'statusCode': 403,
          'message': 'This device is cooling down.',
          'code': 'device_cooldown_active',
          'remainingMinutes': 3,
          'remainingSeconds': 125,
        }),
      );

      expect(error.isDeviceCooldown, isTrue);
      expect(error.remainingMinutes, 3);
      expect(error.remainingSeconds, 125);
      expect(error.remainingCooldown, const Duration(seconds: 125));
      expect(
        error.deviceIntegrityPayload?.code,
        DeviceIntegrityErrorCode.deviceCooldownActive,
      );
    });

    test('maintenance 503 carries the announcement and estimate', () {
      final error = ApiRequestError.fromDio(
        _dioError(503, <String, dynamic>{
          'statusCode': 503,
          'message': ['Polycheck is under maintenance.', 'Try again later.'],
          'code': 'system_maintenance',
          'estimatedEnd': '2026-11-10T12:00:00.000Z',
        }),
      );

      expect(error.isMaintenance, isTrue);
      expect(error.isNetworkFailure, isTrue);
      expect(
        error.message,
        'Polycheck is under maintenance.. Try again later.',
      );
      expect(error.estimatedEnd, '2026-11-10T12:00:00.000Z');
    });

    test('transport failures become status 0 network failures', () {
      final error = ApiRequestError.fromDio(
        DioException(
          requestOptions: RequestOptions(path: '/sessions'),
          type: DioExceptionType.connectionError,
          message: 'connection refused',
        ),
      );

      expect(error.status, 0);
      expect(error.isNetworkFailure, isTrue);
      expect(error.isMaintenance, isFalse);
      expect(error.message, contains('Cannot reach'));
    });
  });
}

DioException _dioError(int status, Map<String, dynamic> body) {
  final options = RequestOptions(path: '/test');
  return DioException(
    requestOptions: options,
    response: Response<Map<String, dynamic>>(
      requestOptions: options,
      statusCode: status,
      data: body,
    ),
    type: DioExceptionType.badResponse,
  );
}
