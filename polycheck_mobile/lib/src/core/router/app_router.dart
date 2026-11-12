import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../widgets/campus_empty_state.dart';
import '../widgets/campus_header.dart';
import 'app_events.dart';
import 'router_notifier.dart';
import 'routes/admin_routes.dart';
import 'routes/app_routes.dart';
import 'routes/auth_routes.dart';
import 'routes/faculty_routes.dart';
import 'routes/student_routes.dart';
import 'routes/surface_routes.dart';

/// Builds the application router from the modular route lists.
///
/// Feature waves append their screens to the corresponding `*_routes.dart`
/// file. While a list is empty, router-level seams keep every guard target
/// reachable without inventing placeholder feature screens.
GoRouter createAppRouter(RouterNotifier notifier) {
  return GoRouter(
    initialLocation: AppRoutes.portal,
    refreshListenable: notifier,
    redirect: (context, state) => notifier.redirect(state),
    errorBuilder: (context, state) =>
        const RouterSeamScreen(title: 'Page not found'),
    routes: <RouteBase>[
      ShellRoute(
        builder: (context, state, child) => AppRootShell(child: child),
        routes: <RouteBase>[
          ...authRoutes,
          ...studentRoutes,
          ...facultyRoutes,
          ...adminRoutes,
          ...surfaceRoutes,
          if (studentRoutes.isEmpty)
            ..._roleSeamRoutes(
              prefix: AppRoutes.studentPrefix,
              home: AppRoutes.studentHome,
              title: 'Student dashboard',
            ),
          if (facultyRoutes.isEmpty)
            ..._roleSeamRoutes(
              prefix: AppRoutes.facultyPrefix,
              home: AppRoutes.facultyHome,
              title: 'Faculty dashboard',
            ),
          if (adminRoutes.isEmpty)
            ..._roleSeamRoutes(
              prefix: AppRoutes.adminPrefix,
              home: AppRoutes.adminHome,
              title: 'Administrator dashboard',
            ),
          if (surfaceRoutes.isEmpty) ..._surfaceSeams,
        ],
      ),
    ],
  );
}

List<RouteBase> _roleSeamRoutes({
  required String prefix,
  required String home,
  required String title,
}) {
  return <RouteBase>[
    GoRoute(
      path: prefix,
      builder: (context, state) => RouterSeamScreen(title: title),
    ),
    GoRoute(
      path: home,
      builder: (context, state) => RouterSeamScreen(title: title),
    ),
  ];
}

List<RouteBase> get _surfaceSeams => <RouteBase>[
  GoRoute(
    path: AppRoutes.profile,
    builder: (context, state) => const RouterSeamScreen(title: 'Profile'),
  ),
  GoRoute(
    path: AppRoutes.assistant,
    builder: (context, state) => const RouterSeamScreen(title: 'Assistant'),
  ),
];

/// Router-level fallback only - never a feature screen.
///
/// It exists so a guard target (role home, `/profile`, `/assistant`) never
/// dead-ends before Wave B fills the corresponding route list.
class RouterSeamScreen extends StatelessWidget {
  const RouterSeamScreen({super.key, required this.title});

  final String title;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: CampusHeader(title: title, automaticallyImplyLeading: false),
      body: const CampusEmptyState(
        icon: Icons.construction_outlined,
        title: 'Not available in this build',
        message: 'This section ships in the next mobile update.',
      ),
    );
  }
}

final appRouterProvider = Provider<GoRouter>((ref) {
  final notifier = ref.watch(routerNotifierProvider);
  final router = createAppRouter(notifier);
  ref.onDispose(router.dispose);
  return router;
});
