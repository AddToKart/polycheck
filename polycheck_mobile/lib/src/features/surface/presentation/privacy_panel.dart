import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_providers.dart';
import '../../../core/models/privacy.dart';
import '../../../core/network/api_error.dart';
import '../../../core/providers/session_provider.dart';
import '../../../core/theme/pup_theme.dart';
import '../../../core/utils/designations.dart';
import '../../../core/widgets/campus_button.dart';
import '../../../core/widgets/campus_loading.dart';
import '../../../core/widgets/campus_toast.dart';
import '../data/surface_downloads.dart';

/// Read-only RA 10173 transparency center.
///
/// Super admins and IT coordinators see the live institution snapshot (the
/// same gate as `GET /settings/privacy-center`); every other role sees the
/// plain-language notice and the published data inventory.
class PrivacyPanel extends ConsumerStatefulWidget {
  const PrivacyPanel({super.key});

  @override
  ConsumerState<PrivacyPanel> createState() => _PrivacyPanelState();
}

class _PrivacyPanelState extends ConsumerState<PrivacyPanel> {
  PrivacyCenterSnapshot? _snapshot;
  bool _loading = false;
  String? _error;
  bool _exporting = false;

  @override
  void initState() {
    super.initState();
    unawaited(_load());
  }

  bool get _privileged {
    final user = ref.read(sessionProvider).user;
    return user != null && canAccessItOperations(user);
  }

  Future<void> _load() async {
    if (!_privileged) return;
    setState(() {
      _loading = true;
      _error = null;
    });
    try {
      final snapshot = await ref.read(settingsApiProvider).getPrivacyCenter();
      if (!mounted) return;
      setState(() {
        _snapshot = snapshot;
        _loading = false;
      });
    } catch (error) {
      if (!mounted) return;
      setState(() {
        _loading = false;
        _error = error is ApiRequestError
            ? error.message
            : 'Unable to load the privacy center.';
      });
    }
  }

  Future<void> _downloadDpoSummary() async {
    if (_exporting) return;
    setState(() => _exporting = true);
    try {
      final document = await ref.read(docsApiProvider).dpoSummary();
      await SurfaceDownloads.shareBytes(
        bytes: document.bytes,
        filename: document.filename,
        mimeType: document.contentType,
        title: 'PUP Polycheck DPO summary',
      );
      if (!mounted) return;
      setState(() => _exporting = false);
    } catch (error) {
      if (!mounted) return;
      setState(() => _exporting = false);
      CampusToast.showIn(
        context,
        error is ApiRequestError
            ? error.message
            : 'Unable to prepare the DPO summary.',
        tone: CampusToastTone.error,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final privileged = _privileged;
    final inventory = _snapshot?.dataInventory.isNotEmpty == true
        ? _snapshot!.dataInventory
        : privacyDataInventory;

    return RefreshIndicator(
      color: tokens.maroon,
      backgroundColor: tokens.surface,
      onRefresh: _load,
      child: ListView(
        physics: const AlwaysScrollableScrollPhysics(),
        padding: const EdgeInsets.fromLTRB(12, 12, 12, 28),
        children: [
          Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: tokens.isDark
                  ? tokens.gold.withValues(alpha: 0.08)
                  : tokens.gold.withValues(alpha: 0.16),
              border: Border.all(color: tokens.gold),
            ),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Icon(
                  Icons.privacy_tip_outlined,
                  size: 20,
                  color: tokens.isDark ? tokens.gold : tokens.deepMaroon,
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Data Privacy Act of 2012 (RA 10173)',
                        style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          color: tokens.isDark
                              ? tokens.gold
                              : tokens.deepMaroon,
                          fontWeight: FontWeight.w700,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Text(
                        'Polycheck processes identity, attendance, and '
                        'geolocation evidence only for official class records '
                        'and anti-proxy check-in. This page is read-only.',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: tokens.isDark
                              ? tokens.gold
                              : tokens.deepMaroon,
                          height: 1.4,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
          if (privileged) ...[
            const SizedBox(height: 12),
            if (_loading)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 20),
                child: CampusLoading(label: 'Loading the live attestation.'),
              )
            else if (_error != null)
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: tokens.surface,
                  border: Border.all(
                    color: tokens.isDark ? tokens.gold : tokens.maroon,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      _error!,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: tokens.isDark ? tokens.gold : tokens.maroon,
                      ),
                    ),
                    const SizedBox(height: 6),
                    CampusButton(
                      label: 'Try again',
                      icon: Icons.refresh,
                      variant: CampusButtonVariant.outline,
                      expand: false,
                      onPressed: () => unawaited(_load()),
                    ),
                  ],
                ),
              )
            else if (_snapshot != null) ...[
              PrivacySnapshotView(snapshot: _snapshot!),
              const SizedBox(height: 10),
              CampusButton(
                label: 'Download DPO summary (PDF)',
                icon: Icons.picture_as_pdf_outlined,
                variant: CampusButtonVariant.gold,
                loading: _exporting,
                onPressed: _exporting
                    ? null
                    : () => unawaited(_downloadDpoSummary()),
              ),
            ],
          ] else ...[
            const SizedBox(height: 12),
            _NoticeSection(
              title: 'What we collect and why',
              body:
                  'Your account identity, class attendance records, signed QR '
                  'token evidence, and - for in-person sessions only - the GPS '
                  'coordinates captured when you scan. Coordinates prove you '
                  'were inside the classroom geofence; online sessions never '
                  'collect location.',
            ),
            _NoticeSection(
              title: 'How long we keep it',
              body:
                  'Attendance decisions stay with your academic record. '
                  'Geolocation coordinates, accuracy, and risk signals are '
                  'shredded after the institution retention window (7-90 '
                  'days, default 30). Unlinked denied scan attempts are '
                  'deleted after 90 days.',
            ),
            _NoticeSection(
              title: 'Your rights',
              body:
                  'You may request access, correction, or a copy of your '
                  'records through the Registrar or the Data Protection '
                  'Officer. Disputes and excuse requests are the in-app way to '
                  'contest an attendance entry.',
            ),
            _NoticeSection(
              title: 'Who to contact',
              body:
                  'PUP Santa Maria Data Protection Officer, through the Office '
                  'of the Registrar. Include your student number and the '
                  'specific record you are asking about.',
            ),
          ],
          const SizedBox(height: 16),
          Text(
            'PUBLISHED DATA INVENTORY',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: tokens.muted,
              fontWeight: FontWeight.w700,
              letterSpacing: 1,
            ),
          ),
          const SizedBox(height: 6),
          for (final row in inventory) _InventoryCard(row: row),
        ],
      ),
    );
  }
}

/// Live institution snapshot (consent coverage, shred attestation, breaches).
class PrivacySnapshotView extends StatelessWidget {
  const PrivacySnapshotView({super.key, required this.snapshot});

  final PrivacyCenterSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    final percent = consentCoveragePercent(
      snapshot.consent.covered,
      snapshot.consent.totalActive,
    );
    final ephemeral = snapshot.ephemeral;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: tokens.surface,
            border: Border.all(color: tokens.borderSubtle),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'RETENTION ATTESTATION',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: tokens.muted,
                  fontWeight: FontWeight.w700,
                  letterSpacing: 1,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Geolocation retention: ${snapshot.retentionDays} days',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: tokens.onSurface,
                  fontWeight: FontWeight.w700,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                ephemeral.lastRunAt == null
                    ? 'No shred run has been recorded yet.'
                    : 'Last shred: ${_formatDate(ephemeral.lastRunAt!)} \u00b7 '
                          '${ephemeral.recordsShredded ?? 0} attendance '
                          'rows \u00b7 ${ephemeral.attemptsShredded ?? 0} '
                          'scan attempts',
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: tokens.muted,
                  height: 1.4,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                '0 rows are beyond the retention window.',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: tokens.isDark
                      ? const Color(0xFF86EFAC)
                      : const Color(0xFF15803D),
                  fontWeight: FontWeight.w700,
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 8),
        Row(
          children: [
            Expanded(
              child: _MetricCard(
                label: 'CONSENT COVERAGE',
                value: percent == null ? '-' : '$percent%',
                detail:
                    '${snapshot.consent.covered}/'
                    '${snapshot.consent.totalActive} active accounts',
              ),
            ),
            const SizedBox(width: 8),
            Expanded(
              child: _MetricCard(
                label: 'BREACHES',
                value: '${snapshot.breaches.length}',
                detail: snapshot.breaches.isEmpty
                    ? 'None recorded'
                    : 'Review required',
              ),
            ),
          ],
        ),
      ],
    );
  }

  String _formatDate(String iso) {
    final date = DateTime.tryParse(iso)?.toLocal();
    if (date == null) return iso;
    final hour = date.hour % 12 == 0 ? 12 : date.hour % 12;
    final minute = date.minute.toString().padLeft(2, '0');
    final suffix = date.hour < 12 ? 'AM' : 'PM';
    return '${date.year}-${date.month.toString().padLeft(2, '0')}-'
        '${date.day.toString().padLeft(2, '0')} $hour:$minute $suffix';
  }
}

class _MetricCard extends StatelessWidget {
  const _MetricCard({
    required this.label,
    required this.value,
    required this.detail,
  });

  final String label;
  final String value;
  final String detail;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: tokens.surface,
        border: Border.all(color: tokens.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: tokens.muted,
              fontSize: 9,
              fontWeight: FontWeight.w700,
              letterSpacing: 0.8,
            ),
          ),
          const SizedBox(height: 2),
          Text(
            value,
            style: Theme.of(context).textTheme.titleLarge?.copyWith(
              color: tokens.isDark ? tokens.gold : tokens.maroon,
              fontWeight: FontWeight.w700,
            ),
          ),
          Text(
            detail,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: tokens.muted,
              fontSize: 9,
              height: 1.3,
            ),
          ),
        ],
      ),
    );
  }
}

class _NoticeSection extends StatelessWidget {
  const _NoticeSection({required this.title, required this.body});

  final String title;
  final String body;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: tokens.surface,
        border: Border.all(color: tokens.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: Theme.of(context).textTheme.titleSmall?.copyWith(
              color: tokens.onSurface,
              fontWeight: FontWeight.w700,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            body,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tokens.muted, height: 1.45),
          ),
        ],
      ),
    );
  }
}

class _InventoryCard extends StatelessWidget {
  const _InventoryCard({required this.row});

  final PrivacyDataInventoryRow row;

  @override
  Widget build(BuildContext context) {
    final tokens = PupTheme.of(context);
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: tokens.surface,
        border: Border.all(color: tokens.borderSubtle),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            row.data,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: tokens.onSurface,
              fontWeight: FontWeight.w700,
              height: 1.35,
            ),
          ),
          const SizedBox(height: 3),
          Text(
            row.purpose,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(color: tokens.muted, height: 1.35),
          ),
          const SizedBox(height: 4),
          Text(
            '${row.lawfulBasis} \u00b7 ${row.lifetime}',
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
              color: tokens.muted,
              fontSize: 9,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }
}
