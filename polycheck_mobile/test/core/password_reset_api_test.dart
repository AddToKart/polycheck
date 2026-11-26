import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/api/session_api.dart';

class _StubAdapter implements HttpClientAdapter {
  _StubAdapter(this.responseBody);

  final Map<String, dynamic> responseBody;
  RequestOptions? last;

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    last = options;
    return ResponseBody.fromString(
      jsonEncode(responseBody),
      200,
      headers: <String, List<String>>{
        Headers.contentTypeHeader: <String>[Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

void main() {
  Dio dioFor(_StubAdapter adapter) =>
      Dio(BaseOptions(baseUrl: 'https://example.test/api'))
        ..httpClientAdapter = adapter;

  test('requestPasswordReset posts only the student number to the public '
      'endpoint', () async {
    final adapter = _StubAdapter({'ok': true, 'delivery': 'email'});
    final result = await SessionApi(
      dioFor(adapter),
    ).requestPasswordReset('2024-00123-MN-0');

    expect(result, PasswordResetDelivery.email);
    expect(adapter.last!.method, 'POST');
    expect(adapter.last!.uri.path, endsWith('/password-reset/request'));
    expect(adapter.last!.data, {'studentId': '2024-00123-MN-0'});
  });

  test('anything other than "email" is treated as unavailable', () async {
    for (final body in <Map<String, dynamic>>[
      {'ok': true, 'delivery': 'unavailable'},
      {'ok': true},
    ]) {
      final result = await SessionApi(
        dioFor(_StubAdapter(body)),
      ).requestPasswordReset('2024-00123-MN-0');
      expect(result, PasswordResetDelivery.unavailable);
    }
  });
}
