import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:polycheck_mobile/src/core/api/ai_api.dart';
import 'package:polycheck_mobile/src/core/api/api_providers.dart';
import 'package:polycheck_mobile/src/core/models/ai.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';
import 'package:polycheck_mobile/src/core/providers/session_provider.dart';
import 'package:polycheck_mobile/src/core/theme/pup_theme.dart';
import 'package:polycheck_mobile/src/core/widgets/campus_button.dart';
import 'package:polycheck_mobile/src/features/surface/data/notification_inbox_controller.dart';
import 'package:polycheck_mobile/src/features/surface/data/surface_paths.dart';
import 'package:polycheck_mobile/src/features/surface/presentation/profile_screen.dart';

import '../../helpers/auth_harness.dart';

/// FX1/FIX2/FIX3 regression coverage for the profile chrome and tab routing.
class _FakeAiApi extends AiApi {
  _FakeAiApi({required this.enabled, this.policyBlocked = false})
    : super(Dio(), tokenStore: MemoryTokenStore());

  final bool enabled;
  final bool policyBlocked;

  @override
  Future<AiCapabilities> getCapabilities() async =>
      AiCapabilities(enabled: enabled, policyBlocked: policyBlocked);
}

class _FakeInboxController extends NotificationInboxController {
  @override
  NotificationInboxState build() => const NotificationInboxState();
}

ProviderContainer _container(
  User user, {
  bool assistantEnabled = true,
  bool policyBlocked = false,
}) {
  final container = ProviderContainer(
    overrides: <Override>[
      sessionProvider.overrideWith(() => FakeSessionController(user)),
      aiApiProvider.overrideWithValue(
        _FakeAiApi(enabled: assistantEnabled, policyBlocked: policyBlocked),
      ),
      notificationInboxProvider.overrideWith(_FakeInboxController.new),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

Future<GoRouter> _pumpProfileApp(
  WidgetTester tester, {
  required ProviderContainer container,
  required String initialLocation,
}) async {
  final router = GoRouter(
    initialLocation: initialLocation,
    routes: <RouteBase>[
      GoRoute(
        path: '/profile',
        builder: (context, state) => ProfileScreen(
          tab: SurfacePaths.parseTab(state.uri.queryParameters['tab']),
        ),
      ),
      GoRoute(
        path: '/faculty/dashboard',
        builder: (context, state) => const Scaffold(
          key: ValueKey<String>('faculty-home'),
          body: Center(child: Text('FACULTY HOME')),
        ),
      ),
      GoRoute(
        path: '/student/dashboard',
        builder: (context, state) =>
            const Scaffold(body: Center(child: Text('STUDENT HOME'))),
      ),
      GoRoute(
        path: '/assistant',
        builder: (context, state) =>
            const Scaffold(body: Center(child: Text('ASSISTANT PAGE'))),
      ),
    ],
  );
  addTearDown(router.dispose);
  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(theme: PupTheme.light, routerConfig: router),
    ),
  );
  await tester.pumpAndSettle();
  return router;
}

void main() {
  testWidgets('profile chrome drops the duplicate floating pills', (
    tester,
  ) async {
    final container = _container(testStudent);
    await _pumpProfileApp(
      tester,
      container: container,
      initialLocation: '/profile',
    );

    expect(find.widgetWithText(CampusButton, 'Assistant'), findsNothing);
    expect(find.widgetWithText(CampusButton, 'Notifications'), findsNothing);
    expect(find.widgetWithText(CampusButton, 'Privacy'), findsNothing);
    // Notifications and Privacy remain reachable as tabs.
    expect(find.text('Contact information'), findsOneWidget);
    expect(find.text('Device & anti-cheat'), findsOneWidget);
  });

  testWidgets('assistant lives in the AppBar actions when available', (
    tester,
  ) async {
    final container = _container(testStudent);
    await _pumpProfileApp(
      tester,
      container: container,
      initialLocation: '/profile',
    );

    final assistant = find.byKey(
      const ValueKey<String>('profile-assistant-action'),
    );
    expect(assistant, findsOneWidget);
    expect(find.byTooltip('Assistant'), findsOneWidget);

    await tester.tap(assistant);
    await tester.pumpAndSettle();
    expect(find.text('ASSISTANT PAGE'), findsOneWidget);
  });

  testWidgets('assistant action is hidden when policy blocks the role', (
    tester,
  ) async {
    final container = _container(testStudent, policyBlocked: true);
    await _pumpProfileApp(
      tester,
      container: container,
      initialLocation: '/profile',
    );

    expect(
      find.byKey(const ValueKey<String>('profile-assistant-action')),
      findsNothing,
    );
    // The bell stays: notifications are independent of the assistant policy.
    expect(find.byTooltip('Notifications'), findsOneWidget);
  });

  testWidgets('switching tabs is local state (no router go, URL unchanged)', (
    tester,
  ) async {
    final container = _container(testStudent);
    final router = await _pumpProfileApp(
      tester,
      container: container,
      initialLocation: '/profile?tab=security',
    );

    final before = router.routerDelegate.currentConfiguration.uri.toString();
    expect(
      find.byKey(const ValueKey<String>('profile-back-fallback')),
      findsOneWidget,
    );

    await tester.ensureVisible(find.text('Contact information'));
    await tester.tap(find.text('Contact information'));
    await tester.pumpAndSettle();

    expect(find.text('Secondary contacts'), findsOneWidget);
    expect(
      router.routerDelegate.currentConfiguration.uri.toString(),
      before,
      reason: 'tab switching must not rewrite the location',
    );
    // The pushed/landed page keeps its back affordance.
    expect(
      find.byKey(const ValueKey<String>('profile-back-fallback')),
      findsOneWidget,
    );
  });

  testWidgets('deep link ?tab= lands on the requested tab on mount', (
    tester,
  ) async {
    final container = _container(testStudent);
    await _pumpProfileApp(
      tester,
      container: container,
      initialLocation: '/profile?tab=contacts',
    );

    expect(find.text('Secondary contacts'), findsOneWidget);
    expect(
      find.byKey(const ValueKey<String>('profile-back-fallback')),
      findsOneWidget,
    );
  });

  testWidgets('stackless landing back button exits to the role home', (
    tester,
  ) async {
    final container = _container(testFaculty);
    await _pumpProfileApp(
      tester,
      container: container,
      initialLocation: '/profile',
    );

    final fallback = find.byKey(
      const ValueKey<String>('profile-back-fallback'),
    );
    expect(fallback, findsOneWidget);

    await tester.tap(fallback);
    await tester.pumpAndSettle();

    expect(find.text('FACULTY HOME'), findsOneWidget);
  });

  testWidgets('stackless student back button exits to the student home route', (
    tester,
  ) async {
    final container = _container(testStudent);
    await _pumpProfileApp(
      tester,
      container: container,
      initialLocation: '/profile',
    );

    await tester.tap(
      find.byKey(const ValueKey<String>('profile-back-fallback')),
    );
    await tester.pumpAndSettle();

    expect(find.text('STUDENT HOME'), findsOneWidget);
  });

  testWidgets('pushed profile keeps the system back arrow, not the fallback', (
    tester,
  ) async {
    final container = _container(testFaculty);
    final router = await _pumpProfileApp(
      tester,
      container: container,
      initialLocation: '/faculty/dashboard',
    );

    router.push('/profile');
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey<String>('profile-back-fallback')),
      findsNothing,
    );
    expect(find.byType(BackButton), findsOneWidget);
    expect(find.text('Password & security'), findsWidgets);
  });
}
