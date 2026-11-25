import 'dart:typed_data';

import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/theme/brand_theme.dart';
import 'package:polycheck_mobile/src/core/utils/outage_simulator.dart';
import 'package:polycheck_mobile/src/features/surface/data/outage_demo.dart';
import 'package:polycheck_mobile/src/features/surface/presentation/widgets/outage_widgets.dart';

void main() {
  tearDown(() {
    OutageSimulator.disarm();
    SurfaceOutageInterceptor.resetForTests();
  });

  test('the demo flag only accepts the exact string true', () {
    expect(OutageDemo.parseFlag('true'), isTrue);
    expect(OutageDemo.parseFlag('false'), isFalse);
    expect(OutageDemo.parseFlag('TRUE'), isFalse);
    expect(OutageDemo.parseFlag(null), isFalse);
    // Default build (no dart-define) keeps the simulator off.
    expect(OutageDemo.enabled, isFalse);
  });

  test('receipts render the sequence and operation prefix', () {
    expect(OutageDemo.receipt(104), 'Receipt #104');
    expect(
      OutageDemo.receipt(104, 'a1b2c3d4-e5f6'),
      'Receipt #104 \u00b7 a1b2c3d4',
    );
    expect(OutageDemo.receipt(0, ''), 'Receipt #0');
  });

  group('FLR-11 bootstrap interceptor', () {
    test('install is a no-op when the build flag is off', () {
      final dio = Dio();
      final before = dio.interceptors.length;
      SurfaceOutageInterceptor.install(dio);

      expect(SurfaceOutageInterceptor.isInstalled, isFalse);
      expect(dio.interceptors.length, before);
    });

    test('install attaches the guard exactly once (idempotent)', () {
      final dio = Dio();
      final before = dio.interceptors.length;
      SurfaceOutageInterceptor.install(dio, enabled: true);
      final afterFirst = dio.interceptors.length;
      SurfaceOutageInterceptor.install(dio, enabled: true);

      expect(SurfaceOutageInterceptor.isInstalled, isTrue);
      expect(afterFirst, before + 1);
      expect(dio.interceptors.length, afterFirst);
    });

    test(
      'an armed guard rejects the request before it leaves the client',
      () async {
        final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api'))
          ..httpClientAdapter = _RecordingAdapter();
        SurfaceOutageInterceptor.install(dio, enabled: true);
        OutageSimulator.arm();

        await expectLater(
          dio.get<dynamic>('/sessions'),
          throwsA(
            isA<DioException>()
                .having((e) => e.type, 'type', DioExceptionType.connectionError)
                .having((e) => e.error, 'error', isA<SimulatedNetworkOutage>()),
          ),
        );
        expect(
          (dio.httpClientAdapter as _RecordingAdapter).requests,
          isEmpty,
          reason: 'the guard runs before any transport call',
        );
      },
    );

    test('a disarmed guard passes the request through', () async {
      final dio = Dio(BaseOptions(baseUrl: 'https://example.test/api'))
        ..httpClientAdapter = _RecordingAdapter();
      SurfaceOutageInterceptor.install(dio, enabled: true);
      OutageSimulator.disarm();

      Object? failure;
      try {
        await dio.get<dynamic>('/sessions');
      } catch (error) {
        failure = error;
      }

      final adapter = dio.httpClientAdapter as _RecordingAdapter;
      expect(adapter.requests, hasLength(1), reason: 'reached the transport');
      expect(
        failure.toString(),
        isNot(contains(OutageSimulator.simulatedMessage)),
      );
    });
  });

  testWidgets('the pill renders nothing when the build flag is off', (
    tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: BrandTheme.light,
        home: const Scaffold(body: OutagePill()),
      ),
    );
    await tester.pump();

    expect(find.text('OFFLINE SIMULATION'), findsNothing);
  });
}

/// Counts transport calls so "intercepted before the network" is observable.
class _RecordingAdapter implements HttpClientAdapter {
  final List<RequestOptions> requests = <RequestOptions>[];

  @override
  Future<ResponseBody> fetch(
    RequestOptions options,
    Stream<Uint8List>? requestStream,
    Future<void>? cancelFuture,
  ) async {
    requests.add(options);
    return ResponseBody.fromString('{}', 200);
  }

  @override
  void close({bool force = false}) {}
}
