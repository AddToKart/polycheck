import 'package:go_router/go_router.dart';

import '../../../features/surface/data/surface_paths.dart';
import '../../../features/surface/presentation/assistant_screen.dart';
import '../../../features/surface/presentation/notifications_screen.dart';
import '../../../features/surface/presentation/privacy_screen.dart';
import '../../../features/surface/presentation/profile_screen.dart';

/// Shared authenticated surfaces.
///
/// `AppRoutes.sharedPaths` admits `/profile`, `/assistant`, `/notifications`,
/// `/privacy`, and `/profile/reports` for every authenticated role. Profile
/// tabs remain available as `?tab=` destinations (`SurfacePaths`); the
/// standalone aliases serve deep links and notification destinations.
final List<RouteBase> surfaceRoutes = <RouteBase>[
  GoRoute(
    path: SurfacePaths.assistant,
    builder: (context, state) => const AssistantScreen(),
  ),
  GoRoute(
    path: SurfacePaths.profile,
    builder: (context, state) => ProfileScreen(
      tab: SurfacePaths.parseTab(state.uri.queryParameters['tab']),
    ),
  ),
  // Contract aliases: the core guard must admit these paths before they can
  // be reached directly (see `AppRoutes.sharedPaths`).
  GoRoute(
    path: SurfacePaths.notificationsPage,
    builder: (context, state) => const NotificationsScreen(),
  ),
  GoRoute(
    path: SurfacePaths.privacyPage,
    builder: (context, state) => const PrivacyScreen(),
  ),
  GoRoute(
    path: SurfacePaths.profileReportsPage,
    builder: (context, state) => const ProfileScreen(tab: ProfileTab.reports),
  ),
];
