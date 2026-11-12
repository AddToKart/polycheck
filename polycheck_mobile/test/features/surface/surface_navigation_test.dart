import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:polycheck_mobile/src/features/surface/data/surface_navigation.dart';

/// FX1/FIX3 guard coverage: `SurfaceNavigation` may still `go` for cold
/// notification destinations, but it must never collapse a stack that already
/// shows the target (the profile-tab stack-killer).
void main() {
  testWidgets('no-op when the target is already the live location', (
    tester,
  ) async {
    late BuildContext pageContext;
    final router = GoRouter(
      initialLocation: '/profile?tab=reports',
      routes: <RouteBase>[
        GoRoute(
          path: '/profile',
          builder: (context, state) {
            pageContext = context;
            return const Scaffold(body: Text('profile'));
          },
        ),
        GoRoute(
          path: '/assistant',
          builder: (context, state) => const Scaffold(body: Text('assistant')),
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    final result = SurfaceNavigation.open(pageContext, '/profile?tab=reports');
    await tester.pumpAndSettle();

    expect(result, isTrue);
    expect(
      router.routerDelegate.currentConfiguration.uri.toString(),
      '/profile?tab=reports',
    );
    expect(find.text('profile'), findsOneWidget);
  });

  testWidgets('pushed target is not collapsed by a redundant go', (
    tester,
  ) async {
    late BuildContext profileContext;
    final router = GoRouter(
      initialLocation: '/faculty/dashboard',
      routes: <RouteBase>[
        GoRoute(
          path: '/faculty/dashboard',
          builder: (context, state) => const Scaffold(body: Text('home')),
        ),
        GoRoute(
          path: '/profile',
          builder: (context, state) {
            profileContext = context;
            return const Scaffold(body: Text('pushed profile'));
          },
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    router.push('/profile');
    await tester.pumpAndSettle();
    expect(find.text('pushed profile'), findsOneWidget);

    final result = SurfaceNavigation.open(profileContext, '/profile');
    await tester.pumpAndSettle();

    expect(result, isTrue);
    // Still on the pushed profile (not replaced/popped by a `go`).
    expect(find.text('pushed profile'), findsOneWidget);
    expect(GoRouterState.of(profileContext).uri.toString(), '/profile');
  });

  testWidgets('unknown destinations explain the fallback without navigating', (
    tester,
  ) async {
    late BuildContext pageContext;
    final router = GoRouter(
      initialLocation: '/profile',
      routes: <RouteBase>[
        GoRoute(
          path: '/profile',
          builder: (context, state) {
            pageContext = context;
            return const Scaffold(body: Text('profile'));
          },
        ),
      ],
    );
    addTearDown(router.dispose);
    await tester.pumpWidget(MaterialApp.router(routerConfig: router));
    await tester.pumpAndSettle();

    final result = SurfaceNavigation.open(pageContext, '/not-registered');
    await tester.pump();

    expect(result, isFalse);
    expect(
      router.routerDelegate.currentConfiguration.uri.toString(),
      '/profile',
    );
    expect(
      find.text('This screen is not available in the current build yet.'),
      findsOneWidget,
    );
  });
}
