import 'package:dio/dio.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/api/api_models.dart';
import 'package:polycheck_mobile/src/core/api/api_providers.dart';
import 'package:polycheck_mobile/src/core/api/audit_api.dart';
import 'package:polycheck_mobile/src/core/providers/session_provider.dart';
import 'package:polycheck_mobile/src/core/theme/pup_theme.dart';
import 'package:polycheck_mobile/src/features/admin/presentation/audit_logs_screen.dart';

import '../../helpers/auth_harness.dart';

class _FakeAuditApi extends AuditApi {
  _FakeAuditApi(this.result) : super(Dio());

  final LedgerVerifyResult result;

  @override
  Future<AuditLogPage> getAuditLogs([
    AuditLogFilters filters = const AuditLogFilters(),
  ]) async => const AuditLogPage();

  @override
  Future<LedgerVerifyResult> verifyLedger() async => result;
}

LedgerVerifyResult decode(Map<String, dynamic> json) =>
    LedgerVerifyResult.fromJson(json);

Future<void> pumpAuditLogs(
  WidgetTester tester,
  LedgerVerifyResult result,
) async {
  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        sessionProvider.overrideWith(() => FakeSessionController(testAdmin)),
        auditApiProvider.overrideWithValue(_FakeAuditApi(result)),
      ],
      child: MaterialApp(theme: PupTheme.light, home: const AuditLogsScreen()),
    ),
  );
  await tester.pumpAndSettle();
}

Future<void> tapVerify(WidgetTester tester) async {
  await tester.tap(find.byIcon(Icons.verified_user_outlined));
  await tester.pumpAndSettle();
}

void main() {
  testWidgets('a verified chain renders the intact banner', (tester) async {
    await pumpAuditLogs(
      tester,
      decode(<String, dynamic>{
        'status': 'verified',
        'verified': true,
        'recordsChecked': 3145,
        'sessionsChecked': 189,
        'unhashedRecords': 0,
        'lastAnchorDate': '2026-11-10',
      }),
    );

    await tapVerify(tester);

    expect(find.textContaining('Ledger intact'), findsOneWidget);
    expect(find.textContaining('3,145'), findsOneWidget);
    expect(find.textContaining('189'), findsOneWidget);
    expect(find.textContaining('Ledger not anchored'), findsNothing);
  });

  testWidgets('an unanchored ledger warns instead of claiming integrity', (
    tester,
  ) async {
    await pumpAuditLogs(
      tester,
      decode(<String, dynamic>{
        'status': 'insufficient_data',
        'verified': false,
        'recordsChecked': 0,
        'sessionsChecked': 0,
        'unhashedRecords': 16,
      }),
    );

    await tapVerify(tester);

    expect(
      find.textContaining(
        'Ledger not anchored — 16 records have no chain entry',
      ),
      findsOneWidget,
    );
    expect(find.textContaining('ledger backfill'), findsOneWidget);
    expect(find.textContaining('Ledger intact'), findsNothing);
    expect(find.textContaining('Chain broken'), findsNothing);
  });

  testWidgets('a broken chain still names the record and session', (
    tester,
  ) async {
    await pumpAuditLogs(
      tester,
      decode(<String, dynamic>{
        'status': 'broken',
        'verified': false,
        'recordsChecked': 10,
        'sessionsChecked': 2,
        'unhashedRecords': 0,
        'brokenAt': <String, dynamic>{
          'sessionId': 'sess-1',
          'recordId': 'rec-9',
          'reason': 'hash_mismatch',
        },
      }),
    );

    await tapVerify(tester);

    expect(find.textContaining('Chain broken at rec-9'), findsOneWidget);
    expect(find.textContaining('sess-1'), findsOneWidget);
    expect(find.textContaining('Ledger not anchored'), findsNothing);
    expect(find.textContaining('Ledger intact'), findsNothing);
  });
}
