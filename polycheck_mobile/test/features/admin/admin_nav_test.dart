import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_riverpod/misc.dart' show Override;
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';
import 'package:polycheck_mobile/src/core/providers/session_provider.dart';
import 'package:polycheck_mobile/src/core/router/router_decision.dart';
import 'package:polycheck_mobile/src/core/theme/pup_theme.dart';
import 'package:polycheck_mobile/src/core/widgets/campus_bottom_nav.dart';
import 'package:polycheck_mobile/src/features/admin/domain/admin_access.dart';
import 'package:polycheck_mobile/src/features/admin/presentation/widgets/admin_common.dart';
import 'package:polycheck_mobile/src/features/admin/presentation/widgets/admin_shell.dart';

import '../../helpers/auth_harness.dart';

/// SW-A: the console bottom bar is designation-driven, never a static list.
const User _superAdmin = User(
  id: 'admin-1',
  fullName: 'Campus Director',
  role: UserRole.superAdmin,
  scope: 'institution',
);

const User _itCoordinator = User(
  id: 'teacher-it',
  fullName: 'IT Coordinator',
  role: UserRole.teacher,
  department: 'CCIS',
  isItCoordinator: true,
);

const User _registrar = User(
  id: 'teacher-reg',
  fullName: 'Registrar',
  role: UserRole.teacher,
  department: 'CCIS',
  isUserRegistrar: true,
);

List<String> _ids(List<AdminSection> sections) => <String>[
  for (final section in sections) section.name,
];

/// Sentinel console screen: the real `AdminScaffold` chrome (header, back
/// fallback, popup) inside the real `AdminShell`.
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

Future<GoRouter> _pumpConsole(
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
  group('adminTabFor', () {
    final all = AdminSection.values.toList();

    test('maps every console route to its owning section', () {
      for (final section in AdminSection.values) {
        expect(adminTabFor(section.route, all), section);
      }
    });

    test('keeps the settings selection across tab queries', () {
      expect(
        adminTabFor('/admin/settings?tab=system', all),
        AdminSection.settings,
      );
      expect(
        adminTabFor('/admin/settings?tab=privacy', all),
        AdminSection.settings,
      );
    });

    test('nested detail routes map by prefix', () {
      expect(adminTabFor('/admin/users/stu-1', all), AdminSection.users);
      expect(
        adminTabFor('/admin/audit-logs/audit-1?highlight=x', all),
        AdminSection.auditLogs,
      );
    });

    test('trailing slashes still match', () {
      expect(adminTabFor('/admin/settings/', all), AdminSection.settings);
    });

    test('unknown and non-admin locations map to null', () {
      expect(adminTabFor('/admin/unknown', all), isNull);
      expect(adminTabFor('/admin', all), isNull);
      expect(adminTabFor('/faculty/dashboard', all), isNull);
      expect(adminTabFor('', all), isNull);
    });

    test('a section outside the rendered bar maps to null', () {
      final bar = adminBarSectionsFor(_superAdmin);
      expect(bar, hasLength(4));
      expect(adminTabFor('/admin/server-status', bar), isNull);
      expect(adminTabFor('/admin/system-reports', bar), isNull);
      expect(adminTabFor('/admin/search', bar), isNull);
      expect(adminTabFor('/admin/audit-logs', bar), AdminSection.auditLogs);
    });
  });

  group('bar contents per designation', () {
    test('super admin: first four console sections', () {
      expect(_ids(adminBarSectionsFor(_superAdmin)), <String>[
        'dashboard',
        'users',
        'settings',
        'auditLogs',
      ]);
      expect(adminShowsBottomBar(_superAdmin), isTrue);
    });

    test('IT coordinator: its three sections in console order', () {
      expect(_ids(adminBarSectionsFor(_itCoordinator)), <String>[
        'settings',
        'serverStatus',
        'systemReports',
      ]);
      expect(adminShowsBottomBar(_itCoordinator), isTrue);
    });

    test('registrar: one section means no bar at all', () {
      expect(adminBarSectionsFor(_registrar), isEmpty);
      expect(adminShowsBottomBar(_registrar), isFalse);
    });

    test('dual-hat IT + registrar fills all four bar slots', () {
      final dualHat = _itCoordinator.copyWith(isUserRegistrar: true);
      expect(_ids(adminBarSectionsFor(dualHat)), <String>[
        'users',
        'settings',
        'serverStatus',
        'systemReports',
      ]);
    });

    test('popup overflow never repeats a bar destination', () {
      final bar = adminBarSectionsFor(_superAdmin).toSet();
      final menu = adminMenuSectionsFor(_superAdmin);
      expect(_ids(menu), <String>['serverStatus', 'systemReports', 'search']);
      expect(menu.toSet().intersection(bar), isEmpty);
      expect(menu.length + bar.length, AdminSection.values.length);

      expect(adminMenuSectionsFor(_itCoordinator), isEmpty);
      expect(_ids(adminMenuSectionsFor(_registrar)), <String>['users']);
    });
  });

  group('AdminShell', () {
    testWidgets('super admin bar renders four items and tracks every route', (
      tester,
    ) async {
      final router = await _pumpConsole(
        tester,
        user: _superAdmin,
        initialLocation: '/admin/dashboard',
      );

      expect(find.byType(CampusBottomNav), findsOneWidget);
      for (final id in <String>[
        'dashboard',
        'users',
        'settings',
        'auditLogs',
      ]) {
        expect(
          find.byKey(ValueKey<String>('campus-nav-$id')),
          findsOneWidget,
          reason: id,
        );
      }
      for (final id in <String>['serverStatus', 'systemReports', 'search']) {
        expect(
          find.byKey(ValueKey<String>('campus-nav-$id')),
          findsNothing,
          reason: '$id belongs in the popup overflow',
        );
      }

      final bar = adminBarSectionsFor(_superAdmin);
      for (final section in AdminSection.values) {
        router.go(section.route);
        await tester.pumpAndSettle();

        final expected = adminTabFor(section.route, bar);
        for (final candidate in bar) {
          final selected = find.byKey(
            ValueKey<String>('campus-nav-selected-${candidate.name}'),
          );
          if (candidate == expected) {
            expect(
              selected,
              findsOneWidget,
              reason: '${section.route} selects ${candidate.name}',
            );
          } else {
            expect(
              selected,
              findsNothing,
              reason: '${section.route} must not select ${candidate.name}',
            );
          }
        }
        expect(
          find.text('CONSOLE ${section.name}'),
          findsOneWidget,
          reason: '${section.route} renders its console',
        );
      }
    });

    testWidgets('bar taps navigate with tab semantics', (tester) async {
      final router = await _pumpConsole(
        tester,
        user: _superAdmin,
        initialLocation: '/admin/dashboard',
      );

      await tester.tap(find.byKey(const ValueKey<String>('campus-nav-users')));
      await tester.pumpAndSettle();
      expect(
        router.routerDelegate.currentConfiguration.uri.path,
        '/admin/users',
      );

      await tester.tap(
        find.byKey(const ValueKey<String>('campus-nav-auditLogs')),
      );
      await tester.pumpAndSettle();
      expect(
        router.routerDelegate.currentConfiguration.uri.path,
        '/admin/audit-logs',
      );
      expect(
        find.byKey(const ValueKey<String>('campus-nav-selected-auditLogs')),
        findsOneWidget,
      );
    });

    testWidgets('super admin popup is overflow-only (no bar duplicates)', (
      tester,
    ) async {
      await _pumpConsole(
        tester,
        user: _superAdmin,
        initialLocation: '/admin/dashboard',
      );

      await tester.tap(find.byTooltip('Administrator sections'));
      await tester.pumpAndSettle();

      for (final label in <String>[
        'Server status',
        'System reports',
        'Global search',
      ]) {
        expect(find.text(label), findsOneWidget, reason: label);
      }
      // Bar labels are Dashboard / Users / Settings / Audit; full console
      // names for bar-embedded sections must not appear in the popup.
      for (final label in <String>[
        'User management',
        'Institution settings',
        'Audit log',
      ]) {
        expect(find.text(label), findsNothing, reason: label);
      }
      expect(find.byType(PopupMenuItem<AdminSection>), findsNWidgets(3));
    });

    testWidgets('IT coordinator gets a three-item bar and no overflow popup', (
      tester,
    ) async {
      await _pumpConsole(
        tester,
        user: _itCoordinator,
        initialLocation: '/admin/server-status',
      );

      expect(find.byType(CampusBottomNav), findsOneWidget);
      for (final id in <String>['settings', 'serverStatus', 'systemReports']) {
        expect(
          find.byKey(ValueKey<String>('campus-nav-$id')),
          findsOneWidget,
          reason: id,
        );
      }
      for (final id in <String>['dashboard', 'users', 'auditLogs', 'search']) {
        expect(
          find.byKey(ValueKey<String>('campus-nav-$id')),
          findsNothing,
          reason: id,
        );
      }
      expect(
        find.byKey(const ValueKey<String>('campus-nav-selected-serverStatus')),
        findsOneWidget,
      );
      // Every permitted section is already in the bar.
      expect(find.byTooltip('Administrator sections'), findsNothing);
    });

    testWidgets('registrar keeps popup-only chrome (no bar, no menu)', (
      tester,
    ) async {
      await _pumpConsole(
        tester,
        user: _registrar,
        initialLocation: '/admin/users',
      );

      expect(find.byType(CampusBottomNav), findsNothing);
      for (final section in AdminSection.values) {
        expect(
          find.byKey(ValueKey<String>('campus-nav-${section.name}')),
          findsNothing,
          reason: section.name,
        );
      }
      // Today's behaviour for a single-section console: nothing to switch to,
      // so the popup menu button stays hidden; the header back fallback is
      // what keeps deep links escapable.
      expect(find.byTooltip('Administrator sections'), findsNothing);
      expect(find.byKey(const ValueKey('admin-back-fallback')), findsOneWidget);
      expect(find.text('CONSOLE users'), findsOneWidget);
    });

    testWidgets('accounts without a console render no bar', (tester) async {
      await _pumpConsole(
        tester,
        user: testFaculty,
        initialLocation: '/admin/users',
      );

      expect(find.byType(CampusBottomNav), findsNothing);
      expect(find.text('Administrator access required'), findsOneWidget);
    });
  });

  group('guard coverage for non-designated accounts', () {
    RouteDecision decide(User? user, AppRole role) => decideRoute(
      location: '/admin/users',
      status: SessionStatus.signedIn,
      user: user,
      maintenanceActive: false,
      hasExpiredSession: false,
      lastRole: role,
      officerPresident: false,
      officerQac: false,
    );

    test('plain teachers are redirected to the faculty home', () {
      final decision = decide(testFaculty, AppRole.faculty);
      expect(decision.allowed, isFalse);
      expect(decision.redirect, '/faculty/dashboard');
    });

    test('students are redirected to the student home', () {
      final decision = decide(testStudent, AppRole.student);
      expect(decision.allowed, isFalse);
      expect(decision.redirect, '/student/dashboard');
    });

    test('designated accounts are allowed into their console subset', () {
      expect(decide(_superAdmin, AppRole.admin).allowed, isTrue);
      expect(
        decide(_itCoordinator, AppRole.faculty).redirect,
        '/admin/server-status',
      );
      expect(decide(_registrar, AppRole.faculty).allowed, isTrue);
    });
  });
}
