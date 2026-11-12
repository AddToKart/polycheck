import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:polycheck_mobile/src/core/providers/session_provider.dart';
import 'package:polycheck_mobile/src/core/theme/pup_theme.dart';

/// Portal select sentinel (route `/`). Mirrors the real destination of the
/// anonymous redirect so sign-out assertions can look for it.
class PortalSentinel extends StatelessWidget {
  const PortalSentinel({super.key});

  static const ValueKey<String> screenKey = ValueKey<String>('portal-screen');

  @override
  Widget build(BuildContext context) {
    return const Scaffold(
      key: screenKey,
      body: Center(child: Text('PORTAL')),
    );
  }
}

typedef NestedShellBuilder =
    Widget Function(BuildContext context, GoRouterState state, Widget child);

class _RouterRefresh extends ChangeNotifier {
  void ping() => notifyListeners();
}

/// Pumps the production navigator topology (FX4 repro harness).
///
/// `createAppRouter` wraps every route list in a root `ShellRoute`
/// (`AppRootShell`), and `studentRoutes` adds a second, nested `ShellRoute`
/// (`StudentShell`). That nesting is what makes a caller-context dialog pop
/// remove a *page* instead of the dialog, so the harness must reproduce it -
/// a flat `MaterialApp(home: ...)` hid the reported bug.
///
/// The redirect mirrors only the anonymous branch of `decideRoute`: while the
/// session is restoring it stays put, and once signed out it lands on `/`.
Future<GoRouter> pumpNestedShellApp(
  WidgetTester tester, {
  required ProviderContainer container,
  required String initialLocation,
  List<RouteBase> outerRoutes = const <RouteBase>[],
  List<RouteBase> nestedRoutes = const <RouteBase>[],
  NestedShellBuilder? nestedShellBuilder,
}) async {
  final refresh = _RouterRefresh();
  container.listen<SessionState>(
    sessionProvider,
    (previous, next) => refresh.ping(),
  );
  addTearDown(refresh.dispose);

  final router = GoRouter(
    initialLocation: initialLocation,
    refreshListenable: refresh,
    redirect: (context, state) {
      final session = container.read(sessionProvider);
      if (session.isRestoring) return null;
      if (!session.isSignedIn && state.uri.path != '/') return '/';
      return null;
    },
    routes: <RouteBase>[
      // Root shell analogue (`AppRootShell`).
      ShellRoute(
        builder: (context, state, child) => child,
        routes: <RouteBase>[
          ...outerRoutes,
          if (nestedRoutes.isNotEmpty)
            // Feature shell analogue (`StudentShell` / `FacultyShell`).
            ShellRoute(
              builder:
                  nestedShellBuilder ??
                  (context, state, child) => _DefaultNestedShell(child: child),
              routes: nestedRoutes,
            ),
          GoRoute(
            path: '/',
            builder: (context, state) => const PortalSentinel(),
          ),
        ],
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

class _DefaultNestedShell extends StatelessWidget {
  const _DefaultNestedShell({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Scaffold(
      body: child,
      bottomNavigationBar: Container(
        height: 56,
        alignment: Alignment.center,
        decoration: BoxDecoration(
          color: tokens.surface,
          border: Border(top: BorderSide(color: tokens.borderSubtle)),
        ),
        child: const Text('NESTED SHELL'),
      ),
    );
  }
}
