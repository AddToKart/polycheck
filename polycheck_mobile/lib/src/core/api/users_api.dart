import '../models/api.dart';
import '../models/bulk_import.dart';
import '../models/dashboard.dart';
import '../models/user.dart';
import 'api_base.dart';
import 'api_models.dart';

/// Account directory, administration, governance, and bulk student import.
class UsersApi extends ApiBase {
  UsersApi(super.dio);

  Future<List<User>> getStudents() async {
    final data = await getJson('/users/students');
    return asList(data)
        .whereType<Map>()
        .map((item) => User.fromJson(asMap(item)))
        .toList(growable: false);
  }

  Future<User> getStudent(String id) async {
    final data = await getJson('/users/$id');
    return User.fromJson(asMap(data));
  }

  Future<List<User>> getTeachers() async {
    final data = await getJson('/users/teachers');
    return asList(data)
        .whereType<Map>()
        .map((item) => User.fromJson(asMap(item)))
        .toList(growable: false);
  }

  Future<AdminUserPage> getUsers([
    AdminUserFilters filters = const AdminUserFilters(),
  ]) async {
    final data = await getJson(
      '/users',
      query: <String, dynamic>{
        'role': filters.role?.wire,
        'q': filters.q,
        'department': filters.department,
        'status': filters.status?.wire,
        'limit': filters.limit,
        'offset': filters.offset,
      },
    );
    return AdminUserPage.fromJson(asMap(data));
  }

  Future<User> updateUser(String id, UpdateUserInput input) async {
    // Null is meaningful here: clearing a teacher governance override sends
    // `null` (mirrors the web console), so do not strip it.
    final data = await patchJson(
      '/users/$id',
      body: input.toJson(),
      dropNulls: false,
    );
    return User.fromJson(asMap(data));
  }

  Future<User> changeUserRole(String id, AssignableRole role) async {
    final data = await patchJson(
      '/users/$id/role',
      body: <String, dynamic>{'role': role.wire},
    );
    return User.fromJson(asMap(data));
  }

  Future<User> createAdmin(CreateAdminInput input) async {
    final data = await postJson('/users/admins', body: input.toJson());
    return User.fromJson(asMap(data));
  }

  Future<CreateTeacherResult> createTeacher(CreateTeacherInput input) async {
    final data = await postJson('/users/teachers', body: input.toJson());
    return CreateTeacherResult.fromJson(asMap(data));
  }

  Future<CreateStudentResult> createStudent(CreateStudentInput input) async {
    final data = await postJson('/users/students', body: input.toJson());
    return CreateStudentResult.fromJson(asMap(data));
  }

  Future<ResetUserPasswordResult> resetUserPassword(
    String id, {
    String? password,
  }) async {
    final data = await patchJson(
      '/users/$id/password',
      body: password == null
          ? const <String, dynamic>{}
          : <String, dynamic>{'password': password},
    );
    return ResetUserPasswordResult.fromJson(asMap(data));
  }

  Future<User> setUserStatus(String id, bool isActive) async {
    final data = await patchJson(
      '/users/$id/status',
      body: <String, dynamic>{'isActive': isActive},
    );
    return User.fromJson(asMap(data));
  }

  Future<TeacherResetStudentPasswordResult> teacherResetStudentPassword(
    String studentId,
    String sectionId,
  ) async {
    final data = await postJson(
      '/users/students/$studentId/teacher-reset-password',
      body: <String, dynamic>{'sectionId': sectionId},
    );
    return TeacherResetStudentPasswordResult.fromJson(asMap(data));
  }

  Future<EmergencyDeviceReleaseResult> emergencyReleaseDevice(
    String studentId,
    EmergencyDeviceReleaseInput input,
  ) async {
    final data = await postJson(
      '/users/students/$studentId/device-release',
      body: input.toJson(),
    );
    return EmergencyDeviceReleaseResult.fromJson(asMap(data));
  }

  Future<UnregisterDeviceResult> unregisterDevice(String deviceId) async {
    final data = await postJson(
      '/users/me/device/unregister',
      body: <String, dynamic>{'deviceId': deviceId},
    );
    return UnregisterDeviceResult.fromJson(asMap(data));
  }

  Future<User> updateContacts(UpdateContactsInput input) async {
    final data = await patchJson('/users/me/contacts', body: input.toJson());
    return User.fromJson(asMap(data));
  }

  Future<StudentImportResult> importStudents(
    StudentImportRequest request,
  ) async {
    final data = await postJson(
      '/users/students/import',
      body: request.toJson(),
      idempotencyKey: request.idempotencyKey,
    );
    return StudentImportResult.fromJson(asMap(data));
  }

  Future<ImportJobStatus> getStudentImportJob(String jobId) async {
    final data = await getJson(
      '/users/students/import/jobs/${Uri.encodeComponent(jobId)}',
    );
    return ImportJobStatus.fromJson(asMap(data));
  }
}
