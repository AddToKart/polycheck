import 'package:go_router/go_router.dart';

import '../../../features/admin/domain/admin_settings.dart';
import '../../../features/admin/presentation/admin_dashboard_screen.dart';
import '../../../features/admin/presentation/audit_logs_screen.dart';
import '../../../features/admin/presentation/global_search_screen.dart';
import '../../../features/admin/presentation/server_status_screen.dart';
import '../../../features/admin/presentation/settings_screen.dart';
import '../../../features/admin/presentation/system_reports_screen.dart';
import '../../../features/admin/presentation/users_screen.dart';
import '../../../features/admin/presentation/widgets/admin_shell.dart';

/// Super-admin / designation console routes (Phase 3.5).
///
/// Every console screen rides ONE [AdminShell] (persistent, designation-aware
/// bottom navigation), so deep links and section switches keep the same
/// chrome. Visibility is enforced by `adminAccessFor` inside every screen and
/// by `canOpenAdminPath` in the router guard, which sits above this shell; the
/// shell only renders the bar when the account's filtered section list has at
/// least two entries (the registrar's single-section console stays
/// popup-only).
final List<RouteBase> adminRoutes = <RouteBase>[
  ShellRoute(
    builder: (context, state, child) =>
        AdminShell(location: state.uri.path, child: child),
    routes: <RouteBase>[
      GoRoute(
        path: '/admin/dashboard',
        builder: (context, state) => const AdminDashboardScreen(),
      ),
      GoRoute(
        path: '/admin/users',
        builder: (context, state) => const AdminUsersScreen(),
      ),
      GoRoute(
        path: '/admin/settings',
        builder: (context, state) => AdminSettingsScreen(
          initialTab: SettingsTab.tryParse(state.uri.queryParameters['tab']),
        ),
      ),
      GoRoute(
        path: '/admin/audit-logs',
        builder: (context, state) => const AuditLogsScreen(),
      ),
      GoRoute(
        path: '/admin/server-status',
        builder: (context, state) => const ServerStatusScreen(),
      ),
      GoRoute(
        path: '/admin/system-reports',
        builder: (context, state) => const SystemReportsScreen(),
      ),
      GoRoute(
        path: '/admin/search',
        builder: (context, state) => const GlobalSearchScreen(),
      ),
    ],
  ),
];
