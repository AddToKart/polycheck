import '../models/api.dart';
import '../models/subject.dart';
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
