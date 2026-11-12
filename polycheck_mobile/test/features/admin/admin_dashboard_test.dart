import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/api/api_providers.dart';
import 'package:polycheck_mobile/src/core/api/dashboard_api.dart';
import 'package:polycheck_mobile/src/core/models/dashboard.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';
import 'package:polycheck_mobile/src/core/providers/session_provider.dart';
import 'package:polycheck_mobile/src/core/theme/pup_theme.dart';
import 'package:polycheck_mobile/src/features/admin/presentation/admin_dashboard_screen.dart';

import '../../helpers/auth_harness.dart';

class FakeDashboardApi extends DashboardApi {
  FakeDashboardApi(this.overview) : super(Dio());

  final AdminOverview overview;

  @override
  Future<AdminOverview> getAdminOverview() async => overview;
}

const overview = AdminOverview(
  scope: AdminScopeKind.institution,
  counts: AdminOverviewCounts(
    activeFaculty: 12,
    disabledFaculty: 1,
    activeStudents: 340,
    disabledStudents: 4,
    activeSessions: 3,
    pendingDisputes: 2,
  ),
  health: AdminOverviewHealth(
    status: AdminOverviewHealthStatus.ok,
    timestamp: '2026-11-10T08:00:00Z',
    database: true,
    redis: true,
  ),
);

const plainTeacher = User(
  id: 'teacher',
  fullName: 'Plain Teacher',
  role: UserRole.teacher,
  department: 'CCIS',
);

Future<void> pumpDashboard(
  WidgetTester tester, {
  required User? user,
  AdminOverview? data = overview,
}) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        sessionProvider.overrideWith(() => FakeSessionController(user)),
        dashboardApiProvider.overrideWithValue(
          FakeDashboardApi(data ?? overview),
        ),
      ],
      child: MaterialApp(
        theme: PupTheme.light,
        home: const AdminDashboardScreen(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('renders counts, health, and console entries', (tester) async {
    await pumpDashboard(tester, user: testAdmin);

    expect(find.text('Institution scope'), findsOneWidget);
    expect(find.text('ACTIVE FACULTY'), findsOneWidget);
    expect(find.text('12'), findsOneWidget);
    expect(find.text('340'), findsOneWidget);
    await tester.scrollUntilVisible(find.text('User management'), 250);
    expect(find.text('User management'), findsOneWidget);
  });

  testWidgets('plain teachers are refused the administrator console', (
    tester,
  ) async {
    await pumpDashboard(tester, user: plainTeacher);

    expect(find.text('Administrator access required'), findsOneWidget);
    expect(find.text('Institution scope'), findsNothing);
    expect(find.text('Back to my home'), findsOneWidget);
  });
}
