/// PUP Santa Maria course (degree program) catalog.
///
/// 1:1 mirror of `shared/src/constants/pup-courses.ts` (a parity test pins
/// both). PUP Santa Maria has no academic departments: it has courses, each
/// with a head professor, so the catalog is a flat list and the course `code`
/// is the only scoping key. Codes are stored verbatim on `Section.course`;
/// names are display-only. The registrar's sign-off on the list is a release
/// gate (see `plan/course-scope-plan.md` §4.1).
class PupCourse {
  const PupCourse({
    required this.code,
    required this.name,
    this.aliases = const <String>[],
    this.department,
  });

  /// Short program code stored on the section, e.g. 'BSIT'.
  final String code;

  /// Full official program name for display.
  final String name;

  /// Alternate spellings that normalize to this code (matched ignoring case,
  /// spacing and punctuation).
  final List<String> aliases;

  /// Legacy grouping key from the pre-course draft catalog. Never set on the
  /// current entries.
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
  String toString() => 'PupCourse($code, $name)';
}

const List<PupCourse> pupSantaMariaCourses = [
  PupCourse(
    code: 'BSA',
    name: 'Bachelor of Science in Accountancy',
    aliases: ['BS Accountancy'],
  ),
  PupCourse(
    code: 'BSCpE',
    name: 'Bachelor of Science in Computer Engineering',
    aliases: ['BSCPE', 'BS Computer Engineering'],
  ),
  PupCourse(
    code: 'BSENTREP',
    name: 'Bachelor of Science in Entrepreneurship',
    aliases: ['BS Entrepreneurship', 'BSEntrep'],
  ),
  PupCourse(
    code: 'BSHM',
    name: 'Bachelor of Science in Hospitality Management',
    aliases: ['BS Hospitality Management'],
  ),
  PupCourse(
    code: 'BSIT',
    name: 'Bachelor of Science in Information Technology',
    aliases: ['BS Information Technology'],
  ),
  PupCourse(
    code: 'BSEDEN',
    name: 'Bachelor of Secondary Education major in English',
    aliases: ['BSED-EN', 'BSEd English', 'BSEd major in English'],
  ),
  PupCourse(
    code: 'BSEDMT',
    name: 'Bachelor of Secondary Education major in Mathematics',
    aliases: [
      'BSED-MT',
      'BSEd Math',
      'BSEd Mathematics',
      'BSEd major in Mathematics',
    ],
  ),
  PupCourse(
    code: 'DOMTLOM',
    name: 'Diploma in Office Management Technology – Legal Office Management',
    aliases: ['DOMT', 'DOMT-LOM', 'Diploma in Office Management Technology'],
  ),
];

/// Every catalog code, in catalog order.
List<String> pupCourseCodes() => [
  for (final course in pupSantaMariaCourses) course.code,
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

/// Result of [normalizeCourse]; unmatched input keeps its raw text.
class NormalizedCourse {
  const NormalizedCourse({this.code, required this.matched, required this.raw});

  final String? code;
  final bool matched;
  final String raw;
}

String _compact(String value) =>
    value.toLowerCase().replaceAll(RegExp(r'[^a-z0-9]+'), '');

Map<String, String>? _lookup;

Map<String, String> _buildLookup() {
  final map = <String, String>{};
  void add(String key, String code) {
    if (key.isEmpty) return;
    map.putIfAbsent(key, () => code);
  }

  for (final course in pupSantaMariaCourses) {
    add(_compact(course.code), course.code);
  }
  for (final course in pupSantaMariaCourses) {
    add(_compact(course.name), course.code);
  }
  for (final course in pupSantaMariaCourses) {
    for (final alias in course.aliases) {
      add(_compact(alias), course.code);
    }
  }
  return map;
}

/// Case-, spacing- and punctuation-insensitive match against the catalog's
/// codes, names and aliases (mirrors `normalizeCourse` in shared). Unknown
/// input is returned unmatched with the raw text intact; a bare legacy `BSEd`
/// stays unmatched because two majors exist.
NormalizedCourse normalizeCourse(String? input) {
  final raw = (input ?? '').trim();
  if (raw.isEmpty) return NormalizedCourse(matched: false, raw: raw);
  final code = (_lookup ??= _buildLookup())[_compact(raw)];
  return code == null
      ? NormalizedCourse(matched: false, raw: raw)
      : NormalizedCourse(code: code, matched: true, raw: raw);
}

/// Label of the single bucket returned by [pupCoursesByDepartment].
const String pupCoursesGroupLabel = 'PUP Santa Maria programs';

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

/// Legacy wrapper kept so the picker keeps compiling. The campus has no
/// departments, so this is always one bucket holding the whole catalog.
List<PupCourseGroup> pupCoursesByDepartment() => [
  PupCourseGroup(
    department: pupCoursesGroupLabel,
    courses: List<PupCourse>.unmodifiable(pupSantaMariaCourses),
  ),
];
