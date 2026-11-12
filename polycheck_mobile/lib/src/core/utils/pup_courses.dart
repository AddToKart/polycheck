/// PUP Santa Maria course (degree program) catalog.
///
/// 1:1 copy of `shared/src/constants/pup-courses.ts`. Codes are stored
/// verbatim on `Section.course`; names are display-only. DRAFT: confirm with
/// the registrar before release — teachers can still enter an off-catalog
/// course through the form's "Other — specify manually" option.
class PupCourse {
  const PupCourse({required this.code, required this.name, this.department});

  /// Short program code stored on the section, e.g. 'BSIT'.
  final String code;

  /// Full program name for display.
  final String name;

  /// Optional grouping key used by the selector (department/college).
  final String? department;

  @override
  bool operator ==(Object other) =>
      other is PupCourse &&
      other.code == code &&
      other.name == name &&
      other.department == department;

  @override
  int get hashCode => Object.hash(code, name, department);

  @override
  String toString() => 'PupCourse($code, $name, department: $department)';
}

const List<PupCourse> pupSantaMariaCourses = [
  // College of Computer and Information Sciences (CCIS)
  PupCourse(
    code: 'BSIT',
    name: 'BS Information Technology',
    department: 'CCIS',
  ),
  PupCourse(code: 'BSCS', name: 'BS Computer Science', department: 'CCIS'),
  PupCourse(code: 'BSIS', name: 'BS Information Systems', department: 'CCIS'),
  // Business / Accountancy
  PupCourse(code: 'BSA', name: 'BS Accountancy', department: 'Business'),
  PupCourse(
    code: 'BSMA',
    name: 'BS Management Accounting',
    department: 'Business',
  ),
  PupCourse(
    code: 'BSAIS',
    name: 'BS Accounting Information Systems',
    department: 'Business',
  ),
  PupCourse(
    code: 'BSBA',
    name: 'BS Business Administration',
    department: 'Business',
  ),
  PupCourse(
    code: 'BSHM',
    name: 'BS Hospitality Management',
    department: 'Business',
  ),
  PupCourse(
    code: 'BSTM',
    name: 'BS Tourism Management',
    department: 'Business',
  ),
  // Engineering
  PupCourse(
    code: 'BSCE',
    name: 'BS Civil Engineering',
    department: 'Engineering',
  ),
  PupCourse(
    code: 'BSECE',
    name: 'BS Electronics Engineering',
    department: 'Engineering',
  ),
  PupCourse(
    code: 'BSME',
    name: 'BS Mechanical Engineering',
    department: 'Engineering',
  ),
  PupCourse(
    code: 'BSEE',
    name: 'BS Electrical Engineering',
    department: 'Engineering',
  ),
  PupCourse(
    code: 'BSIE',
    name: 'BS Industrial Engineering',
    department: 'Engineering',
  ),
  // Teacher Education
  PupCourse(
    code: 'BEEd',
    name: 'Bachelor of Elementary Education',
    department: 'Education',
  ),
  PupCourse(
    code: 'BSEd',
    name: 'Bachelor of Secondary Education',
    department: 'Education',
  ),
  PupCourse(
    code: 'BTVTE',
    name: 'Bachelor of Technical-Vocational Teacher Education',
    department: 'Education',
  ),
  // Industrial Technology
  PupCourse(
    code: 'BIT',
    name: 'Bachelor of Industrial Technology',
    department: 'Industrial Technology',
  ),
];

/// Case-insensitive catalog lookup by program code.
PupCourse? pupCourseByCode(String? code) {
  final needle = code?.trim().toLowerCase();
  if (needle == null || needle.isEmpty) return null;
  for (final course in pupSantaMariaCourses) {
    if (course.code.toLowerCase() == needle) return course;
  }
  return null;
}

/// Display name for a stored course code, falling back to the raw code.
String pupCourseName(String? code) {
  final trimmed = code?.trim();
  if (trimmed == null || trimmed.isEmpty) return '';
  return pupCourseByCode(trimmed)?.name ?? trimmed;
}

class PupCourseGroup {
  const PupCourseGroup({required this.department, required this.courses});

  final String department;
  final List<PupCourse> courses;

  @override
  bool operator ==(Object other) =>
      other is PupCourseGroup &&
      other.department == department &&
      _listEquals(other.courses, courses);

  @override
  int get hashCode => Object.hash(department, Object.hashAll(courses));
}

bool _listEquals<T>(List<T> a, List<T> b) {
  if (a.length != b.length) return false;
  for (var index = 0; index < a.length; index++) {
    if (a[index] != b[index]) return false;
  }
  return true;
}

/// Catalog entries grouped by department, preserving list order.
List<PupCourseGroup> pupCoursesByDepartment() {
  final groups = <String, List<PupCourse>>{};
  for (final course in pupSantaMariaCourses) {
    final key = course.department ?? 'Other';
    groups.putIfAbsent(key, () => <PupCourse>[]).add(course);
  }
  return [
    for (final entry in groups.entries)
      PupCourseGroup(
        department: entry.key,
        courses: List<PupCourse>.unmodifiable(entry.value),
      ),
  ];
}
