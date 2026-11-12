import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/dashboard.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';
import 'package:polycheck_mobile/src/features/admin/domain/admin_users.dart';

const teacher = User(
  id: 'teacher-1',
  fullName: 'Prof. Juan Dela Cruz',
  email: 'juan@pup.edu.ph',
  role: UserRole.teacher,
  department: 'CCIS',
  canResetStudentPasswords: true,
);

const student = User(
  id: 'student-1',
  fullName: 'Maria Santos',
  role: UserRole.student,
  studentId: '2024-00001-MN-0',
  program: 'BSIT',
  yearLevel: 2,
  department: 'CCIS',
);

void main() {
  group('user filter builders', () {
    test('builds role, query, status, and clamped pagination', () {
      final filters = buildUserFilters(
        UserRoleTab.student,
        const UserFilterState(
          q: '  maria  ',
          department: ' CCIS ',
          status: AdminUserStatusFilter.active,
        ),
        offset: 40,
        limit: 999,
      );
      expect(filters.role, AdminUserRoleFilter.student);
      expect(filters.q, 'maria');
      expect(filters.department, 'CCIS');
      expect(filters.status, AdminUserStatusFilter.active);
      expect(filters.limit, maxUserPageSize);
      expect(filters.offset, 40);
    });

    test('department pin wins over the typed department', () {
      final filters = buildUserFilters(
        UserRoleTab.teacher,
        const UserFilterState(department: 'COE'),
        departmentPin: 'CCIS',
      );
      expect(filters.department, 'CCIS');
    });

    test(
      'blank filters become absent query keys and negative offsets clamp',
      () {
        final filters = buildUserFilters(
          UserRoleTab.teacher,
          const UserFilterState(q: '   ', department: '  '),
          offset: -10,
        );
        expect(filters.q, isNull);
        expect(filters.department, isNull);
        expect(filters.offset, 0);
        expect(filters.limit, userPageSize);
      },
    );

    test('registrar tabs exclude protected super admins', () {
      expect(
        userRoleTabsFor(institutionAdmin: false, registrar: true),
        <UserRoleTab>[UserRoleTab.teacher, UserRoleTab.student],
      );
      expect(
        userRoleTabsFor(institutionAdmin: true, registrar: false),
        UserRoleTab.values,
      );
    });
  });

  group('profile edits', () {
    test('role-specific editable fields', () {
      expect(editableFieldsForRole(UserRole.teacher), <EditableUserField>[
        EditableUserField.fullName,
        EditableUserField.department,
        EditableUserField.email,
      ]);
      expect(editableFieldsForRole(UserRole.student), <EditableUserField>[
        EditableUserField.fullName,
        EditableUserField.department,
        EditableUserField.program,
        EditableUserField.yearLevel,
      ]);
      expect(editableFieldsForRole(UserRole.superAdmin), isEmpty);
    });

    test('validation covers department and year range', () {
      final values = editableValuesForUser(student)
        ..[EditableUserField.department] = ''
        ..[EditableUserField.yearLevel] = '9';
      expect(
        validateUserUpdate(student, values),
        'Department is required for student accounts.',
      );
      values[EditableUserField.department] = 'CCIS';
      expect(
        validateUserUpdate(student, values),
        'Year level must be between 1 and 8.',
      );
    });

    test(
      'payload omits unchanged fields and only clears changed overrides',
      () {
        final payload = buildUserUpdatePayload(
          teacher,
          editableValuesForUser(teacher),
          resetChoice: CapabilityChoice.inherit,
          unbindChoice: CapabilityChoice.inherit,
        );
        expect(payload, <String, dynamic>{'canResetStudentPasswords': null});

        final unchanged = buildUserUpdatePayload(
          teacher,
          editableValuesForUser(teacher),
          resetChoice: CapabilityChoice.allow,
        );
        expect(unchanged, isEmpty);

        final changed = buildUserUpdatePayload(
          student,
          editableValuesForUser(student)
            ..[EditableUserField.program] = 'BSIT'
            ..[EditableUserField.fullName] = 'Maria S. Santos',
        );
        expect(changed, <String, dynamic>{'fullName': 'Maria S. Santos'});
      },
    );

    test('designation writes only include changed flags', () {
      final payload = buildUserUpdatePayload(
        teacher,
        editableValuesForUser(teacher),
        isItCoordinator: true,
        isDepartmentHead: false,
        isUserRegistrar: false,
      );
      expect(payload, <String, dynamic>{'isItCoordinator': true});
    });
  });

  group('capability tri-state merge', () {
    test('maps nullable overrides to UI choices', () {
      expect(capabilityChoiceFrom(null), CapabilityChoice.inherit);
      expect(capabilityChoiceFrom(true), CapabilityChoice.allow);
      expect(capabilityChoiceFrom(false), CapabilityChoice.deny);
      expect(capabilityOverride(CapabilityChoice.inherit), isNull);
      expect(capabilityOverride(CapabilityChoice.allow), isTrue);
      expect(capabilityOverride(CapabilityChoice.deny), isFalse);
    });

    test('an override can restrict but never enable a disabled capability', () {
      expect(effectiveCapability(null, institutionDefault: true), isTrue);
      expect(effectiveCapability(false, institutionDefault: true), isFalse);
      expect(effectiveCapability(true, institutionDefault: false), isFalse);
    });
  });

  group('create validation and paging', () {
    test('student number and password policy', () {
      expect(studentIdPattern.hasMatch('2024-00001-MN-0'), isTrue);
      expect(studentIdPattern.hasMatch('2024-1-MN-0'), isFalse);
      expect(meetsPasswordPolicy('Pup@2026Secure!'), isTrue);
      expect(meetsPasswordPolicy('weakpassword'), isFalse);
    });

    test('create forms surface the first blocking problem', () {
      expect(
        validateCreateStudentForm(
          fullName: 'M',
          studentId: 'bad',
          email: '',
          program: '',
          yearLevel: '1',
          department: '',
        ),
        'Enter the full name.',
      );
      expect(
        validateCreateAdminForm(
          fullName: 'New Admin',
          email: 'admin@pup.edu.ph',
          department: 'CCIS',
          password: 'short',
        ),
        contains('12+ characters'),
      );
    });

    test('role change copy and paging helpers', () {
      expect(assignableRoleFor(teacher), AssignableRole.student);
      expect(assignableRoleFor(student), AssignableRole.teacher);
      expect(
        assignableRoleFor(
          const User(id: 'x', fullName: 'X', role: UserRole.superAdmin),
        ),
        isNull,
      );
      expect(
        roleChangeCopy(student, AssignableRole.teacher).title,
        'Change to Teacher',
      );
      expect(
        roleChangeRequiresDepartment(student, AssignableRole.teacher),
        isFalse,
      );

      const page = AdminUserPage(
        data: <User>[student],
        total: 41,
        limit: 20,
        offset: 20,
        hasMore: true,
      );
      expect(userPageCount(page), 3);
      expect(userPageNumber(page), 2);
      expect(userRangeLabel(page), '21–21 of 41');
    });
  });
}
