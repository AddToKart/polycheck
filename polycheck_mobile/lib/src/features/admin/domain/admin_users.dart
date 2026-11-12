import '../../../core/models/dashboard.dart';
import '../../../core/models/user.dart';

/// Mirrors `frontend/src/lib/admin-users.ts` plus the registrar department pin.
const int userPageSize = 20;
const int maxUserPageSize = 100;

enum UserRoleTab {
  teacher('teacher', 'Teachers'),
  student('student', 'Students'),
  superAdmin('super_admin', 'Super Admins');

  const UserRoleTab(this.wire, this.label);

  final String wire;
  final String label;

  AdminUserRoleFilter get roleFilter => switch (this) {
    UserRoleTab.teacher => AdminUserRoleFilter.teacher,
    UserRoleTab.student => AdminUserRoleFilter.student,
    UserRoleTab.superAdmin => AdminUserRoleFilter.superAdmin,
  };

  static UserRoleTab? tryParse(String? value) {
    for (final tab in values) {
      if (tab.wire == value) return tab;
    }
    return null;
  }
}

class UserFilterState {
  const UserFilterState({this.q = '', this.department = '', this.status});

  final String q;
  final String department;
  final AdminUserStatusFilter? status;

  UserFilterState copyWith({
    String? q,
    String? department,
    AdminUserStatusFilter? status,
    bool clearStatus = false,
  }) {
    return UserFilterState(
      q: q ?? this.q,
      department: department ?? this.department,
      status: clearStatus ? null : (status ?? this.status),
    );
  }
}

/// Role tabs a console actor may browse.
///
/// Registrars (department-pinned) never see the protected super-admin tab.
List<UserRoleTab> userRoleTabsFor({
  required bool institutionAdmin,
  required bool registrar,
}) {
  if (institutionAdmin) return UserRoleTab.values;
  return const <UserRoleTab>[UserRoleTab.teacher, UserRoleTab.student];
}

AdminUserFilters buildUserFilters(
  UserRoleTab tab,
  UserFilterState filters, {
  int offset = 0,
  int limit = userPageSize,
  String? departmentPin,
}) {
  final cappedLimit = limit.clamp(1, maxUserPageSize);
  final query = filters.q.trim();
  final pinned = departmentPin?.trim() ?? '';
  final department = pinned.isNotEmpty ? pinned : filters.department.trim();
  return AdminUserFilters(
    role: tab.roleFilter,
    q: query.isEmpty ? null : query,
    department: department.isEmpty ? null : department,
    status: filters.status,
    limit: cappedLimit,
    offset: offset < 0 ? 0 : offset,
  );
}

// ── Editable profile fields ──

enum EditableUserField {
  fullName('fullName'),
  department('department'),
  email('email'),
  program('program'),
  yearLevel('yearLevel');

  const EditableUserField(this.wire);

  final String wire;
}

List<EditableUserField> editableFieldsForRole(UserRole role) {
  if (role == UserRole.teacher) {
    return const <EditableUserField>[
      EditableUserField.fullName,
      EditableUserField.department,
      EditableUserField.email,
    ];
  }
  if (role == UserRole.student) {
    return const <EditableUserField>[
      EditableUserField.fullName,
      EditableUserField.department,
      EditableUserField.program,
      EditableUserField.yearLevel,
    ];
  }
  return const <EditableUserField>[];
}

Map<EditableUserField, String> editableValuesForUser(User user) {
  return <EditableUserField, String>{
    EditableUserField.fullName: user.fullName,
    EditableUserField.department: user.department ?? '',
    EditableUserField.email: user.email ?? '',
    EditableUserField.program: user.program ?? '',
    EditableUserField.yearLevel: user.yearLevel == null
        ? ''
        : '${user.yearLevel}',
  };
}

bool canManageUser(User target) => target.role != UserRole.superAdmin;

AssignableRole? assignableRoleFor(User target) {
  if (target.role == UserRole.teacher) return AssignableRole.student;
  if (target.role == UserRole.student) return AssignableRole.teacher;
  return null;
}

bool roleChangeRequiresDepartment(User target, AssignableRole nextRole) =>
    nextRole == AssignableRole.teacher &&
    (target.department == null || target.department!.trim().isEmpty);

class RoleChangeCopy {
  const RoleChangeCopy({
    required this.title,
    required this.consequence,
    required this.confirmLabel,
  });

  final String title;
  final String consequence;
  final String confirmLabel;
}

RoleChangeCopy roleChangeCopy(User target, AssignableRole nextRole) {
  if (nextRole == AssignableRole.student) {
    return RoleChangeCopy(
      title: 'Change to Student',
      consequence:
          '${target.fullName} will lose teaching access. The change is blocked '
          'while this teacher still has sections assigned, so reassign or '
          'remove those sections first.',
      confirmLabel: 'Change to Student',
    );
  }
  return RoleChangeCopy(
    title: 'Change to Teacher',
    consequence:
        '${target.fullName} will gain teaching access and keep their '
        'enrollment history. A department is required before this student can '
        'become a teacher.',
    confirmLabel: 'Change to Teacher',
  );
}

String? validateUserUpdate(User target, Map<EditableUserField, String> values) {
  final fields = editableFieldsForRole(target.role).toSet();
  if (fields.isEmpty) {
    return 'This account type cannot be edited from the console.';
  }
  if (fields.contains(EditableUserField.fullName) &&
      (values[EditableUserField.fullName] ?? '').trim().length < 2) {
    return 'Full name must be at least 2 characters.';
  }
  if (fields.contains(EditableUserField.department) &&
      target.role == UserRole.student &&
      (values[EditableUserField.department] ?? '').trim().length < 2) {
    return 'Department is required for student accounts.';
  }
  if (fields.contains(EditableUserField.email) &&
      !_emailPattern.hasMatch((values[EditableUserField.email] ?? '').trim())) {
    return 'Enter a valid PUP email address.';
  }
  if (fields.contains(EditableUserField.program) &&
      (values[EditableUserField.program] ?? '').trim().length < 2) {
    return 'Program must be at least 2 characters.';
  }
  if (fields.contains(EditableUserField.yearLevel)) {
    final year = int.tryParse(
      (values[EditableUserField.yearLevel] ?? '').trim(),
    );
    if (year == null || year < 1 || year > 8) {
      return 'Year level must be between 1 and 8.';
    }
  }
  return null;
}

/// Builds a partial `PATCH /users/:id` body.
///
/// Omitted fields must stay absent (not explicit `null`): the backend treats
/// `!== undefined` as "provided". Only a cleared capability override is sent
/// as an explicit `null`, matching the web console.
Map<String, dynamic> buildUserUpdatePayload(
  User target,
  Map<EditableUserField, String> values, {
  CapabilityChoice? resetChoice,
  CapabilityChoice? unbindChoice,
  bool? isItCoordinator,
  bool? isDepartmentHead,
  bool? isUserRegistrar,
}) {
  final fields = editableFieldsForRole(target.role).toSet();
  final payload = <String, dynamic>{};
  final fullName = (values[EditableUserField.fullName] ?? '').trim();
  final department = (values[EditableUserField.department] ?? '').trim();
  final email = (values[EditableUserField.email] ?? '').trim();
  final program = (values[EditableUserField.program] ?? '').trim();
  final yearLevel = int.tryParse(
    (values[EditableUserField.yearLevel] ?? '').trim(),
  );

  if (fields.contains(EditableUserField.fullName) &&
      fullName.isNotEmpty &&
      fullName != target.fullName) {
    payload['fullName'] = fullName;
  }
  if (fields.contains(EditableUserField.department) &&
      department.isNotEmpty &&
      department != (target.department ?? '')) {
    payload['department'] = department;
  }
  if (fields.contains(EditableUserField.email) &&
      email.isNotEmpty &&
      email != (target.email ?? '')) {
    payload['email'] = email;
  }
  if (fields.contains(EditableUserField.program) &&
      program.isNotEmpty &&
      program != (target.program ?? '')) {
    payload['program'] = program;
  }
  if (fields.contains(EditableUserField.yearLevel) &&
      yearLevel != null &&
      yearLevel >= 1 &&
      yearLevel <= 8 &&
      yearLevel != target.yearLevel) {
    payload['yearLevel'] = yearLevel;
  }

  if (target.role == UserRole.teacher) {
    if (resetChoice != null) {
      final next = capabilityOverride(resetChoice);
      if (next != target.canResetStudentPasswords) {
        payload['canResetStudentPasswords'] = next;
      }
    }
    if (unbindChoice != null) {
      final next = capabilityOverride(unbindChoice);
      if (next != target.canEmergencyUnbindDevices) {
        payload['canEmergencyUnbindDevices'] = next;
      }
    }
    if (isItCoordinator != null && isItCoordinator != target.isItCoordinator) {
      payload['isItCoordinator'] = isItCoordinator;
    }
    if (isDepartmentHead != null &&
        isDepartmentHead != target.isDepartmentHead) {
      payload['isDepartmentHead'] = isDepartmentHead;
    }
    if (isUserRegistrar != null && isUserRegistrar != target.isUserRegistrar) {
      payload['isUserRegistrar'] = isUserRegistrar;
    }
  }

  return payload;
}

bool hasUserChanges(Map<String, dynamic> payload) => payload.isNotEmpty;

// ── Capability tri-state ──

enum CapabilityChoice {
  inherit('Default'),
  allow('Allow'),
  deny('Deny');

  const CapabilityChoice(this.label);

  final String label;
}

CapabilityChoice capabilityChoiceFrom(bool? value) {
  if (value == null) return CapabilityChoice.inherit;
  return value ? CapabilityChoice.allow : CapabilityChoice.deny;
}

bool? capabilityOverride(CapabilityChoice choice) {
  return switch (choice) {
    CapabilityChoice.inherit => null,
    CapabilityChoice.allow => true,
    CapabilityChoice.deny => false,
  };
}

/// A per-teacher override can restrict a capability but never enable one the
/// institution has switched off.
bool effectiveCapability(bool? override, {required bool institutionDefault}) {
  if (!institutionDefault) return false;
  return override != false;
}

// ── Create-form validation ──

final RegExp _emailPattern = RegExp(r'^[^\s@]+@[^\s@]+\.[^\s@]+$');
final RegExp studentIdPattern = RegExp(r'^\d{4}-\d{5}-[A-Z]{2}-\d$');

bool meetsPasswordPolicy(String password) {
  return password.length >= 12 &&
      RegExp(r'[a-z]').hasMatch(password) &&
      RegExp(r'[A-Z]').hasMatch(password) &&
      RegExp(r'\d').hasMatch(password) &&
      RegExp(r'[^A-Za-z0-9]').hasMatch(password);
}

String? validateCreateTeacherForm({
  required String fullName,
  required String email,
}) {
  if (fullName.trim().length < 2) return 'Enter the full name.';
  if (!_emailPattern.hasMatch(email.trim())) return 'Enter a valid PUP email.';
  return null;
}

String? validateCreateStudentForm({
  required String fullName,
  required String studentId,
  required String email,
  required String program,
  required String yearLevel,
  required String department,
}) {
  if (fullName.trim().length < 2) return 'Enter the full name.';
  if (!studentIdPattern.hasMatch(studentId.trim().toUpperCase())) {
    return 'Student number must look like 2024-00001-MN-0.';
  }
  final trimmedEmail = email.trim();
  if (trimmedEmail.isNotEmpty && !_emailPattern.hasMatch(trimmedEmail)) {
    return 'Enter a valid PUP email or leave it blank.';
  }
  if (program.trim().length < 2) return 'Enter the program.';
  final year = int.tryParse(yearLevel.trim());
  if (year == null || year < 1 || year > 8) {
    return 'Year level must be between 1 and 8.';
  }
  if (department.trim().length < 2) return 'Enter the department.';
  return null;
}

String? validateCreateAdminForm({
  required String fullName,
  required String email,
  required String department,
  required String password,
}) {
  if (fullName.trim().length < 2) return 'Enter the full name.';
  if (!_emailPattern.hasMatch(email.trim())) return 'Enter a valid PUP email.';
  if (department.trim().length < 2) return 'Enter the department.';
  if (!meetsPasswordPolicy(password)) {
    return 'Password must be 12+ characters with uppercase, lowercase, a '
        'number, and a symbol.';
  }
  return null;
}

// ── Paging + labels ──

int userPageCount(AdminUserPage page) =>
    page.limit > 0 ? (page.total / page.limit).ceil() : 0;

int userPageNumber(AdminUserPage page) =>
    page.limit > 0 ? (page.offset ~/ page.limit) + 1 : 1;

String userRangeLabel(AdminUserPage page) {
  if (page.total == 0) return '0 accounts';
  final first = page.offset + 1;
  final last = page.offset + page.data.length < page.total
      ? page.offset + page.data.length
      : page.total;
  return '$first–$last of ${page.total}';
}

String userRoleLabel(UserRole role) {
  return switch (role) {
    UserRole.superAdmin => 'Super Admin',
    UserRole.teacher => 'Teacher',
    UserRole.student => 'Student',
  };
}

String accountInitials(String fullName) {
  final parts = fullName
      .trim()
      .split(RegExp(r'\s+'))
      .where((part) => part.isNotEmpty)
      .toList(growable: false);
  if (parts.isEmpty) return '?';
  if (parts.length == 1) return parts.first.characters1();
  return '${parts.first.characters1()}${parts.last.characters1()}';
}

extension on String {
  String characters1() => isEmpty ? '' : substring(0, 1).toUpperCase();
}
