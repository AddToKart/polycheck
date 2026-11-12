import '../../../core/api/api_models.dart';

/// Pure banner model for `POST /audit-logs/ledger/verify`.
///
/// Mirrors `android/app/(faculty)/audit-logs.tsx` so the copy stays identical
/// across clients.

enum LedgerVerifyPhase { idle, busy, done, error }

class LedgerVerifyState {
  const LedgerVerifyState.idle()
    : phase = LedgerVerifyPhase.idle,
      result = null,
      message = null;

  const LedgerVerifyState.busy()
    : phase = LedgerVerifyPhase.busy,
      result = null,
      message = null;

  const LedgerVerifyState.done(LedgerVerifyResult value)
    : phase = LedgerVerifyPhase.done,
      result = value,
      message = null;

  const LedgerVerifyState.failed(String value)
    : phase = LedgerVerifyPhase.error,
      result = null,
      message = value;

  final LedgerVerifyPhase phase;
  final LedgerVerifyResult? result;
  final String? message;

  bool get isBusy => phase == LedgerVerifyPhase.busy;
}

enum LedgerBannerTone { busy, verified, insufficient, broken, error }

class LedgerBanner {
  const LedgerBanner({required this.tone, required this.title, this.detail});

  final LedgerBannerTone tone;
  final String title;
  final String? detail;
}

/// Three verdicts the server can return; mirrors `LedgerVerifyStatus` in
/// `@polycheck/shared`.
enum LedgerVerifyOutcome { verified, broken, insufficientData }

/// Resolves the wire `status`, falling back to the legacy `verified` boolean
/// for older backend responses that predate the status field.
LedgerVerifyOutcome ledgerOutcomeOf(LedgerVerifyResult result) {
  switch (result.status) {
    case 'verified':
      return LedgerVerifyOutcome.verified;
    case 'broken':
      return LedgerVerifyOutcome.broken;
    case 'insufficient_data':
      return LedgerVerifyOutcome.insufficientData;
    default:
      return result.verified
          ? LedgerVerifyOutcome.verified
          : LedgerVerifyOutcome.broken;
  }
}

const Map<String, String> ledgerBreakLabels = <String, String>{
  'hash_mismatch': 'the stored hash no longer matches the recomputed chain',
  'link_mismatch': 'a chain link points at the wrong predecessor record',
  'anchor_mismatch': 'the published daily anchor does not match the chain head',
};

String ledgerBreakLabel(String reason) =>
    ledgerBreakLabels[reason] ??
    'the chain failed verification for an unknown reason';

String formatLedgerCount(int value) {
  final digits = value.abs().toString();
  final buffer = StringBuffer();
  for (var i = 0; i < digits.length; i++) {
    if (i > 0 && (digits.length - i) % 3 == 0) buffer.write(',');
    buffer.write(digits[i]);
  }
  return value < 0 ? '-$buffer' : buffer.toString();
}

LedgerBanner? ledgerBannerFor(LedgerVerifyState state) {
  switch (state.phase) {
    case LedgerVerifyPhase.idle:
      return null;
    case LedgerVerifyPhase.busy:
      return const LedgerBanner(
        tone: LedgerBannerTone.busy,
        title: 'Verifying ledger integrity.',
        detail: 'Recomputing every attendance hash chain — read-only check.',
      );
    case LedgerVerifyPhase.error:
      return LedgerBanner(
        tone: LedgerBannerTone.error,
        title: 'Ledger verification failed',
        detail: state.message,
      );
    case LedgerVerifyPhase.done:
      final result = state.result;
      if (result == null) return null;
      switch (ledgerOutcomeOf(result)) {
        case LedgerVerifyOutcome.verified:
          return LedgerBanner(
            tone: LedgerBannerTone.verified,
            title:
                '✓ Ledger intact — ${formatLedgerCount(result.recordsChecked)} '
                'records across ${formatLedgerCount(result.sessionsChecked)} '
                'sessions verified',
            detail: result.lastAnchorDate == null
                ? 'Daily chain heads are published to the audit trail.'
                : 'Last published anchor: ${result.lastAnchorDate}',
          );
        case LedgerVerifyOutcome.insufficientData:
          final count = formatLedgerCount(result.unhashedRecords);
          final noun = result.unhashedRecords == 1
              ? 'record has'
              : 'records have';
          return LedgerBanner(
            tone: LedgerBannerTone.insufficient,
            title: '⚠ Ledger not anchored — $count $noun no chain entry',
            detail:
                'Nothing could be verified, so integrity is unproven. Run the '
                'ledger backfill (or re-run the seed) to chain the historical '
                'attendance rows.',
          );
        case LedgerVerifyOutcome.broken:
          final brokenAt = result.brokenAt;
          return LedgerBanner(
            tone: LedgerBannerTone.broken,
            title: brokenAt == null
                ? '✗ Chain verification failed'
                : '✗ Chain broken at ${brokenAt.recordId}',
            detail: brokenAt == null
                ? 'The scanner could not complete a chain; check server logs '
                      'and retry.'
                : 'Investigate session ${brokenAt.sessionId} — '
                      '${ledgerBreakLabel(brokenAt.reason)}.',
          );
      }
  }
}
