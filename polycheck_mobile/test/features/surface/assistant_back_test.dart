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
import 'package:polycheck_mobile/src/features/surface/presentation/assistant_screen.dart';

import '../../helpers/auth_harness.dart';

/// SW-3: the assistant keeps the implied arrow when pushed (profile action)
/// and renders an explicit fallback to the role home when deep-linked.
class _FakeAiApi extends AiApi {
  _FakeAiApi() : super(Dio(), tokenStore: MemoryTokenStore());

  @override
  Future<AiCapabilities> getCapabilities() async =>
      const AiCapabilities(enabled: false, policyBlocked: true);
}

Future<GoRouter> _pumpApp(
  WidgetTester tester, {
  required User user,
  required String initialLocation,
}) async {
  final router = GoRouter(
    initialLocation: initialLocation,
    routes: <RouteBase>[
      GoRoute(
        path: '/assistant',
        builder: (context, state) => const AssistantScreen(),
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
        builder: (context, state) => const Scaffold(
          key: ValueKey<String>('student-home'),
          body: Center(child: Text('STUDENT HOME')),
        ),
      ),
      GoRoute(
        path: '/admin/dashboard',
        builder: (context, state) => const Scaffold(
          key: ValueKey<String>('admin-home'),
          body: Center(child: Text('ADMIN HOME')),
        ),
      ),
    ],
  );
  addTearDown(router.dispose);

  final container = ProviderContainer(
    overrides: <Override>[
      sessionProvider.overrideWith(() => FakeSessionController(user)),
      aiApiProvider.overrideWithValue(_FakeAiApi()),
    ],
  );
  addTearDown(container.dispose);

  await tester.pumpWidget(
    UncontrolledProviderScope(
      container: container,
      child: MaterialApp.router(theme: PupTheme.light, routerConfig: router),
    ),
  );
  await tester.pumpAndSettle();
  return router;
}

const ValueKey<String> _fallbackKey = ValueKey<String>(
  'assistant-back-fallback',
);

void main() {
  for (final fixture in <({String name, User user, String home})>[
    (name: 'student', user: testStudent, home: 'STUDENT HOME'),
    (name: 'faculty', user: testFaculty, home: 'FACULTY HOME'),
    (name: 'super admin', user: testAdmin, home: 'ADMIN HOME'),
  ]) {
    testWidgets(
      '${fixture.name}: stackless assistant offers a fallback to the role home',
      (tester) async {
        await _pumpApp(
          tester,
          user: fixture.user,
          initialLocation: '/assistant',
        );

        expect(find.byKey(_fallbackKey), findsOneWidget);
        await tester.tap(find.byKey(_fallbackKey));
        await tester.pumpAndSettle();
        expect(find.text(fixture.home), findsOneWidget);
      },
    );
  }

  testWidgets('pushed assistant keeps the implied back arrow', (tester) async {
    final router = await _pumpApp(
      tester,
      user: testFaculty,
      initialLocation: '/faculty/dashboard',
    );

    router.push('/assistant');
    await tester.pumpAndSettle();

    expect(find.byKey(_fallbackKey), findsNothing);
    expect(find.byType(BackButton), findsOneWidget);

    router.pop();
    await tester.pumpAndSettle();
    expect(find.text('FACULTY HOME'), findsOneWidget);
  });
}
