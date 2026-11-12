import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';
import 'package:polycheck_mobile/src/core/providers/session_provider.dart';
import 'package:polycheck_mobile/src/core/theme/pup_theme.dart';
import 'package:polycheck_mobile/src/core/widgets/campus_bottom_nav.dart';
import 'package:polycheck_mobile/src/features/admin/domain/admin_access.dart';
import 'package:polycheck_mobile/src/features/admin/presentation/widgets/admin_common.dart';
import 'package:polycheck_mobile/src/features/admin/presentation/widgets/admin_shell.dart';

import '../helpers/auth_harness.dart';

/// SW-A router topology: the production router wraps every route list in a
/// root `ShellRoute` (`AppRootShell`), and the console now adds a second,
/// nested `ShellRoute` (`AdminShell`). These tests ride that exact nesting so
/// a deep link into `/admin/*` proves the shell mounts and the screen's own
/// back fallback stays reachable.
const User _superAdmin = User(
  id: 'admin-1',
  fullName: 'Campus Director',
  role: UserRole.superAdmin,
  scope: 'institution',
);

const User _registrar = User(
  id: 'teacher-reg',
  fullName: 'Registrar',
  role: UserRole.teacher,
  department: 'CCIS',
  isUserRegistrar: true,
);

class _ConsoleStub extends StatelessWidget {
  const _ConsoleStub({required this.section});

  final AdminSection section;

  @override
  Widget build(BuildContext context) {
    return AdminScaffold(
      title: section.label,
      section: section,
      body: Text('CONSOLE ${section.name}'),
    );
  }
}

Future<GoRouter> _pumpAdminRouter(
  WidgetTester tester, {
  required User user,
  required String initialLocation,
}) async {
  final container = ProviderContainer(
    overrides: <Override>[
      sessionProvider.overrideWith(() => FakeSessionController(user)),
    ],
  );
  addTearDown(container.dispose);

  final router = GoRouter(
    initialLocation: initialLocation,
    routes: <RouteBase>[
      // Root shell analogue (`AppRootShell`).
      ShellRoute(
        builder: (context, state, child) => child,
        routes: <RouteBase>[
          // Feature shell analogue (`adminRoutes`'s single ShellRoute).
          ShellRoute(
            builder: (context, state, child) =>
                AdminShell(location: state.uri.path, child: child),
            routes: <RouteBase>[
              for (final section in AdminSection.values)
                GoRoute(
                  path: section.route,
                  builder: (context, state) => _ConsoleStub(section: section),
                ),
            ],
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

void main() {
  testWidgets('a deep link into the console rides the shell and its bar', (
    tester,
  ) async {
    final router = await _pumpAdminRouter(
      tester,
      user: _superAdmin,
      initialLocation: '/admin/audit-logs',
    );

    expect(find.byType(AdminShell), findsOneWidget);
    expect(find.byType(CampusBottomNav), findsOneWidget);
    for (final id in <String>['dashboard', 'users', 'settings', 'auditLogs']) {
      expect(
        find.byKey(ValueKey<String>('campus-nav-$id')),
        findsOneWidget,
        reason: id,
      );
    }
    expect(
      find.byKey(const ValueKey<String>('campus-nav-selected-auditLogs')),
      findsOneWidget,
    );
    expect(find.text('CONSOLE auditLogs'), findsOneWidget);
    expect(
      router.routerDelegate.currentConfiguration.uri.path,
      '/admin/audit-logs',
    );
  });

  testWidgets('every console deep link keeps the bar mounted', (tester) async {
    final router = await _pumpAdminRouter(
      tester,
      user: _superAdmin,
      initialLocation: '/admin/dashboard',
    );

    for (final section in AdminSection.values) {
      router.go(section.route);
      await tester.pumpAndSettle();

      expect(
        find.byType(AdminShell),
        findsOneWidget,
        reason: '${section.route} rides the admin shell',
      );
      expect(
        find.byType(CampusBottomNav),
        findsOneWidget,
        reason: '${section.route} keeps the bar',
      );
      expect(
        find.text('CONSOLE ${section.name}'),
        findsOneWidget,
        reason: '${section.route} renders its screen',
      );
    }
  });

  testWidgets('settings tab queries map their highlight to Settings', (
    tester,
  ) async {
    await _pumpAdminRouter(
      tester,
      user: _superAdmin,
      initialLocation: '/admin/settings?tab=system',
    );

    expect(
      find.byKey(const ValueKey<String>('campus-nav-selected-settings')),
      findsOneWidget,
    );
    expect(find.text('CONSOLE settings'), findsOneWidget);
  });

  testWidgets('a deep-linked console keeps the back fallback', (tester) async {
    final router = await _pumpAdminRouter(
      tester,
      user: _superAdmin,
      initialLocation: '/admin/search',
    );

    // `/admin/search` is a popup-overflow surface: no bar item selected.
    for (final id in <String>['dashboard', 'users', 'settings', 'auditLogs']) {
      expect(
        find.byKey(ValueKey<String>('campus-nav-selected-$id')),
        findsNothing,
        reason: id,
      );
    }

    final fallback = find.byKey(const ValueKey('admin-back-fallback'));
    expect(fallback, findsOneWidget);
    await tester.tap(fallback);
    await tester.pumpAndSettle();

    expect(
      router.routerDelegate.currentConfiguration.uri.path,
      '/admin/dashboard',
    );
    expect(
      find.byKey(const ValueKey<String>('campus-nav-selected-dashboard')),
      findsOneWidget,
    );
  });

  testWidgets('registrar deep links ride the shell without a bar', (
    tester,
  ) async {
    final router = await _pumpAdminRouter(
      tester,
      user: _registrar,
      initialLocation: '/admin/users',
    );

    expect(find.byType(AdminShell), findsOneWidget);
    expect(find.byType(CampusBottomNav), findsNothing);
    expect(find.byKey(const ValueKey('admin-back-fallback')), findsOneWidget);
    expect(find.text('CONSOLE users'), findsOneWidget);
    expect(router.routerDelegate.currentConfiguration.uri.path, '/admin/users');
  });
}
