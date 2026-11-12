import '../models/attendance.dart';
import 'api_base.dart';
import 'api_models.dart';

/// Dispute listing, student submission, and teacher resolution.
class DisputesApi extends ApiBase {
  DisputesApi(super.dio);

  Future<List<AttendanceRecord>> getDisputedRecords({
    String? sessionId,
    String? status,
    String? search,
  }) async {
    final query = <String, dynamic>{
      'sessionId': ?sessionId,
      if (status != null && status != 'all') 'status': status,
      'search': ?search,
    };
    final data = await getJson('/disputes', query: query);
    return asList(data)
        .whereType<Map>()
        .map((item) => AttendanceRecord.fromJson(asMap(item)))
        .toList(growable: false);
  }

  Future<AttendanceRecord> submitDispute({
    required String recordId,
    required DisputeReason reason,
    required String description,
  }) async {
    final data = await postJson(
      '/disputes',
      body: <String, dynamic>{
        'recordId': recordId,
        'reason': reason.wire,
        'description': description,
      },
    );
    return AttendanceRecord.fromJson(asMap(data));
  }

  Future<AttendanceRecord> resolveDispute(
    String recordId, {
    required DisputeResolution resolution,
    AttendanceStatus? newStatus,
  }) async {
    final data = await postJson(
      '/disputes/$recordId/resolve',
      body: <String, dynamic>{
        'resolution': resolution.wire,
        if (newStatus != null) 'newStatus': newStatus.wire,
      },
    );
    return AttendanceRecord.fromJson(asMap(data));
  }
}
