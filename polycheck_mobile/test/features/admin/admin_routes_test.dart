import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:polycheck_mobile/src/core/router/routes/admin_routes.dart';

/// SW-A: all seven console screens ride ONE `AdminShell`, so the table is a
/// single `ShellRoute` whose children are the seven `GoRoute`s.
void main() {
  test('ships every administrator console route inside one shell', () {
    expect(adminRoutes.length, 1);
    final shell = adminRoutes.single;
    expect(shell, isA<ShellRoute>());

    final routes = (shell as ShellRoute).routes;
    final paths = routes.whereType<GoRoute>().map((route) => route.path);
    expect(
      paths,
      containsAll(<String>[
        '/admin/dashboard',
        '/admin/users',
        '/admin/settings',
        '/admin/audit-logs',
        '/admin/server-status',
        '/admin/system-reports',
        '/admin/search',
      ]),
    );
    expect(routes.length, 7);
  });

  test('settings arrives as a deep-linkable tab query', () {
    final shell = adminRoutes.single as ShellRoute;
    final settings = shell.routes.whereType<GoRoute>().firstWhere(
      (route) => route.path == '/admin/settings',
    );
    expect(settings.builder, isNotNull);
  });
}
