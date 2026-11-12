/// Canonical route paths shared by the router, guards, and auth screens.
abstract final class AppRoutes {
  static const String portal = '/';
  static const String studentLogin = '/login/student';
  static const String facultyLogin = '/login/faculty';
  static const String forcePasswordChange = '/force-password-change';
  static const String maintenance = '/maintenance';

  static const String profile = '/profile';
  static const String assistant = '/assistant';

  /// Shared authenticated surfaces registered by the surface wave.
  ///
  /// `/profile?tab=...` stays the canonical shape; the standalone aliases
  /// below exist for deep links and notification destinations.
  static const String notifications = '/notifications';
  static const String privacy = '/privacy';
  static const String profileReports = '/profile/reports';

  static const String studentHome = '/student/dashboard';
  static const String facultyHome = '/faculty/dashboard';
  static const String adminHome = '/admin/dashboard';

  static const String studentPrefix = '/student';
  static const String facultyPrefix = '/faculty';
  static const String adminPrefix = '/admin';

  static const Set<String> authPaths = <String>{
    portal,
    studentLogin,
    facultyLogin,
    maintenance,
  };

  static const Set<String> sharedPaths = <String>{
    profile,
    assistant,
    notifications,
    privacy,
    profileReports,
  };

  /// Every registered administrator console route.
  ///
  /// Designation-scoped subsets are enforced by the guard; unknown
  /// `/admin/*` paths redirect instead of dead-ending on the error screen.
  static const Set<String> adminPaths = <String>{
    '/admin/dashboard',
    '/admin/users',
    '/admin/settings',
    '/admin/audit-logs',
    '/admin/server-status',
    '/admin/system-reports',
    '/admin/search',
  };

  static const Set<String> loginPaths = <String>{studentLogin, facultyLogin};
}
