import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';
import 'package:polycheck_mobile/src/features/admin/domain/admin_access.dart';
import 'package:polycheck_mobile/src/features/admin/domain/admin_settings.dart';

const superAdmin = User(
  id: 'admin-1',
  fullName: 'Campus Director',
  role: UserRole.superAdmin,
  scope: 'institution',
);

const departmentAdmin = User(
  id: 'admin-2',
  fullName: 'Department Director',
  role: UserRole.superAdmin,
  scope: 'department',
  department: 'CCIS',
);

const itCoordinator = User(
  id: 'teacher-it',
  fullName: 'IT Coordinator',
  role: UserRole.teacher,
  department: 'CCIS',
  isItCoordinator: true,
);

const registrar = User(
  id: 'teacher-reg',
  fullName: 'Registrar',
  role: UserRole.teacher,
  department: 'CCIS',
  isUserRegistrar: true,
);

const departmentHead = User(
  id: 'teacher-head',
  fullName: 'Department Head',
  role: UserRole.teacher,
  department: 'CCIS',
  isDepartmentHead: true,
);

const plainTeacher = User(
  id: 'teacher',
  fullName: 'Plain Teacher',
  role: UserRole.teacher,
  department: 'CCIS',
);

const student = User(
  id: 'student',
  fullName: 'Student',
  role: UserRole.student,
  studentId: '2024-00001-MN-0',
);

void main() {
  group('designation visibility matrix', () {
    test('super admin implicitly holds every console and tab', () {
      final access = adminAccessFor(superAdmin);
      expect(access.sections, containsAll(AdminSection.values));
      expect(access.settingsTabs, containsAll(SettingsTab.values));
      expect(access.canManageDesignations, isTrue);
      expect(access.canEditInstitutionSettings, isTrue);
      expect(access.canWriteMaintenance, isTrue);
      expect(access.isDepartmentPinned, isFalse);
    });

    test(
      'department-scope super admin is pinned and read-only for settings',
      () {
        final access = adminAccessFor(departmentAdmin);
        expect(access.canOpen(AdminSection.users), isTrue);
        expect(access.canEditInstitutionSettings, isFalse);
        expect(access.canWriteMaintenance, isFalse);
        expect(access.isDepartmentPinned, isTrue);
        expect(access.departmentPin, 'CCIS');
        expect(access.settingsReadOnly, isTrue);
      },
    );

    test('IT coordinator gets status, triage, and the System/Privacy tabs', () {
      final access = adminAccessFor(itCoordinator);
      expect(access.sections, <AdminSection>{
        AdminSection.serverStatus,
        AdminSection.systemReports,
        AdminSection.settings,
      });
      expect(access.settingsTabs, <SettingsTab>{
        SettingsTab.system,
        SettingsTab.privacy,
      });
      expect(access.canEditInstitutionSettings, isFalse);
      expect(access.canWriteMaintenance, isTrue);
      expect(access.canWriteSettingsTab(SettingsTab.system), isTrue);
      expect(access.canWriteSettingsTab(SettingsTab.institution), isFalse);
      expect(access.canManageDesignations, isFalse);
    });

    test('registrar gets the department-pinned user console only', () {
      final access = adminAccessFor(registrar);
      expect(access.sections, <AdminSection>{AdminSection.users});
      expect(access.isDepartmentPinned, isTrue);
      expect(access.departmentPin, 'CCIS');
      expect(access.canManageDesignations, isFalse);
      expect(access.canOpen(AdminSection.settings), isFalse);
    });

    test('dual-hat teachers receive the union of their suites', () {
      final both = itCoordinator.copyWith(isUserRegistrar: true);
      final access = adminAccessFor(both);
      expect(access.canOpen(AdminSection.serverStatus), isTrue);
      expect(access.canOpen(AdminSection.users), isTrue);
      expect(access.isDepartmentPinned, isTrue);
    });

    test(
      'department heads, plain teachers, and students get no admin console',
      () {
        expect(adminAccessFor(departmentHead).isEmpty, isTrue);
        expect(adminAccessFor(plainTeacher).isEmpty, isTrue);
        expect(adminAccessFor(student).isEmpty, isTrue);
        expect(adminAccessFor(null).isEmpty, isTrue);
      },
    );
  });

  group('landing routes', () {
    test('routes each designation to its first console', () {
      expect(adminLandingRoute(superAdmin), AdminSection.dashboard.route);
      expect(adminLandingRoute(itCoordinator), AdminSection.serverStatus.route);
      expect(adminLandingRoute(registrar), AdminSection.users.route);
      expect(adminLandingRoute(departmentHead), '/faculty/dashboard');
      expect(adminLandingRoute(student), '/student/dashboard');
    });

    test('settings tabs stay in declaration order', () {
      expect(adminSettingsTabsFor(superAdmin), SettingsTab.values);
      expect(adminSettingsTabsFor(itCoordinator), <SettingsTab>[
        SettingsTab.system,
        SettingsTab.privacy,
      ]);
    });
  });
}
