import 'dart:typed_data';

import '../models/section_role.dart';
import 'api_base.dart';

/// Proof-of-class uploads (`backend/src/proofs/proofs.controller.ts`).
///
/// Identity fields are stamped server-side, exactly like the Android client
/// strips `uploadedBy`/`uploadedByStudentName` before POSTing.
class ProofsApi extends ApiBase {
  ProofsApi(super.dio);

  Future<ProofOfClass> uploadProofOfClass({
    required String sectionId,
    required String sessionId,
    required String photoData,
    String? description,
  }) async {
    final data = await postJson(
      '/proofs',
      body: <String, dynamic>{
        'sectionId': sectionId,
        'sessionId': sessionId,
        'photoData': photoData,
        'description': ?description,
      },
    );
    return ProofOfClass.fromJson(asMap(data));
  }

  Future<List<ProofOfClass>> getProofsOfClass(String sessionId) async {
    final data = await getJson('/proofs/$sessionId');
    return asList(data)
        .whereType<Map>()
        .map((item) => ProofOfClass.fromJson(asMap(item)))
        .toList(growable: false);
  }

  Future<bool> deleteProofOfClass(String proofId) async {
    await deleteJson('/proofs/$proofId');
    return true;
  }

  /// Raw proof image bytes (auth'd; mobile renders via `Image.memory`).
  Future<Uint8List> getProofFile(String proofId) async {
    final response = await getBytes('/proofs/$proofId/file');
    return response.bytes;
  }
}
