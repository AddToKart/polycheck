import 'api_base.dart';
import 'api_models.dart';

/// Audit log listing and hash-chain verification (super admin only).
class AuditApi extends ApiBase {
  AuditApi(super.dio);

  Future<AuditLogPage> getAuditLogs([
    AuditLogFilters filters = const AuditLogFilters(),
  ]) async {
    final data = await getJson('/audit-logs', query: filters.toQuery());
    return AuditLogPage.fromJson(asMap(data));
  }

  Future<LedgerVerifyResult> verifyLedger() async {
    final data = await postJson('/audit-logs/ledger/verify');
    return LedgerVerifyResult.fromJson(asMap(data));
  }
}
