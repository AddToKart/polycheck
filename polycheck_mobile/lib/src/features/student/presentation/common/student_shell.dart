import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';

import '../../student_paths.dart';

/// Persistent student navigation for the three tab surfaces.
///
/// The scan screen lives outside this shell because it is a full-bleed camera
/// surface. Officer/detail routes also stay outside so the tab bar never
/// overlays a QR or a form.
class StudentShell extends ConsumerWidget {
  const StudentShell({super.key, required this.child, required this.location});

  final Widget child;
  final String location;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final session = ref.watch(sessionProvider);
    final user = session.user;
    if (user == null) {
      return Scaffold(
        body: const CampusLoading(label: 'Loading your account…'),
      );
    }
    if (user.role != UserRole.student) {
      return Scaffold(
        appBar: const CampusHeader(
          title: 'Student access only',
          automaticallyImplyLeading: false,
        ),
        body: const CampusEmptyState(
          icon: Icons.lock_outline,
          title: 'Student access only',
          message: 'This section is available to student accounts.',
        ),
      );
    }

    final currentIndex = switch (location) {
      StudentPaths.schedule => 1,
      StudentPaths.history => 3,
      _ => 0,
    };

    return Scaffold(
      body: child,
      bottomNavigationBar: CampusBottomNav(
        items: <CampusBottomNavItem>[
          CampusBottomNavItem(
            id: 'dashboard',
            icon: Icons.dashboard_outlined,
            activeIcon: Icons.dashboard,
            label: 'Dashboard',
            selected: currentIndex == 0,
            onTap: () => context.go(StudentPaths.dashboard),
          ),
          CampusBottomNavItem(
            id: 'schedule',
            icon: Icons.calendar_today_outlined,
            activeIcon: Icons.calendar_today,
            label: 'Schedule',
            selected: currentIndex == 1,
            onTap: () => context.go(StudentPaths.schedule),
          ),
          CampusBottomNavItem(
            id: 'scan',
            icon: Icons.qr_code_scanner,
            activeIcon: Icons.qr_code_scanner,
            label: 'Scan',
            selected: false,
            onTap: () => context.push(StudentPaths.scan),
          ),
          CampusBottomNavItem(
            id: 'history',
            icon: Icons.history_outlined,
            activeIcon: Icons.history,
            label: 'History',
            selected: currentIndex == 3,
            onTap: () => context.go(StudentPaths.history),
          ),
        ],
      ),
    );
  }
}
