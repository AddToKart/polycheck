import 'dart:convert';
import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/api/session_api.dart';
import 'package:polycheck_mobile/src/core/network/api_error.dart';

/// Every profile reload goes through `SessionApi.me()`: the first-login
/// password change, privacy consent, reopening the app and the replaced-session
/// check. It once parsed the reply twice and crashed on every call, while the
/// tests stayed green because they all replaced `me()` with a fake. These tests
/// run the real method against a stubbed transport.
class _ProfileAdapter implements HttpClientAdapter {
  _ProfileAdapter(this.body, {this.status = 200});

  final Map<String, dynamic> body;
  final int status;
  final List<String> paths = <String>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    paths.add(options.uri.path);
    return ResponseBody.fromString(
      jsonEncode(body),
      status,
      headers: <String, List<String>>{
        Headers.contentTypeHeader: <String>[Headers.jsonContentType],
      },
    );
  }

  @override
  void close({bool force = false}) {}
}

const Map<String, dynamic> _profile = <String, dynamic>{
  'id': 'student-1',
  'fullName': 'Maria Santos',
  'studentId': '2024-00001-SM-0',
  'role': 'student',
  'program': 'BSIT',
  'yearLevel': 1,
  'email': null,
  'isActive': true,
  'mustChangePassword': false,
};

SessionApi _api(_ProfileAdapter adapter) => SessionApi(
  Dio(BaseOptions(baseUrl: 'https://example.test/api'))
    ..httpClientAdapter = adapter,
);

void main() {
  test('me() returns the signed-in profile', () async {
    final adapter = _ProfileAdapter(_profile);

    final user = await _api(adapter).me();

    expect(adapter.paths.single, endsWith('/auth/me'));
    expect(user.id, 'student-1');
    expect(user.fullName, 'Maria Santos');
    expect(user.mustChangePassword, isFalse);
  });

  test('me() with a timeout returns the profile too (cold start)', () async {
    final user = await _api(
      _ProfileAdapter(_profile),
    ).me(timeout: const Duration(seconds: 4));

    expect(user.id, 'student-1');
  });

  test('me() surfaces a rejected session as a typed error', () async {
    await expectLater(
      _api(
        _ProfileAdapter(<String, dynamic>{
          'message': 'Invalid or expired session',
        }, status: 401),
      ).me(),
      throwsA(isA<ApiRequestError>().having((e) => e.status, 'status', 401)),
    );
  });
}
