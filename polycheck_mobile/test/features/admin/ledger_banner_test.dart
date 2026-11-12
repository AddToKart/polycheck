import 'package:flutter_test/flutter_test.dart';
import 'package:polycheck_mobile/src/core/api/api_models.dart';
import 'package:polycheck_mobile/src/features/admin/domain/ledger_banner.dart';

void main() {
  test('idle and busy states', () {
    expect(ledgerBannerFor(const LedgerVerifyState.idle()), isNull);
    final busy = ledgerBannerFor(const LedgerVerifyState.busy());
    expect(busy?.tone, LedgerBannerTone.busy);
    expect(busy?.detail, contains('read-only'));
  });

  test('verified ledger reports counts and the last anchor', () {
    final banner = ledgerBannerFor(
      const LedgerVerifyState.done(
        LedgerVerifyResult(
          verified: true,
          recordsChecked: 3145,
          sessionsChecked: 189,
          lastAnchorDate: '2026-11-10',
        ),
      ),
    );
    expect(banner?.tone, LedgerBannerTone.verified);
    expect(banner?.title, contains('3,145'));
    expect(banner?.title, contains('189'));
    expect(banner?.detail, contains('2026-11-10'));
  });

  test('a break names the session and reason', () {
    final banner = ledgerBannerFor(
      const LedgerVerifyState.done(
        LedgerVerifyResult(
          verified: false,
          recordsChecked: 10,
          sessionsChecked: 2,
          brokenAt: LedgerBreak(
            sessionId: 'sess-1',
            recordId: 'rec-9',
            reason: 'anchor_mismatch',
          ),
        ),
      ),
    );
    expect(banner?.tone, LedgerBannerTone.broken);
    expect(banner?.title, contains('rec-9'));
    expect(banner?.detail, contains('sess-1'));
    expect(banner?.detail, contains('daily anchor'));
  });

  test('error state surfaces the message', () {
    final banner = ledgerBannerFor(
      const LedgerVerifyState.failed('Network unavailable'),
    );
    expect(banner?.tone, LedgerBannerTone.error);
    expect(banner?.detail, 'Network unavailable');
  });

  test('an unanchored ledger decodes insufficient_data and warns', () {
    final result = LedgerVerifyResult.fromJson(<String, dynamic>{
      'status': 'insufficient_data',
      'verified': false,
      'recordsChecked': 0,
      'sessionsChecked': 0,
      'unhashedRecords': 16,
    });

    expect(ledgerOutcomeOf(result), LedgerVerifyOutcome.insufficientData);
    final banner = ledgerBannerFor(LedgerVerifyState.done(result));
    expect(banner?.tone, LedgerBannerTone.insufficient);
    expect(
      banner?.title,
      '⚠ Ledger not anchored — 16 records have no chain entry',
    );
    expect(banner?.detail, contains('ledger backfill'));
    expect(banner?.detail, contains('re-run the seed'));
  });

  test('a single off-chain row reads in the singular', () {
    final result = LedgerVerifyResult.fromJson(<String, dynamic>{
      'status': 'insufficient_data',
      'verified': false,
      'unhashedRecords': 1,
    });

    expect(
      ledgerBannerFor(LedgerVerifyState.done(result))?.title,
      '⚠ Ledger not anchored — 1 record has no chain entry',
    );
  });

  test('responses without a status field fall back to the verified flag', () {
    final legacyVerified = LedgerVerifyResult.fromJson(<String, dynamic>{
      'verified': true,
      'recordsChecked': 3,
      'sessionsChecked': 1,
    });
    expect(legacyVerified.status, isNull);
    expect(legacyVerified.unhashedRecords, 0);
    expect(ledgerOutcomeOf(legacyVerified), LedgerVerifyOutcome.verified);

    final legacyBroken = LedgerVerifyResult.fromJson(<String, dynamic>{
      'verified': false,
    });
    expect(ledgerOutcomeOf(legacyBroken), LedgerVerifyOutcome.broken);
  });

  test('count formatting groups thousands', () {
    expect(formatLedgerCount(0), '0');
    expect(formatLedgerCount(999), '999');
    expect(formatLedgerCount(1000), '1,000');
    expect(formatLedgerCount(1234567), '1,234,567');
  });
}
