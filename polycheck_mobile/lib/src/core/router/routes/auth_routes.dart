import 'package:go_router/go_router.dart';

import '../../../features/auth/presentation/faculty_login_screen.dart';
import '../../../features/auth/presentation/force_password_change_screen.dart';
import '../../../features/auth/presentation/maintenance_screen.dart';
import '../../../features/auth/presentation/portal_select_screen.dart';
import '../../../features/auth/presentation/student_login_screen.dart';
import 'app_routes.dart';

/// Public/authentication routes - complete and working in slice A3.
final List<RouteBase> authRoutes = <RouteBase>[
  GoRoute(
    path: AppRoutes.portal,
    builder: (context, state) => const PortalSelectScreen(),
  ),
  GoRoute(
    path: AppRoutes.studentLogin,
    builder: (context, state) => StudentLoginScreen(
      redirect: state.uri.queryParameters['redirect'],
      reason: state.uri.queryParameters['reason'],
    ),
  ),
  GoRoute(
    path: AppRoutes.facultyLogin,
    builder: (context, state) => FacultyLoginScreen(
      redirect: state.uri.queryParameters['redirect'],
      reason: state.uri.queryParameters['reason'],
    ),
  ),
  GoRoute(
    path: AppRoutes.forcePasswordChange,
    builder: (context, state) => const ForcePasswordChangeScreen(),
  ),
  GoRoute(
    path: AppRoutes.maintenance,
    builder: (context, state) => const MaintenanceScreen(),
  ),
];
