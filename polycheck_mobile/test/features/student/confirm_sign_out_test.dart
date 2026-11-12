import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:polycheck_mobile/src/core/api/api_providers.dart';
import 'package:polycheck_mobile/src/core/api/session_api.dart';
import 'package:polycheck_mobile/src/core/database/app_database.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';
import 'package:polycheck_mobile/src/core/network/dio_client.dart';
import 'package:polycheck_mobile/src/core/providers/session_provider.dart';
import 'package:polycheck_mobile/src/core/widgets/confirm_sign_out.dart';
import 'package:polycheck_mobile/src/features/student/presentation/common/student_shell.dart';
import 'package:polycheck_mobile/src/features/student/presentation/dashboard/sign_out_footer.dart';
import 'package:polycheck_mobile/src/features/surface/presentation/widgets/sign_out_tile.dart';

import '../../helpers/auth_harness.dart';
import '../../router/nested_shell_harness.dart';

/// FX1 regression harness (replaces the flat-router test that hid FIX4).
///
/// The reported crash: `confirm_sign_out` popped with the *caller's* context
/// while `showCampusDialog` rides the root navigator. Inside the nested
/// `StudentShell` navigator that pop removed the dashboard page, go_router
/// emptied its match list (blank screen), the dialog future resolved `false`,
/// and `logout()` never ran - so the server session survived and a later
/// login hit `active_session_elsewhere`. This harness mirrors the production
/// topology (`app_router.dart` root shell + `studentRoutes` nested shell).
class _RecordingSessionApi extends SessionApi {
  _RecordingSessionApi(this.profile) : super(Dio());

  final User profile;
  int logoutCalls = 0;
  String? lastDeviceId;
  bool? lastArmDeviceCooldown;

  @override
  Future<User> me({Duration? timeout}) async => profile;

  @override
  Future<void> logout({String? deviceId, bool? armDeviceCooldown}) async {
    logoutCalls += 1;
    lastDeviceId = deviceId;
    lastArmDeviceCooldown = armDeviceCooldown;
  }
}

class _Harness {
  _Harness({
    required this.container,
    required this.api,
    required this.tokens,
    required this.database,
  });

  final ProviderContainer container;
  final _RecordingSessionApi api;
  final MemoryTokenStore tokens;
  final AppDatabase database;
}

Future<_Harness> _createHarness(WidgetTester tester) async {
  final api = _RecordingSessionApi(testStudent);
  final tokens = MemoryTokenStore('seeded-token');
  final database = createTestDatabase();
  addTearDown(database.close);
  final container = ProviderContainer(
    overrides: <Override>[
      sessionApiProvider.overrideWithValue(api),
      tokenStoreProvider.overrideWithValue(tokens),
      deviceIdentityProvider.overrideWithValue(TestDeviceIdentity()),
      appDatabaseProvider.overrideWithValue(database),
    ],
  );
  addTearDown(container.dispose);
  // Let `SessionController.build` finish its restore microtask.
  await container.read(sessionProvider.notifier).restore();
  return _Harness(
    container: container,
    api: api,
    tokens: tokens,
    database: database,
  );
}

const ValueKey<String> _dashboardPageKey = ValueKey<String>('dashboard-page');

/// Minimal inner-shell page hosting the real dashboard sign-out tile.
Widget _studentDashboardSentinel() {
  return Scaffold(
    key: _dashboardPageKey,
    appBar: AppBar(title: const Text('Dashboard')),
    body: const Center(child: SignOutFooterTile()),
  );
}

Widget _profileSentinel() {
  return Scaffold(
    appBar: AppBar(title: const Text('My Profile')),
    body: const Center(child: ProfileSignOutTile()),
  );
}

List<RouteBase> _studentShellRoutes() => <RouteBase>[
  GoRoute(
    path: '/student/dashboard',
    builder: (context, state) => _studentDashboardSentinel(),
  ),
];

void main() {
  testWidgets('dialog copy matches the RN strings verbatim', (tester) async {
    late bool confirmed;
    bool resolved = false;
    await tester.pumpWidget(
      MaterialApp(
        home: Builder(
          builder: (context) => Scaffold(
            body: Center(
              child: ElevatedButton(
                onPressed: () async {
                  confirmed = await showConfirmSignOutDialog(context);
                  resolved = true;
                },
                child: const Text('open'),
              ),
            ),
          ),
        ),
      ),
    );

    await tester.tap(find.text('open'));
    await tester.pumpAndSettle();

    expect(find.text('Sign out?'), findsOneWidget);
    expect(
      find.text('You will need to sign in again to use Polycheck.'),
      findsOneWidget,
    );
    expect(find.text('Cancel'), findsOneWidget);
    expect(find.widgetWithText(TextButton, 'Sign out'), findsOneWidget);

    await tester.tap(find.widgetWithText(TextButton, 'Sign out'));
    await tester.pumpAndSettle();

    expect(resolved, isTrue);
    expect(confirmed, isTrue, reason: 'confirm resolves true on the tap');
  });

  testWidgets(
    'nested student shell: confirm runs logout, clears token/session, and '
    'lands on the portal',
    (tester) async {
      final harness = await _createHarness(tester);
      await pumpNestedShellApp(
        tester,
        container: harness.container,
        initialLocation: '/student/dashboard',
        nestedRoutes: _studentShellRoutes(),
        nestedShellBuilder: (context, state, child) =>
            StudentShell(location: state.uri.path, child: child),
      );

      expect(find.byKey(_dashboardPageKey), findsOneWidget);
      expect(harness.api.logoutCalls, 0);

      await tester.tap(find.byKey(const ValueKey<String>('student-sign-out')));
      await tester.pumpAndSettle();
      expect(find.text('Sign out?'), findsOneWidget);

      await tester.tap(find.widgetWithText(TextButton, 'Sign out'));
      await tester.pumpAndSettle();

      expect(harness.api.logoutCalls, 1);
      expect(harness.api.lastArmDeviceCooldown, isTrue);
      expect(harness.api.lastDeviceId, 'mobile-test-device');
      expect(harness.tokens.token, isNull, reason: 'bearer cleared locally');
      expect(harness.container.read(sessionProvider).isSignedIn, isFalse);
      expect(harness.container.read(sessionProvider).user, isNull);
      expect(
        await harness.database.readActiveProfile(),
        isNull,
        reason: 'owner cache purged',
      );
      expect(find.byKey(PortalSentinel.screenKey), findsOneWidget);
      expect(find.text('PORTAL'), findsOneWidget);
      expect(find.byKey(_dashboardPageKey), findsNothing);
    },
  );

  testWidgets(
    'nested student shell: Cancel keeps the page mounted and the session alive',
    (tester) async {
      final harness = await _createHarness(tester);
      await pumpNestedShellApp(
        tester,
        container: harness.container,
        initialLocation: '/student/dashboard',
        nestedRoutes: _studentShellRoutes(),
        nestedShellBuilder: (context, state, child) =>
            StudentShell(location: state.uri.path, child: child),
      );

      await tester.tap(find.byKey(const ValueKey<String>('student-sign-out')));
      await tester.pumpAndSettle();
      await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
      await tester.pumpAndSettle();

      expect(harness.api.logoutCalls, 0);
      expect(harness.tokens.token, 'seeded-token');
      expect(harness.container.read(sessionProvider).isSignedIn, isTrue);
      // The nested page was not popped (the FIX4 blank-screen failure mode).
      expect(find.byKey(_dashboardPageKey), findsOneWidget);
      expect(find.byType(StudentShell), findsOneWidget);
      expect(find.byKey(PortalSentinel.screenKey), findsNothing);
    },
  );

  testWidgets('barrier dismiss also leaves the page and session intact', (
    tester,
  ) async {
    final harness = await _createHarness(tester);
    await pumpNestedShellApp(
      tester,
      container: harness.container,
      initialLocation: '/student/dashboard',
      nestedRoutes: _studentShellRoutes(),
      nestedShellBuilder: (context, state, child) =>
          StudentShell(location: state.uri.path, child: child),
    );

    await tester.tap(find.byKey(const ValueKey<String>('student-sign-out')));
    await tester.pumpAndSettle();
    await tester.tapAt(const Offset(8, 8));
    await tester.pumpAndSettle();

    expect(harness.api.logoutCalls, 0);
    expect(find.byKey(_dashboardPageKey), findsOneWidget);
    expect(find.text('Sign out?'), findsNothing);
  });

  testWidgets(
    'profile tile (outer shell navigator): confirm runs logout and lands on '
    'the portal',
    (tester) async {
      final harness = await _createHarness(tester);
      await pumpNestedShellApp(
        tester,
        container: harness.container,
        initialLocation: '/profile',
        outerRoutes: <RouteBase>[
          GoRoute(
            path: '/profile',
            builder: (context, state) => _profileSentinel(),
          ),
        ],
      );

      await tester.tap(find.byKey(const ValueKey<String>('profile-sign-out')));
      await tester.pumpAndSettle();
      expect(find.text('Sign out?'), findsOneWidget);

      await tester.tap(find.widgetWithText(TextButton, 'Sign out'));
      await tester.pumpAndSettle();

      expect(harness.api.logoutCalls, 1);
      expect(harness.tokens.token, isNull);
      expect(harness.container.read(sessionProvider).user, isNull);
      expect(find.byKey(PortalSentinel.screenKey), findsOneWidget);
      expect(find.text('My Profile'), findsNothing);
    },
  );

  testWidgets('profile tile: Cancel keeps the profile page mounted', (
    tester,
  ) async {
    final harness = await _createHarness(tester);
    await pumpNestedShellApp(
      tester,
      container: harness.container,
      initialLocation: '/profile',
      outerRoutes: <RouteBase>[
        GoRoute(
          path: '/profile',
          builder: (context, state) => _profileSentinel(),
        ),
      ],
    );

    await tester.tap(find.byKey(const ValueKey<String>('profile-sign-out')));
    await tester.pumpAndSettle();
    await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
    await tester.pumpAndSettle();

    expect(harness.api.logoutCalls, 0);
    expect(find.text('My Profile'), findsOneWidget);
  });
}
