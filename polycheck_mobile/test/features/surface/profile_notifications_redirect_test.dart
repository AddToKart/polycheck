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
import 'package:polycheck_mobile/src/features/surface/data/notification_inbox_controller.dart';
import 'package:polycheck_mobile/src/features/surface/data/surface_paths.dart';
import 'package:polycheck_mobile/src/features/surface/presentation/profile_screen.dart';

import '../../helpers/auth_harness.dart';

/// SW-2: the notifications profile tab is gone; the header bell and legacy
/// `?tab=notifications` deep links both land on the standalone center.
class _FakeAiApi extends AiApi {
  _FakeAiApi() : super(Dio(), tokenStore: MemoryTokenStore());

  @override
  Future<AiCapabilities> getCapabilities() async =>
      const AiCapabilities(enabled: false, policyBlocked: true);
}

class _FakeInboxController extends NotificationInboxController {
  @override
  NotificationInboxState build() => const NotificationInboxState();
}

ProviderContainer _container(User user) {
  final container = ProviderContainer(
    overrides: <Override>[
      sessionProvider.overrideWith(() => FakeSessionController(user)),
      aiApiProvider.overrideWithValue(_FakeAiApi()),
      notificationInboxProvider.overrideWith(_FakeInboxController.new),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

Future<GoRouter> _pumpApp(
  WidgetTester tester, {
  required ProviderContainer container,
  required String initialLocation,
}) async {
  // Wide enough that every profile chip builds in the horizontal list.
  tester.view.physicalSize = const Size(1400, 1400);
  tester.view.devicePixelRatio = 1.0;
  addTearDown(tester.view.resetPhysicalSize);
  addTearDown(tester.view.resetDevicePixelRatio);

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
        path: SurfacePaths.notificationsPage,
        builder: (context, state) => const Scaffold(
          key: ValueKey<String>('notifications-page'),
          body: Center(child: Text('NOTIFICATIONS CENTER')),
        ),
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
  testWidgets('profile chips no longer include Notifications', (tester) async {
    await _pumpApp(
      tester,
      container: _container(testStudent),
      initialLocation: '/profile',
    );

    expect(find.text('Password & security'), findsWidgets);
    expect(find.text('Device & anti-cheat'), findsOneWidget);
    expect(find.text('Privacy (RA 10173)'), findsOneWidget);
    // No tab chip labelled Notifications (the header bell keeps the tooltip,
    // which is not a Text in the tree).
    expect(find.text('Notifications'), findsNothing);
  });

  testWidgets('the header bell opens the standalone center with a back arrow', (
    tester,
  ) async {
    final router = await _pumpApp(
      tester,
      container: _container(testStudent),
      initialLocation: '/profile',
    );

    await tester.tap(find.byTooltip('Notifications'));
    await tester.pumpAndSettle();

    // `state.uri` is the live location; `currentConfiguration.uri` keeps the
    // base location after an imperative push.
    expect(router.state.uri.path, SurfacePaths.notificationsPage);
    expect(find.text('NOTIFICATIONS CENTER'), findsOneWidget);
    expect(router.canPop(), isTrue);

    router.pop();
    await tester.pumpAndSettle();
    expect(find.text('Password & security'), findsWidgets);
  });

  testWidgets(
    'legacy ?tab=notifications lands on the center, profile beneath',
    (tester) async {
      final router = await _pumpApp(
        tester,
        container: _container(testStudent),
        initialLocation: '/profile?tab=notifications',
      );

      expect(router.state.uri.path, SurfacePaths.notificationsPage);
      expect(find.text('NOTIFICATIONS CENTER'), findsOneWidget);
      expect(
        router.canPop(),
        isTrue,
        reason: 'the deep link keeps a back path',
      );

      router.pop();
      await tester.pumpAndSettle();
      // The remapped profile opens on security (notifications is not a chip).
      expect(find.text('Password & security'), findsWidgets);
      expect(find.text('Notifications'), findsNothing);
    },
  );
}
