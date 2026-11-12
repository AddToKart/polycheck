import 'package:drift/drift.dart' hide Column;
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:polycheck_mobile/src/core/polycheck_core.dart';

import '../../data/offline_readiness.dart';
import '../../data/student_providers.dart';

/// Queue issue shaped for the panel (web `OfflineSyncPanel.tsx` parity).
@immutable
class OfflineSyncIssue {
  const OfflineSyncIssue({
    required this.receiptId,
    required this.label,
    required this.error,
    required this.disputed,
    this.flagged = false,
  });

  final String receiptId;
  final String label;
  final String error;

  /// First-arrival-wins duplicate (`DISPUTED_DUPLICATE`): terminal evidence
  /// kept for review — never auto-retried.
  final bool disputed;

  /// Reconciled as `disputed` by the server (`CONFIRMED_FLAGGED`, e.g. a
  /// delayed offline replay): the evidence **is synced** and only awaits
  /// instructor review, so it is not a failure and is never retried.
  final bool flagged;

  /// Failures only. Duplicates and synced-but-flagged receipts are terminal
  /// server outcomes the student cannot retry from this panel.
  bool get needsRetry => !disputed && !flagged;
}

/// Drift-table issue rows: retryable/terminal failures, first-arrival-wins
/// duplicates (`DISPUTED_DUPLICATE`) and receipts the server accepted but
/// stamped `disputed` (`CONFIRMED_FLAGGED`) — newest first.
Stream<List<OfflineAttendanceQueueRow>> watchOfflineQueueIssues(
  AppDatabase database,
  String userId,
) {
  return (database.select(database.offlineAttendanceQueue)
        ..where(
          (row) =>
              row.userId.equals(userId) &
              (row.syncStatus.equalsValue(AttendanceSyncStatus.failed) |
                  row.syncStatus.equalsValue(
                    AttendanceSyncStatus.disputedDuplicate,
                  ) |
                  row.syncStatus.equalsValue(
                    AttendanceSyncStatus.confirmedFlagged,
                  )),
        )
        ..orderBy([(row) => OrderingTerm.desc(row.createdAt)]))
      .watch();
}

List<OfflineSyncIssue> offlineSyncIssuesFromRows(
  List<OfflineAttendanceQueueRow> rows,
) {
  return <OfflineSyncIssue>[
    for (final row in rows)
      OfflineSyncIssue(
        receiptId: row.clientReceiptId,
        label: offlineQueueIssueLabel('attendance_queue'),
        error: issueErrorText(row),
        disputed: row.syncStatus == AttendanceSyncStatus.disputedDuplicate,
        flagged: row.syncStatus == AttendanceSyncStatus.confirmedFlagged,
      ),
  ];
}

String issueErrorText(OfflineAttendanceQueueRow row) {
  final raw = row.serverError ?? '';
  // The sync engine writes `flagged: <disputeReason.wire>` (or `flagged:
  // disputed` when the server sent no reason); the row is a confirmation, not
  // an error, so the raw stamp is never shown verbatim.
  if (raw.startsWith('flagged: ')) {
    final reason = raw.substring('flagged: '.length).trim();
    return reason.isEmpty || reason == 'disputed'
        ? 'Synced · flagged for instructor review'
        : 'Synced · flagged for instructor review '
              '(${_humanizeReasonWire(reason)})';
  }
  if (raw.startsWith('terminal: ')) return raw.substring('terminal: '.length);
  if (raw.isNotEmpty) return raw;
  return row.syncStatus == AttendanceSyncStatus.disputedDuplicate
      ? 'Duplicate submission flagged for review'
      : 'Unspecified offline sync failure';
}

/// Reads a server-stamped reason wire back to sentence case
/// (`delayed_offline_sync` → `delayed offline sync`). Total by design: a
/// future reason wire still renders, unlike an exhaustive label map.
String _humanizeReasonWire(String wire) =>
    wire.replaceAll('_', ' ').trim().toLowerCase();

/// Owner-scoped issue stream (the queue is small; the owner switch re-runs).
final offlineQueueIssuesProvider = StreamProvider.autoDispose
    .family<List<OfflineAttendanceQueueRow>, String>((ref, userId) {
      return watchOfflineQueueIssues(ref.watch(appDatabaseProvider), userId);
    });

/// Page-local stamp holder; `CachedMeta.lastSyncAt` has no drift watcher, so
/// the panel keeps the last read value and refreshes it after every drain.
class _LastSyncStamp extends Notifier<DateTime?> {
  @override
  DateTime? build() => null;

  void stamp(DateTime? value) {
    state = value;
  }
}

final _lastSyncStampProvider = NotifierProvider<_LastSyncStamp, DateTime?>(
  _LastSyncStamp.new,
);

/// Offline sync panel (web `OfflineSyncPanel.tsx` parity — B-12):
///
/// * last-sync line (`CachedMeta.lastSyncAt`, read owner-scoped),
/// * pending sentence with the RN instructor-review emphasis (§4.5),
/// * up to 3 issue rows — `Check-in` kind label + error + per-row Retry
///   through W1's `SyncController.retryOne` (the drift queue holds
///   attendance evidence only, so the labelled kind is `attendance_queue`),
/// * synced-but-flagged receipts (`CONFIRMED_FLAGGED`) render distinctly as
///   gold-rail confirmations with the server reason and **no** Retry — they
///   are already synced, not failures,
/// * global **Sync now** retained; the toast renders `syncDrainMessage`.
class StudentOfflineSyncPanel extends ConsumerStatefulWidget {
  const StudentOfflineSyncPanel({super.key});

  @override
  ConsumerState<StudentOfflineSyncPanel> createState() =>
      _StudentOfflineSyncPanelState();
}

class _StudentOfflineSyncPanelState
    extends ConsumerState<StudentOfflineSyncPanel> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _loadMeta());
  }

  Future<void> _loadMeta() async {
    final user = ref.read(sessionProvider).user;
    if (user == null) return;
    final meta = await ref.read(appDatabaseProvider).readMeta(user.id);
    if (!mounted) return;
    ref.read(_lastSyncStampProvider.notifier).stamp(meta?.lastSyncAt);
  }

  Future<void> _syncNow() async {
    final report = await ref.read(syncControllerProvider.notifier).drainNow();
    if (!mounted) return;
    await _loadMeta();
    if (!mounted) return;
    final needsWarning =
        report.hasNeedsAttention ||
        report.abortReason == SyncAbortReason.unauthorized ||
        report.abortReason == SyncAbortReason.maintenance ||
        report.abortReason == SyncAbortReason.offline;
    final tone = needsWarning
        ? CampusToastTone.warning
        : report.confirmed > 0
        ? CampusToastTone.success
        : CampusToastTone.info;
    CampusToast.showIn(context, syncDrainMessage(report), tone: tone);
  }

  Future<void> _retry(String receiptId) async {
    final report = await ref
        .read(syncControllerProvider.notifier)
        .retryOne(receiptId);
    if (!mounted) return;
    if (report.attempted > 0 || report.hasNeedsAttention) {
      CampusToast.showIn(
        context,
        syncDrainMessage(report),
        tone: report.hasNeedsAttention
            ? CampusToastTone.warning
            : CampusToastTone.success,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final user = ref.watch(sessionProvider).user;
    final pending = ref.watch(pendingScanCountProvider).value ?? 0;
    final stamp = ref.watch(_lastSyncStampProvider);

    // Re-read the ownership stamp after every drain completes.
    ref.listen(syncControllerProvider.select((state) => state.lastReport), (
      previous,
      next,
    ) {
      if (next != null) _loadMeta();
    });

    final rows = user == null
        ? const <OfflineAttendanceQueueRow>[]
        : ref.watch(offlineQueueIssuesProvider(user.id)).value ??
              const <OfflineAttendanceQueueRow>[];
    final shaped = offlineSyncIssuesFromRows(rows);
    // Failures only: a flagged receipt is already synced and a duplicate is
    // terminal evidence, so neither belongs in "need attention".
    final attention = shaped.where((issue) => issue.needsRetry).length;
    final syncing = ref.watch(syncControllerProvider).draining;

    return CampusCard(
      key: const ValueKey('student-offline-chip'),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: <Widget>[
          Row(
            children: <Widget>[
              Icon(
                Icons.cloud_outlined,
                size: 16,
                color: tokens.isDark ? tokens.gold : tokens.maroon,
              ),
              const SizedBox(width: 6),
              Text(
                'OFFLINE SYNC',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: tokens.muted,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1.2,
                ),
              ),
              const Spacer(),
              Text(
                formatOfflineLastSync(stamp),
                key: const ValueKey('offline-last-sync'),
                style: Theme.of(
                  context,
                ).textTheme.labelSmall?.copyWith(color: tokens.muted),
              ),
              const SizedBox(width: 4),
              IconButton(
                key: const ValueKey('student-sync-now'),
                tooltip: 'Sync pending attendance now',
                onPressed: syncing ? null : _syncNow,
                icon: syncing
                    ? SizedBox(
                        width: 14,
                        height: 14,
                        child: CircularProgressIndicator(
                          strokeWidth: 2,
                          color: tokens.maroon,
                        ),
                      )
                    : Icon(
                        Icons.sync,
                        size: 18,
                        color: tokens.isDark ? tokens.gold : tokens.maroon,
                      ),
              ),
            ],
          ),
          Text(
            pendingSentence(pending, attention),
            key: const ValueKey('offline-pending-count'),
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tokens.onSurface),
          ),
          if (shaped.isNotEmpty) ...<Widget>[
            const SizedBox(height: 8),
            for (final issue in shaped.take(3))
              _IssueRow(
                key: ValueKey('offline-issue-${issue.receiptId}'),
                issue: issue,
                onRetry: issue.needsRetry
                    ? () => _retry(issue.receiptId)
                    : null,
                busy: syncing,
              ),
          ],
        ],
      ),
    );
  }
}

/// Web `OfflineSyncPanel.tsx:151-155` sentence plus the RN §4.5
/// instructor-review emphasis ("Confirmation may require instructor review").
@visibleForTesting
String pendingSentence(int pending, int needAttention) {
  if (pending == 0) {
    return 'All attendance evidence is synced.';
  }
  final base =
      '$pending saved item${pending == 1 ? '' : 's'} waiting to sync. '
      'Confirmation may require instructor review.';
  if (needAttention > 0) {
    return '$base $needAttention need attention.';
  }
  return base;
}

class _IssueRow extends StatelessWidget {
  const _IssueRow({
    super.key,
    required this.issue,
    required this.onRetry,
    required this.busy,
  });

  final OfflineSyncIssue issue;
  final VoidCallback? onRetry;
  final bool busy;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final (border, background) = issue.flagged
        ? // Synced-but-flagged: gold rail like the review rail, but a lighter
          // wash than a duplicate and never a failure maroon.
          (tokens.gold, tokens.gold.withValues(alpha: 0.06))
        : issue.disputed
        ? (tokens.gold, tokens.gold.withValues(alpha: 0.10))
        : (tokens.maroon, tokens.maroon.withValues(alpha: 0.08));
    return Container(
      padding: const EdgeInsets.all(8),
      decoration: BoxDecoration(
        border: Border(left: BorderSide(color: border, width: 4)),
        color: background,
      ),
      child: Row(
        children: <Widget>[
          if (issue.flagged)
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: Icon(
                Icons.flag_outlined,
                key: ValueKey('offline-flagged-${issue.receiptId}'),
                size: 14,
                color: tokens.isDark ? tokens.gold : tokens.maroon,
              ),
            ),
          Expanded(
            child: Text.rich(
              TextSpan(
                text: issue.label,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: tokens.onSurface,
                  fontWeight: FontWeight.w800,
                ),
                children: <InlineSpan>[
                  const TextSpan(text: ' · '),
                  TextSpan(
                    text: issue.error,
                    style: Theme.of(
                      context,
                    ).textTheme.labelSmall?.copyWith(color: tokens.onSurface),
                  ),
                ],
              ),
            ),
          ),
          if (onRetry != null)
            TextButton(
              key: ValueKey('offline-retry-${issue.receiptId}'),
              onPressed: busy ? null : onRetry,
              style: TextButton.styleFrom(
                foregroundColor: tokens.isDark ? tokens.gold : tokens.maroon,
                minimumSize: const Size(44, 40),
                padding: const EdgeInsets.symmetric(horizontal: 8),
                textStyle: Theme.of(
                  context,
                ).textTheme.labelSmall?.copyWith(fontWeight: FontWeight.w800),
              ),
              child: const Text('Retry'),
            ),
        ],
      ),
    );
  }
}
