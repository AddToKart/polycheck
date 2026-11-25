import 'package:dio/dio.dart';
import 'package:drift/native.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/student/data/student_providers.dart';

import '../../helpers/auth_harness.dart';
import 'student_test_harness.dart';

/// FLR-09: officer-permission expiry is a server-clock decision.
///
/// The provider used to compare `expiresAt` against `DateTime.now()`, so a
/// device clock running behind kept an expired grant alive and one running
/// ahead denied a live grant. It now reads the [TrustedClock] (device UTC +
/// persisted `/health` offset), exactly like every token window.
class _FixedSectionsApi extends SectionsApi {
  _FixedSectionsApi({required this.expiresAt, required this.studentId})
    : super(Dio());

  final String expiresAt;
  final String studentId;

  @override
  Future<Section> getSection(String id) async => testSection(id: id);

  @override
  Future<List<SectionRole>> getStudentRoles(String studentId) async =>
      <SectionRole>[
        SectionRole(
          id: 'sr-1',
          sectionId: 'sec-1',
          studentId: this.studentId,
          role: SectionRoleType.president,
        ),
      ];

  @override
  Future<List<SessionPermission>> getActiveSessionPermissions(
    String sectionId,
  ) async => <SessionPermission>[
    SessionPermission(
      id: 'perm-1',
      sectionId: sectionId,
      studentId: studentId,
      grantedBy: 'teacher-1',
      grantedAt: '2026-11-10T08:00:00.000Z',
      expiresAt: expiresAt,
      isActive: true,
    ),
  ];
}

class _EmptySessionsApi extends SessionsApi {
  _EmptySessionsApi() : super(Dio());

  @override
  Future<List<Session>> getSectionSessions(String sectionId) async =>
      const <Session>[];
}

class _SilentClock extends TrustedClockNotifier {
  _SilentClock(this.clock);

  final TrustedClock clock;

  @override
  TrustedClock build() => clock;

  @override
  Future<void> refreshQuietly() async {}
}

void main() {
  // The device believes it is 2026-11-10 08:00 UTC.
  final deviceNow = DateTime.utc(2026, 11, 10, 8);

  List<Override> overrides({
    required _FixedSectionsApi sectionsApi,
    required TrustedClock clock,
  }) {
    return <Override>[
      sessionProvider.overrideWith(() => FakeSessionController(studentUser)),
      appDatabaseProvider.overrideWithValue(
        AppDatabase.forTesting(NativeDatabase.memory()),
      ),
      sectionsApiProvider.overrideWithValue(sectionsApi),
      sessionsApiProvider.overrideWithValue(_EmptySessionsApi()),
      subjectsApiProvider.overrideWithValue(_NoopSubjectsApi()),
      trustedClockProvider.overrideWith(() => _SilentClock(clock)),
      deviceNowProvider.overrideWithValue(() => deviceNow),
    ];
  }

  Future<StudentSectionDetailView> resolve(
    _FixedSectionsApi sectionsApi,
    TrustedClock clock,
  ) async {
    final container = ProviderContainer(
      overrides: overrides(sectionsApi: sectionsApi, clock: clock),
    );
    addTearDown(container.dispose);
    return container.read(studentSectionDetailProvider('sec-1').future);
  }

  test('a server clock AHEAD of the device expires the grant', () async {
    // Grant expired one minute before the *server's* now, but still in the
    // device's future (the device is 30 minutes behind) — the bug case.
    final sectionsApi = _FixedSectionsApi(
      expiresAt: deviceNow.add(const Duration(minutes: 29)).toIso8601String(),
      studentId: studentUser.id,
    );
    final serverAhead = const TrustedClock(offsetMs: 30 * 60 * 1000);

    final view = await resolve(sectionsApi, serverAhead);

    expect(view.permission, OfficerPermissionCheck.denied);
    expect(view.permissionExpiresAt, isNull);
  });

  test('a server clock BEHIND the device keeps a live grant', () async {
    // The device is 30 minutes fast: raw `DateTime.now()` would call this
    // expired even though the server says the grant is live.
    final sectionsApi = _FixedSectionsApi(
      expiresAt: deviceNow.add(const Duration(minutes: 10)).toIso8601String(),
      studentId: studentUser.id,
    );
    final serverBehind = const TrustedClock(offsetMs: -30 * 60 * 1000);

    final view = await resolve(sectionsApi, serverBehind);

    expect(view.permission, OfficerPermissionCheck.authorized);
    expect(view.permissionExpiresAt, isNotNull);
    expect(view.hasActivePermission, isTrue);
  });

  test('an offset-free clock agrees with the server expiry', () async {
    final sectionsApi = _FixedSectionsApi(
      expiresAt: deviceNow.add(const Duration(hours: 2)).toIso8601String(),
      studentId: studentUser.id,
    );

    final view = await resolve(sectionsApi, const TrustedClock());

    expect(view.permission, OfficerPermissionCheck.authorized);
    expect(view.permissionExpiresAt, isNotNull);
  });
}

class _NoopSubjectsApi extends SubjectsApi {
  _NoopSubjectsApi() : super(Dio());

  @override
  Future<Subject> getSubject(String id) async => testSubject;
}
