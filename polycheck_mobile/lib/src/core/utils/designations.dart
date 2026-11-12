import '../models/user.dart';

/// Mirrors `shared/src/utils/designations.ts`.
///
/// PUP Santa Maria "dual-hat" model: teachers keep their classroom identity
/// and may additionally hold one or more administrative designations. Super
/// admins implicitly hold every suite, so the helpers always short-circuit on
/// `role == super_admin` without requiring flags on the account.
enum FacultyDesignation {
  itOperations('it_operations', 'isItCoordinator', 'IT Coordinator'),
  academicOversight(
    'academic_oversight',
    'isDepartmentHead',
    'Department Head',
  ),
  userAdmin('user_admin', 'isUserRegistrar', 'Registrar');

  const FacultyDesignation(this.wire, this.flag, this.label);

  final String wire;
  final String flag;
  final String label;
}

const List<FacultyDesignation> facultyDesignations = FacultyDesignation.values;

const Map<FacultyDesignation, String> designationDescriptions = {
  FacultyDesignation.itOperations:
      'Server status, issue triage, and maintenance controls.',
  FacultyDesignation.academicOversight:
      'Department-wide reports, excuses, and at-risk oversight.',
  FacultyDesignation.userAdmin:
      'Department-scoped account creation, resets, and roster imports.',
};

bool _teacherHasFlag(PolyUser? user, bool? Function(PolyUser) flag) {
  if (user == null) return false;
  if (user.role == UserRole.superAdmin) return true;
  return user.role == UserRole.teacher && flag(user) == true;
}

bool hasDesignation(PolyUser? user, FacultyDesignation designation) {
  switch (designation) {
    case FacultyDesignation.itOperations:
      return _teacherHasFlag(user, (u) => u.isItCoordinator);
    case FacultyDesignation.academicOversight:
      return _teacherHasFlag(user, (u) => u.isDepartmentHead);
    case FacultyDesignation.userAdmin:
      return _teacherHasFlag(user, (u) => u.isUserRegistrar);
  }
}

/// Every active designation, in stable declaration order (empty for
/// students and plain teachers).
List<FacultyDesignation> activeDesignations(PolyUser? user) => [
  for (final designation in facultyDesignations)
    if (hasDesignation(user, designation)) designation,
];

/// IT Operations Suite: server status, issue triage, maintenance controls.
bool canAccessItOperations(PolyUser? user) =>
    _teacherHasFlag(user, (u) => u.isItCoordinator);

/// Academic Department Oversight: reports, excuses, at-risk (department-scoped
/// server-side).
bool canAccessAcademicOversight(PolyUser? user) =>
    _teacherHasFlag(user, (u) => u.isDepartmentHead);

/// Registrar Suite: department-scoped account administration.
bool canAccessUserAdmin(PolyUser? user) =>
    _teacherHasFlag(user, (u) => u.isUserRegistrar);

/// Maintenance-mode exemption is deliberately limited to super admins and IT
/// coordinators.
bool isMaintenanceExempt(PolyUser? user) =>
    _teacherHasFlag(user, (u) => u.isItCoordinator);

/// The department an academic-oversight actor may inspect. Super admins are
/// not pinned, and a designated head without a department gets no oversight.
String? oversightDepartment(PolyUser? user) {
  if (user == null || user.role != UserRole.teacher) return null;
  if (user.isDepartmentHead != true) return null;
  final department = user.department?.trim();
  return department == null || department.isEmpty ? null : department;
}
