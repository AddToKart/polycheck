import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/models/user.dart';
import 'package:polycheck_mobile/src/core/utils/designations.dart';

class FakePolyUser implements PolyUser {
  FakePolyUser(
    this.role, {
    this.department,
    this.isItCoordinator,
    this.isDepartmentHead,
    this.isUserRegistrar,
  });

  @override
  final UserRole role;

  @override
  final String? department;

  @override
  final bool? isItCoordinator;

  @override
  final bool? isDepartmentHead;

  @override
  final bool? isUserRegistrar;
}

void main() {
  final plainTeacher = FakePolyUser(UserRole.teacher, department: 'CCIS');

  test('students have no designations even if flags leak through', () {
    final student = FakePolyUser(
      UserRole.student,
      isItCoordinator: true,
      isDepartmentHead: true,
      isUserRegistrar: true,
    );
    expect(activeDesignations(student), isEmpty);
    expect(canAccessItOperations(student), isFalse);
    expect(canAccessAcademicOversight(student), isFalse);
    expect(canAccessUserAdmin(student), isFalse);
    expect(isMaintenanceExempt(student), isFalse);
  });

  test('returns no capabilities for null users and plain teachers', () {
    expect(activeDesignations(null), isEmpty);
    expect(hasDesignation(null, FacultyDesignation.itOperations), isFalse);
    expect(canAccessItOperations(plainTeacher), isFalse);
    expect(canAccessAcademicOversight(plainTeacher), isFalse);
    expect(canAccessUserAdmin(plainTeacher), isFalse);
    expect(isMaintenanceExempt(plainTeacher), isFalse);
    expect(oversightDepartment(plainTeacher), isNull);
  });

  test('grants every suite implicitly to super admins without flags', () {
    final superAdmin = FakePolyUser(UserRole.superAdmin);
    expect(activeDesignations(superAdmin), [
      FacultyDesignation.itOperations,
      FacultyDesignation.academicOversight,
      FacultyDesignation.userAdmin,
    ]);
    expect(canAccessItOperations(superAdmin), isTrue);
    expect(canAccessAcademicOversight(superAdmin), isTrue);
    expect(canAccessUserAdmin(superAdmin), isTrue);
    expect(isMaintenanceExempt(superAdmin), isTrue);
    expect(oversightDepartment(superAdmin), isNull);
  });

  test('grants only the IT suite to an IT coordinator', () {
    final coordinator = FakePolyUser(
      UserRole.teacher,
      isItCoordinator: true,
      department: 'CCIS',
    );
    expect(canAccessItOperations(coordinator), isTrue);
    expect(isMaintenanceExempt(coordinator), isTrue);
    expect(canAccessAcademicOversight(coordinator), isFalse);
    expect(canAccessUserAdmin(coordinator), isFalse);
    expect(activeDesignations(coordinator), [FacultyDesignation.itOperations]);
  });

  test('grants only academic oversight to a head, pinned to department', () {
    final head = FakePolyUser(
      UserRole.teacher,
      isDepartmentHead: true,
      department: '  CCIS  ',
    );
    expect(canAccessAcademicOversight(head), isTrue);
    expect(canAccessItOperations(head), isFalse);
    expect(canAccessUserAdmin(head), isFalse);
    expect(isMaintenanceExempt(head), isFalse);
    expect(oversightDepartment(head), 'CCIS');
    expect(activeDesignations(head), [FacultyDesignation.academicOversight]);
  });

  test('denies oversight to a department head without a department', () {
    final head = FakePolyUser(UserRole.teacher, isDepartmentHead: true);
    expect(canAccessAcademicOversight(head), isTrue);
    expect(oversightDepartment(head), isNull);
  });

  test('grants only user administration to a registrar', () {
    final registrar = FakePolyUser(
      UserRole.teacher,
      isUserRegistrar: true,
      department: 'Registrar',
    );
    expect(canAccessUserAdmin(registrar), isTrue);
    expect(canAccessItOperations(registrar), isFalse);
    expect(canAccessAcademicOversight(registrar), isFalse);
    expect(isMaintenanceExempt(registrar), isFalse);
    expect(activeDesignations(registrar), [FacultyDesignation.userAdmin]);
  });

  test('supports multiple concurrent designations in stable order', () {
    final dualHat = FakePolyUser(
      UserRole.teacher,
      isItCoordinator: true,
      isDepartmentHead: true,
      isUserRegistrar: true,
    );
    expect(activeDesignations(dualHat), [
      FacultyDesignation.itOperations,
      FacultyDesignation.academicOversight,
      FacultyDesignation.userAdmin,
    ]);
    expect(hasDesignation(dualHat, FacultyDesignation.userAdmin), isTrue);
  });
}
