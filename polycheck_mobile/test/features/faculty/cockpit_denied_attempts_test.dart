import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/faculty/presentation/session_cockpit_screen.dart';

const AttendanceCoordinates _none = AttendanceCoordinates(
  latitude: null,
  longitude: null,
);

ScanAttemptView _attempt({
  required String id,
  required String studentName,
  ScanAttemptOutcome outcome = ScanAttemptOutcome.denied,
  String? denialReason,
  double? distance,
  double? radius,
  String timestamp = '2026-11-10T18:40:00.000Z',
}) {
  return ScanAttemptView(
    id: id,
    sessionId: 'sess-1',
    studentId: studentName.toLowerCase().replaceAll(' ', '-'),
    studentName: studentName,
    timestamp: timestamp,
    receivedAt: timestamp,
    coordinates: _none,
    outcome: outcome,
    denialReason: denialReason,
    distanceMeters: distance,
    geofenceRadiusMeters: radius,
  );
}

/// Records `getScanAttempts` calls so the invalidate-on-toggle refetch is
/// observable while staying hermetic (no socket, no network).
class _StubAttendanceApi extends AttendanceApi {
  _StubAttendanceApi(this.attempts) : super(Dio());

  int calls = 0;
  final List<ScanAttemptView> attempts;

  @override
  Future<List<ScanAttemptView>> getScanAttempts({String? sessionId}) async {
    calls += 1;
    return attempts;
  }
}

void main() {
  test('denied-only projection keeps the newest denied attempt first', () {
    final shaped = deniedAttemptsFrom(<ScanAttemptView>[
      _attempt(
        id: 'a-1',
        studentName: 'Ada Meza',
        denialReason: 'mocked_location',
        timestamp: '2026-11-10T09:10:00.000Z',
      ),
      _attempt(
        id: 'a-2',
        studentName: 'Bo Reyes',
        outcome: ScanAttemptOutcome.accepted,
        timestamp: '2026-11-10T09:05:00.000Z',
      ),
      _attempt(
        id: 'a-3',
        studentName: 'Cy Lim',
        denialReason: 'outside_geofence',
        distance: 124,
        radius: 50,
        timestamp: '2026-11-10T09:20:00.000Z',
      ),
    ]);

    expect(shaped.map((attempt) => attempt.id), <String>['a-3', 'a-1']);
  });

  test('denial reasons use the RN dispute-rail voice with web fallbacks', () {
    expect(
      deniedAttemptReasonLabel('mocked_location'),
      'Mock GPS · fake location',
    );
    expect(
      deniedAttemptReasonLabel('suspicious_coordinates'),
      'Suspicious GPS · unusual jump',
    );
    expect(deniedAttemptReasonLabel('qr_expired'), 'Expired QR');
    expect(deniedAttemptReasonLabel('rate_limited'), 'Too many attempts');
    expect(
      deniedAttemptReasonLabel('session_inactive'),
      'Session is not armed',
    );
    expect(
      deniedAttemptReasonLabel('not_enrolled'),
      'Not enrolled in this section',
    );
    expect(deniedAttemptReasonLabel('new_future_reason'), 'new future reason');
    expect(deniedAttemptReasonLabel(null), isNull);
    expect(deniedAttemptReasonLabel(''), isNull);
  });

  test('distance copy mirrors the web radar voice', () {
    expect(
      deniedDistanceCopy(distanceMeters: 124.2, geofenceRadiusMeters: 50),
      '124m away · 74m outside geofence',
    );
    expect(
      deniedDistanceCopy(distanceMeters: 12.4, geofenceRadiusMeters: 50),
      '12m away',
    );
    expect(
      deniedDistanceCopy(distanceMeters: null, geofenceRadiusMeters: 50),
      isNull,
    );
  });

  test('relative time goes now → minutes → hours → date', () {
    final now = DateTime.utc(2026, 11, 10, 12);
    expect(
      deniedAttemptRelativeTime(
        DateTime.utc(2026, 11, 10, 12, 40).toIso8601String(),
        now: now,
      ),
      'now',
    );
    expect(
      deniedAttemptRelativeTime(
        DateTime.utc(2026, 11, 10, 11, 30).toIso8601String(),
        now: now,
      ),
      '30m ago',
    );
    expect(
      deniedAttemptRelativeTime(
        DateTime.utc(2026, 11, 10, 9).toIso8601String(),
        now: now,
      ),
      '3h ago',
    );
    expect(
      deniedAttemptRelativeTime(
        DateTime.utc(2026, 11, 9, 9).toIso8601String(),
        now: now,
      ),
      'November 9',
    );
  });

  testWidgets('cockpit section renders denied rows with reason + distance '
      'and refetches when expanded', (tester) async {
    final api = _StubAttendanceApi(<ScanAttemptView>[
      _attempt(
        id: 'a-1',
        studentName: 'Ada Meza',
        denialReason: 'mocked_location',
        timestamp: DateTime.now()
            .toUtc()
            .subtract(const Duration(minutes: 3))
            .toIso8601String(),
      ),
      _attempt(
        id: 'a-2',
        studentName: 'Cy Lim',
        denialReason: 'outside_geofence',
        distance: 124,
        radius: 50,
        timestamp: DateTime.now()
            .toUtc()
            .subtract(const Duration(minutes: 9))
            .toIso8601String(),
      ),
    ]);

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[attendanceApiProvider.overrideWithValue(api)],
        child: const MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: CockpitDeniedAttemptsSection(
                sessionId: 'sess-1',
                initiallyOpen: true,
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('DENIED ATTEMPTS (2)'), findsOneWidget);
    expect(find.text('Ada Meza'), findsOneWidget);
    expect(find.text('Mock GPS · fake location'), findsOneWidget);
    expect(find.text('Cy Lim'), findsOneWidget);
    expect(
      find.textContaining(
        'Outside geofence · 124m away · 74m outside '
        'geofence',
      ),
      findsOneWidget,
    );
    expect(find.textContaining('m ago'), findsWidgets);
    expect(api.calls, 1);
  });

  testWidgets('cockpit section starts collapsed and refetches on expand', (
    tester,
  ) async {
    final api = _StubAttendanceApi(<ScanAttemptView>[
      _attempt(
        id: 'a-1',
        studentName: 'Bo Reyes',
        denialReason: 'rate_limited',
        timestamp: '2026-11-10T18:40:00.000Z',
      ),
    ]);

    await tester.pumpWidget(
      ProviderScope(
        overrides: <Override>[attendanceApiProvider.overrideWithValue(api)],
        child: const MaterialApp(
          home: Scaffold(
            body: SingleChildScrollView(
              child: CockpitDeniedAttemptsSection(
                sessionId: 'sess-1',
                initiallyOpen: false,
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(api.calls, 1);
    // Collapsed: only the header row.
    expect(find.byKey(const ValueKey('cockpit-denied-count')), findsOneWidget);
    expect(find.text('Bo Reyes'), findsNothing);

    await tester.tap(find.byKey(const ValueKey('cockpit-denied-toggle')));
    await tester.pumpAndSettle();

    expect(api.calls, 2);
    expect(find.text('Bo Reyes'), findsOneWidget);
    expect(find.text('Too many attempts'), findsOneWidget);
  });
}
