import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:polycheck_mobile/src/core/router/routes/faculty_routes.dart';
import 'package:polycheck_mobile/src/features/faculty/presentation/widgets/faculty_shell.dart';

void main() {
  final shell = facultyRoutes.whereType<ShellRoute>().single;

  List<String> paths() => [
    for (final route in shell.routes.whereType<GoRoute>()) route.path,
  ];

  test('ships every faculty route from the wave contract', () {
    expect(paths().toSet(), {
      '/faculty/dashboard',
      '/faculty/subjects',
      '/faculty/subjects/create',
      '/faculty/subjects/:id',
      '/faculty/subjects/:id/sessions',
      '/faculty/sections/create',
      '/faculty/sections/:id',
      '/faculty/sessions',
      '/faculty/sessions/create',
      '/faculty/sessions/:id',
      '/faculty/disputes',
      '/faculty/excuses',
      '/faculty/at-risk',
      '/faculty/attendance',
      '/faculty/reports',
      '/faculty/schedule',
      '/faculty/students/:id',
    });
  });

  test('every faculty route rides the persistent FacultyShell', () {
    expect(facultyRoutes, hasLength(1));
    expect(shell.builder, isNotNull);
  });

  test('static segments precede their :id variants', () {
    final list = paths();
    expect(
      list.indexOf('/faculty/subjects/create'),
      lessThan(list.indexOf('/faculty/subjects/:id')),
    );
    expect(
      list.indexOf('/faculty/sections/create'),
      lessThan(list.indexOf('/faculty/sections/:id')),
    );
    expect(
      list.indexOf('/faculty/sessions/create'),
      lessThan(list.indexOf('/faculty/sessions/:id')),
    );
    expect(
      list.indexOf('/faculty/subjects/:id/sessions'),
      lessThan(list.indexOf('/faculty/subjects/:id')),
    );
  });

  test('has no kiosk route (web-only projector stage)', () {
    expect(paths().any((path) => path.contains('kiosk')), isFalse);
  });

  test('primary tab resolution treats detail/create routes as parents', () {
    // Every registered path has a deterministic primary-tab story.
    final resolved = {
      for (final path in paths())
        path: facultyTabFor(path.replaceAll(':id', 'sec-1')),
    };
    expect(resolved['/faculty/dashboard'], FacultyTab.dashboard);
    expect(resolved['/faculty/subjects'], FacultyTab.subjects);
    expect(resolved['/faculty/subjects/create'], FacultyTab.subjects);
    expect(resolved['/faculty/subjects/:id'], FacultyTab.subjects);
    expect(resolved['/faculty/subjects/:id/sessions'], FacultyTab.subjects);
    expect(resolved['/faculty/sections/:id'], FacultyTab.subjects);
    expect(resolved['/faculty/students/:id'], FacultyTab.subjects);
    expect(resolved['/faculty/sessions'], FacultyTab.sessions);
    expect(resolved['/faculty/sessions/create'], FacultyTab.sessions);
    expect(resolved['/faculty/sessions/:id'], FacultyTab.sessions);
    expect(resolved['/faculty/disputes'], FacultyTab.disputes);
    // More-sheet surfaces intentionally have no primary tab.
    for (final path in const <String>[
      '/faculty/attendance',
      '/faculty/excuses',
      '/faculty/reports',
      '/faculty/schedule',
      '/faculty/at-risk',
    ]) {
      expect(resolved[path], isNull, reason: '$path is a More surface');
    }
  });
}
