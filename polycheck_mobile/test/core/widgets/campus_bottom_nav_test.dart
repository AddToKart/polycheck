import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';
import 'package:polycheck_mobile/src/features/faculty/presentation/widgets/faculty_shell.dart';
import 'package:polycheck_mobile/src/features/student/presentation/common/student_shell.dart';
import 'package:polycheck_mobile/src/features/student/student_paths.dart';

import '../../helpers/auth_harness.dart';

/// Bug 5: the faculty bar was a detached floating box while the student bar
/// was full-width flat. Both shells now render the same shared
/// [CampusBottomNav] (full-width, flat, hairline top, gold edge indicator).
void main() {
  Future<void> pumpShell(
    WidgetTester tester,
    User user,
    Widget shell, {
    GoRouter? router,
  }) async {
    tester.view.physicalSize = const Size(800, 600);
    tester.view.devicePixelRatio = 1.0;
    addTearDown(tester.view.resetPhysicalSize);
    addTearDown(tester.view.resetDevicePixelRatio);

    // A fresh manual container per pump: re-pumping a scoped ProviderScope
    // would update the existing element and keep the previous session state.
    final container = ProviderContainer(
      overrides: <Override>[
        sessionProvider.overrideWith(() => FakeSessionController(user)),
      ],
    );
    addTearDown(container.dispose);
    await tester.pumpWidget(
      UncontrolledProviderScope(
        container: container,
        child: router == null
            ? MaterialApp(theme: PupTheme.light, home: shell)
            : MaterialApp.router(theme: PupTheme.light, routerConfig: router),
      ),
    );
    await tester.pump();
  }

  testWidgets('student and faculty shells render the same shared nav', (
    tester,
  ) async {
    await pumpShell(
      tester,
      testStudent,
      const StudentShell(
        location: StudentPaths.dashboard,
        child: Text('student body'),
      ),
    );

    expect(find.text('student body'), findsOneWidget);
    expect(find.byType(CampusBottomNav), findsOneWidget);
    final studentNav = tester.widget<CampusBottomNav>(
      find.byType(CampusBottomNav),
    );
    expect(studentNav.items.map((item) => item.id), <String>[
      'dashboard',
      'schedule',
      'scan',
      'history',
    ]);
    expect(studentNav.items[0].selected, isTrue);
    expect(studentNav.items[2].selected, isFalse, reason: 'scan never selects');
    expect(
      find.byKey(const ValueKey('campus-nav-selected-dashboard')),
      findsOneWidget,
    );

    final studentRect = tester.getRect(find.byType(CampusBottomNav));
    // Full-width flat bar — no detached floating box.
    expect(studentRect.left, 0);
    expect(studentRect.width, 800);
    expect(
      find.descendant(
        of: find.byType(CampusBottomNav),
        matching: find.byWidgetPredicate(
          (widget) => widget is SizedBox && widget.height == 58,
        ),
      ),
      findsOneWidget,
    );

    // Faculty shell: same component, same geometry.
    await pumpShell(
      tester,
      testFaculty,
      const FacultyShell(
        location: '/faculty/dashboard',
        child: Text('faculty body'),
      ),
    );

    expect(find.text('faculty body'), findsOneWidget);
    expect(find.byType(CampusBottomNav), findsOneWidget);
    final facultyNav = tester.widget<CampusBottomNav>(
      find.byType(CampusBottomNav),
    );
    expect(facultyNav.items.map((item) => item.id), <String>[
      'dashboard',
      'subjects',
      'sessions',
      'disputes',
    ]);
    expect(facultyNav.items[0].selected, isTrue);
    expect(
      find.byKey(const ValueKey('campus-nav-selected-dashboard')),
      findsOneWidget,
    );

    final facultyRect = tester.getRect(find.byType(CampusBottomNav));
    expect(facultyRect.left, 0);
    expect(facultyRect.width, 800);
    expect(facultyRect.height, studentRect.height);
  });

  testWidgets('faculty More-surface locations keep no primary tab selected', (
    tester,
  ) async {
    await pumpShell(
      tester,
      testFaculty,
      const FacultyShell(
        location: '/faculty/schedule',
        child: Text('schedule body'),
      ),
    );
    for (final tab in FacultyTab.values) {
      expect(
        find.byKey(ValueKey<String>('campus-nav-selected-${tab.name}')),
        findsNothing,
        reason: tab.name,
      );
    }
  });

  testWidgets('student nav switches tabs through go()', (tester) async {
    final router = GoRouter(
      initialLocation: StudentPaths.dashboard,
      routes: <RouteBase>[
        ShellRoute(
          builder: (context, state, child) =>
              StudentShell(location: state.uri.path, child: child),
          routes: <RouteBase>[
            GoRoute(
              path: StudentPaths.dashboard,
              builder: (_, _) => const Text('PAGE dashboard'),
            ),
            GoRoute(
              path: StudentPaths.schedule,
              builder: (_, _) => const Text('PAGE schedule'),
            ),
            GoRoute(
              path: StudentPaths.history,
              builder: (_, _) => const Text('PAGE history'),
            ),
          ],
        ),
      ],
    );
    addTearDown(router.dispose);
    await pumpShell(
      tester,
      testStudent,
      const SizedBox.shrink(),
      router: router,
    );
    await tester.pumpAndSettle();

    await tester.tap(find.byKey(const ValueKey('campus-nav-schedule')));
    await tester.pumpAndSettle();
    expect(find.text('PAGE schedule'), findsOneWidget);

    await tester.tap(find.byKey(const ValueKey('campus-nav-history')));
    await tester.pumpAndSettle();
    expect(find.text('PAGE history'), findsOneWidget);
  });
}
