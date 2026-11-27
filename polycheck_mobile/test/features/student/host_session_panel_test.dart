import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/api/api_providers.dart';
import 'package:polycheck_mobile/src/core/api/sessions_api.dart';
import 'package:polycheck_mobile/src/core/models/host_session.dart';
import 'package:polycheck_mobile/src/core/network/api_error.dart';
import 'package:polycheck_mobile/src/core/network/dio_client.dart';
import 'package:polycheck_mobile/src/core/network/secure_token_store.dart';
import 'package:polycheck_mobile/src/core/theme/brand_theme.dart';
import 'package:polycheck_mobile/src/core/utils/device_security.dart';
import 'package:polycheck_mobile/src/features/student/data/student_scan_service.dart';
import 'package:polycheck_mobile/src/features/student/presentation/officer/host_session_panel.dart';
import 'package:qr_flutter/qr_flutter.dart';

HostSessionState _state({
  bool active = false,
  bool canStart = false,
  bool canEnd = false,
  String? presence,
}) => HostSessionState(
  sessionId: 'sess-1',
  isActive: active,
  canStart: canStart,
  canEnd: canEnd,
  gracePeriodMinutes: 15,
  qrToken: canEnd ? 'signed-token' : null,
  presenceMessage: presence,
  roster: active
      ? const <HostRosterEntry>[
          HostRosterEntry(
            studentName: 'A Student',
            status: 'present',
            scannedAt: '2026-11-27T01:02:00Z',
          ),
          HostRosterEntry(studentName: 'B Student', status: 'pending'),
        ]
      : const <HostRosterEntry>[],
);

class _FakeSessionsApi extends SessionsApi {
  _FakeSessionsApi(this.current, {this.refusal}) : super(Dio());

  HostSessionState current;
  final String? refusal;
  final List<Map<String, dynamic>> starts = <Map<String, dynamic>>[];
  int reads = 0;
  int ends = 0;

  @override
  Future<HostSessionState> getHostSession(String sessionId) async {
    reads += 1;
    if (refusal != null) {
      throw ApiRequestError(message: refusal!, status: 403);
    }
    return current;
  }

  @override
  Future<HostSessionState> startHostSession(
    String sessionId,
    Map<String, dynamic> body,
  ) async {
    starts.add(body);
    return current = _state(
      active: true,
      canEnd: true,
      presence: 'You were marked present.',
    );
  }

  @override
  Future<HostSessionState> endHostSession(String sessionId) async {
    ends += 1;
    return current = _state();
  }
}

class _FakeDeviceIdentity extends DeviceIdentity {
  @override
  Future<String> getOrCreate() async => 'mobile-test';
}

class _FixedLocation implements ScanLocationReader {
  const _FixedLocation({this.refused = false});

  final bool refused;

  @override
  Future<ScanLocation> current() async {
    if (refused) {
      throw const ScanLocationException('Location access was denied.');
    }
    return ScanLocation(
      latitude: 14.8697,
      longitude: 120.9991,
      accuracyMeters: 12,
      isMocked: false,
      capturedAt: DateTime.utc(2026, 11, 27, 1),
    );
  }
}

void main() {
  Future<void> pump(
    WidgetTester tester,
    _FakeSessionsApi api, {
    bool locationRefused = false,
  }) async {
    tester.view.physicalSize = const Size(1080, 3200);
    tester.view.devicePixelRatio = 2.0;
    addTearDown(tester.view.reset);
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          sessionsApiProvider.overrideWithValue(api),
          scanLocationReaderProvider.overrideWithValue(
            _FixedLocation(refused: locationRefused),
          ),
          // Stand-ins so the test needs no platform channels or sockets.
          deviceIdentityProvider.overrideWithValue(_FakeDeviceIdentity()),
          deviceSecurityProberProvider.overrideWithValue(
            DefaultDeviceSecurityProber(readOperatingSystem: () => 'web'),
          ),
        ],
        child: MaterialApp(
          theme: BrandTheme.light,
          home: const Scaffold(
            body: SingleChildScrollView(
              child: HostSessionPanel(sessionId: 'sess-1'),
            ),
          ),
        ),
      ),
    );
    await tester.pump();
  }

  Future<void> start(WidgetTester tester) async {
    await tester.tap(find.byKey(const ValueKey('host-start-session')));
    await tester.pump();
    await tester.pump(const Duration(milliseconds: 400));
  }

  testWidgets('starts with the location and shows the QR and live list', (
    tester,
  ) async {
    final api = _FakeSessionsApi(_state(canStart: true));
    await pump(tester, api);

    await start(tester);

    expect(api.starts.single, containsPair('latitude', 14.8697));
    expect(api.starts.single, containsPair('validityMinutes', 5));
    expect(api.starts.single, containsPair('deviceId', 'mobile-test'));
    expect(find.text('You were marked present.'), findsOneWidget);
    expect(find.byType(QrImageView), findsOneWidget);
    expect(find.text('1 of 2 checked in'), findsOneWidget);
    expect(find.text('Present · 9:02 AM'), findsOneWidget);
    expect(find.text('Not yet'), findsOneWidget);

    // The list refreshes by itself while the class is running.
    final before = api.reads;
    await tester.pump(hostPollInterval);
    expect(api.reads, before + 1);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('still starts when location is refused', (tester) async {
    final api = _FakeSessionsApi(_state(canStart: true));
    await pump(tester, api, locationRefused: true);

    await start(tester);

    expect(api.starts.single.containsKey('latitude'), isFalse);
    await tester.pumpWidget(const SizedBox.shrink());
  });

  testWidgets('asks before ending, then stops refreshing', (tester) async {
    final api = _FakeSessionsApi(_state(active: true, canEnd: true));
    await pump(tester, api);

    await tester.tap(find.byKey(const ValueKey('host-end-session')));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Cancel'));
    await tester.pumpAndSettle();
    expect(api.ends, 0);

    await tester.tap(find.byKey(const ValueKey('host-end-session')));
    await tester.pumpAndSettle();
    await tester.tap(find.byKey(const ValueKey('host-confirm-end')));
    await tester.pumpAndSettle();

    expect(api.ends, 1);
    expect(find.text('Session ended.'), findsOneWidget);
    final reads = api.reads;
    await tester.pump(hostPollInterval * 2);
    expect(api.reads, reads);
  });

  testWidgets('shows why the controls are unavailable', (tester) async {
    await pump(
      tester,
      _FakeSessionsApi(
        _state(canStart: true),
        refusal: 'Your professor removed your permission for this session.',
      ),
    );

    expect(find.textContaining('removed your permission'), findsOneWidget);
    expect(find.byKey(const ValueKey('host-start-session')), findsNothing);
  });
}
