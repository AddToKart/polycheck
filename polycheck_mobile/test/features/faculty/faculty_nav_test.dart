import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';
import 'package:polycheck_mobile/src/core/providers/session_provider.dart';
import 'package:polycheck_mobile/src/core/theme/pup_theme.dart';
import 'package:polycheck_mobile/src/features/faculty/presentation/widgets/faculty_shell.dart';

import '../../helpers/auth_harness.dart';

/// Concrete instances of every registered `/faculty/*` path (the router owns
/// the `:id` forms; here we only need a readable location per screen).
const List<String> _concreteFacultyPaths = <String>[
  '/faculty/dashboard',
  '/faculty/subjects',
  '/faculty/subjects/create',
  '/faculty/subjects/subj-1',
  '/faculty/subjects/subj-1/sessions',
  '/faculty/sections/create',
  '/faculty/sections/sec-1',
  '/faculty/sessions',
  '/faculty/sessions/create',
  '/faculty/sessions/sess-1',
  '/faculty/disputes',
  '/faculty/excuses',
  '/faculty/at-risk',
  '/faculty/attendance',
  '/faculty/reports',
  '/faculty/schedule',
  '/faculty/students/stu-1',
];

List<RouteBase> _sentinelRoutes() => <RouteBase>[
  for (final path in <String>[
    ..._concreteFacultyPaths,
    '/profile',
    '/assistant',
    '/notifications',
    '/admin/server-status',
    '/admin/system-reports',
    '/admin/settings',
    '/admin/users',
  ])
    GoRoute(
      path: path,
      builder: (context, state) => Scaffold(
        appBar: AppBar(title: Text('page $path')),
        body: Center(child: Text('PAGE $path')),
      ),
    ),
];

Future<GoRouter> _pumpFacultyApp(
  WidgetTester tester, {
  required ProviderContainer container,
  required String initialLocation,
  List<RouteBase> routes = const <RouteBase>[],
}) async {
  final router = GoRouter(
    initialLocation: initialLocation,
    routes: <RouteBase>[
      ShellRoute(
        builder: (context, state, child) =>
            FacultyShell(location: state.uri.path, child: child),
        routes: routes,
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

ProviderContainer _containerWith(User user) {
  final container = ProviderContainer(
    overrides: <Override>[
      sessionProvider.overrideWith(() => FakeSessionController(user)),
    ],
  );
  addTearDown(container.dispose);
  return container;
}

void main() {
  testWidgets('every faculty route keeps the bottom bar and the parent tab', (
    tester,
  ) async {
    final container = _containerWith(testFaculty);
    for (final path in _concreteFacultyPaths) {
      await _pumpFacultyApp(
        tester,
        container: container,
        initialLocation: path,
        routes: _sentinelRoutes(),
      );

      expect(
        find.byType(FacultyShell),
        findsOneWidget,
        reason: '$path must render inside the faculty shell',
      );
      for (final tab in FacultyTab.values) {
        expect(
          find.byKey(ValueKey<String>('campus-nav-${tab.name}')),
          findsOneWidget,
          reason: '$path shows the ${tab.name} nav item',
        );
      }
      final expected = facultyTabFor(path);
      for (final tab in FacultyTab.values) {
        final selected = find.byKey(
          ValueKey<String>('campus-nav-selected-${tab.name}'),
        );
        if (tab == expected) {
          expect(selected, findsOneWidget, reason: '$path selects ${tab.name}');
        } else {
          expect(
            selected,
            findsNothing,
            reason: '$path must not select ${tab.name}',
          );
        }
      }
    }
  });

  testWidgets('bottom nav switches primary tabs with location change', (
    tester,
  ) async {
    final container = _containerWith(testFaculty);
    final router = await _pumpFacultyApp(
      tester,
      container: container,
      initialLocation: '/faculty/dashboard',
      routes: _sentinelRoutes(),
    );

    await tester.tap(find.byKey(const ValueKey<String>('campus-nav-subjects')));
    await tester.pumpAndSettle();
    expect(
      router.routerDelegate.currentConfiguration.uri.path,
      '/faculty/subjects',
    );

    await tester.tap(find.byKey(const ValueKey<String>('campus-nav-sessions')));
    await tester.pumpAndSettle();
    expect(
      router.routerDelegate.currentConfiguration.uri.path,
      '/faculty/sessions',
    );

    await tester.tap(find.byKey(const ValueKey<String>('campus-nav-disputes')));
    await tester.pumpAndSettle();
    expect(
      router.routerDelegate.currentConfiguration.uri.path,
      '/faculty/disputes',
    );

    await tester.tap(
      find.byKey(const ValueKey<String>('campus-nav-dashboard')),
    );
    await tester.pumpAndSettle();
    expect(
      router.routerDelegate.currentConfiguration.uri.path,
      '/faculty/dashboard',
    );
  });

  testWidgets('student accounts never see the faculty shell nav', (
    tester,
  ) async {
    final container = _containerWith(testStudent);
    await _pumpFacultyApp(
      tester,
      container: container,
      initialLocation: '/faculty/dashboard',
      routes: _sentinelRoutes(),
    );

    expect(find.text('Faculty access only'), findsWidgets);
    expect(
      find.byKey(const ValueKey<String>('campus-nav-dashboard')),
      findsNothing,
    );
  });

  testWidgets('More sheet lists every secondary classroom surface', (
    tester,
  ) async {
    final container = _containerWith(testFaculty);
    await _pumpFacultyApp(
      tester,
      container: container,
      initialLocation: '/faculty/dashboard',
      routes: <RouteBase>[
        GoRoute(
          path: '/faculty/dashboard',
          builder: (context, state) => const FacultyScaffold(
            title: 'Faculty dashboard',
            body: Text('dashboard body'),
          ),
        ),
        ..._sentinelRoutes(),
      ],
    );

    await tester.tap(find.byKey(const ValueKey<String>('faculty-more-button')));
    await tester.pumpAndSettle();

    for (final key in const <String>[
      'faculty-more-schedule',
      'faculty-more-attendance',
      'faculty-more-excuses',
      'faculty-more-reports',
      'faculty-more-at-risk',
      'faculty-more-report-issue',
      'faculty-more-profile',
      'faculty-more-assistant',
      'faculty-more-sign-out',
    ]) {
      expect(find.byKey(ValueKey<String>(key)), findsOneWidget, reason: key);
    }
    expect(find.text('Schedule'), findsOneWidget);
    expect(find.text('Profile & security'), findsOneWidget);
  });

  testWidgets('More sheet navigates classroom items with go()', (tester) async {
    final container = _containerWith(testFaculty);
    final router = await _pumpFacultyApp(
      tester,
      container: container,
      initialLocation: '/faculty/dashboard',
      routes: <RouteBase>[
        GoRoute(
          path: '/faculty/dashboard',
          builder: (context, state) => const FacultyScaffold(
            title: 'Faculty dashboard',
            body: Text('dashboard body'),
          ),
        ),
        ..._sentinelRoutes(),
      ],
    );

    await tester.tap(find.byKey(const ValueKey<String>('faculty-more-button')));
    await tester.pumpAndSettle();
    await tester.tap(
      find.byKey(const ValueKey<String>('faculty-more-schedule')),
    );
    await tester.pumpAndSettle();

    expect(
      router.routerDelegate.currentConfiguration.uri.path,
      '/faculty/schedule',
    );
    expect(find.text('PAGE /faculty/schedule'), findsOneWidget);
  });

  testWidgets('More sheet pushes shared surfaces (back returns to class)', (
    tester,
  ) async {
    final container = _containerWith(testFaculty);
    await _pumpFacultyApp(
      tester,
      container: container,
      initialLocation: '/faculty/dashboard',
      routes: <RouteBase>[
        GoRoute(
          path: '/faculty/dashboard',
          builder: (context, state) => const FacultyScaffold(
            title: 'Faculty dashboard',
            body: Text('dashboard body'),
          ),
        ),
        ..._sentinelRoutes(),
      ],
    );

    await tester.tap(find.byKey(const ValueKey<String>('faculty-more-button')));
    await tester.pumpAndSettle();
    await tester.ensureVisible(
      find.byKey(const ValueKey<String>('faculty-more-profile')),
    );
    await tester.tap(
      find.byKey(const ValueKey<String>('faculty-more-profile')),
    );
    await tester.pumpAndSettle();

    // `push` keeps the classroom page beneath, so the shared surface has a
    // system back arrow (`currentConfiguration` only tracks the base match).
    expect(find.text('PAGE /profile'), findsOneWidget);
    expect(find.text('dashboard body'), findsNothing);
  });

  testWidgets('plain teachers never see designation-gated console items', (
    tester,
  ) async {
    final container = _containerWith(testFaculty);
    await _pumpFacultyApp(
      tester,
      container: container,
      initialLocation: '/faculty/dashboard',
      routes: <RouteBase>[
        GoRoute(
          path: '/faculty/dashboard',
          builder: (context, state) => const FacultyScaffold(
            title: 'Faculty dashboard',
            body: Text('dashboard body'),
          ),
        ),
        ..._sentinelRoutes(),
      ],
    );

    await tester.tap(find.byKey(const ValueKey<String>('faculty-more-button')));
    await tester.pumpAndSettle();

    for (final key in const <String>[
      'faculty-more-server-status',
      'faculty-more-system-reports',
      'faculty-more-settings',
      'faculty-more-users',
    ]) {
      expect(find.byKey(ValueKey<String>(key)), findsNothing, reason: key);
    }
  });

  testWidgets(
    'IT coordinators see the IT suite but not the registrar console',
    (tester) async {
      final coordinator = testFaculty.copyWith(isItCoordinator: true);
      final container = _containerWith(coordinator);
      await _pumpFacultyApp(
        tester,
        container: container,
        initialLocation: '/faculty/dashboard',
        routes: <RouteBase>[
          GoRoute(
            path: '/faculty/dashboard',
            builder: (context, state) => const FacultyScaffold(
              title: 'Faculty dashboard',
              body: Text('dashboard body'),
            ),
          ),
          ..._sentinelRoutes(),
        ],
      );

      await tester.tap(
        find.byKey(const ValueKey<String>('faculty-more-button')),
      );
      await tester.pumpAndSettle();

      expect(
        find.byKey(const ValueKey<String>('faculty-more-server-status')),
        findsOneWidget,
      );
      expect(
        find.byKey(const ValueKey<String>('faculty-more-system-reports')),
        findsOneWidget,
      );
      expect(
        find.byKey(const ValueKey<String>('faculty-more-settings')),
        findsOneWidget,
      );
      expect(
        find.byKey(const ValueKey<String>('faculty-more-users')),
        findsNothing,
      );
    },
  );

  testWidgets('registrars see the account console but not the IT suite', (
    tester,
  ) async {
    final registrar = testFaculty.copyWith(isUserRegistrar: true);
    final container = _containerWith(registrar);
    await _pumpFacultyApp(
      tester,
      container: container,
      initialLocation: '/faculty/dashboard',
      routes: <RouteBase>[
        GoRoute(
          path: '/faculty/dashboard',
          builder: (context, state) => const FacultyScaffold(
            title: 'Faculty dashboard',
            body: Text('dashboard body'),
          ),
        ),
        ..._sentinelRoutes(),
      ],
    );

    await tester.tap(find.byKey(const ValueKey<String>('faculty-more-button')));
    await tester.pumpAndSettle();

    expect(
      find.byKey(const ValueKey<String>('faculty-more-users')),
      findsOneWidget,
    );
    expect(
      find.byKey(const ValueKey<String>('faculty-more-server-status')),
      findsNothing,
    );
  });

  testWidgets('More sheet sign-out opens the shared confirmation dialog', (
    tester,
  ) async {
    final container = _containerWith(testFaculty);
    await _pumpFacultyApp(
      tester,
      container: container,
      initialLocation: '/faculty/dashboard',
      routes: <RouteBase>[
        GoRoute(
          path: '/faculty/dashboard',
          builder: (context, state) => const FacultyScaffold(
            title: 'Faculty dashboard',
            body: Text('dashboard body'),
          ),
        ),
        ..._sentinelRoutes(),
      ],
    );

    await tester.tap(find.byKey(const ValueKey<String>('faculty-more-button')));
    await tester.pumpAndSettle();
    // The sheet body is height-capped (65% of the screen) and scrolls, so the
    // bottom sign-out row must be scrolled into view first.
    await tester.ensureVisible(
      find.byKey(const ValueKey<String>('faculty-more-sign-out')),
    );
    await tester.tap(
      find.byKey(const ValueKey<String>('faculty-more-sign-out')),
    );
    await tester.pumpAndSettle();

    expect(find.text('Sign out?'), findsOneWidget);
    expect(find.byType(FacultyScaffold), findsOneWidget);

    await tester.tap(find.widgetWithText(TextButton, 'Cancel'));
    await tester.pumpAndSettle();
    expect(find.text('dashboard body'), findsOneWidget);
  });
}
