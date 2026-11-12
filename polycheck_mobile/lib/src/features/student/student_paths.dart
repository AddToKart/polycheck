/// Route paths owned by the student feature wave.
///
/// The identifiers in `/student/subjects/:id` are section ids, matching the
/// existing React Native `subject-info/[id]` route (which is also a section).
abstract final class StudentPaths {
  static const String base = '/student';
  static const String dashboard = '/student/dashboard';
  static const String schedule = '/student/schedule';
  static const String history = '/student/history';
  static const String scan = '/student/scan';

  static const String subjectPrefix = '/student/subjects';

  /// Full enrolled-class list (dashboard "View all N classes").
  static const String classList = subjectPrefix;

  static String subject(String sectionId) =>
      '$subjectPrefix/${Uri.encodeComponent(sectionId)}';

  static String createSession(String sectionId) =>
      '${subject(sectionId)}/create-session';

  static String subjectSession(String sectionId, String sessionId) =>
      '${subject(sectionId)}/sessions/${Uri.encodeComponent(sessionId)}';

  /// Shared authenticated surfaces owned by the surface wave.
  static const String profile = '/profile';
  static const String assistant = '/assistant';
  static const String notifications = '/notifications';
}
