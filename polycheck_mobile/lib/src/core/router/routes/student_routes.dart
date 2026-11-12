import 'package:go_router/go_router.dart';

import '../../../features/student/presentation/common/student_shell.dart';
import '../../../features/student/presentation/dashboard/student_classes_screen.dart';
import '../../../features/student/presentation/dashboard/student_dashboard_screen.dart';
import '../../../features/student/presentation/history/student_history_screen.dart';
import '../../../features/student/presentation/officer/student_create_session_screen.dart';
import '../../../features/student/presentation/officer/student_section_detail_screen.dart';
import '../../../features/student/presentation/officer/student_session_detail_screen.dart';
import '../../../features/student/presentation/scan/student_scan_screen.dart';
import '../../../features/student/presentation/schedule/student_schedule_screen.dart';
import '../../../features/student/student_paths.dart';

/// Student feature routes (dashboard, schedule, scanner, history, and the
/// read-only/officer class pages).
///
/// The router guard already limits `/student/*` to student roles; this list
/// only owns screen wiring. `/student` resolves to the dashboard.
final List<RouteBase> studentRoutes = <RouteBase>[
  GoRoute(
    path: StudentPaths.base,
    redirect: (context, state) => StudentPaths.dashboard,
  ),
  ShellRoute(
    builder: (context, state, child) =>
        StudentShell(location: state.uri.path, child: child),
    routes: <RouteBase>[
      GoRoute(
        path: StudentPaths.dashboard,
        builder: (context, state) => const StudentDashboardScreen(),
      ),
      GoRoute(
        path: StudentPaths.schedule,
        builder: (context, state) => const StudentScheduleScreen(),
      ),
      GoRoute(
        path: StudentPaths.history,
        builder: (context, state) => const StudentHistoryScreen(),
      ),
    ],
  ),
  GoRoute(
    path: StudentPaths.scan,
    builder: (context, state) => const StudentScanScreen(),
  ),
  GoRoute(
    path: StudentPaths.classList,
    builder: (context, state) => const StudentClassesScreen(),
  ),
  GoRoute(
    path: '${StudentPaths.subjectPrefix}/:id',
    builder: (context, state) =>
        StudentSectionDetailScreen(sectionId: state.pathParameters['id']!),
    routes: <RouteBase>[
      GoRoute(
        path: 'create-session',
        builder: (context, state) =>
            StudentCreateSessionScreen(sectionId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: 'sessions/:sessionId',
        builder: (context, state) => StudentSessionDetailScreen(
          sectionId: state.pathParameters['id']!,
          sessionId: state.pathParameters['sessionId']!,
        ),
      ),
    ],
  ),
];
