import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/api/api_models.dart';
import '../../../core/models/api.dart';
import '../../../core/network/api_error.dart';
import '../../../core/theme/pup_theme.dart';
import '../../../core/utils/calendar_utils.dart';
import '../../../core/widgets/campus_card.dart';
import '../../../core/widgets/campus_empty_state.dart';
import '../../../core/widgets/campus_text_field.dart';
import '../domain/admin_access.dart';
import '../domain/ledger_banner.dart';
import '../domain/server_metrics.dart';
import 'widgets/admin_common.dart';

class AuditLogsScreen extends ConsumerStatefulWidget {
  const AuditLogsScreen({super.key});

  @override
  ConsumerState<AuditLogsScreen> createState() => _AuditLogsScreenState();
}

class _AuditLogsScreenState extends ConsumerState<AuditLogsScreen> {
  final _search = TextEditingController();
  Timer? _debounce;
  AuditLogPage? _page;
  AuditOutcome? _outcome;
  String _query = '';
  int _pageNumber = 1;
  bool _loading = true;
  String? _error;
  LedgerVerifyState _ledger = const LedgerVerifyState.idle();
  int _requestId = 0;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) _load();
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _search.dispose();
    super.dispose();
  }

  Future<void> _load() async {
    final requestId = ++_requestId;
    setState(() {
      _loading = true;
      _error = null;
    });
    final range = getRecentCampusDateRange(30);
    try {
      final page = await ref
          .read(auditApiProvider)
          .getAuditLogs(
            AuditLogFilters(
              page: _pageNumber,
              pageSize: 25,
              search: _query.isEmpty ? null : _query,
              outcome: _outcome?.wire,
              startDate: range.startDate,
              endDate: range.endDate,
            ),
          );
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _page = page;
        _loading = false;
      });
    } catch (error) {
      if (!mounted || requestId != _requestId) return;
      setState(() {
        _loading = false;
        _error = error is ApiRequestError ? error.message : '$error';
      });
    }
  }

  void _onSearchChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 350), () {
      if (!mounted) return;
      setState(() {
        _query = value;
        _pageNumber = 1;
      });
      _load();
    });
  }

  Future<void> _verifyLedger() async {
    setState(() => _ledger = const LedgerVerifyState.busy());
    try {
      final result = await ref.read(auditApiProvider).verifyLedger();
      if (!mounted) return;
      setState(() => _ledger = LedgerVerifyState.done(result));
    } catch (error) {
      if (!mounted) return;
      setState(
        () => _ledger = LedgerVerifyState.failed(
          error is ApiRequestError ? error.message : '$error',
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final banner = ledgerBannerFor(_ledger);
    final page = _page;
    return AdminScaffold(
      title: 'Audit log',
      subtitle: 'Account, classroom, and settings changes',
      section: AdminSection.auditLogs,
      actions: <Widget>[
        IconButton(
          tooltip: 'Verify ledger integrity',
          onPressed: _ledger.isBusy ? null : _verifyLedger,
          icon: const Icon(Icons.verified_user_outlined),
        ),
        IconButton(
          tooltip: 'Refresh audit log',
          onPressed: _loading ? null : _load,
          icon: const Icon(Icons.refresh),
        ),
      ],
      body: ListView(
        padding: const EdgeInsets.all(16),
        children: <Widget>[
          if (banner != null) ...<Widget>[
            _LedgerBannerView(banner: banner),
            const SizedBox(height: 12),
          ],
          CampusTextField(
            controller: _search,
            label: 'Search audit log',
            hint: 'Action, entity, or actor',
            prefixIcon: Icons.search,
            onChanged: _onSearchChanged,
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: <Widget>[
              AdminFilterChip(
                label: 'All outcomes',
                selected: _outcome == null,
                onSelected: () {
                  setState(() {
                    _outcome = null;
                    _pageNumber = 1;
                  });
                  _load();
                },
              ),
              for (final outcome in AuditOutcome.values)
                AdminFilterChip(
                  label: switch (outcome) {
                    AuditOutcome.initiated => 'Initiated',
                    AuditOutcome.succeeded => 'Succeeded',
                    AuditOutcome.failed => 'Failed',
                  },
                  selected: _outcome == outcome,
                  onSelected: () {
                    setState(() {
                      _outcome = outcome;
                      _pageNumber = 1;
                    });
                    _load();
                  },
                ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            'Showing the last 30 days · rollback-safe read-only view',
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: PupTheme.of(context).muted),
          ),
          const SizedBox(height: 10),
          if (_loading)
            const Padding(
              padding: EdgeInsets.symmetric(vertical: 40),
              child: AdminLoading(label: 'Loading audit log…'),
            )
          else if (_error != null)
            AdminErrorState(message: _error!, onRetry: _load)
          else if (page == null || page.items.isEmpty)
            const CampusEmptyState(
              icon: Icons.history,
              title: 'No audited changes',
              message: 'No activity matches this filter in the last 30 days.',
            )
          else ...<Widget>[
            for (final entry in page.items)
              Padding(
                padding: const EdgeInsets.only(bottom: 8),
                child: _AuditRow(entry: entry),
              ),
            Row(
              children: <Widget>[
                OutlinedButton(
                  onPressed: page.page > 1 && !_loading
                      ? () {
                          setState(() => _pageNumber -= 1);
                          _load();
                        }
                      : null,
                  child: const Text('Previous'),
                ),
                const SizedBox(width: 8),
                Text(
                  'Page ${page.page} of ${page.totalPages < 1 ? 1 : page.totalPages}',
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const Spacer(),
                OutlinedButton(
                  onPressed: page.page < page.totalPages && !_loading
                      ? () {
                          setState(() => _pageNumber += 1);
                          _load();
                        }
                      : null,
                  child: const Text('Next'),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _LedgerBannerView extends StatelessWidget {
  const _LedgerBannerView({required this.banner});

  final LedgerBanner banner;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final (background, border, foreground, icon) = switch (banner.tone) {
      LedgerBannerTone.busy => (
        tokens.campus,
        tokens.borderSubtle,
        tokens.onSurface,
        Icons.hourglass_top,
      ),
      LedgerBannerTone.verified => (
        tokens.gold.withValues(alpha: 0.18),
        tokens.gold,
        tokens.deepMaroon,
        Icons.verified_outlined,
      ),
      LedgerBannerTone.insufficient => (
        tokens.surface,
        tokens.gold,
        tokens.deepMaroon,
        Icons.warning_amber_rounded,
      ),
      LedgerBannerTone.broken || LedgerBannerTone.error => (
        tokens.deepMaroon,
        tokens.deepMaroon,
        Colors.white,
        Icons.link_off,
      ),
    };
    return Container(
      decoration: BoxDecoration(
        color: background,
        border: Border.all(color: border),
      ),
      padding: const EdgeInsets.all(12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Icon(icon, size: 20, color: foreground),
          const SizedBox(width: 8),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Text(
                  banner.title,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: foreground,
                    fontWeight: FontWeight.w700,
                  ),
                ),
                if (banner.detail != null)
                  Text(
                    banner.detail!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: foreground,
                      height: 1.4,
                    ),
                  ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _AuditRow extends StatefulWidget {
  const _AuditRow({required this.entry});

  final AuditLogEntry entry;

  @override
  State<_AuditRow> createState() => _AuditRowState();
}

class _AuditRowState extends State<_AuditRow> {
  bool _expanded = false;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final entry = widget.entry;
    final failed = entry.outcome == AuditOutcome.failed;
    return CampusCard(
      onTap: () => setState(() => _expanded = !_expanded),
      padding: const EdgeInsets.all(12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Icon(
                failed
                    ? Icons.error_outline
                    : entry.outcome == AuditOutcome.succeeded
                    ? Icons.check_circle_outline
                    : Icons.schedule,
                size: 18,
                color: failed ? tokens.maroon : tokens.muted,
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: <Widget>[
                    Text(
                      entry.actorName.isEmpty
                          ? 'Unknown account'
                          : entry.actorName,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    AdminStatusChip(
                      label: entry.action,
                      active: false,
                      positive: false,
                    ),
                  ],
                ),
              ),
              AdminStatusChip(
                label: switch (entry.outcome) {
                  AuditOutcome.initiated => 'Initiated',
                  AuditOutcome.succeeded => 'Succeeded',
                  AuditOutcome.failed => 'Failed',
                },
                active: entry.outcome == AuditOutcome.succeeded,
                positive: entry.outcome != AuditOutcome.failed,
              ),
              const SizedBox(width: 4),
              Icon(
                _expanded ? Icons.expand_less : Icons.expand_more,
                size: 18,
                color: tokens.muted,
              ),
            ],
          ),
          if (_expanded) ...<Widget>[
            const SizedBox(height: 10),
            Divider(color: tokens.borderSubtle, height: 1),
            const SizedBox(height: 8),
            _DetailLine(label: 'Entity', value: entry.entityType),
            _DetailLine(label: 'Entity ID', value: entry.entityId ?? '—'),
            _DetailLine(
              label: 'Actor role',
              value: entry.actorRole.isEmpty ? '—' : entry.actorRole,
            ),
            _DetailLine(
              label: 'IP address',
              value: entry.ipAddress ?? 'Not recorded',
            ),
            _DetailLine(
              label: 'Timestamp',
              value: formatDateTimeLabel(entry.createdAt),
            ),
          ],
        ],
      ),
    );
  }
}

class _DetailLine extends StatelessWidget {
  const _DetailLine({required this.label, required this.value});

  final String label;
  final String value;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: 3),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: <Widget>[
          SizedBox(
            width: 96,
            child: Text(
              label,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: tokens.muted,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
          Expanded(
            child: Text(value, style: Theme.of(context).textTheme.bodySmall),
          ),
        ],
      ),
    );
  }
}
