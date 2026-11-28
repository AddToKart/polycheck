import '../models/api.dart';
import '../models/subject.dart';
import '../models/subject_lifecycle.dart';
import 'api_base.dart';

/// Parent-subject CRUD (`backend/src/subjects/subjects.controller.ts`).
class SubjectsApi extends ApiBase {
  SubjectsApi(super.dio);

  Future<List<Subject>> getSubjects() async {
    final data = await getJson('/subjects');
    return asList(data)
        .whereType<Map>()
        .map((item) => Subject.fromJson(asMap(item)))
        .toList(growable: false);
  }

  Future<List<Subject>> getArchivedSubjects() async {
    final data = await getJson('/subjects', query: {'archived': 'true'});
    return asList(data)
        .whereType<Map>()
        .map((item) => Subject.fromJson(asMap(item)))
        // An older server ignores the filter and returns the current subjects.
        .where((subject) => subject.archivedAt != null)
        .toList(growable: false);
  }

  Future<SubjectLifecycle> getLifecycle(String id) async {
    final data = await getJson('/subjects/$id/lifecycle');
    return SubjectLifecycle.fromJson(asMap(data));
  }

  Future<SubjectLifecycle> archive(String id) async {
    final data = await postJson('/subjects/$id/archive');
    return SubjectLifecycle.fromJson(asMap(data));
  }

  /// Cancels the pending erasure and brings the subject back.
  Future<SubjectLifecycle> restore(String id) async {
    final data = await postJson('/subjects/$id/restore');
    return SubjectLifecycle.fromJson(asMap(data));
  }

  /// Deletes an archived subject and all its records. [confirmCode] is its code.
  Future<void> deletePermanently(String id, String confirmCode) async {
    await postJson(
      '/subjects/$id/delete-permanently',
      body: <String, dynamic>{'confirmCode': confirmCode},
    );
  }

  Future<Subject> getSubject(String id) async {
    final data = await getJson('/subjects/$id');
    return Subject.fromJson(asMap(data));
  }

  Future<Subject> createSubject(CreateSubjectInput input) async {
    final data = await postJson('/subjects', body: input.toJson());
    return Subject.fromJson(asMap(data));
  }

  Future<Subject> updateSubject(
    String id, {
    String? name,
    String? code,
    String? description,
  }) async {
    final data = await patchJson(
      '/subjects/$id',
      body: <String, dynamic>{
        'name': ?name,
        'code': ?code,
        'description': ?description,
      },
    );
    return Subject.fromJson(asMap(data));
  }

  Future<void> removeSubject(String id) async {
    await deleteJson('/subjects/$id');
  }
}
