import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../../core/providers/session_provider.dart';
import '../../../../core/theme/pup_theme.dart';
import '../../../../core/widgets/campus_bottom_nav.dart';
import '../../domain/admin_access.dart';
import 'admin_common.dart';

/// Active console tab for an `/admin/*` location.
///
/// [sections] is the section set the bottom bar actually renders; the mapper
/// returns null when the location's owning section is not in that set, so
/// overflow surfaces (super admin Server status / System reports / Search)
/// keep the bar unselected instead of highlighting a tab that is not there.
///
/// Matching order: exact route match first, then nested detail routes
/// (`/admin/users/:id`, `/admin/audit-logs/:id`, …) via prefix. Query strings
/// are ignored, so `/admin/settings?tab=system` stays on Settings. Unknown,
/// non-admin, and empty locations map to null.
AdminSection? adminTabFor(String location, List<AdminSection> sections) {
  final path = _adminPathOf(location);
  for (final section in sections) {
    if (path == section.route) return section;
  }
  for (final section in sections) {
    if (path.startsWith('${section.route}/')) return section;
  }
  return null;
}

String _adminPathOf(String location) {
  final query = location.indexOf('?');
  final fragment = location.indexOf('#');
  var end = location.length;
  if (query >= 0) end = query;
  if (fragment >= 0 && fragment < end) end = fragment;
  var path = location.substring(0, end);
  if (path.length > 1 && path.endsWith('/')) {
    path = path.substring(0, path.length - 1);
  }
  return path;
}

/// Compact bottom-bar label for [section].
///
/// The console labels ("User management", "Institution settings") are too long
/// for a four-item phone bar; the header keeps the full names.
String adminBarLabel(AdminSection section) {
  return switch (section) {
    AdminSection.dashboard => 'Dashboard',
    AdminSection.users => 'Users',
    AdminSection.settings => 'Settings',
    AdminSection.auditLogs => 'Audit',
    AdminSection.serverStatus => 'Server',
    AdminSection.systemReports => 'Reports',
    AdminSection.search => 'Search',
  };
}

/// Persistent administrator navigation for every `/admin/*` surface.
///
/// Mirrors `FacultyShell`/`StudentShell`: each console screen keeps its own
/// `Scaffold`/`CampusHeader` (system back arrow, header actions, popup
/// overflow) while this shell owns the detached bottom bar. Bar contents are
/// designation-driven via [adminBarSectionsFor]; accounts without a bar (the
/// registrar's single-section console, or no console at all) get the child
/// untouched, exactly the pre-shell chrome.
class AdminShell extends ConsumerWidget {
  const AdminShell({super.key, required this.child, required this.location});

  final Widget child;
  final String location;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(sessionProvider.select((state) => state.user));
    if (!adminShowsBottomBar(user)) return child;

    final sections = adminBarSectionsFor(user);
    final active = adminTabFor(location, sections);
    return Scaffold(
      backgroundColor: PupTheme.of(context).campus,
      body: child,
      bottomNavigationBar: CampusBottomNav(
        items: <CampusBottomNavItem>[
          for (final section in sections)
            CampusBottomNavItem(
              id: section.name,
              icon: adminSectionIcon(section),
              activeIcon: adminSectionActiveIcon(section),
              label: adminBarLabel(section),
              selected: section == active,
              onTap: () => context.go(section.route),
            ),
        ],
      ),
    );
  }
}
