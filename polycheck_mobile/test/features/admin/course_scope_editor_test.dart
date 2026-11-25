import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';
import 'package:polycheck_mobile/src/core/providers/session_provider.dart';
import 'package:polycheck_mobile/src/core/theme/pup_theme.dart';
import 'package:polycheck_mobile/src/features/admin/application/admin_users_api.dart';
import 'package:polycheck_mobile/src/features/admin/presentation/widgets/user_record_sheet.dart';

final _admin = User(
  id: 'admin-1',
  fullName: 'System Administrator',
  role: UserRole.superAdmin,
  scope: 'institution',
  isActive: true,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
);

User _teacher({
  bool head = false,
  List<String> courses = const <String>[],
  bool all = false,
}) => User(
  id: 't-9',
  fullName: 'Prof. Head',
  email: 'head@pup.edu.ph',
  role: UserRole.teacher,
  isActive: true,
  isDepartmentHead: head,
  managedCourses: courses,
  managesAllCourses: all,
  createdAt: '2026-01-01T00:00:00Z',
  updatedAt: '2026-01-01T00:00:00Z',
);

class _SignedInAdmin extends SessionController {
  @override
  SessionState build() =>
      SessionState(status: SessionStatus.signedIn, user: _admin);
}

class _RecordingApi extends AdminUsersApi {
  _RecordingApi(this.target) : super(Dio());

  final User target;
  final List<Map<String, dynamic>> patches = <Map<String, dynamic>>[];

  @override
  Future<User> patchUser(String id, Map<String, dynamic> body) async {
    patches.add(body);
    return target;
  }
}

Future<_RecordingApi> _pump(WidgetTester tester, User account) async {
  final api = _RecordingApi(account);
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        sessionProvider.overrideWith(_SignedInAdmin.new),
        adminUsersApiProvider.overrideWithValue(api),
      ],
      child: MaterialApp(
        theme: PupTheme.light,
        home: Scaffold(
          body: SingleChildScrollView(
            child: UserRecordSheet(account: account, onChanged: () {}),
          ),
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
  return api;
}

Future<void> _tapVisible(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder);
  await tester.pumpAndSettle();
  await tester.tap(finder);
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('course scope stays hidden until a head or registrar is on', (
    tester,
  ) async {
    await _pump(tester, _teacher());

    expect(find.text('Course Head'), findsOneWidget);
    expect(find.text('Department Head'), findsNothing);
    expect(find.byKey(const ValueKey('course-scope-all')), findsNothing);

    await _tapVisible(tester, find.text('Course Head'));
    expect(find.byKey(const ValueKey('course-scope-all')), findsOneWidget);
    expect(find.textContaining('No courses selected'), findsOneWidget);
  });

  testWidgets('saving sends the designation and the chosen courses together', (
    tester,
  ) async {
    final api = await _pump(tester, _teacher());

    await _tapVisible(tester, find.text('Course Head'));
    await _tapVisible(tester, find.byKey(const ValueKey('course-scope-BSIT')));
    await _tapVisible(tester, find.byKey(const ValueKey('course-scope-BSHM')));
    await _tapVisible(tester, find.text('Save changes'));

    expect(api.patches, hasLength(1));
    expect(api.patches.single['isDepartmentHead'], isTrue);
    expect(api.patches.single['managedCourses'], ['BSIT', 'BSHM']);
    expect(api.patches.single.containsKey('managesAllCourses'), isFalse);
  });

  testWidgets('the all-courses switch makes a Head of Academic Programs', (
    tester,
  ) async {
    final api = await _pump(
      tester,
      _teacher(head: true, courses: const ['BSIT']),
    );

    await _tapVisible(tester, find.byKey(const ValueKey('course-scope-all')));
    await _tapVisible(tester, find.text('Save changes'));

    expect(api.patches, hasLength(1));
    expect(api.patches.single, <String, dynamic>{'managesAllCourses': true});
  });

  testWidgets('chips lock while all courses is on', (tester) async {
    await _pump(tester, _teacher(head: true, all: true));

    final chip = tester.widget<FilterChip>(
      find.byKey(const ValueKey('course-scope-BSIT')),
    );
    expect(chip.selected, isTrue);
    expect(chip.onSelected, isNull);
  });
}
