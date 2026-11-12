import 'package:go_router/go_router.dart';

import '../../../features/faculty/presentation/faculty_at_risk_screen.dart';
import '../../../features/faculty/presentation/faculty_attendance_screen.dart';
import '../../../features/faculty/presentation/faculty_dashboard_screen.dart';
import '../../../features/faculty/presentation/faculty_disputes_screen.dart';
import '../../../features/faculty/presentation/faculty_excuses_screen.dart';
import '../../../features/faculty/presentation/faculty_reports_screen.dart';
import '../../../features/faculty/presentation/faculty_schedule_screen.dart';
import '../../../features/faculty/presentation/faculty_sessions_screen.dart';
import '../../../features/faculty/presentation/faculty_subjects_screen.dart';
import '../../../features/faculty/presentation/section_create_screen.dart';
import '../../../features/faculty/presentation/section_detail_screen.dart';
import '../../../features/faculty/presentation/session_cockpit_screen.dart';
import '../../../features/faculty/presentation/session_create_screen.dart';
import '../../../features/faculty/presentation/student_detail_screen.dart';
import '../../../features/faculty/presentation/subject_create_screen.dart';
import '../../../features/faculty/presentation/subject_detail_screen.dart';
import '../../../features/faculty/presentation/widgets/faculty_shell.dart';

/// Faculty (teacher) route table.
///
/// Every route rides the [FacultyShell] (persistent bottom navigation), so
/// detail/create pages keep the correct parent tab highlighted. Static
/// segments are registered before `:id` variants so `/faculty/sessions/
/// create` never resolves as a session id. The kiosk projector stage stays
/// web-only (plan §7.6); the mobile cockpit is the activation surface.
final List<RouteBase> facultyRoutes = <RouteBase>[
  ShellRoute(
    builder: (context, state, child) =>
        FacultyShell(location: state.uri.path, child: child),
    routes: <RouteBase>[
      GoRoute(
        path: '/faculty/dashboard',
        builder: (context, state) => const FacultyDashboardScreen(),
      ),
      GoRoute(
        path: '/faculty/subjects',
        builder: (context, state) => const FacultySubjectsScreen(),
      ),
      GoRoute(
        path: '/faculty/subjects/create',
        builder: (context, state) => const SubjectCreateScreen(),
      ),
      GoRoute(
        path: '/faculty/subjects/:id/sessions',
        builder: (context, state) =>
            FacultySessionsScreen(subjectId: state.pathParameters['id']),
      ),
      GoRoute(
        path: '/faculty/subjects/:id',
        builder: (context, state) =>
            SubjectDetailScreen(subjectId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/faculty/sections/create',
        redirect: (context, state) =>
            state.uri.queryParameters['subjectId'] == null
            ? '/faculty/subjects'
            : null,
        builder: (context, state) => SectionCreateScreen(
          subjectId: state.uri.queryParameters['subjectId']!,
        ),
      ),
      GoRoute(
        path: '/faculty/sections/:id',
        builder: (context, state) =>
            SectionDetailScreen(sectionId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/faculty/sessions',
        builder: (context, state) => FacultySessionsScreen(
          sectionId: state.uri.queryParameters['sectionId'],
        ),
      ),
      GoRoute(
        path: '/faculty/sessions/create',
        builder: (context, state) => SessionCreateScreen(
          initialSectionId: state.uri.queryParameters['sectionId'],
        ),
      ),
      GoRoute(
        path: '/faculty/sessions/:id',
        builder: (context, state) =>
            SessionCockpitScreen(sessionId: state.pathParameters['id']!),
      ),
      GoRoute(
        path: '/faculty/disputes',
        builder: (context, state) => const FacultyDisputesScreen(),
      ),
      GoRoute(
        path: '/faculty/excuses',
        builder: (context, state) => const FacultyExcusesScreen(),
      ),
      GoRoute(
        path: '/faculty/at-risk',
        builder: (context, state) => const FacultyAtRiskScreen(),
      ),
      GoRoute(
        path: '/faculty/attendance',
        builder: (context, state) => const FacultyAttendanceScreen(),
      ),
      GoRoute(
        path: '/faculty/reports',
        builder: (context, state) => const FacultyReportsScreen(),
      ),
      GoRoute(
        path: '/faculty/schedule',
        builder: (context, state) => const FacultyScheduleScreen(),
      ),
      GoRoute(
        path: '/faculty/students/:id',
        builder: (context, state) => FacultyStudentDetailScreen(
          studentId: state.pathParameters['id']!,
          sectionId: state.uri.queryParameters['sectionId'],
        ),
      ),
    ],
  ),
];
