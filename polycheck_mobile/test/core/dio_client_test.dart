import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/network/api_events.dart';
import 'package:polycheck_mobile/src/core/network/dio_client.dart';
import 'package:polycheck_mobile/src/core/network/secure_token_store.dart';

void main() {
  group('PolycheckInterceptor', () {
    test('attaches the bearer token and installation header', () async {
      final harness = _Harness(token: 'test-token');

      await harness.dio.get<dynamic>('/sessions');

      final headers = harness.adapter.requests.single.headers;
      expect(headers['Authorization'], 'Bearer test-token');
      expect(headers['X-Polycheck-Device-Id'], 'mobile-test-device');
    });

    test('never attaches a stale bearer token to login requests', () async {
      final harness = _Harness(token: 'stale-token');

      await harness.dio.post<dynamic>(
        '/auth/mobile/login/student',
        data: <String, dynamic>{'studentId': '2024-00001-MN-0'},
      );

      final headers = harness.adapter.requests.single.headers;
      expect(headers.containsKey('Authorization'), isFalse);
      expect(headers['X-Polycheck-Device-Id'], 'mobile-test-device');
    });

    test(
      '401 outside login clears the token and emits the expiry event',
      () async {
        final harness = _Harness(
          token: 'test-token',
          responses: [
            _jsonResponse(<String, dynamic>{
              'statusCode': 401,
              'code': 'active_session_elsewhere',
              'message': 'Signed in elsewhere',
            }, status: 401),
          ],
        );
        final eventFuture = harness.events.sessionExpired.first;

        await expectLater(
          harness.dio.get<dynamic>('/auth/me'),
          throwsA(isA<DioException>()),
        );

        final event = await eventFuture.timeout(const Duration(seconds: 2));
        expect(event.path, '/auth/me');
        expect(await harness.tokens.read(), isNull);
      },
    );

    test('503 system_maintenance publishes the announcement event', () async {
      final harness = _Harness(
        token: 'test-token',
        responses: [
          _jsonResponse(<String, dynamic>{
            'statusCode': 503,
            'code': 'system_maintenance',
            'message': 'Scheduled maintenance',
            'estimatedEnd': '2026-11-10T12:00:00.000Z',
          }, status: 503),
        ],
      );
      final eventFuture = harness.events.maintenance.first;

      await expectLater(
        harness.dio.get<dynamic>('/sessions'),
        throwsA(isA<DioException>()),
      );

      final event = await eventFuture.timeout(const Duration(seconds: 2));
      expect(event.message, 'Scheduled maintenance');
      expect(event.estimatedEnd, '2026-11-10T12:00:00.000Z');
    });

    test('retries an idempotent GET once on a transport failure', () async {
      final harness = _Harness(
        responses: [
          _transportFailure,
          _jsonResponse(<String, dynamic>{'ok': true}),
        ],
      );

      final response = await harness.dio.get<dynamic>('/subjects');

      expect(response.data, <String, dynamic>{'ok': true});
      expect(harness.adapter.requests, hasLength(2));
    });

    test('does not retry POST mutations', () async {
      final harness = _Harness(responses: [_transportFailure]);

      await expectLater(
        harness.dio.post<dynamic>('/attendance/scan'),
        throwsA(isA<DioException>()),
      );

      expect(harness.adapter.requests, hasLength(1));
    });
  });
}

ResponseBody _jsonResponse(Map<String, dynamic> body, {int status = 200}) {
  return ResponseBody.fromString(
    jsonEncode(body),
    status,
    headers: <String, List<String>>{
      Headers.contentTypeHeader: <String>[Headers.jsonContentType],
    },
  );
}

final DioException _transportFailure = DioException(
  requestOptions: RequestOptions(path: '/'),
  type: DioExceptionType.connectionError,
  message: 'connection refused',
);

class _Harness {
  _Harness({String? token, List<Object>? responses})
    : tokens = MemoryTokenStore(token),
      events = ApiEvents() {
    adapter = _ScriptedAdapter(
      responses ?? [_jsonResponse(<String, dynamic>{})],
    );
    dio = createPolycheckDio(
      baseUrl: 'https://example.test/api',
      tokenStore: tokens,
      deviceIdentity: _FakeDeviceIdentity(),
      events: events,
      adapter: adapter,
    );
  }

  final MemoryTokenStore tokens;
  final ApiEvents events;
  late final _ScriptedAdapter adapter;
  late final Dio dio;
}

class MemoryTokenStore implements TokenStore {
  MemoryTokenStore([this.token]);

  String? token;

  @override
  Future<String?> read() async => token;

  @override
  Future<void> write(String value) async => token = value;

  @override
  Future<void> clear() async => token = null;
}

class _FakeDeviceIdentity extends DeviceIdentity {
  @override
  Future<String> getOrCreate() async => 'mobile-test-device';
}

class _ScriptedAdapter implements HttpClientAdapter {
  _ScriptedAdapter(this.responses);

  /// Each request consumes the next entry; the last entry repeats.
  final List<Object> responses;
  final List<RequestOptions> requests = <RequestOptions>[];
  int _index = 0;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    final entry = responses[_index.clamp(0, responses.length - 1)];
    _index++;
    if (entry is DioException) {
      throw DioException(
        requestOptions: options,
        type: entry.type,
        message: entry.message,
      );
    }
    return entry as ResponseBody;
  }

  @override
  void close({bool force = false}) {}
}
