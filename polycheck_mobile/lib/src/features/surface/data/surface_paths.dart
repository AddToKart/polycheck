/// Canonical routes for the shared authenticated surface.
///
/// `/profile?tab=...` is the canonical profile shape. The standalone
/// `/notifications`, `/privacy`, and `/profile/reports` aliases are admitted
/// for every authenticated role through `AppRoutes.sharedPaths`.
abstract final class SurfacePaths {
  static const String assistant = '/assistant';
  static const String profile = '/profile';

  static const String security = '/profile?tab=security';
  static const String contacts = '/profile?tab=contacts';
  static const String device = '/profile?tab=device';
  static const String reports = '/profile?tab=reports';
  static const String notifications = '/profile?tab=notifications';
  static const String privacy = '/profile?tab=privacy';

  /// Standalone page paths requested by the shared-surface contract.
  ///
  /// Registered in `surfaceRoutes` and admitted by the guard for every
  /// authenticated role; in-app navigation still prefers the `?tab=` shapes.
  static const String notificationsPage = '/notifications';
  static const String privacyPage = '/privacy';
  static const String profileReportsPage = '/profile/reports';

  /// Dev-only outage simulator section (rendered when the build flag is on).
  static const String developer = '/profile?tab=dev';

  static const String adminSettings = '/admin/settings';

  static String profileTab(ProfileTab tab) => '/profile?tab=${tab.wire}';

  static ProfileTab parseTab(String? raw) {
    if (raw == null) return ProfileTab.security;
    for (final tab in ProfileTab.values) {
      if (tab.wire == raw) return tab;
    }
    return ProfileTab.security;
  }
}

enum ProfileTab {
  security('security', 'Password & security'),
  contacts('contacts', 'Contact information'),
  device('device', 'Device & anti-cheat'),
  reports('reports', 'My reports'),
  notifications('notifications', 'Notifications'),
  privacy('privacy', 'Privacy (RA 10173)'),
  dev('dev', 'Developer tools');

  const ProfileTab(this.wire, this.label);

  final String wire;
  final String label;
}
