import 'package:flutter/foundation.dart';

import '../models/user.dart';
import '../providers/session_provider.dart';
import '../utils/designations.dart';
import 'routes/app_routes.dart';

/// Navigation identity used by the guard ladder.
///
/// Officer roles are presentation-only labels: all three student variants share
/// the `/student/*` section. The backend re-authorizes every officer action.
enum AppRole { student, president, qac, faculty, admin }

AppRole? resolveAppRole(
  User? user, {
  required bool officerPresident,
  required bool officerQac,
}) {
  if (user == null) return null;
  return switch (user.role) {
    UserRole.superAdmin => AppRole.admin,
    UserRole.teacher => AppRole.faculty,
    UserRole.student when officerPresident => AppRole.president,
    UserRole.student when officerQac => AppRole.qac,
    UserRole.student => AppRole.student,
  };
}

bool isStudentRole(AppRole? role) =>
    role == AppRole.student || role == AppRole.president || role == AppRole.qac;

/// Admin console subset an IT-coordinator teacher may enter (K13).
///
/// Their visible settings tabs are narrowed in-screen by `adminAccessFor`.
const Set<String> itCoordinatorAdminPaths = <String>{
  '/admin/server-status',
  '/admin/system-reports',
  '/admin/settings',
};

/// Admin console subset a registrar teacher may enter (department-pinned).
const Set<String> registrarAdminPaths = <String>{'/admin/users'};

bool isAdminPath(String path) =>
    path == AppRoutes.adminPrefix ||
    path.startsWith('${AppRoutes.adminPrefix}/');

/// Landing console for a designated teacher or super admin.
///
/// Super admins keep the dashboard; dual-hat staff start on the first suite
/// they hold, matching `adminLandingRoute` in the admin feature. Plain
/// teachers, department heads, and students get null (their role home).
String? adminLandingPath(User? user) {
  if (user == null) return null;
  if (user.role == UserRole.superAdmin) return AppRoutes.adminHome;
  if (user.role != UserRole.teacher) return null;
  if (canAccessItOperations(user)) return '/admin/server-status';
  if (canAccessUserAdmin(user)) return '/admin/users';
  return null;
}

bool canOpenAdminPath(User? user, String path) {
  if (user == null) return false;
  if (user.role == UserRole.superAdmin) {
    return AppRoutes.adminPaths.contains(path);
  }
  if (canAccessItOperations(user) && itCoordinatorAdminPaths.contains(path)) {
    return true;
  }
  if (canAccessUserAdmin(user) && registrarAdminPaths.contains(path)) {
    return true;
  }
  return false;
}

String roleHome(AppRole? role) => switch (role) {
  AppRole.student || AppRole.president || AppRole.qac => AppRoutes.studentHome,
  AppRole.faculty => AppRoutes.facultyHome,
  AppRole.admin => AppRoutes.adminHome,
  null => AppRoutes.portal,
};

String? rolePrefix(AppRole? role) => switch (role) {
  AppRole.student ||
  AppRole.president ||
  AppRole.qac => AppRoutes.studentPrefix,
  AppRole.faculty => AppRoutes.facultyPrefix,
  AppRole.admin => AppRoutes.adminPrefix,
  null => null,
};

/// Pure guard result. A null [redirect] means "stay where you are".
@immutable
class RouteDecision {
  const RouteDecision.allow() : redirect = null;

  const RouteDecision.redirect(this.redirect);

  final String? redirect;

  bool get allowed => redirect == null;
}

/// The complete guard ladder, independent of GoRouter and Riverpod so it can
/// be unit-tested as a pure function.
///
/// Order: restore/auth-in-flight -> anonymous -> role -> forced password
/// rotation -> maintenance -> auth screens -> shared routes -> role section.
RouteDecision decideRoute({
  required String location,
  required SessionStatus status,
  required User? user,
  required bool maintenanceActive,
  required bool hasExpiredSession,
  required AppRole? lastRole,
  required bool officerPresident,
  required bool officerQac,
}) {
  final uri = _parseLocation(location);
  final path = _normalizePath(uri.path);
  final query = uri.queryParameters;

  if (status == SessionStatus.unknown ||
      status == SessionStatus.restoring ||
      status == SessionStatus.authenticating) {
    return const RouteDecision.allow();
  }

  final signedIn = status == SessionStatus.signedIn && user != null;

  if (!signedIn) {
    if (AppRoutes.authPaths.contains(path)) {
      if (hasExpiredSession &&
          AppRoutes.loginPaths.contains(path) &&
          query['reason'] != 'expired') {
        return _redirect(path, <String, String>{...query, 'reason': 'expired'});
      }
      return const RouteDecision.allow();
    }

    if (hasExpiredSession) {
      return _redirect(_loginPathFor(lastRole), <String, String>{
        'reason': 'expired',
        'redirect': location,
      });
    }

    return _redirect(AppRoutes.portal, <String, String>{'redirect': location});
  }

  final role = resolveAppRole(
    user,
    officerPresident: officerPresident,
    officerQac: officerQac,
  );
  if (role == null) return const RouteDecision.redirect(AppRoutes.portal);

  if (user.mustChangePassword) {
    if (path == AppRoutes.forcePasswordChange ||
        path == AppRoutes.maintenance) {
      return const RouteDecision.allow();
    }
    return const RouteDecision.redirect(AppRoutes.forcePasswordChange);
  }

  final exempt = isMaintenanceExempt(user);
  if (maintenanceActive && !exempt && path != AppRoutes.maintenance) {
    return const RouteDecision.redirect(AppRoutes.maintenance);
  }

  // Public maintenance surface (exempt users may open the status variant).
  if (path == AppRoutes.maintenance) {
    return const RouteDecision.allow();
  }

  if (AppRoutes.authPaths.contains(path)) {
    return RouteDecision.redirect(roleHome(role));
  }

  if (path == AppRoutes.forcePasswordChange) {
    return RouteDecision.redirect(roleHome(role));
  }

  if (AppRoutes.sharedPaths.contains(path)) {
    return const RouteDecision.allow();
  }

  // K13 administrator suites: super admins own every console route; IT
  // coordinators get server status / triage / settings; registrars get the
  // account console. Everyone else - including department heads - never
  // enters `/admin/*`, and wrong sub-routes land on the permitted console.
  if (isAdminPath(path)) {
    if (path != AppRoutes.adminPrefix && canOpenAdminPath(user, path)) {
      return const RouteDecision.allow();
    }
    return RouteDecision.redirect(adminLandingPath(user) ?? roleHome(role));
  }

  final prefix = rolePrefix(role);
  if (prefix == null) return const RouteDecision.redirect(AppRoutes.portal);
  if (path == prefix) {
    return RouteDecision.redirect(roleHome(role));
  }
  if (path.startsWith('$prefix/')) {
    return const RouteDecision.allow();
  }

  // Wrong-section navigation never dead-ends.
  return RouteDecision.redirect(roleHome(role));
}

/// Validates a preserved `redirect` query parameter against the role section.
/// Returns null when the caller should just use the role home.
///
/// Pass the signed-in [user] so dual-hat designees may resume deep links into
/// their permitted `/admin/*` console; without it only role-shared paths are
/// accepted.
String? resolvePostLoginDestination({
  required String? redirect,
  required AppRole? role,
  User? user,
}) {
  final raw = redirect?.trim();
  if (raw == null || raw.isEmpty || role == null) return null;
  final uri = Uri.tryParse(raw);
  if (uri == null || !uri.path.startsWith('/') || uri.path.startsWith('//')) {
    return null;
  }
  final path = _normalizePath(uri.path);
  if (AppRoutes.authPaths.contains(path) ||
      path == AppRoutes.forcePasswordChange) {
    return null;
  }
  if (AppRoutes.sharedPaths.contains(path)) return uri.toString();
  if (isAdminPath(path)) {
    if (path == AppRoutes.adminPrefix) {
      final landing = adminLandingPath(user);
      return landing == null ? null : Uri(path: landing).toString();
    }
    if (canOpenAdminPath(user, path)) return uri.toString();
    final landing = adminLandingPath(user);
    return landing == null ? null : Uri(path: landing).toString();
  }
  final prefix = rolePrefix(role);
  if (prefix == null) return null;
  if (path == prefix) return null;
  if (!path.startsWith('$prefix/')) return null;
  return uri.toString();
}

String _loginPathFor(AppRole? role) {
  return role == AppRole.faculty || role == AppRole.admin
      ? AppRoutes.facultyLogin
      : AppRoutes.studentLogin;
}

RouteDecision _redirect(String path, [Map<String, String>? query]) {
  final cleaned = <String, String>{
    if (query != null)
      for (final entry in query.entries)
        if (entry.value.isNotEmpty) entry.key: entry.value,
  };
  return RouteDecision.redirect(
    Uri(
      path: path,
      queryParameters: cleaned.isEmpty ? null : cleaned,
    ).toString(),
  );
}

Uri _parseLocation(String location) {
  final raw = location.trim();
  if (raw.isEmpty) return Uri(path: AppRoutes.portal);
  final parsed = Uri.tryParse(raw);
  if (parsed == null) return Uri(path: AppRoutes.portal);
  if (parsed.path.isEmpty) {
    return parsed.replace(path: AppRoutes.portal);
  }
  return parsed;
}

String _normalizePath(String path) {
  if (path.isEmpty) return AppRoutes.portal;
  if (path.length > 1 && path.endsWith('/')) {
    return path.substring(0, path.length - 1);
  }
  return path;
}
