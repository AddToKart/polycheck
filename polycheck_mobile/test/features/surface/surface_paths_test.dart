import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/features/surface/data/surface_paths.dart';

void main() {
  test('profile tab paths stay on the guard-admitted profile path', () {
    for (final tab in ProfileTab.values) {
      final path = SurfacePaths.profileTab(tab);
      expect(path, startsWith('/profile?tab='));
      expect(Uri.parse(path).path, '/profile');
      expect(SurfacePaths.parseTab(tab.wire), tab);
    }
  });

  test('unknown or missing tab parameters fall back to security', () {
    expect(SurfacePaths.parseTab(null), ProfileTab.security);
    expect(SurfacePaths.parseTab('nope'), ProfileTab.security);
    expect(SurfacePaths.parseTab('privacy'), ProfileTab.privacy);
  });

  test('contract alias paths are registered constants', () {
    expect(SurfacePaths.notificationsPage, '/notifications');
    expect(SurfacePaths.privacyPage, '/privacy');
    expect(SurfacePaths.profileReportsPage, '/profile/reports');
    expect(SurfacePaths.assistant, '/assistant');
  });
}
