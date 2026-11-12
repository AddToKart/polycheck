import '../models/api.dart';
import '../models/bulk_import.dart';
import '../models/section_role.dart';
import '../models/subject.dart';
import '../models/user.dart';
import 'api_base.dart';
import 'api_models.dart';

/// Sections, rosters, enrollment, section roles, and session permissions.
///
/// Paths and body keys mirror `android/services/api-client.ts`. Offline reads
/// stay out of this class (sync slice); callers write successful responses to
/// [AppDatabase] themselves.
class SectionsApi extends ApiBase {
  SectionsApi(super.dio);

  Future<List<Section>> getSections({String? subjectId}) async {
    final data = await getJson('/sections', query: {'subjectId': subjectId});
    return asList(data)
        .whereType<Map>()
        .map((item) => Section.fromJson(asMap(item)))
        .toList(growable: false);
  }

  Future<Section> getSection(String id) async {
    final data = await getJson('/sections/$id');
    return Section.fromJson(asMap(data));
  }

  Future<Section> createSection(CreateSectionInput input) async {
    final data = await postJson('/sections', body: input.toJson());
    return Section.fromJson(asMap(data));
  }

  Future<Section> updateSection(
    String id, {
    String? section,
    String? course,
    String? room,
    List<CreateSectionScheduleSlot>? schedule,
    String? semester,
  }) async {
    final data = await patchJson(
      '/sections/$id',
      body: <String, dynamic>{
        'section': ?section,
        'course': ?course,
        'room': ?room,
        if (schedule != null)
          'schedule': schedule.map((slot) => slot.toJson()).toList(),
        'semester': ?semester,
      },
    );
    return Section.fromJson(asMap(data));
  }

  Future<void> removeSection(String id) async {
    await deleteJson('/sections/$id');
  }

  /// Rows of `GET /sections/:id/students` (student plus per-section counts).
  Future<List<SectionStudent>> getSectionStudents(String sectionId) async {
    final data = await getJson('/sections/$sectionId/students');
    return asList(data)
        .whereType<Map>()
        .map((item) => SectionStudent.fromJson(asMap(item)))
        .toList(growable: false);
  }

  Future<List<User>> getStudentsForSection(String sectionId) async {
    final data = await getJson('/sections/$sectionId/students');
    return asList(data)
        .whereType<Map>()
        .map((item) => User.fromJson(asMap(item)))
        .toList(growable: false);
  }

  /// Role-scoped section list. The `studentId` argument is kept for call-site
  /// parity with Android; `/sections` scopes by the authenticated user.
  Future<List<Section>> getStudentSections(String studentId) async {
    final data = await getJson('/sections');
    return asList(data)
        .whereType<Map>()
        .map((item) => Section.fromJson(asMap(item)))
        .toList(growable: false);
  }

  Future<({String enrollmentCode})> resetEnrollmentCode(
    String sectionId,
  ) async {
    final data = await postJson('/sections/$sectionId/enrollment-code/reset');
    return (enrollmentCode: asMap(data)['enrollmentCode'] as String? ?? '');
  }

  Future<void> disableEnrollmentCode(String sectionId) async {
    await postJson('/sections/$sectionId/enrollment-code/disable');
  }

  Future<bool> removeStudentFromSection(
    String sectionId,
    String studentId,
  ) async {
    await deleteJson('/sections/$sectionId/students/$studentId');
    return true;
  }

  Future<bool> enrollStudent(EnrollStudentInput input) async {
    await postJson(
      '/sections/${input.sectionId}/enroll-student',
      body: <String, dynamic>{
        'studentId': input.studentId,
        'studentName': input.studentName,
      },
    );
    return true;
  }

  Future<Enrollment> enrollByCode(String enrollmentCode) async {
    final data = await postJson(
      '/sections/enroll-by-code',
      body: <String, dynamic>{'enrollmentCode': enrollmentCode},
    );
    return Enrollment.fromJson(asMap(data));
  }

  Future<Enrollment> enrollViaCode(String sectionId, String code) async {
    final data = await postJson(
      '/sections/$sectionId/enroll',
      body: <String, dynamic>{'enrollmentCode': code},
    );
    return Enrollment.fromJson(asMap(data));
  }

  Future<List<Enrollment>> getEnrollments({String? sectionId}) async {
    final data = await getJson(
      sectionId == null ? '/enrollments' : '/sections/$sectionId/enrollments',
    );
    return asList(data)
        .whereType<Map>()
        .map((item) => Enrollment.fromJson(asMap(item)))
        .toList(growable: false);
  }

  // ── Section roles ──

  Future<SectionRole> assignSectionRole(
    String sectionId,
    String studentId,
    SectionRoleType role,
  ) async {
    final data = await postJson(
      '/section-roles',
      body: <String, dynamic>{
        'sectionId': sectionId,
        'studentId': studentId,
        'role': role.wire,
      },
    );
    return SectionRole.fromJson(asMap(data));
  }

  Future<bool> removeSectionRole(
    String sectionId,
    String studentId,
    SectionRoleType role,
  ) async {
    await deleteJson('/section-roles/$sectionId/$studentId/${role.wire}');
    return true;
  }

  Future<List<SectionRole>> getSectionRoles(String sectionId) async {
    final data = await getJson('/section-roles/$sectionId');
    return asList(data)
        .whereType<Map>()
        .map((item) => SectionRole.fromJson(asMap(item)))
        .toList(growable: false);
  }

  Future<List<SectionRole>> getStudentRoles(String studentId) async {
    final data = await getJson('/section-roles/student/$studentId');
    return asList(data)
        .whereType<Map>()
        .map((item) => SectionRole.fromJson(asMap(item)))
        .toList(growable: false);
  }

  // ── Session permissions ──

  Future<SessionPermission> grantSessionPermission(
    String sectionId,
    String studentId,
  ) async {
    final data = await postJson(
      '/session-permissions',
      body: <String, dynamic>{'sectionId': sectionId, 'studentId': studentId},
    );
    return SessionPermission.fromJson(asMap(data));
  }

  Future<bool> revokeSessionPermission(
    String sectionId,
    String studentId,
  ) async {
    await deleteJson('/session-permissions/$sectionId/$studentId');
    return true;
  }

  Future<bool> checkSessionPermission(
    String sectionId,
    String studentId,
  ) async {
    final data = await getJson(
      '/session-permissions/check/$sectionId/$studentId',
    );
    return data == true;
  }

  Future<List<SessionPermission>> getActiveSessionPermissions(
    String sectionId,
  ) async {
    final data = await getJson('/session-permissions/$sectionId');
    return asList(data)
        .whereType<Map>()
        .map((item) => SessionPermission.fromJson(asMap(item)))
        .toList(growable: false);
  }

  // ── Enrollment import ──

  Future<EnrollImportResult> previewEnrollImport(
    String sectionId,
    List<EnrollImportRow> rows,
  ) async {
    final data = await postJson(
      '/sections/$sectionId/enrollments/import',
      body: <String, dynamic>{
        'mode': 'validate',
        'rows': rows.map((row) => row.toJson()).toList(),
      },
    );
    return EnrollImportResult.fromJson(asMap(data));
  }

  Future<EnrollImportResult> importSectionEnrollments(
    String sectionId,
    EnrollImportRequest request,
  ) async {
    final data = await postJson(
      '/sections/$sectionId/enrollments/import',
      body: request.toJson(),
      idempotencyKey: request.idempotencyKey,
    );
    return EnrollImportResult.fromJson(asMap(data));
  }
}
