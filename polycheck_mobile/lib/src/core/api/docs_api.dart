import 'api_base.dart';
import 'api_models.dart';

/// Document exports (`backend/src/docs/docs.controller.ts`).
///
/// Every method returns the raw bytes plus the server filename/content type so
/// the UI can hand them to the platform share sheet (share_plus lands with the
/// presentation wave; A2 deliberately adds no new dependency).
class DocsApi extends ApiBase {
  DocsApi(super.dio);

  Future<DocumentDownload> masterList(
    String sectionId, {
    String format = 'pdf',
  }) {
    return _download(
      '/docs/master-list/${Uri.encodeComponent(sectionId)}',
      query: <String, dynamic>{'format': format},
      fallbackName: 'master-list-$sectionId.$format',
    );
  }

  Future<DocumentDownload> sessionAttendance(
    String sessionId, {
    String format = 'csv',
  }) {
    return _download(
      '/docs/session-attendance/${Uri.encodeComponent(sessionId)}',
      query: <String, dynamic>{'format': format},
      fallbackName: 'session-attendance-$sessionId.$format',
    );
  }

  Future<DocumentDownload> classRecord(
    String sectionId, {
    String format = 'pdf',
    String? from,
  }) {
    return _download(
      '/docs/class-record/${Uri.encodeComponent(sectionId)}',
      query: <String, dynamic>{'format': format, 'from': from},
      fallbackName: 'class-record-$sectionId.$format',
    );
  }

  Future<DocumentDownload> atRiskNotice(
    String referralId, {
    String format = 'pdf',
  }) {
    return _download(
      '/docs/at-risk-notice/${Uri.encodeComponent(referralId)}',
      query: <String, dynamic>{'format': format},
      fallbackName: 'at-risk-notice-$referralId.$format',
    );
  }

  /// Class photos with their time stamps as one PDF, for a session, a section
  /// or a whole subject.
  Future<DocumentDownload> proofPhotos({
    String? sessionId,
    String? sectionId,
    String? subjectId,
    String? from,
    String? to,
  }) {
    return _download(
      '/docs/proof-photos',
      query: <String, dynamic>{
        'sessionId': sessionId,
        'sectionId': sectionId,
        'subjectId': subjectId,
        'from': from,
        'to': to,
      },
      fallbackName: 'class-photos.pdf',
    );
  }

  /// Every attendance record of a subject, as a spreadsheet.
  Future<DocumentDownload> subjectAttendance(String subjectId) {
    return _download(
      '/docs/subject-attendance/${Uri.encodeComponent(subjectId)}',
      query: const <String, dynamic>{},
      fallbackName: 'attendance-$subjectId-all-records.csv',
    );
  }

  Future<DocumentDownload> dpoSummary({String format = 'pdf'}) {
    return _download(
      '/docs/dpo-summary',
      query: <String, dynamic>{'format': format},
      fallbackName: 'dpo-summary.$format',
    );
  }

  Future<DocumentDownload> _download(
    String path, {
    required Map<String, dynamic> query,
    required String fallbackName,
  }) async {
    final response = await getBytes(path, query: query);
    return DocumentDownload(
      bytes: response.bytes,
      filename: response.filename ?? fallbackName,
      contentType: response.contentType,
    );
  }
}
