import 'api_base.dart';
import 'api_models.dart';

/// Transport seam for the sync engine (fakeable in hermetic tests).
abstract interface class SyncTransport {
  /// `POST /sync/attendance/batches` (202; queued receipt or inline results).
  Future<SyncBatchSubmitResult> submitBatch(List<Map<String, dynamic>> records);

  Future<SyncBatchStatus> getBatchStatus(String receiptId);

  /// Legacy synchronous endpoint (no BullMQ receipt).
  Future<List<SyncRecordResult>> submitSynchronously(
    List<Map<String, dynamic>> records,
  );
}

/// Attendance sync batch contract (`backend/src/sync/sync.controller.ts`).
///
/// The Phase 4 worker owns queue draining/backoff; these methods only expose
/// the server receipt pipeline.
class SyncApi extends ApiBase implements SyncTransport {
  SyncApi(super.dio);

  /// `POST /sync/attendance/batches` (202; queued receipt or inline results).
  @override
  Future<SyncBatchSubmitResult> submitBatch(
    List<Map<String, dynamic>> records,
  ) async {
    final data = await postJson(
      '/sync/attendance/batches',
      body: <String, dynamic>{'records': records},
    );
    return SyncBatchSubmitResult.fromJson(asMap(data));
  }

  @override
  Future<SyncBatchStatus> getBatchStatus(String receiptId) async {
    final data = await getJson(
      '/sync/attendance/batches/${Uri.encodeComponent(receiptId)}',
    );
    return SyncBatchStatus.fromJson(asMap(data));
  }

  /// Legacy synchronous endpoint (no BullMQ receipt).
  @override
  Future<List<SyncRecordResult>> submitSynchronously(
    List<Map<String, dynamic>> records,
  ) async {
    final data = await postJson(
      '/sync/attendance',
      body: <String, dynamic>{'records': records},
    );
    return asList(data)
        .whereType<Map>()
        .map((item) => SyncRecordResult.fromJson(asMap(item)))
        .toList(growable: false);
  }
}
