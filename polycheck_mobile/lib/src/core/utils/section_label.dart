/// Mirrors `shared/src/utils/section-label.ts`.
///
/// Two sections can carry the same subject while belonging to different
/// courses, so the course must always be visible when known. Legacy sections
/// without a course render unchanged.
String formatSectionHeading({required String section, String? course}) {
  final trimmed = course?.trim();
  return trimmed != null && trimmed.isNotEmpty
      ? 'Section $section \u00B7 $trimmed'
      : 'Section $section';
}

/// Course label for chips/badges; empty string when the section has no course.
String sectionCourseLabel(String? course) => course?.trim() ?? '';
