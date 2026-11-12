import 'dart:typed_data';

import 'package:dio/dio.dart';

import '../network/api_error.dart';

/// Shared HTTP plumbing for the domain API classes.
///
/// Every failure is converted to [ApiRequestError]; nothing is swallowed.
/// Methods that the RN client implements with an offline cache remain pure
/// network here — the sync slice (Phase 4) owns queue/drain behavior.
abstract class ApiBase {
  ApiBase(this.dio);

  final Dio dio;

  Future<dynamic> getJson(String path, {Map<String, dynamic>? query}) async {
    try {
      final response = await dio.get<dynamic>(
        path,
        queryParameters: _cleanQuery(query),
      );
      return response.data;
    } on DioException catch (error) {
      throw ApiRequestError.fromDio(error);
    }
  }

  Future<dynamic> postJson(
    String path, {
    Object? body,
    String? idempotencyKey,
  }) async {
    try {
      final response = await dio.post<dynamic>(
        path,
        data: dropNullValues(body),
        options: Options(
          headers: idempotencyKey == null
              ? null
              : <String, dynamic>{'Idempotency-Key': idempotencyKey},
        ),
      );
      return response.data;
    } on DioException catch (error) {
      throw ApiRequestError.fromDio(error);
    }
  }

  Future<dynamic> putJson(String path, {Object? body}) async {
    try {
      final response = await dio.put<dynamic>(path, data: dropNullValues(body));
      return response.data;
    } on DioException catch (error) {
      throw ApiRequestError.fromDio(error);
    }
  }

  Future<dynamic> patchJson(
    String path, {
    Object? body,
    bool dropNulls = true,
  }) async {
    try {
      final response = await dio.patch<dynamic>(
        path,
        data: dropNulls ? dropNullValues(body) : body,
      );
      return response.data;
    } on DioException catch (error) {
      throw ApiRequestError.fromDio(error);
    }
  }

  Future<dynamic> deleteJson(String path, {Map<String, dynamic>? query}) async {
    try {
      final response = await dio.delete<dynamic>(
        path,
        queryParameters: _cleanQuery(query),
      );
      return response.data;
    } on DioException catch (error) {
      throw ApiRequestError.fromDio(error);
    }
  }

  Future<String> getText(String path, {Map<String, dynamic>? query}) async {
    try {
      final response = await dio.get<dynamic>(
        path,
        queryParameters: _cleanQuery(query),
        options: Options(responseType: ResponseType.plain),
      );
      final data = response.data;
      return data is String ? data : '$data';
    } on DioException catch (error) {
      throw ApiRequestError.fromDio(error);
    }
  }

  Future<BinaryResponse> getBytes(
    String path, {
    Map<String, dynamic>? query,
  }) async {
    try {
      final response = await dio.get<List<int>>(
        path,
        queryParameters: _cleanQuery(query),
        options: Options(responseType: ResponseType.bytes),
      );
      final data = response.data ?? const <int>[];
      return BinaryResponse(
        bytes: Uint8List.fromList(data),
        headers: response.headers,
      );
    } on DioException catch (error) {
      throw ApiRequestError.fromDio(error);
    }
  }

  static Map<String, dynamic>? _cleanQuery(Map<String, dynamic>? query) {
    if (query == null) return null;
    final cleaned = <String, dynamic>{
      for (final entry in query.entries)
        if (entry.value != null && entry.value != '') entry.key: entry.value,
    };
    return cleaned.isEmpty ? null : cleaned;
  }
}

Map<String, dynamic> asMap(Object? value) {
  if (value is Map<String, dynamic>) return value;
  if (value is Map) return value.cast<String, dynamic>();
  return <String, dynamic>{};
}

List<dynamic> asList(Object? value) {
  return value is List ? value : const <dynamic>[];
}

/// Recursively removes null map entries so the JSON body matches
/// `JSON.stringify` on the RN clients (an omitted optional field, not an
/// explicit `null`). False, zero, and empty strings are preserved.
Object? dropNullValues(Object? value) {
  if (value is Map) {
    return <String, dynamic>{
      for (final entry in value.entries)
        if (entry.value != null) '${entry.key}': dropNullValues(entry.value),
    };
  }
  if (value is List) {
    return value.map(dropNullValues).toList(growable: false);
  }
  return value;
}

class BinaryResponse {
  const BinaryResponse({required this.bytes, required this.headers});

  final Uint8List bytes;
  final Headers headers;

  String? get filename {
    final disposition = headers.value('content-disposition');
    if (disposition == null) return null;
    final match = RegExp(
      "filename\\*?=(?:UTF-8'')?\"?([^\";]+)\"?",
      caseSensitive: false,
    ).firstMatch(disposition);
    return match?.group(1);
  }

  String get contentType =>
      headers.value(Headers.contentTypeHeader) ?? 'application/octet-stream';
}
