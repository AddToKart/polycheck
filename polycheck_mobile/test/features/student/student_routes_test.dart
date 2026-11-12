import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';
import 'package:polycheck_mobile/src/core/router/routes/student_routes.dart';
import 'package:polycheck_mobile/src/features/student/student_paths.dart';

void main() {
  test('student route table owns every student screen', () {
    final topLevelPaths = studentRoutes
        .whereType<GoRoute>()
        .map((route) => route.path)
        .toList(growable: false);

    expect(topLevelPaths, contains(StudentPaths.base));
    expect(topLevelPaths, contains(StudentPaths.scan));
    expect(topLevelPaths, contains(StudentPaths.classList));
    expect(topLevelPaths, contains('${StudentPaths.subjectPrefix}/:id'));

    final shell = studentRoutes.whereType<ShellRoute>().single;
    final shellPaths = shell.routes
        .whereType<GoRoute>()
        .map((route) => route.path)
        .toList(growable: false);
    expect(shellPaths, contains(StudentPaths.dashboard));
    expect(shellPaths, contains(StudentPaths.schedule));
    expect(shellPaths, contains(StudentPaths.history));

    final sectionRoute = studentRoutes.whereType<GoRoute>().firstWhere(
      (route) => route.path == '${StudentPaths.subjectPrefix}/:id',
    );
    final nestedPaths = sectionRoute.routes
        .whereType<GoRoute>()
        .map((route) => route.path)
        .toList(growable: false);
    expect(nestedPaths, contains('create-session'));
    expect(nestedPaths, contains('sessions/:sessionId'));
  });

  test('route helpers build encoded section and session URLs', () {
    expect(StudentPaths.classList, '/student/subjects');
    expect(StudentPaths.subject('sec 1'), '/student/subjects/sec%201');
    expect(
      StudentPaths.subjectSession('sec-1', 'sess 1'),
      '/student/subjects/sec-1/sessions/sess%201',
    );
    expect(
      StudentPaths.createSession('sec-1'),
      '/student/subjects/sec-1/create-session',
    );
  });
}
